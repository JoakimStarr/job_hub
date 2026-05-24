import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const mockAuthDbRef = vi.hoisted(() => ({ current: null as any }));

describe('增强版认证 API 集成测试', () => {
  let authDb: any;
  let originalEnv: NodeJS.ProcessEnv;
  let testDbPath: string;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    vi.resetModules();

    testDbPath = path.join(process.cwd(), `data/test_integration_auth_${Date.now()}.db`);
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
        device_type TEXT,
        browser TEXT,
        os TEXT,
        success INTEGER DEFAULT 1,
        error_code TEXT,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_login_logs_user_id ON login_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_login_logs_created_at ON login_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_login_logs_action ON login_logs(action);
    `);

    authDb = {
      database: db,
      SESSION_TIMEOUT_HOURS: 24,
      MAX_LOGIN_ATTEMPTS: 5,
      LOGIN_LOCKOUT_MINUTES: 15,

      generateSalt(length = 32) {
        return crypto.randomBytes(length).toString('hex');
      },

      hashPassword(password, salt) {
        return crypto.createHash('sha256').update(`${password}${salt}`).digest('hex');
      },

      verifyPassword(password, salt, storedHash) {
        const computedHash = this.hashPassword(password, salt);
        try {
          return crypto.timingSafeEqual(
            Buffer.from(computedHash),
            Buffer.from(storedHash)
          );
        } catch {
          return false;
        }
      },

      generateSessionToken() {
        return crypto.randomBytes(48).toString('base64url');
      },

      createUser(username, password, role = 'viewer', permissions) {
        const existing = this.getUserByUsername(username);
        if (existing) throw new Error(`用户名 '${username}' 已存在`);

        const salt = this.generateSalt();
        const passwordHash = this.hashPassword(password, salt);

        const defaultPermissions = {
          admin: ['view_jobs', 'view_stats', 'manage_crawler', 'view_system', 'use_recommendations', 'manage_users'],
          operator: ['view_jobs', 'view_stats', 'manage_crawler', 'view_system', 'use_recommendations'],
          viewer: ['view_jobs', 'view_stats', 'view_system', 'use_recommendations']
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
        return this.sanitizeUser(row);
      },

      getUserByUsername(username) {
        const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
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
          lastLoginAt: row.last_login_at
        };
      },

      authenticate(credentials, ipAddress?, userAgent?) {
        const { username, password } = credentials;

        const userRow = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

        if (!userRow) {
          return { success: false, error: '用户名或密码错误', errorCode: 'INVALID_CREDENTIALS' };
        }

        if (userRow.locked_until) {
          const lockedUntil = new Date(userRow.locked_until);
          if (new Date() < lockedUntil) {
            const remainingMinutes = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
            return { success: false, error: `账户已锁定，请 ${remainingMinutes} 分钟后重试`, errorCode: 'ACCOUNT_LOCKED' };
          }
        }

        if (!userRow.is_active) {
          return { success: false, error: '账户已被禁用', errorCode: 'ACCOUNT_DISABLED' };
        }

        if (!this.verifyPassword(password, userRow.salt, userRow.password_hash)) {
          db.prepare('UPDATE users SET failed_login_count = failed_login_count + 1 WHERE id = ?')
            .run(userRow.id);

          const currentCount = (db.prepare('SELECT failed_login_count FROM users WHERE id = ?')
            .get(userRow.id) as any).failed_login_count || 0;

          if (currentCount >= this.MAX_LOGIN_ATTEMPTS) {
            const lockUntil = new Date(Date.now() + this.LOGIN_LOCKOUT_MINUTES * 60000).toISOString();
            db.prepare('UPDATE users SET locked_until = ?, failed_login_count = ? WHERE id = ?')
              .run(lockUntil, this.MAX_LOGIN_ATTEMPTS, userRow.id);
            return { success: false, error: `登录失败次数过多，账户已锁定 ${this.LOGIN_LOCKOUT_MINUTES} 分钟`, errorCode: 'ACCOUNT_LOCKED' };
          }

          const remainingAttempts = this.MAX_LOGIN_ATTEMPTS - currentCount;
          return { success: false, error: `用户名或密码错误，剩余尝试次数: ${remainingAttempts}`, errorCode: 'INVALID_CREDENTIALS' };
        }

        const sessionId = crypto.randomBytes(32).toString('base64url');
        const token = this.generateSessionToken();
        const expiresAt = new Date(Date.now() + this.SESSION_TIMEOUT_HOURS * 3600000);

        db.prepare(
          'INSERT INTO sessions (id, user_id, token, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(sessionId, userRow.id, token, ipAddress, userAgent, expiresAt.toISOString());

        db.prepare(`UPDATE users SET last_login_at = datetime('now'), failed_login_count = 0, locked_until = NULL WHERE id = ?`)
          .run(userRow.id);

        db.prepare(`
          INSERT INTO login_logs (user_id, username, action, ip_address, user_agent, success)
          VALUES (?, ?, 'login_success', ?, ?, 1)
        `).run(userRow.id, username, ipAddress, userAgent);

        return {
          success: true,
          user: this.sanitizeUser(userRow),
          sessionToken: token
        };
      },

      validateSession(token) {
        const now = new Date().toISOString();
        const row = db.prepare(`
          SELECT s.*, u.username, u.role, u.permissions
          FROM sessions s
          JOIN users u ON s.user_id = u.id
          WHERE s.token = ? AND s.expires_at > ? AND u.is_active = 1
        `).get(token, now);

        if (!row) return null;

        const newExpires = new Date(Date.now() + this.SESSION_TIMEOUT_HOURS * 3600000).toISOString();
        db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(newExpires, row.id);

        return {
          id: row.user_id,
          username: row.username,
          role: row.role,
          permissions: JSON.parse(row.permissions || '[]'),
          isActive: true,
          createdAt: row.created_at,
          expiresAt: newExpires
        };
      },

      destroySession(token) {
        const result = db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
        return result.changes > 0;
      },

      destroyAllUserSessions(userId) {
        const result = db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
        return result.changes;
      },

      createSession(userId, ipAddress?, userAgent?) {
        const sessionId = crypto.randomBytes(32).toString('base64url');
        const token = this.generateSessionToken();
        const expiresAt = new Date(Date.now() + this.SESSION_TIMEOUT_HOURS * 3600000);

        db.prepare(
          'INSERT INTO sessions (id, user_id, token, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(sessionId, userId, token, ipAddress, userAgent, expiresAt.toISOString());

        return { sessionId, token: token };
      },

      getLoginLogs(params) {
        const conditions = [];
        const values = [];

        if (params.userId) {
          conditions.push('user_id = ?');
          values.push(params.userId);
        }

        if (params.action) {
          conditions.push('action = ?');
          values.push(params.action);
        }

        if (params.startDate) {
          conditions.push("created_at >= ?");
          values.push(params.startDate);
        }

        if (params.endDate) {
          conditions.push("created_at <= ?");
          values.push(params.endDate);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const page = params.page || 1;
        const limit = params.limit || 20;
        const offset = (page - 1) * limit;

        const countResult = db.prepare(
          `SELECT COUNT(*) as count FROM login_logs ${whereClause}`
        ).get(...values) as { count: number };
        const total = countResult.count;

        const rows = db.prepare(`
          SELECT * FROM login_logs
          ${whereClause}
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?
        `).all(...values, limit, offset) as any[];

        return { logs: rows.map(row => ({
          id: row.id,
          userId: row.user_id,
          username: row.username,
          action: row.action,
          ipAddress: row.ip_address,
          userAgent: row.user_agent,
          success: row.success,
          createdAt: row.created_at
        })), total };
      },

      getLoginLogStatistics(params = {}) {
        const conditions = [];
        const values = [];

        if (params.startDate) {
          conditions.push("created_at >= ?");
          values.push(params.startDate);
        }

        if (params.endDate) {
          conditions.push("created_at <= ?");
          values.push(params.endDate);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const totalResult = db.prepare(
          `SELECT COUNT(*) as count FROM login_logs ${whereClause}`
        ).get(...values) as { count: number };

        const successResult = db.prepare(
          `SELECT COUNT(*) as count FROM login_logs ${whereClause} AND success = 1`
        ).get(...values) as { count: number };

        const failedResult = db.prepare(
          `SELECT COUNT(*) as count FROM login_logs ${whereClause} AND success = 0`
        ).get(...values) as { count: number };

        const uniqueUsersResult = db.prepare(
          `SELECT COUNT(DISTINCT user_id) as count FROM login_logs ${whereClause}`
        ).get(...values) as { count: number };

        return {
          totalLogins: totalResult.count,
          successfulLogins: successResult.count,
          failedLogins: failedResult.count,
          uniqueUsers: uniqueUsersResult.count,
          topIPs: [],
          loginByHour: new Array(24).fill(0)
        };
      }
    };

    authDb.createUser('testadmin', 'Admin@123', 'admin');
    authDb.createUser('testoperator', 'Operator@123', 'operator');
    authDb.createUser('testviewer', 'Viewer@123', 'viewer');

    mockAuthDbRef.current = authDb;

    vi.mock('@/lib/auth-db', () => ({
      getAuthDb: () => mockAuthDbRef.current,
      AuthDatabase: mockAuthDbRef.current
    }));

    vi.mock('@/lib/logger', () => ({
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
      }
    }));
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();

    if (authDb && authDb.database) {
      authDb.database.close();
    }

    try {
      const testFiles = fs.readdirSync(path.join(process.cwd(), 'data'))
        .filter(f => f.startsWith('test_integration_auth_'));

      testFiles.forEach(file => {
        const filePath = path.join(process.cwd(), 'data', file);
        try {
          fs.unlinkSync(filePath);
          const walFile = filePath + '-wal';
          const shmFile = filePath + '-shm';
          if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
          if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile);
        } catch (e) {}
      });
    } catch (e) {}
  });

  // ==================== POST /api/auth/login 测试 (8个用例) ====================

  describe('POST /api/auth/login - 登录功能', () => {
    async function createLoginRequest(body: any, headers?: Record<string, string>) {
      const { POST } = await import('@/app/api/auth/login/route');

      const request = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify(body)
      });

      return POST(request);
    }

    it('成功登录应该返回200和完整的用户信息', async () => {
      const response = await createLoginRequest({
        username: 'testadmin',
        password: 'Admin@123'
      }, {
        'x-forwarded-for': '192.168.1.100',
        'user-agent': 'TestBrowser/1.0'
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.user).toBeDefined();
      expect(data.user.username).toBe('testadmin');
      expect(data.user.role).toBe('admin');
      expect(data.message).toContain('欢迎回来');
      expect(response.headers.get('set-cookie')).toContain('session_token=');
    });

    it('错误的密码应该返回401和正确的错误码', async () => {
      const response = await createLoginRequest({
        username: 'testadmin',
        password: 'wrongpassword'
      });

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe('INVALID_CREDENTIALS');
      expect(data.error).toContain('用户名或密码错误');
    });

    it('不存在的账号应该返回401且不暴露用户是否存在', async () => {
      const response = await createLoginRequest({
        username: 'nonexistent_user_xyz',
        password: 'anypassword'
      });

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe('INVALID_CREDENTIALS');
      expect(data.error).not.toContain('不存在');
    });

    it('缺少用户名参数应该返回400', async () => {
      const response = await createLoginRequest({
        password: 'password123'
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe('MISSING_CREDENTIALS');
      expect(data.error).toContain('不能为空');
    });

    it('缺少密码参数应该返回400', async () => {
      const response = await createLoginRequest({
        username: 'testadmin'
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe('MISSING_CREDENTIALS');
    });

    it('空请求体应该返回400', async () => {
      const { POST } = await import('@/app/api/auth/login/route');

      const request = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('无效的JSON格式应该返回500', async () => {
      const { POST } = await import('@/app/api/auth/login/route');

      const request = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json {{{'
      });

      const response = await POST(request);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe('INTERNAL_ERROR');
    });

    it('连续多次密码错误后账户应被锁定', async () => {
      for (let i = 0; i < authDb.MAX_LOGIN_ATTEMPTS; i++) {
        await createLoginRequest({
          username: 'testviewer',
          password: 'wrong_password_attempt'
        });
      }

      const finalResponse = await createLoginRequest({
        username: 'testviewer',
        password: 'Viewer@123'
      });

      expect(finalResponse.status).toBe(401);
      const data = await finalResponse.json();
      expect(data.errorCode).toBe('ACCOUNT_LOCKED');
      expect(data.error).toContain('锁定');
    });
  });

  // ==================== GET /api/auth/me 测试 (7个用例) ====================

  describe('GET /api/auth/me - 获取当前用户信息', () => {
    async function createMeRequest(cookie?: string) {
      const { GET } = await import('@/app/api/auth/me/route');

      const headers: Record<string, string> = {};
      if (cookie) {
        headers['cookie'] = `session_token=${cookie}`;
      }

      const request = new NextRequest('http://localhost/api/auth/me', {
        method: 'GET',
        headers
      });

      return GET(request);
    }

    it('有效的Session应该返回完整用户信息', async () => {
      const loginResult = authDb.authenticate(
        { username: 'testadmin', password: 'Admin@123' },
        '127.0.0.1',
        'TestAgent/1.0'
      );

      const response = await createMeRequest(loginResult.sessionToken);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.authenticated).toBe(true);
      expect(data.user).toBeDefined();
      expect(data.user.username).toBe('testadmin');
      expect(data.user.role).toBe('admin');
      expect(data.message).toContain('当前用户');
    });

    it('没有Cookie应该返回未登录状态', async () => {
      const response = await createMeRequest();

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.authenticated).toBe(false);
      expect(data.user).toBeNull();
      expect(data.message).toBe('未登录');
    });

    it('无效的Token应该返回未登录并清除Cookie', async () => {
      const response = await createMeRequest('invalid_token_12345_xyz');

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.authenticated).toBe(false);
      expect(data.user).toBeNull();
      expect(data.message).toContain('过期');

      const setCookie = response.headers.get('set-cookie');
      expect(setCookie).toContain('Max-Age=0');
    });

    it('过期的Token应该返回未登录状态', async () => {
      const loginResult = authDb.authenticate(
        { username: 'testviewer', password: 'Viewer@123' }
      );

      const pastDate = new Date(Date.now() - 86400000).toISOString();
      authDb.database.prepare(
        'UPDATE sessions SET expires_at = ? WHERE token = ?'
      ).run(pastDate, loginResult.sessionToken);

      const response = await createMeRequest(loginResult.sessionToken);
      const data = await response.json();

      expect(data.authenticated).toBe(false);
    });

    it('被禁用的用户的Session应该无效', async () => {
      const loginResult = authDb.authenticate(
        { username: 'testoperator', password: 'Operator@123' }
      );

      const user = authDb.getUserByUsername('testoperator');
      authDb.database.prepare(
        'UPDATE users SET is_active = 0 WHERE id = ?'
      ).run(user!.id);

      const response = await createMeRequest(loginResult.sessionToken);
      const data = await response.json();

      expect(data.authenticated).toBe(false);
    });

    it('不同角色的用户都应该能正确获取信息', async () => {
      const testCases = [
        { username: 'testadmin', password: 'Admin@123', expectedRole: 'admin' },
        { username: 'testoperator', password: 'Operator@123', expectedRole: 'operator' },
        { username: 'testviewer', password: 'Viewer@123', expectedRole: 'viewer' }
      ];

      for (const testCase of testCases) {
        const loginResult = authDb.authenticate(
          { username: testCase.username, password: testCase.password }
        );

        const response = await createMeRequest(loginResult.sessionToken);
        const data = await response.json();

        expect(data.authenticated).toBe(true);
        expect(data.user.role).toBe(testCase.expectedRole);
      }
    });

    it('用户信息不应该包含敏感字段如密码哈希', async () => {
      const loginResult = authDb.authenticate(
        { username: 'testadmin', password: 'Admin@123' }
      );

      const response = await createMeRequest(loginResult.sessionToken);
      const data = await response.json();

      expect(data.user.password_hash).toBeUndefined();
      expect(data.user.salt).toBeUndefined();
      expect(data.user).toHaveProperty('id');
      expect(data.user).toHaveProperty('username');
      expect(data.user).toHaveProperty('role');
    });
  });

  // ==================== POST /api/auth/logout 测试 (6个用例) ====================

  describe('POST /api/auth/logout - 登出功能', () => {
    async function createLogoutRequest(cookie?: string) {
      const { POST } = await import('@/app/api/auth/logout/route');

      const headers: Record<string, string> = {};
      if (cookie) {
        headers['cookie'] = `session_token=${cookie}`;
      }

      const request = new NextRequest('http://localhost/api/auth/logout', {
        method: 'POST',
        headers
      });

      return POST(request);
    }

    it('登出应该成功并清除Cookie', async () => {
      const response = await createLogoutRequest();

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('登出');

      const setCookie = response.headers.get('set-cookie');
      expect(setCookie).toContain('session_token=');
      expect(setCookie).toContain('Max-Age=0');
    });

    it('登出响应应该包含正确的安全Cookie属性', async () => {
      const response = await createLogoutRequest();

      const setCookie = response.headers.get('set-cookie');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('Path=/');
      expect(setCookie).toContain('SameSite=Lax');
    });

    it('即使没有Session也应该能调用登出接口', async () => {
      const response = await createLogoutRequest('nonexistent_session_token');

      expect(response.status).toBe(200);
      expect((await response.json()).success).toBe(true);
    });

    it('有效Session登出后Token应该失效', async () => {
      const loginResult = authDb.authenticate(
        { username: 'testadmin', password: 'Admin@123' }
      );

      await createLogoutRequest(loginResult.sessionToken);

      const { GET } = await import('@/app/api/auth/me/route');
      const meRequest = new NextRequest('http://localhost/api/auth/me', {
        method: 'GET',
        headers: { cookie: `session_token=${loginResult.sessionToken}` }
      });

      const meResponse = await GET(meRequest);
      const meData = await meResponse.json();

      expect(meData.authenticated).toBe(false);
    });

    it('重复登出不应该报错', async () => {
      const loginResult = authDb.authenticate(
        { username: 'testviewer', password: 'Viewer@123' }
      );

      const firstLogout = await createLogoutRequest(loginResult.sessionToken);
      expect(firstLogout.status).toBe(200);

      const secondLogout = await createLogoutRequest(loginResult.sessionToken);
      expect(secondLogout.status).toBe(200);
      expect((await secondLogout.json()).success).toBe(true);
    });

    it('生产环境登出Cookie应该包含Secure标志', async () => {
      process.env.NODE_ENV = 'production';

      const response = await createLogoutRequest();

      const setCookie = response.headers.get('set-cookie');
      expect(setCookie).toContain('Secure');
    });
  });

  // ==================== POST /api/auth/change-password 测试 (8个用例) ====================

  describe('POST /api/auth/change-password - 修改密码', () => {
    async function createChangePasswordRequest(body: any, cookie?: string) {
      const { POST } = await import('@/app/api/auth/change-password/route');

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (cookie) {
        headers['cookie'] = `session_token=${cookie}`;
      }

      const request = new NextRequest('http://localhost/api/auth/change-password', {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      return POST(request);
    }

    it('正确旧密码和新密码应该成功修改', async () => {
      const loginResult = authDb.authenticate(
        { username: 'testadmin', password: 'Admin@123' }
      );

      const response = await createChangePasswordRequest({
        currentPassword: 'Admin@123',
        newPassword: 'NewAdmin@456',
        confirmPassword: 'NewAdmin@456'
      }, loginResult.sessionToken);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('密码修改成功');
      expect(data.data.sessionsDestroyed).toBeGreaterThanOrEqual(0);
      expect(response.headers.get('set-cookie')).toContain('session_token=');
    });

    it('错误的旧密码应该返回403', async () => {
      const loginResult = authDb.authenticate(
        { username: 'testadmin', password: 'Admin@123' }
      );

      const response = await createChangePasswordRequest({
        currentPassword: 'WrongOldPassword',
        newPassword: 'NewPassword@123',
        confirmPassword: 'NewPassword@123'
      }, loginResult.sessionToken);

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe('INVALID_CURRENT_PASSWORD');
      expect(data.error).toContain('当前密码错误');
    });

    it('未登录状态应该返回401', async () => {
      const response = await createChangePasswordRequest({
        currentPassword: 'somepassword',
        newPassword: 'newpassword',
        confirmPassword: 'newpassword'
      });

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe('UNAUTHORIZED');
    });

    it('新密码与确认密码不一致应该返回409', async () => {
      const loginResult = authDb.authenticate(
        { username: 'testviewer', password: 'Viewer@123' }
      );

      const response = await createChangePasswordRequest({
        currentPassword: 'Viewer@123',
        newPassword: 'NewPass@123',
        confirmPassword: 'DifferentPass@123'
      }, loginResult.sessionToken);

      expect(response.status).toBe(409);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe('PASSWORD_MISMATCH');
      expect(data.error).toContain('不一致');
    });

    it('新密码与旧密码相同应该返回400', async () => {
      const loginResult = authDb.authenticate(
        { username: 'testoperator', password: 'Operator@123' }
      );

      const response = await createChangePasswordRequest({
        currentPassword: 'Operator@123',
        newPassword: 'Operator@123',
        confirmPassword: 'Operator@123'
      }, loginResult.sessionToken);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe('SAME_PASSWORD');
      expect(data.error).toContain('不能与当前密码相同');
    });

    it('弱密码强度应该返回400和详细的反馈', async () => {
      const loginResult = authDb.authenticate(
        { username: 'testviewer', password: 'Viewer@123' }
      );

      const response = await createChangePasswordRequest({
        currentPassword: 'Viewer@123',
        newPassword: '123',
        confirmPassword: '123'
      }, loginResult.sessionToken);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe('WEAK_PASSWORD');
      expect(data.details).toBeDefined();
      expect(Array.isArray(data.details)).toBe(true);
      expect(data.details.length).toBeGreaterThan(0);
    });

    it('缺少必填字段应该返回400', async () => {
      const loginResult = authDb.authenticate(
        { username: 'testadmin', password: 'Admin@123' }
      );

      const response = await createChangePasswordRequest({
        currentPassword: 'Admin@123'
      }, loginResult.sessionToken);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe('MISSING_FIELDS');
    });

    it('修改密码后旧Session应该失效需要重新登录', async () => {
      const loginResult = authDb.authenticate(
        { username: 'testadmin', password: 'Admin@123' }
      );
      const oldToken = loginResult.sessionToken;

      await createChangePasswordRequest({
        currentPassword: 'Admin@123',
        newPassword: 'UpdatedAdmin@789',
        confirmPassword: 'UpdatedAdmin@789'
      }, oldToken);

      const { GET } = await import('@/app/api/auth/me/route');
      const meRequest = new NextRequest('http://localhost/api/auth/me', {
        method: 'GET',
        headers: { cookie: `session_token=${oldToken}` }
      });

      const meResponse = await GET(meRequest);
      const meData = await meResponse.json();

      expect(meData.authenticated).toBe(false);
    });
  });

  // ==================== GET /api/auth/logs 测试 (7个用例) ====================

  describe('GET /api/auth/logs - 获取登录日志', () => {
    async function createLogsRequest(cookie?: string, queryParams?: Record<string, string>) {
      const { GET } = await import('@/app/api/auth/logs/route');

      const headers: Record<string, string> = {};
      if (cookie) {
        headers['cookie'] = `session_token=${cookie}`;
      }

      const queryString = queryParams ? '?' + new URLSearchParams(queryParams).toString() : '';
      const url = `http://localhost/api/auth/logs${queryString}`;

      const request = new NextRequest(url, {
        method: 'GET',
        headers
      });

      return GET(request);
    }

    it('管理员应该能获取日志列表', async () => {
      const loginResult = authDb.authenticate(
        { username: 'testadmin', password: 'Admin@123' }
      );

      authDb.authenticate({ username: 'testviewer', password: 'Viewer@123' }, '192.168.1.1');
      authDb.authenticate({ username: 'testviewer', password: 'Viewer@123' }, '192.168.1.2');

      const response = await createLogsRequest(loginResult.sessionToken);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.logs).toBeDefined();
      expect(Array.isArray(data.logs)).toBe(true);
      expect(data.total).toBeDefined();
      expect(data.page).toBe(1);
      expect(data.totalPages).toBeDefined();
      expect(data.statistics).toBeDefined();
    });

    it('未登录应该返回401', async () => {
      const response = await createLogsRequest();

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe('UNAUTHORIZED');
    });

    it('普通viewer角色应该返回403权限不足', async () => {
      const loginResult = authDb.authenticate(
        { username: 'testviewer', password: 'Viewer@123' }
      );

      const response = await createLogsRequest(loginResult.sessionToken);

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe('FORBIDDEN');
      expect(data.error).toContain('权限不足');
    });

    it('分页参数应该正常工作', async () => {
      const loginResult = authDb.authenticate(
        { username: 'testadmin', password: 'Admin@123' }
      );

      for (let i = 0; i < 25; i++) {
        authDb.authenticate({ username: 'testoperator', password: 'Operator@123' }, `10.0.0.${i}`);
      }

      const response = await createLogsRequest(loginResult.sessionToken, {
        page: '2',
        limit: '10'
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.page).toBe(2);
      expect(data.limit).toBe(10);
      expect(data.logs.length).toBeLessThanOrEqual(10);
    });

    it('limit超过最大值应该被限制为100', async () => {
      const loginResult = authDb.authenticate(
        { username: 'testadmin', password: 'Admin@123' }
      );

      const response = await createLogsRequest(loginResult.sessionToken, {
        limit: '999'
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.limit).toBe(100);
    });

    it('操作员角色应该能够访问日志', async () => {
      const loginResult = authDb.authenticate(
        { username: 'testoperator', password: 'Operator@123' }
      );

      const response = await createLogsRequest(loginResult.sessionToken);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.logs).toBeDefined();
    });

    it('统计数据应该包含必要的字段', async () => {
      const loginResult = authDb.authenticate(
        { username: 'testadmin', password: 'Admin@123' }
      );

      authDb.authenticate({ username: 'testadmin', password: 'Admin@123' }, '10.0.0.1');
      authDb.authenticate({ username: 'testadmin', password: 'wrong' }, '10.0.0.2');

      const response = await createLogsRequest(loginResult.sessionToken);
      const data = await response.json();

      expect(data.statistics.totalLogins).toBeGreaterThanOrEqual(0);
      expect(data.statistics.successfulLogins).toBeGreaterThanOrEqual(0);
      expect(data.statistics.failedLogins).toBeGreaterThanOrEqual(0);
      expect(data.statistics.uniqueUsers).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(data.statistics.topIPs)).toBe(true);
      expect(Array.isArray(data.statistics.loginByHour)).toBe(true);
      expect(data.statistics.loginByHour.length).toBe(24);
    });
  });

  // ==================== 安全性测试 (8个用例) ====================

  describe('通用安全性验证', () => {
    it('XSS防护：用户名中的HTML标签应该被安全处理', async () => {
      const xssUsername = '<script>alert("xss")</script>';
      authDb.createUser(xssUsername, 'XssTest@123');

      const { POST } = await import('@/app/api/auth/login/route');
      const req = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: xssUsername, password: 'XssTest@123' })
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(typeof data.user.username).toBe('string');
      expect(data.user.username).not.toContain('<script>');
    });

    it('SQL注入防护：用户名中的SQL语句不应影响查询', async () => {
      const sqlInjectionUsername = "'; DROP TABLE users; --";
      const { POST } = await import('@/app/api/auth/login/route');
      const req = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: sqlInjectionUsername, password: 'test' })
      });

      const response = await POST(req);

      expect([400, 401]).toContain(response.status);

      const userCheck = authDb.database.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
      expect(userCheck.count).toBeGreaterThan(0);
    });

    it('不应该在错误消息中泄露用户名是否存在的信息', async () => {
      const { POST } = await import('@/app/api/auth/login/route');

      const notExistReq = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'completely_nonexistent_user', password: 'pass' })
      });

      const wrongPassReq = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testadmin', password: 'wrongpass' })
      });

      const notExistRes = await POST(notExistReq);
      const wrongPassRes = await POST(wrongPassReq);

      const notExistData = await notExistRes.json();
      const wrongPassData = await wrongPassRes.json();

      expect(notExistData.errorCode).toBe(wrongPassData.errorCode);
      expect(notExistData.error).toBe(wrongPassData.error);
    });

    it('Session Cookie应该设置HttpOnly防止XSS攻击', async () => {
      const { POST } = await import('@/app/api/auth/login/route');
      const req = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testadmin', password: 'Admin@123' })
      });

      const response = await POST(req);
      const setCookie = response.headers.get('set-cookie');

      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).not.toContain('javascript:');
    });

    it('密码字段应该在响应中被完全隐藏', async () => {
      const { POST } = await import('@/app/api/auth/login/route');
      const req = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testadmin', password: 'Admin@123' })
      });

      const response = await POST(req);
      const data = await response.json();

      expect(data.password).toBeUndefined();
      expect(data.password_hash).toBeUndefined();
      expect(data.salt).toBeUndefined();
      expect(data.user.password).toBeUndefined();
      expect(data.user.password_hash).toBeUndefined();
    });

    it('CSRF防护：Cookie应该设置SameSite属性', async () => {
      const { POST } = await import('@/app/api/auth/login/route');
      const req = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testviewer', password: 'Viewer@123' })
      });

      const response = await POST(req);
      const setCookie = response.headers.get('set-cookie');

      expect(setCookie).toMatch(/SameSite=(Lax|Strict)/i);
    });
  });

  // ==================== 边界条件和性能测试 (6个用例) ====================

  describe('边界条件和性能测试', () => {
    it('超长用户名应该能正确处理而不崩溃', async () => {
      const longUsername = 'a'.repeat(10000);
      const { POST } = await import('@/app/api/auth/login/route');
      const req = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: longUsername, password: 'password' })
      });

      const response = await POST(req);
      expect([400, 401]).toContain(response.status);
    });

    it('超长密码应该能正确处理', async () => {
      const longPassword = 'p'.repeat(10000);
      const { POST } = await import('@/app/api/auth/login/route');
      const req = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testadmin', password: longPassword })
      });

      const response = await POST(req);
      expect([400, 401, 500]).toContain(response.status);
    });

    it('并发登录请求应该能正确处理', async () => {
      const { POST } = await import('@/app/api/auth/login/route');

      const requests = Array(20).fill(null).map(() =>
        new NextRequest('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'testadmin', password: 'Admin@123' })
        })
      );

      const responses = await Promise.all(requests.map(req => POST(req)));

      responses.forEach(response => {
        expect([200, 401]).toContain(response.status);
      });

      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBeGreaterThan(0);
    });

    it('缺少Content-Type头应该优雅地处理', async () => {
      const { POST } = await import('@/app/api/auth/login/route');
      const req = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        body: '{"username":"test","password":"test"}'
      });

      const response = await POST(req);
      expect(response.status).toBeLessThan(500);
    });

    it('特殊字符用户名应该能正确处理', async () => {
      const specialUsernames = [
        "user'name",
        'user"name',
        'user<name>',
        'user&name',
        'user/name',
        'user\\name',
        '用户名中文',
        'user@domain.com',
        'user+test'
      ];

      for (const username of specialUsernames) {
        const { POST } = await import('@/app/api/auth/login/route');
        const req = new NextRequest('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password: 'password123' })
        });

        const response = await POST(req);
        expect([400, 401, 500]).toContain(response.status);
      }
    });

    it('空字符串输入应该返回适当的错误', async () => {
      const { POST } = await import('@/app/api/auth/login/route');
      const req = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: '', password: '' })
      });

      const response = await POST(req);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.errorCode).toBe('MISSING_CREDENTIALS');
    });
  });
});
