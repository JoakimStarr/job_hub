import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { NextRequest } from 'next/server';

describe('认证 API 路由', () => {
  let authDb: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    
    vi.resetModules();
    
    const Database = (await import('better-sqlite3')).default;
    const path = (await import('path')).default;
    const fs = (await import('fs')).default;

    const testDbPath = path.join(process.cwd(), `data/test_api_${Date.now()}.db`);
    const db = new Database(testDbPath);
    
    db.pragma('journal_mode = WAL');
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

    const crypto = await import('crypto');
    const createHash = crypto.createHash;
    const randomBytes = crypto.randomBytes;

    authDb = {
      database: db,
      SESSION_TIMEOUT_HOURS: 24,
      MAX_LOGIN_ATTEMPTS: 5,
      LOGIN_LOCKOUT_MINUTES: 15,

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
          return false;
        }
      },

      generateSessionToken() {
        return randomBytes(48).toString('base64url');
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

        const sessionId = randomBytes(32).toString('base64url');
        const token = this.generateSessionToken();
        const expiresAt = new Date(Date.now() + this.SESSION_TIMEOUT_HOURS * 3600000);

        db.prepare(
          'INSERT INTO sessions (id, user_id, token, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(sessionId, userRow.id, token, ipAddress, userAgent, expiresAt.toISOString());

        db.prepare(`UPDATE users SET last_login_at = datetime('now'), failed_login_count = 0, locked_until = NULL WHERE id = ?`)
          .run(userRow.id);

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
      }
    };

    authDb.createUser('testadmin', 'admin123', 'admin');
    authDb.createUser('testoperator', 'operator123', 'operator');
    authDb.createUser('testviewer', 'viewer123', 'viewer');

    vi.mock('@/lib/auth-db', () => ({
      getAuthDb: () => authDb
    }));
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();

    if (authDb && authDb.database) {
      authDb.database.close();
    }

    const path = require('path');
    const fs = require('fs');
    const testFiles = fs.readdirSync(path.join(process.cwd(), 'data'))
      .filter(f => f.startsWith('test_api_'));
    
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
  });

  // ==================== POST /api/auth/login 测试 ====================

  describe('POST /api/auth/login', () => {
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

    it('成功登录应该返回 200 和用户信息', async () => {
      const response = await createLoginRequest({
        username: 'testadmin',
        password: 'admin123'
      }, {
        'x-forwarded-for': '192.168.1.100',
        'user-agent': 'TestBrowser/1.0'
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.user).toBeDefined();
      expect(data.user.username).toBe('testadmin');
      expect(data.message).toContain('欢迎回来');
      
      expect(response.headers.get('set-cookie')).toContain('session_token=');
    });

    it('错误的密码应该返回 401', async () => {
      const response = await createLoginRequest({
        username: 'testadmin',
        password: 'wrongpassword'
      });

      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe('INVALID_CREDENTIALS');
      expect(data.error).toBeDefined();
    });

    it('不存在的用户应该返回 401（不暴露用户是否存在）', async () => {
      const response = await createLoginRequest({
        username: 'nonexistent_user',
        password: 'anypassword'
      });

      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe('INVALID_CREDENTIALS');
    });

    it('缺少用户名参数应该返回 400', async () => {
      const response = await createLoginRequest({
        password: 'password123'
      });

      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe('MISSING_CREDENTIALS');
      expect(data.error).toContain('不能为空');
    });

    it('缺少密码参数应该返回 400', async () => {
      const response = await createLoginRequest({
        username: 'testadmin'
      });

      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe('MISSING_CREDENTIALS');
    });

    it('空请求体应该返回 400', async () => {
      const { POST } = await import('@/app/api/auth/login/route');
      
      const request = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('无效的 JSON 应该返回 500', async () => {
      const { POST } = await import('@/app/api/auth/login/route');
      
      const request = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe('INTERNAL_ERROR');
    });

    it('Session Cookie 应该设置正确的属性', async () => {
      const response = await createLoginRequest({
        username: 'testviewer',
        password: 'viewer123'
      });

      const setCookie = response.headers.get('set-cookie');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Lax');
      expect(setCookie).toContain('Path=/');
      expect(setCookie).toContain('session_token=');
    });

    it('生产环境应该设置 Secure 标志', async () => {
      process.env.NODE_ENV = 'production';
      
      const response = await createLoginRequest({
        username: 'testviewer',
        password: 'viewer123'
      });

      const setCookie = response.headers.get('set-cookie');
      expect(setCookie).toContain('Secure');
    });

    it('不同角色的用户都能正常登录', async () => {
      const roles = [
        { username: 'testadmin', password: 'admin123', role: 'admin' },
        { username: 'testoperator', password: 'operator123', role: 'operator' },
        { username: 'testviewer', password: 'viewer123', role: 'viewer' }
      ];

      for (const { username, password, role } of roles) {
        const response = await createLoginRequest({ username, password });
        const data = await response.json();
        
        expect(response.status).toBe(200);
        expect(data.user.role).toBe(role);
      }
    });
  });

  // ==================== GET /api/auth/me 测试 ====================

  describe('GET /api/auth/me', () => {
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

    it('有效的 Session 应该返回用户信息', async () => {
      const loginResult = authDb.authenticate(
        { username: 'testadmin', password: 'admin123' },
        '127.0.0.1',
        'TestAgent'
      );

      const response = await createMeRequest(loginResult.sessionToken);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.authenticated).toBe(true);
      expect(data.user).toBeDefined();
      expect(data.user.username).toBe('testadmin');
      expect(data.message).toContain('当前用户');
    });

    it('没有 Cookie 应该返回未登录状态', async () => {
      const response = await createMeRequest();
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.authenticated).toBe(false);
      expect(data.user).toBeNull();
      expect(data.message).toBe('未登录');
    });

    it('无效的 Token 应该返回未登录并清除 Cookie', async () => {
      const response = await createMeRequest('invalid_token_12345');
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.authenticated).toBe(false);
      expect(data.user).toBeNull();
      expect(data.message).toContain('过期');
      
      const setCookie = response.headers.get('set-cookie');
      expect(setCookie).toContain('Max-Age=0');
    });

    it('过期的 Token 应该返回未登录状态', async () => {
      const loginResult = authDb.authenticate(
        { username: 'testviewer', password: 'viewer123' }
      );

      const pastDate = new Date(Date.now() - 86400000).toISOString();
      authDb.database.prepare(
        'UPDATE sessions SET expires_at = ? WHERE token = ?'
      ).run(pastDate, loginResult.sessionToken);

      const response = await createMeRequest(loginResult.sessionToken);
      const data = await response.json();

      expect(data.authenticated).toBe(false);
    });

    it('被禁用的用户的 Session 应该无效', async () => {
      const loginResult = authDb.authenticate(
        { username: 'testoperator', password: 'operator123' }
      );

      const user = authDb.getUserByUsername('testoperator');
      authDb.database.prepare(
        'UPDATE users SET is_active = 0 WHERE id = ?'
      ).run(user!.id);

      const response = await createMeRequest(loginResult.sessionToken);
      const data = await response.json();

      expect(data.authenticated).toBe(false);
    });
  });

  // ==================== POST /api/auth/logout 测试 ====================

  describe('POST /api/auth/logout', () => {
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

    it('登出应该成功清除 Cookie', async () => {
      const response = await createLogoutRequest();
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('登出');
      
      const setCookie = response.headers.get('set-cookie');
      expect(setCookie).toContain('session_token=');
      expect(setCookie).toContain('Max-Age=0');
    });

    it('登出响应应该包含正确的 Cookie 属性', async () => {
      const response = await createLogoutRequest();
      
      const setCookie = response.headers.get('set-cookie');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('Path=/');
    });

    it('即使没有 Session 也应该能调用登出接口', async () => {
      const response = await createLogoutRequest('nonexistent_session');
      
      expect(response.status).toBe(200);
      expect((await response.json()).success).toBe(true);
    });
  });

  // ==================== 安全性测试 ====================

  describe('安全性验证', () => {
    it('不应该在错误消息中泄露用户名是否存在的信息', async () => {
      const { POST } = await import('@/app/api/auth/login/route');
      
      const notExistReq = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'nonexistent', password: 'pass' })
      });

      const wrongPassReq = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testadmin', password: 'wrong' })
      });

      const notExistRes = await POST(notExistReq);
      const wrongPassRes = await POST(wrongPassReq);

      const notExistData = await notExistRes.json();
      const wrongPassData = await wrongPassRes.json();

      expect(notExistData.errorCode).toBe(wrongPassData.errorCode);
    });

    it('密码错误次数过多后应该锁定账户', async () => {
      const { POST } = await import('@/app/api/auth/login/route');
      
      for (let i = 0; i < authDb.MAX_LOGIN_ATTEMPTS; i++) {
        const req = new NextRequest('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'testviewer', password: 'wrong_password' })
        });
        await POST(req);
      }

      const finalReq = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testviewer', password: 'viewer123' })
      });

      const response = await POST(finalReq);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.errorCode).toBe('ACCOUNT_LOCKED');
    });

    it('XSS 防护：用户名中的特殊字符应该安全处理', async () => {
      const xssUsername = '<script>alert("xss")</script>';
      authDb.createUser(xssUsername, 'password123');

      const { POST } = await import('@/app/api/auth/login/route');
      const req = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: xssUsername, password: 'password123' })
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(typeof data.user.username).toBe('string');
    });
  });

  // ==================== 性能和边界条件测试 ====================

  describe('边界条件和性能', () => {
    it('超长用户名应该能正确处理', async () => {
      const longUsername = 'a'.repeat(1000);
      const { POST } = await import('@/app/api/auth/login/route');
      
      const req = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: longUsername, password: 'password' })
      });

      const response = await POST(req);
      expect([400, 401]).toContain(response.status);
    });

    it('并发请求应该能正确处理', async () => {
      const { POST } = await import('@/app/api/auth/login/route');
      
      const requests = Array(10).fill(null).map(() =>
        new NextRequest('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'testadmin', password: 'admin123' })
        })
      );

      const responses = await Promise.all(requests.map(req => POST(req)));
      
      responses.forEach(response => {
        expect([200, 401]).toContain(response.status);
      });
    });

    it('缺少 Content-Type 头应该优雅地处理', async () => {
      const { POST } = await import('@/app/api/auth/login/route');
      
      const req = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        body: '{"username":"test","password":"test"}'
      });

      const response = await POST(req);
      expect(response.status).toBeLessThan(500);
    });
  });
});
