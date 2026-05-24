import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const mockAuthDbRef = vi.hoisted(() => ({ current: null as any }));

interface PerformanceMetrics {
  duration: number;
  memoryBefore: number;
  memoryAfter: number;
  memoryDelta: number;
}

function measurePerformance<T>(fn: () => T): PerformanceMetrics & { result: T } {
  const memoryBefore = process.memoryUsage().heapUsed;
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  const memoryAfter = process.memoryUsage().heapUsed;

  return {
    result,
    duration: end - start,
    memoryBefore,
    memoryAfter,
    memoryDelta: memoryAfter - memoryBefore,
  };
}

async function measureAsyncPerformance<T>(fn: () => Promise<T>): Promise<PerformanceMetrics & { result: T }> {
  const memoryBefore = process.memoryUsage().heapUsed;
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  const memoryAfter = process.memoryUsage().heapUsed;

  return {
    result,
    duration: end - start,
    memoryBefore,
    memoryAfter,
    memoryDelta: memoryAfter - memoryBefore,
  };
}

function calculatePercentile(values: number[], percentile: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

describe('性能基准测试', () => {
  let authDb: any;
  let testDbPath: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    vi.resetModules();

    testDbPath = path.join(process.cwd(), `data/test_perf_bench_${Date.now()}.db`);
    const db = new Database(testDbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

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

      CREATE TABLE IF NOT EXISTS login_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT NOT NULL,
        action TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        success INTEGER DEFAULT 1,
        error_code TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `);

    authDb = {
      database: db,
      SESSION_TIMEOUT_HOURS: 24,
      MAX_LOGIN_ATTEMPTS: 5,
      LOGIN_LOCKOUT_MINUTES: 15,

      generateSalt(length = 32) {
        return require('crypto').randomBytes(length).toString('hex');
      },

      hashPassword(password, salt) {
        return require('crypto').createHash('sha256').update(`${password}${salt}`).digest('hex');
      },

      verifyPassword(password, salt, storedHash) {
        const computedHash = this.hashPassword(password, salt);
        try {
          return require('crypto').timingSafeEqual(
            Buffer.from(computedHash),
            Buffer.from(storedHash)
          );
        } catch {
          return false;
        }
      },

      generateSessionToken() {
        return require('crypto').randomBytes(48).toString('base64url');
      },

      createUser(username, password, role = 'viewer', permissions) {
        const existing = this.getUserByUsername(username);
        if (existing) throw new Error(`用户名 '${username}' 已存在`);
        const salt = this.generateSalt();
        const passwordHash = this.hashPassword(password, salt);
        const defaultPermissions = {
          admin: ['view_jobs', 'view_stats', 'manage_users'],
          operator: ['view_jobs', 'view_stats'],
          viewer: ['view_jobs']
        };
        const finalPermissions = permissions || defaultPermissions[role] || [];
        const result = db.prepare(
          'INSERT INTO users (username, password_hash, salt, role, permissions) VALUES (?, ?, ?, ?, ?)'
        ).run(username, passwordHash, salt, role, JSON.stringify(finalPermissions));
        return this.getUserById(result.lastInsertRowid);
      },

      getUserById(id) {
        const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
        if (!row) return undefined;
        return { id: row.id, username: row.username, role: row.role, isActive: !!row.is_active };
      },

      getUserByUsername(username) {
        const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (!row) return undefined;
        return { id: row.id, username: row.username, role: row.role };
      },

      authenticate(credentials, ipAddress?, userAgent?) {
        const { username, password } = credentials;
        const userRow = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (!userRow) return { success: false, error: '用户名或密码错误' };
        if (userRow.locked_until) {
          const lockedUntil = new Date(userRow.locked_until);
          if (new Date() < lockedUntil) return { success: false, error: '账户已锁定' };
        }
        if (!this.verifyPassword(password, userRow.salt, userRow.password_hash)) {
          return { success: false, error: '用户名或密码错误' };
        }
        const token = this.generateSessionToken();
        const expiresAt = new Date(Date.now() + this.SESSION_TIMEOUT_HOURS * 3600000);
        const sessionId = require('crypto').randomBytes(32).toString('base64url');
        db.prepare(
          'INSERT INTO sessions (id, user_id, token, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(sessionId, userRow.id, token, ipAddress, userAgent, expiresAt.toISOString());
        return { success: true, user: this.getUserById(userRow.id), sessionToken: token };
      },

      validateSession(token) {
        const now = new Date().toISOString();
        const row = db.prepare(
          'SELECT s.*, u.username, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > ?'
        ).get(token, now);
        if (!row) return null;
        return { id: row.user_id, username: row.username, role: row.role };
      },
    };

    authDb.createUser('perfadmin', 'Admin@123', 'admin');
    authDb.createUser('perfviewer', 'Viewer@123', 'viewer');

    mockAuthDbRef.current = authDb;

    vi.mock('@/lib/auth-db', () => ({
      getAuthDb: () => mockAuthDbRef.current,
      AuthDatabase: mockAuthDbRef.current
    }));

    vi.mock('@/lib/logger', () => ({
      logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
    }));
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
    if (authDb && authDb.database) authDb.database.close();
    try {
      const testFiles = fs.readdirSync(path.join(process.cwd(), 'data'))
        .filter(f => f.startsWith('test_perf_bench_'));
      testFiles.forEach(file => {
        const filePath = path.join(process.cwd(), 'data', file);
        try {
          fs.unlinkSync(filePath);
          [filePath + '-wal', filePath + '-shm'].forEach(f => {
            if (fs.existsSync(f)) fs.unlinkSync(f);
          });
        } catch {}
      });
    } catch {}
  });

  describe('1. API响应时间基线测试', () => {
    it('GET /api/auth/me 响应时间 P95 < 200ms', async () => {
      const loginResult = authDb.authenticate({ username: 'perfadmin', password: 'Admin@123' });
      const durations: number[] = [];

      for (let i = 0; i < 50; i++) {
        const { GET } = await import('@/app/api/auth/me/route');
        const req = new NextRequest('http://localhost/api/auth/me', {
          method: 'GET',
          headers: { cookie: `session_token=${loginResult.sessionToken}` }
        });
        const metrics = await measureAsyncPerformance(() => GET(req));
        durations.push(metrics.duration);
      }

      const p95 = calculatePercentile(durations, 95);
      expect(p95).toBeLessThan(200);
    });

    it('POST /api/auth/login 响应时间 P95 < 500ms', async () => {
      const durations: number[] = [];

      for (let i = 0; i < 50; i++) {
        const { POST } = await import('@/app/api/auth/login/route');
        const req = new NextRequest('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'perfviewer', password: 'Viewer@123' })
        });
        const metrics = await measureAsyncPerformance(() => POST(req));
        durations.push(metrics.duration);
      }

      const p95 = calculatePercentile(durations, 95);
      expect(p95).toBeLessThan(500);
    });

    it('单次认证操作 < 50ms', () => {
      const iterations = 100;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const metrics = measurePerformance(() =>
          authDb.authenticate({ username: 'perfadmin', password: 'Admin@123' })
        );
        durations.push(metrics.duration);
      }

      const p95 = calculatePercentile(durations, 95);
      expect(p95).toBeLessThan(50);
    });

    it('批量100次认证操作 < 2s', () => {
      const batchSize = 100;
      const metrics = measurePerformance(() => {
        const results = [];
        for (let i = 0; i < batchSize; i++) {
          results.push(authDb.authenticate({ username: 'perfadmin', password: 'Admin@123' }));
        }
        return results;
      });

      expect(metrics.duration).toBeLessThan(2000);
      expect(metrics.result.length).toBe(batchSize);
      metrics.result.forEach(r => expect(r.success).toBe(true));
    });
  });

  describe('2. 匹配算法性能测试', () => {
    it('不同规则复杂度的耗时对比', async () => {
      const { MatchEngine } = await import('@/lib/match-engine');

      const simpleProfile = {
        name: '测试用户',
        phone: '13800138000',
        email: 'test@test.com',
        skills: ['Python'],
        education: [{ school: '北京大学', major: '计算机科学', degree: '本科', graduationYear: 2024, startDate: '2020-09', endDate: '2024-06' }],
        certifications: [],
        languages: [],
        internships: [],
        projects: [],
        resumeText: '熟悉Python编程，有数据分析经验，北京工作',
      };

      const complexProfile = {
        name: '高级用户',
        phone: '13900139000',
        email: 'complex@test.com',
        skills: ['Python', 'Java', 'JavaScript', 'SQL', 'Excel', '机器学习', '深度学习', '大数据'],
        education: [
          { school: '清华大学', major: '金融工程', degree: '硕士', graduationYear: 2022, startDate: '2019-09', endDate: '2022-06' },
          { school: '复旦大学', major: '数学', degree: '本科', graduationYear: 2019, startDate: '2015-09', endDate: '2019-06' }
        ],
        certifications: ['CFA Level 2', 'CPA'],
        languages: ['英语流利'],
        internships: [
          { company: '中金公司', position: '分析师实习生', duration: '3个月', description: '负责数据分析', startDate: '2021-07', endDate: '2021-10' }
        ],
        projects: [{ name: '量化交易系统', role: '开发者', description: '使用Python开发' }],
        resumeText: '精通Python、Java、机器学习、深度学习，熟悉大数据处理框架，有金融行业经验优先，上海工作',
        targetLocation: '上海',
        targetIndustry: '金融',
      };

      const simpleJob = {
        id: 1,
        title: '初级开发工程师',
        description: '需要Python基础',
        requirements: '本科学历',
        education: '本科',
        location: '北京',
      };

      const complexJob = {
        id: 2,
        title: '高级数据科学家',
        description: '需要精通Python、Java、机器学习、深度学习，熟悉大数据处理框架，有金融行业经验优先',
        requirements: '硕士及以上学历，CFA/CPA优先，5年以上相关经验',
        education: '硕士',
        location: '上海',
        industry: '金融',
      };

      const engine = new MatchEngine();

      const simpleDurations: number[] = [];
      const complexDurations: number[] = [];

      for (let i = 0; i < 50; i++) {
        const simpleMetrics = measurePerformance(() =>
          engine.match(simpleProfile as any, simpleJob as any)
        );
        simpleDurations.push(simpleMetrics.duration);

        const complexMetrics = measurePerformance(() =>
          engine.match(complexProfile as any, complexJob as any)
        );
        complexDurations.push(complexMetrics.duration);
      }

      const simpleP95 = calculatePercentile(simpleDurations, 95);
      const complexP95 = calculatePercentile(complexDurations, 95);

      expect(simpleP95).toBeLessThan(10);
      expect(complexP95).toBeLessThan(20);
    });

    it('内存占用监控 - 批量匹配操作', async () => {
      const { MatchEngine } = await import('@/lib/match-engine');
      const engine = new MatchEngine();

      const profile = {
        name: '内存测试用户',
        phone: '13700137000',
        email: 'memory@test.com',
        skills: ['Python', 'Java', 'SQL'],
        education: [{ school: '浙江大学', major: '计算机', degree: '硕士', graduationYear: 2023, startDate: '2020-09', endDate: '2023-06' }],
        certifications: [],
        languages: [],
        internships: [],
        projects: [],
        resumeText: '熟悉Python和SQL，有3年开发经验，北京工作',
      };

      const job = {
        id: 3,
        title: '测试职位',
        description: '需要Python和SQL技能',
        requirements: '硕士学历',
        education: '硕士',
        location: '北京',
      };

      const gcIfNeeded = () => {
        if (global.gc) global.gc();
      };

      gcIfNeeded();
      const initialMemory = process.memoryUsage().heapUsed;

      const iterations = 1000;
      for (let i = 0; i < iterations; i++) {
        engine.match(profile as any, job as any);
      }

      gcIfNeeded();
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncreaseMB = (finalMemory - initialMemory) / (1024 * 1024);

      expect(memoryIncreaseMB).toBeLessThan(50);
    });

    it('CPU使用率估算 - 高频操作稳定性', async () => {
      const { MatchEngine } = await import('@/lib/match-engine');
      const engine = new MatchEngine();

      const profile = {
        name: 'CPU测试用户',
        phone: '13600136000',
        email: 'cpu@test.com',
        skills: ['Python'],
        education: [{ school: '南京大学', major: '计算机', degree: '本科', graduationYear: 2024, startDate: '2020-09', endDate: '2024-06' }],
        certifications: [],
        languages: [],
        internships: [],
        projects: [],
        resumeText: '熟悉Python，北京工作',
      };

      const job = {
        id: 4,
        title: '测试职位',
        description: '需要Python',
        requirements: '本科学历',
        education: '本科',
        location: '北京',
      };

      const totalTimeMs = 1000;
      const startTime = performance.now();
      let operationCount = 0;

      while (performance.now() - startTime < totalTimeMs) {
        engine.match(profile as any, job as any);
        operationCount++;
      }

      const actualDuration = performance.now() - startTime;
      const opsPerSecond = Math.round(operationCount / (actualDuration / 1000));

      expect(opsPerSecond).toBeGreaterThan(1000);
    });
  });

  describe('3. 数据库查询性能', () => {
    it('简单查询 < 10ms', () => {
      const durations: number[] = [];

      for (let i = 0; i < 100; i++) {
        const metrics = measurePerformance(() =>
          authDb.database.prepare('SELECT * FROM users WHERE username = ?').get('perfadmin')
        );
        durations.push(metrics.duration);
      }

      const p95 = calculatePercentile(durations, 95);
      expect(p95).toBeLessThan(10);
    });

    it('复杂JOIN查询 < 50ms', () => {
      const loginResult = authDb.authenticate({ username: 'perfadmin', password: 'Admin@123' });

      const durations: number[] = [];

      for (let i = 0; i < 50; i++) {
        const metrics = measurePerformance(() =>
          authDb.database.prepare(`
            SELECT s.*, u.username, u.role 
            FROM sessions s 
            JOIN users u ON s.user_id = u.id 
            WHERE s.token = ? AND u.is_active = 1
          `).get(loginResult.sessionToken)
        );
        durations.push(metrics.duration);
      }

      const p95 = calculatePercentile(durations, 95);
      expect(p95).toBeLessThan(50);
    });

    it('批量插入性能 - 100条记录 < 500ms', () => {
      const insertStmt = authDb.database.prepare(
        'INSERT INTO login_logs (username, action, success) VALUES (?, ?, ?)'
      );

      const batchInsert = authDb.database.transaction((count: number) => {
        for (let i = 0; i < count; i++) {
          insertStmt.run(`test_user_${i}`, 'login_success', 1);
        }
      });

      const metrics = measurePerformance(() => batchInsert(100));

      expect(metrics.duration).toBeLessThan(500);

      const count = authDb.database.prepare('SELECT COUNT(*) as cnt FROM login_logs').get() as any;
      expect(count.cnt).toBeGreaterThanOrEqual(100);
    });

    it('索引查询 vs 全表扫描性能对比', () => {
      for (let i = 0; i < 50; i++) {
        authDb.database.prepare(
          "INSERT INTO login_logs (username, action, success) VALUES (?, ?, ?)"
        ).run(`bench_user_${i}`, i % 2 === 0 ? 'login_success' : 'login_failed', 1);
      }

      const indexedDurations: number[] = [];
      const nonIndexedDurations: number[] = [];

      for (let i = 0; i < 20; i++) {
        const indexedMetrics = measurePerformance(() =>
          authDb.database.prepare(
            "SELECT * FROM login_logs WHERE username = ?"
          ).get('bench_user_0')
        );
        indexedDurations.push(indexedMetrics.duration);

        const nonIndexedMetrics = measurePerformance(() =>
          authDb.database.prepare(
            "SELECT * FROM login_logs WHERE error_code IS NULL"
          ).all()
        );
        nonIndexedDurations.push(nonIndexedMetrics.duration);
      }

      const indexedAvg = indexedDurations.reduce((a, b) => a + b, 0) / indexedDurations.length;
      const nonIndexedAvg = nonIndexedDurations.reduce((a, b) => a + b, 0) / nonIndexedDurations.length;

      expect(indexedAvg).toBeLessThan(nonIndexedAvg * 2);
    });
  });

  describe('4. 并发负载测试', () => {
    it('10并发登录请求响应时间稳定', async () => {
      const concurrency = 10;
      const { POST } = await import('@/app/api/auth/login/route');

      const requests = Array(concurrency).fill(null).map(() =>
        new NextRequest('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'perfadmin', password: 'Admin@123' })
        })
      );

      const start = performance.now();
      const responses = await Promise.all(requests.map(req => POST(req)));
      const totalDuration = performance.now() - start;

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      const avgPerRequest = totalDuration / concurrency;
      expect(avgPerRequest).toBeLessThan(200);
    });

    it('50并发请求系统稳定性', async () => {
      const concurrency = 50;
      const { POST } = await import('@/app/api/auth/login/route');

      const requests = Array(concurrency).fill(null).map((_, i) =>
        new NextRequest('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: i % 2 === 0 ? 'perfadmin' : 'perfviewer',
            password: i % 2 === 0 ? 'Admin@123' : 'Viewer@123'
          })
        })
      );

      const start = performance.now();
      const responses = await Promise.allSettled(requests.map(req => POST(req)));
      const totalDuration = performance.now() - start;

      const successful = responses.filter(r => r.status === 'fulfilled').length;
      const successRate = (successful / concurrency) * 100;

      expect(successRate).toBeGreaterThan(95);

      const avgPerRequest = totalDuration / concurrency;
      expect(avgPerRequest).toBeLessThan(500);
    });

    it('100并发请求无崩溃', async () => {
      const concurrency = 100;
      const { GET } = await import('@/app/api/auth/me/route');

      const loginResult = authDb.authenticate({ username: 'perfadmin', password: 'Admin@123' });

      const requests = Array(concurrency).fill(null).map(() =>
        new NextRequest('http://localhost/api/auth/me', {
          method: 'GET',
          headers: { cookie: `session_token=${loginResult.sessionToken}` }
        })
      );

      const responses = await Promise.allSettled(requests.map(req => GET(req)));

      const errors = responses.filter(r => r.status === 'rejected');
      expect(errors.length).toBe(0);

      const fulfilled = responses.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<Response>[];
      fulfilled.forEach(f => {
        expect([200, 401]).toContain(f.value.status);
      });
    });

    it('高并发下内存泄漏检测', async () => {
      const { GET } = await import('@/app/api/auth/me/route');
      const loginResult = authDb.authenticate({ username: 'perfadmin', password: 'Admin@123' });

      const gcIfNeeded = () => { if (global.gc) global.gc(); };
      gcIfNeeded();
      const memBefore = process.memoryUsage().heapUsed;

      const batches = 5;
      const perBatch = 50;

      for (let batch = 0; batch < batches; batch++) {
        const requests = Array(perBatch).fill(null).map(() =>
          new NextRequest('http://localhost/api/auth/me', {
            method: 'GET',
            headers: { cookie: `session_token=${loginResult.sessionToken}` }
          })
        );
        await Promise.all(requests.map(req => GET(req)));
      }

      gcIfNeeded();
      const memAfter = process.memoryUsage().heapUsed;
      const memIncreaseMB = (memAfter - memBefore) / (1024 * 1024);

      expect(memIncreaseMB).toBeLessThan(20);
    });
  });

  describe('5. 性能基线报告生成', () => {
    it('生成完整性能报告', async () => {
      const report: Record<string, any> = {};

      const loginResult = authDb.authenticate({ username: 'perfadmin', password: 'Admin@123' });

      const loginDurations: number[] = [];
      for (let i = 0; i < 30; i++) {
        const { POST } = await import('@/app/api/auth/login/route');
        const req = new NextRequest('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'perfviewer', password: 'Viewer@123' })
        });
        const m = await measureAsyncPerformance(() => POST(req));
        loginDurations.push(m.duration);
      }

      const meDurations: number[] = [];
      for (let i = 0; i < 30; i++) {
        const { GET } = await import('@/app/api/auth/me/route');
        const req = new NextRequest('http://localhost/api/auth/me', {
          method: 'GET',
          headers: { cookie: `session_token=${loginResult.sessionToken}` }
        });
        const m = await measureAsyncPerformance(() => GET(req));
        meDurations.push(m.duration);
      }

      const authOpDurations: number[] = [];
      for (let i = 0; i < 100; i++) {
        const m = measurePerformance(() =>
          authDb.authenticate({ username: 'perfadmin', password: 'Admin@123' })
        );
        authOpDurations.push(m.duration);
      }

      report.loginAPI = {
        samples: loginDurations.length,
        avg: loginDurations.reduce((a, b) => a + b, 0) / loginDurations.length,
        p50: calculatePercentile(loginDurations, 50),
        p95: calculatePercentile(loginDurations, 95),
        p99: calculatePercentile(loginDurations, 99),
        min: Math.min(...loginDurations),
        max: Math.max(...loginDurations),
      };

      report.meAPI = {
        samples: meDurations.length,
        avg: meDurations.reduce((a, b) => a + b, 0) / meDurations.length,
        p50: calculatePercentile(meDurations, 50),
        p95: calculatePercentile(meDurations, 95),
        p99: calculatePercentile(meDurations, 99),
      };

      report.authOperation = {
        samples: authOpDurations.length,
        avg: authOpDurations.reduce((a, b) => a + b, 0) / authOpDurations.length,
        p50: calculatePercentile(authOpDurations, 50),
        p95: calculatePercentile(authOpDurations, 95),
      };

      report.timestamp = new Date().toISOString();
      report.nodeVersion = process.version;
      report.platform = process.platform;
      report.memoryUsage = {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      };

      expect(report.loginAPI.p95).toBeLessThan(500);
      expect(report.meAPI.p95).toBeLessThan(200);
      expect(report.authOperation.p95).toBeLessThan(50);

      console.log('\n========== 性能基线报告 ==========');
      console.log(JSON.stringify(report, null, 2));
      console.log('====================================\n');
    });
  });
});
