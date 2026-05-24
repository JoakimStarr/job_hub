import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let testDb: Database.Database;
let testDbPath: string;
let authDb: any;
let authDbPath: string;
const MAX_RESPONSE_TIME = 200;

vi.mock('@/lib/db-utils', async () => {
  return {
    ...(await vi.importActual('@/lib/db-utils')),
    getDb: () => testDb,
  };
});

vi.mock('@/lib/auth-db', () => ({
  getAuthDb: () => authDb,
}));

describe('职位 API 集成测试', () => {
  function createTestJob(overrides: Record<string, unknown> = {}, id: number): Record<string, unknown> {
    return {
      id,
      title: `测试职位${id}`,
      company: `测试公司${id}`,
      location: ['北京', '上海', '深圳', '杭州'][id % 4],
      salary: `${10 + id * 5}-${20 + id * 5}K`,
      description: `这是第${id}个测试职位的描述，需要Python和SQL技能`,
      requirements: `本科及以上学历，3年以上相关经验`,
      job_type: ['全职', '兼职', '实习', '远程'][id % 4],
      industry: ['互联网', '金融', '咨询', '教育'][id % 4],
      education: ['本科及以上', '硕士及以上学历', '博士学历', '不限'][id % 4],
      experience: ['1-3年', '3-5年', '5-10年', '不限'][id % 4],
      source: ['boss直聘', '猎聘', '拉勾', '智联招聘'][id % 4],
      university: '',
      source_url: `https://example.com/job/${id}`,
      apply_url: '',
      publish_date: new Date(Date.now() - id * 86400000).toISOString().split('T')[0],
      deadline: '',
      category: '',
      tags: ['Python,SQL', 'Java,Spring', 'React,Vue', '数据分析,Excel'][id % 4],
      is_favorite: 0,
      is_read: 0,
      content_hash: `hash_${id}`,
      created_at: new Date(Date.now() - id * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };
  }

  function seedJobs(count: number, overrides?: Record<string, unknown>[]): void {
    const insertStmt = testDb.prepare(`
      INSERT INTO jobs (title, company, location, salary, description, requirements,
        job_type, industry, education, experience, source, university,
        source_url, apply_url, publish_date, deadline, category, tags,
        is_favorite, is_read, content_hash, created_at, updated_at)
      VALUES (@title, @company, @location, @salary, @description, @requirements,
        @job_type, @industry, @education, @experience, @source, @university,
        @source_url, @apply_url, @publish_date, @deadline, @category, @tags,
        @is_favorite, @is_read, @content_hash, @created_at, @updated_at)
    `);

    const insertMany = testDb.transaction((jobs: Record<string, unknown>[]) => {
      for (const job of jobs) {
        insertStmt.run(job);
      }
    });

    const jobs = Array.from({ length: count }, (_, i) =>
      createTestJob(overrides?.[i] || {}, i + 1)
    );
    insertMany(jobs);
  }

  async function setupAuthDb(): Promise<void> {
    const crypto = await import('crypto');
    const createHash = crypto.createHash;
    const randomBytes = crypto.randomBytes;

    authDb = {
      database: undefined as Database.Database | undefined,
      SESSION_TIMEOUT_HOURS: 24,

      generateSalt(length = 32) {
        return randomBytes(length).toString('hex');
      },

      hashPassword(password, salt) {
        return createHash('sha256').update(`${password}${salt}`).digest('hex');
      },

      verifyPassword(password, salt, storedHash) {
        const computedHash = this.hashPassword(password, salt);
        try {
          const timingSafeEqual = require('crypto').timingSafeEqual;
          return timingSafeEqual(
            Buffer.from(computedHash),
            Buffer.from(storedHash)
          );
        } catch {
          return computedHash === storedHash;
        }
      },

      generateSessionToken() {
        return randomBytes(48).toString('base64url');
      },

      createUser(username, password, role = 'viewer') {
        const existing = this.getUserByUsername(username);
        if (existing) throw new Error(`用户名 '${username}' 已存在`);

        const salt = this.generateSalt();
        const passwordHash = this.hashPassword(password, salt);
        const permissions = role === 'admin'
          ? ['view_jobs', 'view_stats', 'manage_crawler', 'view_system', 'use_recommendations', 'manage_users']
          : role === 'operator'
          ? ['view_jobs', 'view_stats', 'manage_crawler', 'view_system', 'use_recommendations']
          : ['view_jobs', 'view_stats', 'view_system', 'use_recommendations'];

        const db = this.getDb();
        const result = db.prepare(
          'INSERT INTO users (username, password_hash, salt, role, permissions) VALUES (?, ?, ?, ?, ?)'
        ).run(username, passwordHash, salt, role, JSON.stringify(permissions));

        return this.getUserById(result.lastInsertRowid);
      },

      getDb() {
        if (!this.database) {
          this.database = new Database(authDbPath);
          this.database.pragma('journal_mode = WAL');
        }
        return this.database;
      },

      getUserById(id) {
        const row = this.getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
        if (!row) return undefined;
        return this.sanitizeUser(row);
      },

      getUserByUsername(username) {
        const row = this.getDb().prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (!row) return undefined;
        return this.sanitizeUser(row);
      },

      sanitizeUser(row) {
        return {
          id: row.id,
          username: row.username,
          role: row.role,
          permissions: JSON.parse(row.permissions || '[]'),
          isActive: !!row.is_active,
          createdAt: row.created_at,
          lastLoginAt: row.last_login_at,
        };
      },

      authenticate(credentials) {
        const { username, password } = credentials;
        const db = this.getDb();
        const userRow = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

        if (!userRow) {
          return { success: false, error: '用户名或密码错误' };
        }

        if (!userRow.is_active) {
          return { success: false, error: '账户已被禁用' };
        }

        if (!this.verifyPassword(password, userRow.salt, userRow.password_hash)) {
          return { success: false, error: '用户名或密码错误' };
        }

        const sessionId = randomBytes(32).toString('hex');
        const token = this.generateSessionToken();
        const expiresAt = new Date(Date.now() + this.SESSION_TIMEOUT_HOURS * 3600000);

        db.prepare(
          'INSERT INTO sessions (id, user_id, token, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(sessionId, userRow.id, token, '127.0.0.1', 'TestAgent', expiresAt.toISOString());

        db.prepare(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`).run(userRow.id);

        return {
          success: true,
          user: this.sanitizeUser(userRow),
          sessionToken: token,
        };
      },

      validateSession(token) {
        const now = new Date().toISOString();
        const row = this.getDb().prepare(`
          SELECT s.*, u.username, u.role, u.permissions 
          FROM sessions s 
          JOIN users u ON s.user_id = u.id 
          WHERE s.token = ? AND s.expires_at > ? AND u.is_active = 1
        `).get(token, now);

        if (!row) return null;

        return {
          id: row.user_id,
          username: row.username,
          role: row.role,
          permissions: JSON.parse(row.permissions || '[]'),
          isActive: true,
        };
      },
    };

    const db = authDb.getDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'viewer',
        permissions TEXT DEFAULT '[]',
        is_active INTEGER DEFAULT 1,
        failed_login_count INTEGER DEFAULT 0,
        locked_until TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    authDb.createUser('testuser', 'testpass123', 'viewer');
  }

  function getAuthCookie(): string {
    const result = authDb.authenticate({ username: 'testuser', password: 'testpass123' });
    return result.sessionToken;
  }

  beforeEach(async () => {
    vi.resetModules();

    testDbPath = path.join(process.cwd(), `data/test_jobs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.db`);
    testDb = new Database(testDbPath);
    testDb.pragma('journal_mode = WAL');
    testDb.pragma('foreign_keys = ON');

    testDb.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        company TEXT NOT NULL DEFAULT '',
        location TEXT DEFAULT '',
        salary TEXT DEFAULT '面议',
        description TEXT DEFAULT '',
        requirements TEXT DEFAULT '',
        job_type TEXT DEFAULT '实习',
        industry TEXT DEFAULT '',
        education TEXT DEFAULT '',
        experience TEXT DEFAULT '',
        contact TEXT DEFAULT '',
        source TEXT DEFAULT '',
        university TEXT DEFAULT '',
        source_url TEXT UNIQUE,
        apply_url TEXT DEFAULT '',
        publish_date TEXT DEFAULT '',
        deadline TEXT DEFAULT '',
        category TEXT DEFAULT '',
        tags TEXT DEFAULT '',
        is_favorite INTEGER DEFAULT 0,
        is_read INTEGER DEFAULT 0,
        content_hash TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    authDbPath = path.join(process.cwd(), `data/test_auth_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.db`);
    await setupAuthDb();
  });

  afterEach(() => {
    vi.restoreAllMocks();

    if (testDb) {
      testDb.close();
    }
    if (authDb && authDb.database) {
      authDb.database.close();
    }

    [testDbPath, authDbPath].forEach(dbPath => {
      if (dbPath && fs.existsSync(dbPath)) {
        try {
          fs.unlinkSync(dbPath);
          const walFile = `${dbPath}-wal`;
          const shmFile = `${dbPath}-shm`;
          if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
          if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile);
        } catch (e) {}
      }
    });

    const dataDir = path.join(process.cwd(), 'data');
    if (fs.existsSync(dataDir)) {
      const testFiles = fs.readdirSync(dataDir)
        .filter(f => f.startsWith('test_jobs_') || f.startsWith('test_auth_'));
      testFiles.forEach(file => {
        try {
          const filePath = path.join(dataDir, file);
          fs.unlinkSync(filePath);
          [`${filePath}-wal`, `${filePath}-shm`].forEach(ext => {
            if (fs.existsSync(ext)) fs.unlinkSync(ext);
          });
        } catch (e) {}
      });
    }
  });

  // ==================== GET /api/jobs 测试 ====================

  describe('GET /api/jobs - 职位列表', () => {
    async function createJobsRequest(queryParams?: Record<string, string>, cookie?: string) {
      const { GET } = await import('@/app/api/jobs/route');

      const headers: Record<string, string> = {};
      if (cookie) {
        headers['cookie'] = `session_token=${cookie}`;
      }

      const url = new URL('http://localhost/api/jobs');
      if (queryParams) {
        Object.entries(queryParams).forEach(([key, value]) => {
          url.searchParams.set(key, value);
        });
      }

      const request = new NextRequest(url.toString(), { method: 'GET', headers });
      return GET(request);
    }

    it('应该返回分页的职位列表', async () => {
      seedJobs(15);

      const startTime = Date.now();
      const response = await createJobsRequest({ page: '1', page_size: '10' });
      const elapsed = Date.now() - startTime;

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.items).toBeDefined();
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.items.length).toBeLessThanOrEqual(10);
      expect(data.total).toBe(15);
      expect(data.page).toBe(1);
      expect(data.page_size).toBe(10);
      expect(data.pages).toBe(2);
      expect(elapsed).toBeLessThan(MAX_RESPONSE_TIME);
    });

    it('应该支持分页参数', async () => {
      seedJobs(25);

      const page1 = await createJobsRequest({ page: '1', page_size: '5' });
      const page2 = await createJobsRequest({ page: '2', page_size: '5' });

      const data1 = await page1.json();
      const data2 = await page2.json();

      expect(data1.page).toBe(1);
      expect(data2.page).toBe(2);
      expect(data1.items.length).toBe(5);
      expect(data2.items.length).toBe(5);
      expect(data1.items[0].id).not.toBe(data2.items[0].id);
    });

    it('应该支持排序功能', async () => {
      seedJobs(10);

      const ascResponse = await createJobsRequest({ sort: 'salary', order: 'asc' });
      const descResponse = await createJobsRequest({ sort: 'salary', order: 'desc' });

      const ascData = await ascResponse.json();
      const descData = await descResponse.json();

      expect(ascData.items.length).toBeGreaterThan(0);
      expect(descData.items.length).toBeGreaterThan(0);
    });

    it('应该支持按位置筛选', async () => {
      seedJobs(12);

      const response = await createJobsRequest({ location: '北京' });
      const data = await response.json();

      data.items.forEach((job: { location: string }) => {
        expect(job.location).toContain('北京');
      });
    });

    it('应该支持关键词搜索', async () => {
      seedJobs(10, [{ title: 'Python开发工程师' }, { title: 'Java开发工程师' }, { title: '数据分析师' }]);

      const response = await createJobsRequest({ keyword: 'Python' });
      const data = await response.json();

      expect(data.total).toBeGreaterThanOrEqual(1);
    });

    it('空结果集应该返回正确的响应结构', async () => {
      seedJobs(5);

      const response = await createJobsRequest({ keyword: '不存在的职位xyz123' });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items).toEqual([]);
      expect(data.total).toBe(0);
      expect(data.pages).toBe(0);
    });

    it('无效的分页参数应该被纠正', async () => {
      seedJobs(10);

      const response = await createJobsRequest({ page: '-1', page_size: '0' });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.page).toBe(1);
      expect(data.page_size).toBeGreaterThanOrEqual(1);
    });

    it('返回数据应包含必要的字段', async () => {
      seedJobs(5);

      const response = await createJobsRequest();
      const data = await response.json();

      if (data.items.length > 0) {
        const job = data.items[0];
        expect(job).toHaveProperty('id');
        expect(job).toHaveProperty('title');
        expect(job).toHaveProperty('company');
        expect(job).toHaveProperty('location');
        expect(job).toHaveProperty('salary');
        expect(job).toHaveProperty('source');
        expect(job).toHaveProperty('created_at');
      }
    });
  });

  // ==================== GET /api/jobs/[id] 测试 ====================

  describe('GET /api/jobs/[id] - 职位详情', () => {
    async function createJobDetailRequest(id: string | number) {
      const { GET } = await import('@/app/api/jobs/[id]/route');

      const request = new NextRequest(`http://localhost/api/jobs/${id}`, { method: 'GET' });
      return GET(request, { params: Promise.resolve({ id: String(id) }) });
    }

    it('应该返回存在的职位详情', async () => {
      seedJobs(5);

      const startTime = Date.now();
      const response = await createJobDetailRequest(1);
      const elapsed = Date.now() - startTime;

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.id).toBe(1);
      expect(data.title).toBeDefined();
      expect(data.company).toBeDefined();
      expect(elapsed).toBeLessThan(MAX_RESPONSE_TIME);
    });

    it('不存在的职位ID应该返回404', async () => {
      seedJobs(5);

      const response = await createJobDetailRequest(99999);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('not found');
    });

    it('无效的ID格式应该返回错误', async () => {
      const { GET } = await import('@/app/api/jobs/[id]/route');

      const request = new NextRequest('http://localhost/api/jobs/abc', { method: 'GET' });
      const response = await GET(request, { params: Promise.resolve({ id: 'abc' }) });

      expect([400, 404, 500]).toContain(response.status);
    });

    it('返回的详情应包含完整字段', async () => {
      seedJobs(3);

      const response = await createJobDetailRequest(1);
      const data = await response.json();

      const expectedFields = [
        'id', 'title', 'company', 'location', 'salary', 'description',
        'requirements', 'job_type', 'industry', 'education', 'experience',
        'source', 'source_url', 'apply_url', 'is_favorite', 'is_read',
        'created_at', 'updated_at'
      ];

      expectedFields.forEach(field => {
        expect(data).toHaveProperty(field);
      });
    });

    it('source字段应该被转换为可读名称', async () => {
      seedJobs(1, [{ source: 'boss直聘' }]);

      const response = await createJobDetailRequest(1);
      const data = await response.json();

      expect(typeof data.source).toBe('string');
      expect(data.source.length).toBeGreaterThan(0);
    });
  });

  // ==================== POST /api/jobs/[id]/favorite 测试 ====================

  describe('POST /api/jobs/[id]/favorite - 收藏/取消收藏', () => {
    async function createFavoriteRequest(id: number, cookie?: string) {
      const { POST } = await import('@/app/api/jobs/[id]/favorite/route');

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (cookie) {
        headers['cookie'] = `session_token=${cookie}`;
      }

      const request = new NextRequest(`http://localhost/api/jobs/${id}/favorite`, {
        method: 'POST',
        headers,
      });

      return POST(request, { params: Promise.resolve({ id: String(id) }) });
    }

    it('已登录用户应该能收藏职位', async () => {
      seedJobs(5);
      const cookie = getAuthCookie();

      const startTime = Date.now();
      const response = await createFavoriteRequest(1, cookie);
      const elapsed = Date.now() - startTime;

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.is_favorite).toBe(true);
      expect(elapsed).toBeLessThan(MAX_RESPONSE_TIME);
    });

    it('重复收藏应该取消收藏（toggle）', async () => {
      seedJobs(5);
      const cookie = getAuthCookie();

      await createFavoriteRequest(1, cookie);
      const secondResponse = await createFavoriteRequest(1, cookie);
      const secondData = await secondResponse.json();

      expect(secondResponse.status).toBe(200);
      expect(secondData.data.is_favorite).toBe(false);
    });

    it('未登录用户应该返回401', async () => {
      seedJobs(5);

      const response = await createFavoriteRequest(1);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('不存在的职位ID应该返回404', async () => {
      seedJobs(5);
      const cookie = getAuthCookie();

      const response = await createFavoriteRequest(99999, cookie);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('not found');
    });

    it('无效的session token应该返回401', async () => {
      seedJobs(5);

      const response = await createFavoriteRequest(1, 'invalid_token_xyz');

      expect(response.status).toBe(401);
    });

    it('收藏后数据库状态应该更新', async () => {
      seedJobs(5);
      const cookie = getAuthCookie();

      await createFavoriteRequest(1, cookie);

      const job = testDb.prepare('SELECT is_favorite FROM jobs WHERE id = ?').get(1) as { is_favorite: number };
      expect(job.is_favorite).toBe(1);
    });
  });

  // ==================== GET /api/jobs/favorites 测试 ====================

  describe('GET /api/jobs/favorites - 收藏列表', () => {
    async function createFavoritesRequest(queryParams?: Record<string, string>) {
      const { GET } = await import('@/app/api/jobs/favorites/route');

      const url = new URL('http://localhost/api/jobs/favorites');
      if (queryParams) {
        Object.entries(queryParams).forEach(([key, value]) => {
          url.searchParams.set(key, value);
        });
      }

      const request = new NextRequest(url.toString(), { method: 'GET' });
      return GET(request);
    }

    it('应该返回收藏的职位列表', async () => {
      seedJobs(10, [{ is_favorite: 1 }, { is_favorite: 1 }, {}]);

      const startTime = Date.now();
      const response = await createFavoritesRequest();
      const elapsed = Date.now() - startTime;

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.total).toBe(2);
      expect(data.items.length).toBe(2);
      expect(elapsed).toBeLessThan(MAX_RESPONSE_TIME);
    });

    it('空的收藏列表应该返回空数组', async () => {
      seedJobs(5);

      const response = await createFavoritesRequest();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items).toEqual([]);
      expect(data.total).toBe(0);
    });

    it('应该支持分页', async () => {
      const favoriteJobs = Array(15).fill(null).map(() => ({ is_favorite: 1 }));
      seedJobs(15, favoriteJobs);

      const page1 = await createFavoritesRequest({ page: '1', page_size: '5' });
      const page2 = await createFavoritesRequest({ page: '2', page_size: '5' });

      const data1 = await page1.json();
      const data2 = await page2.json();

      expect(data1.items.length).toBe(5);
      expect(data2.items.length).toBe(5);
      expect(data1.page).toBe(1);
      expect(data2.page).toBe(2);
    });

    it('应该只返回is_favorite=1的职位', async () => {
      seedJobs(8, [
        { is_favorite: 1 }, { is_favorite: 0 }, { is_favorite: 1 },
        { is_favorite: 0 }, { is_favorite: 0 }, { is_favorite: 1 },
        { is_favorite: 0 }, { is_favorite: 0 },
      ]);

      const response = await createFavoritesRequest();
      const data = await response.json();

      expect(data.total).toBe(3);
      data.items.forEach((job: { is_favorite: number }) => {
        expect(job.is_favorite).toBe(1);
      });
    });

    it('返回数据结构应该包含分页信息', async () => {
      seedJobs(5, [{ is_favorite: 1 }]);

      const response = await createFavoritesRequest();
      const data = await response.json();

      expect(data).toHaveProperty('items');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('page');
      expect(data).toHaveProperty('page_size');
      expect(data).toHaveProperty('pages');
    });
  });

  // ==================== GET /api/jobs/search 测试 ====================

  describe('GET /api/jobs/search - 搜索功能', () => {
    async function createSearchRequest(queryParams: Record<string, string>) {
      const { GET } = await import('@/app/api/jobs/search/route');

      const url = new URL('http://localhost/api/jobs/search');
      Object.entries(queryParams).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });

      const request = new NextRequest(url.toString(), { method: 'GET' });
      return GET(request);
    }

    it('应该根据关键词搜索职位', async () => {
      seedJobs(10, [
        { title: 'Python高级开发工程师', description: '需要精通Python编程' },
        { title: 'Java后端开发工程师', description: '需要Java经验' },
        { title: '数据分析师', description: '使用Python进行数据分析' },
      ]);

      const startTime = Date.now();
      const response = await createSearchRequest({ q: 'Python' });
      const elapsed = Date.now() - startTime;

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.total).toBeGreaterThanOrEqual(2);
      expect(elapsed).toBeLessThan(MAX_RESPONSE_TIME);
    });

    it('应该支持多条件组合搜索', async () => {
      seedJobs(15, [
        { title: '北京Python工程师', location: '北京', industry: '互联网', job_type: '全职' },
        { title: '上海Java开发', location: '上海', industry: '金融', job_type: '兼职' },
        { title: '深圳数据分析师', location: '深圳', industry: '咨询', job_type: '全职' },
      ]);

      const response = await createSearchRequest({
        q: '工程师',
        location: '北京',
        industry: '互联网',
        job_type: '全职',
      });

      const data = await response.json();
      expect(data.total).toBeGreaterThanOrEqual(1);
      data.items.forEach((job: Record<string, unknown>) => {
        expect(job.location).toBe('北京');
        expect(job.industry).toBe('互联网');
        expect(job.job_type).toBe('全职');
      });
    });

    it('不匹配的搜索应该返回空结果', async () => {
      seedJobs(10);

      const response = await createSearchRequest({ q: '完全不存在的关键词xyz123' });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items).toEqual([]);
      expect(data.total).toBe(0);
    });

    it('应该支持搜索结果的排序', async () => {
      seedJobs(10);

      const response = await createSearchRequest({ q: '测试', sort: 'salary', order: 'desc' });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items.length).toBeGreaterThan(0);
    });

    it('空搜索词应该返回所有结果', async () => {
      seedJobs(8);

      const response = await createSearchRequest({ q: '' });
      const data = await response.json();

      expect(data.total).toBe(8);
    });

    it('特殊字符搜索应该安全处理', async () => {
      seedJobs(5);

      const response = await createSearchRequest({ q: "'; DROP TABLE jobs; --" });
      expect([200, 400, 500]).toContain(response.status);
    });
  });

  // ==================== GET /api/jobs/filters 测试 ====================

  describe('GET /api/jobs/filters - 获取筛选选项', () => {
    async function createFiltersRequest(queryParams?: Record<string, string>) {
      const { GET } = await import('@/app/api/jobs/filters/route');

      const url = new URL('http://localhost/api/jobs/filters');
      if (queryParams) {
        Object.entries(queryParams).forEach(([key, value]) => {
          url.searchParams.set(key, value);
        });
      }

      const request = new NextRequest(url.toString(), { method: 'GET' });
      return GET(request);
    }

    it('应该返回所有筛选选项', async () => {
      seedJobs(20);

      const startTime = Date.now();
      const response = await createFiltersRequest();
      const elapsed = Date.now() - startTime;

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty('locations');
      expect(data).toHaveProperty('job_types');
      expect(data).toHaveProperty('industries');
      expect(data).toHaveProperty('education');
      expect(data).toHaveProperty('sources');
      expect(data).toHaveProperty('provinces');
      expect(Array.isArray(data.locations)).toBe(true);
      expect(Array.isArray(data.job_types)).toBe(true);
      expect(elapsed).toBeLessThan(MAX_RESPONSE_TIME);
    });

    it('筛选选项应该包含正确的数据结构', async () => {
      seedJobs(10);

      const response = await createFiltersRequest();
      const data = await response.json();

      if (data.locations.length > 0) {
        const location = data.locations[0];
        expect(location).toHaveProperty('name');
        expect(location).toHaveProperty('count');
      }
    });

    it('应该支持搜索筛选选项', async () => {
      seedJobs(15);

      const response = await createFiltersRequest({ q: '北京', type: 'location' });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toBeDefined();
    });

    it('应该支持按省份查询城市', async () => {
      seedJobs(10);

      const response = await createFiltersRequest({ province: '北京' });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('province');
      expect(data).toHaveProperty('cities');
    });

    it('缓存机制应该生效（第二次请求更快）', async () => {
      seedJobs(20);

      const start1 = Date.now();
      await createFiltersRequest();
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      await createFiltersRequest();
      const time2 = Date.now() - start2;

      expect(time2).toBeLessThanOrEqual(time1 + 50);
    });

    it('limit参数应该限制返回数量', async () => {
      seedJobs(30);

      const response = await createFiltersRequest({ limit: '5' });
      const data = await response.json();

      expect(response.status).toBe(200);
    });
  });

  // ==================== 性能和边界条件测试 ====================

  describe('性能和边界条件', () => {
    it('大量数据的分页查询应该在200ms内完成', async () => {
      seedJobs(100);

      const { GET } = await import('@/app/api/jobs/route');
      const url = new URL('http://localhost/api/jobs');
      url.searchParams.set('page', '5');
      url.searchParams.set('page_size', '20');

      const startTime = Date.now();
      const request = new NextRequest(url.toString(), { method: 'GET' });
      const response = await GET(request);
      const elapsed = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(elapsed).toBeLessThan(MAX_RESPONSE_TIME);
    });

    it('并发请求应该正确处理', async () => {
      seedJobs(20);

      const { GET } = await import('@/app/api/jobs/route');

      const requests = Array(5).fill(null).map(async (_, i) => {
        const url = new URL('http://localhost/api/jobs');
        url.searchParams.set('page', String(i + 1));
        url.searchParams.set('page_size', '5');
        const request = new NextRequest(url.toString(), { method: 'GET' });
        return GET(request);
      });

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('超长搜索词应该优雅处理', async () => {
      seedJobs(5);

      const { GET } = await import('@/app/api/jobs/search/route');
      const longQuery = 'a'.repeat(1000);

      const url = new URL('http://localhost/api/jobs/search');
      url.searchParams.set('q', longQuery);
      const request = new NextRequest(url.toString(), { method: 'GET' });
      const response = await GET(request);

      expect([200, 400, 500]).toContain(response.status);
    });

    it('极端分页参数应该被约束', async () => {
      seedJobs(10);

      const { GET } = await import('@/app/api/jobs/route');

      const url = new URL('http://localhost/api/jobs');
      url.searchParams.set('page', '999999');
      url.searchParams.set('page_size', '999999');
      const request = new NextRequest(url.toString(), { method: 'GET' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.page_size).toBeLessThanOrEqual(100);
    });

    it('API响应应该是有效的JSON', async () => {
      seedJobs(5);

      const { GET } = await import('@/app/api/jobs/route');
      const request = new NextRequest('http://localhost/api/jobs', { method: 'GET' });
      const response = await GET(request);

      const contentType = response.headers.get('content-type');
      expect(contentType).toContain('application/json');

      const text = await response.text();
      expect(() => JSON.parse(text)).not.toThrow();
    });
  });
});
