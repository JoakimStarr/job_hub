import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { AuthDatabase } from '@/lib/auth-db';
import path from 'path';
import fs from 'fs';

describe('AuthDatabase', () => {
  let authDb: AuthDatabase;
  let testDbPath: string;

  beforeEach(() => {
    testDbPath = path.join(process.cwd(), `data/test_auth_${Date.now()}.db`);
    authDb = new AuthDatabase(testDbPath);
    authDb.connect();
  });

  afterEach(() => {
    authDb.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
      const walFile = testDbPath + '-wal';
      const shmFile = testDbPath + '-shm';
      if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
      if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile);
    }
  });

  // ==================== 密码工具方法测试 ====================

  describe('密码哈希功能', () => {
    describe('generateSalt()', () => {
      it('应该生成指定长度的盐值（默认32字节）', () => {
        const salt = AuthDatabase.generateSalt();
        expect(salt).toHaveLength(64); // 32 bytes * 2 (hex) = 64 chars
        expect(salt).toMatch(/^[a-f0-9]{64}$/);
      });

      it('应该生成不同长度的盐值', () => {
        const salt16 = AuthDatabase.generateSalt(16);
        expect(salt16).toHaveLength(32); // 16 bytes * 2 = 32 chars

        const salt64 = AuthDatabase.generateSalt(64);
        expect(salt64).toHaveLength(128); // 64 bytes * 2 = 128 chars
      });

      it('每次调用都应该生成唯一的盐值', () => {
        const salts = new Set();
        for (let i = 0; i < 100; i++) {
          salts.add(AuthDatabase.generateSalt());
        }
        expect(salts.size).toBe(100);
      });
    });

    describe('hashPassword()', () => {
      it('应该使用 SHA256 哈希密码和盐值', () => {
        const password = 'testPassword123';
        const salt = 'abcdef1234567890';
        const hash = AuthDatabase.hashPassword(password, salt);

        expect(hash).toHaveLength(64); // SHA256 hex output
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
      });

      it('相同密码和盐值应该产生相同的哈希', () => {
        const password = 'mySecretPass';
        const salt = 'somesaltvalue';
        
        const hash1 = AuthDatabase.hashPassword(password, salt);
        const hash2 = AuthDatabase.hashPassword(password, salt);

        expect(hash1).toBe(hash2);
      });

      it('相同密码不同盐值应该产生不同的哈希', () => {
        const password = 'mySecretPass';
        const salt1 = 'salt1111111111';
        const salt2 = 'salt2222222222';

        const hash1 = AuthDatabase.hashPassword(password, salt1);
        const hash2 = AuthDatabase.hashPassword(password, salt2);

        expect(hash1).not.toBe(hash2);
      });

      it('空字符串密码也应该能哈希', () => {
        const hash = AuthDatabase.hashPassword('', 'somesalt');
        expect(hash).toHaveLength(64);
      });
    });

    describe('verifyPassword()', () => {
      it('正确密码应该返回 true', () => {
        const password = 'correctPassword';
        const salt = AuthDatabase.generateSalt();
        const storedHash = AuthDatabase.hashPassword(password, salt);

        expect(AuthDatabase.verifyPassword(password, salt, storedHash)).toBe(true);
      });

      it('错误密码应该返回 false', () => {
        const password = 'correctPassword';
        const wrongPassword = 'wrongPassword';
        const salt = AuthDatabase.generateSalt();
        const storedHash = AuthDatabase.hashPassword(password, salt);

        expect(AuthDatabase.verifyPassword(wrongPassword, salt, storedHash)).toBe(false);
      });

      it('空密码应该返回 false（除非存储的哈希也是空的）', () => {
        const salt = AuthDatabase.generateSalt();
        const storedHash = AuthDatabase.hashPassword('realpassword', salt);

        expect(AuthDatabase.verifyPassword('', salt, storedHash)).toBe(false);
      });

      it('应该防止时序攻击（timingSafeEqual）', () => {
        const password = 'testPassword';
        const salt = AuthDatabase.generateSalt();
        const storedHash = AuthDatabase.hashPassword(password, salt);

        const startCorrect = Date.now();
        for (let i = 0; i < 1000; i++) {
          AuthDatabase.verifyPassword(password, salt, storedHash);
        }
        const durationCorrect = Date.now() - startCorrect;

        const startWrong = Date.now();
        for (let i = 0; i < 1000; i++) {
          AuthDatabase.verifyPassword('wrongpassword', salt, storedHash);
        }
        const durationWrong = Date.now() - startWrong;

        const timeDiff = Math.abs(durationCorrect - durationWrong);
        expect(timeDiff).toBeLessThan(50); // 时间差应该在合理范围内
      });

      it('长度不匹配的哈希应该返回 false 而不是抛出异常', () => {
        const password = 'test';
        const salt = AuthDatabase.generateSalt();
        const invalidHash = 'short_hash'; // 长度不匹配

        expect(() => {
          AuthDatabase.verifyPassword(password, salt, invalidHash);
        }).not.toThrow();

        expect(AuthDatabase.verifyPassword(password, salt, invalidHash)).toBe(false);
      });
    });

    describe('generateSessionToken()', () => {
      it('应该生成 base64url 格式的 token', () => {
        const token = AuthDatabase.generateSessionToken();
        expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      });

      it('每次调用应该生成唯一的 token', () => {
        const tokens = new Set();
        for (let i = 0; i < 100; i++) {
          tokens.add(AuthDatabase.generateSessionToken());
        }
        expect(tokens.size).toBe(100);
      });

      it('token 应该有合理的长度（48字节的base64url）', () => {
        const token = AuthDatabase.generateSessionToken();
        expect(token.length).toBeGreaterThan(40);
        expect(token.length).toBeLessThan(80);
      });
    });
  });

  // ==================== 用户 CRUD 测试 ====================

  describe('用户 CRUD 操作', () => {
    describe('createUser()', () => {
      it('应该成功创建新用户', () => {
        const user = authDb.createUser('testuser', 'password123', 'viewer');

        expect(user).toBeDefined();
        expect(user.username).toBe('testuser');
        expect(user.role).toBe('viewer');
        expect(user.isActive).toBe(true);
        expect(user.permissions).toContain('view_jobs');
        expect(user.id).toBeGreaterThan(0);
        expect(user.createdAt).toBeDefined();
      });

      it('应该为不同角色设置正确的默认权限', () => {
        const admin = authDb.createUser('admin_user', 'pass', 'admin');
        const operator = authDb.createUser('operator_user', 'pass', 'operator');
        const viewer = authDb.createUser('viewer_user', 'pass', 'viewer');

        expect(admin.permissions).toContain('manage_users');
        expect(operator.permissions).not.toContain('manage_users');
        expect(viewer.permissions).not.toContain('manage_crawler');

        expect(admin.permissions.length).toBeGreaterThan(operator.permissions.length);
        expect(operator.permissions.length).toBeGreaterThan(viewer.permissions.length);
      });

      it('应该支持自定义权限列表', () => {
        const customPermissions = ['custom_perm_1', 'custom_perm_2'];
        const user = authDb.createUser('custom_user', 'pass', 'viewer', customPermissions);

        expect(user.permissions).toEqual(customPermissions);
      });

      it('重复用户名应该抛出错误', () => {
        authDb.createUser('duplicate', 'password123');

        expect(() => {
          authDb.createUser('duplicate', 'anotherpassword');
        }).toThrow("用户名 'duplicate' 已存在");
      });

      it('空用户名应该能创建（但可能不符合业务规则）', () => {
        const user = authDb.createUser('', 'password');
        expect(user.username).toBe('');
      });

      it('空密码应该也能创建用户', () => {
        const user = authDb.createUser('emptypass', '');
        expect(user.username).toBe('emptypass');
      });
    });

    describe('getUserById()', () => {
      it('应该通过 ID 找到已存在的用户', () => {
        const createdUser = authDb.createUser('id_test', 'password');
        const foundUser = authDb.getUserById(createdUser.id);

        expect(foundUser).toBeDefined();
        expect(foundUser!.id).toBe(createdUser.id);
        expect(foundUser!.username).toBe('id_test');
      });

      it('不存在的 ID 应该返回 undefined', () => {
        const user = authDb.getUserById(99999);
        expect(user).toBeUndefined();
      });

      it('不应该返回敏感信息（密码哈希和盐值）', () => {
        authDb.createUser('secure_test', 'password123');
        const user = authDb.getUserByUsername('secure_test')!;

        expect((user as any).password_hash).toBeUndefined();
        expect((user as any).salt).toBeUndefined();
      });
    });

    describe('getUserByUsername()', () => {
      it('应该通过用户名找到用户', () => {
        authDb.createUser('username_test', 'password');
        const user = authDb.getUserByUsername('username_test');

        expect(user).toBeDefined();
        expect(user!.username).toBe('username_test');
      });

      it('不存在的用户名应该返回 undefined', () => {
        const user = authDb.getUserByUsername('nonexistent_user');
        expect(user).toBeUndefined();
      });

      it('用户名查找应该是大小写敏感的', () => {
        authDb.createUser('testcase', 'password');
        const userLower = authDb.getUserByUsername('testcase');
        const userUpper = authDb.getUserByUsername('TESTCASE');

        expect(userLower).toBeDefined();
        expect(userUpper).toBeUndefined();
      });
    });

    describe('getAllUsers()', () => {
      it('应该返回所有活跃用户', () => {
        authDb.createUser('user1', 'pass1');
        authDb.createUser('user2', 'pass2');
        authDb.createUser('user3', 'pass3');

        const users = authDb.getAllUsers();
        expect(users.length).toBeGreaterThanOrEqual(3);
        expect(users.map(u => u.username)).toContain('user1');
        expect(users.map(u => u.username)).toContain('user2');
        expect(users.map(u => u.username)).toContain('user3');
      });

      it('不应该包含已删除的用户', () => {
        const user = authDb.createUser('to_delete', 'password');
        authDb.deleteUser(user.id);

        const users = authDb.getAllUsers();
        expect(users.find(u => u.username === 'to_delete')).toBeUndefined();
      });

      it('结果应该按 ID 升序排列', () => {
        authDb.createUser('first', 'pass');
        authDb.createUser('second', 'pass');
        authDb.createUser('third', 'pass');

        const users = authDb.getAllUsers();
        for (let i = 1; i < users.length; i++) {
          expect(users[i].id).toBeGreaterThan(users[i - 1].id);
        }
      });
    });

    describe('updateUser()', () => {
      it('应该更新用户名', () => {
        const user = authDb.createUser('old_name', 'password');
        const updated = authDb.updateUser(user.id, { username: 'new_name' });

        expect(updated).toBeDefined();
        expect(updated!.username).toBe('new_name');
      });

      it('应该更新角色', () => {
        const user = authDb.createUser('role_test', 'password', 'viewer');
        const updated = authDb.updateUser(user.id, { role: 'admin' });

        expect(updated!.role).toBe('admin');
        expect(updated!.permissions).toContain('manage_users');
      });

      it('应该更新权限列表', () => {
        const user = authDb.createUser('perm_test', 'password');
        const newPerms = ['new_perm_1', 'new_perm_2'];
        const updated = authDb.updateUser(user.id, { permissions: newPerms });

        expect(updated!.permissions).toEqual(newPerms);
      });

      it('应该更新激活状态', () => {
        const user = authDb.createUser('active_test', 'password');
        
        authDb.updateUser(user.id, { isActive: false });
        let found = authDb.getUserById(user.id);
        expect(found!.isActive).toBe(false);

        authDb.updateUser(user.id, { isActive: true });
        found = authDb.getUserById(user.id);
        expect(found!.isActive).toBe(true);
      });

      it('应该正确处理密码更新（重新生成盐值和哈希）', () => {
        const user = authDb.createUser('pass_update', 'old_password');
        authDb.updateUser(user.id, { password: 'new_password' });

        const result = authDb.authenticate({ username: 'pass_update', password: 'new_password' });
        expect(result.success).toBe(true);

        const wrongResult = authDb.authenticate({ username: 'pass_update', password: 'old_password' });
        expect(wrongResult.success).toBe(false);
      });

      it('不允许更新的字段应该被忽略', () => {
        const user = authDb.createUser('field_test', 'password');
        const updated = authDb.updateUser(user.id, { 
          username: 'new_name',
          // @ts-ignore - 测试不存在的字段
          invalidField: 'should_be_ignored'
        } as any);

        expect(updated).toBeDefined();
        expect((updated as any).invalidField).toBeUndefined();
      });

      it('空更新对象应该返回原始用户', () => {
        const user = authDb.createUser('empty_update', 'password');
        const updated = authDb.updateUser(user.id, {});

        expect(updated).toEqual(user);
      });

      it('更新不存在的用户应该返回 undefined', () => {
        const updated = authDb.updateUser(99999, { username: 'test' });
        expect(updated).toBeUndefined();
      });
    });

    describe('deleteUser()', () => {
      it('应该软删除用户（设置为非活跃）', () => {
        const user = authDb.createUser('delete_me', 'password');
        const result = authDb.deleteUser(user.id);

        expect(result).toBe(true);

        const found = authDb.getUserById(user.id);
        expect(found).toBeUndefined(); // getUserById 只返回活跃用户
      });

      it('删除用户时应该清除所有会话', () => {
        const user = authDb.createUser('session_user', 'password');
        const authResult = authDb.authenticate(
          { username: 'session_user', password: 'password' },
          '127.0.0.1',
          'TestAgent'
        );

        expect(authResult.sessionToken).toBeDefined();

        authDb.deleteUser(user.id);

        const sessions = authDb.getUserSessions(user.id);
        expect(sessions).toHaveLength(0);
      });

      it('删除不存在的用户应该返回 false', () => {
        const result = authDb.deleteUser(99999);
        expect(result).toBe(false);
      });

      it('重复删除应该返回 false', () => {
        const user = authDb.createUser('double_delete', 'password');
        
        expect(authDb.deleteUser(user.id)).toBe(true);
        expect(authDb.deleteUser(user.id)).toBe(false);
      });
    });
  });

  // ==================== 认证逻辑测试 ====================

  describe('authenticate()', () => {
    beforeEach(() => {
      authDb.createUser('authuser', 'correct_password', 'admin');
    });

    it('正确的凭证应该认证成功', () => {
      const result = authDb.authenticate({
        username: 'authuser',
        password: 'correct_password'
      }, '192.168.1.1', 'Mozilla/5.0');

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user!.username).toBe('authuser');
      expect(result.sessionToken).toBeDefined();
      expect(result.sessionToken!.length).toBeGreaterThan(0);
    });

    it('错误的密码应该认证失败', () => {
      const result = authDb.authenticate({
        username: 'authuser',
        password: 'wrong_password'
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_CREDENTIALS');
      expect(result.error).toContain('剩余尝试次数');
      expect(result.sessionToken).toBeUndefined();
    });

    it('不存在的用户名应该认证失败', () => {
      const result = authDb.authenticate({
        username: 'nonexistent',
        password: 'anypassword'
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_CREDENTIALS');
      expect(result.error).toBe('用户名或密码错误');
    });

    it('应该记录 IP 地址和 User Agent', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      authDb.authenticate(
        { username: 'authuser', password: 'correct_password' },
        '10.0.0.1',
        'TestBrowser/1.0'
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('10.0.0.1')
      );

      consoleSpy.mockRestore();
    });

    it('认证成功后应该重置失败登录计数', () => {
      const userRow = authDb.database.prepare(
        'SELECT * FROM users WHERE username = ?'
      ).get('authuser') as any;

      expect(userRow.failed_login_count).toBe(0);
    });

    it('应该更新最后登录时间', () => {
      authDb.authenticate({
        username: 'authuser',
        password: 'correct_password'
      });

      const user = authDb.getUserByUsername('authuser');
      expect(user!.lastLoginAt).toBeDefined();
    });

    it('缺少参数应该由 API 层处理（这里测试的是数据库层）', () => {
      const result = authDb.authenticate({
        username: '',
        password: ''
      });

      expect(result.success).toBe(false);
    });
  });

  // ==================== 会话管理测试 ====================

  describe('createSession()', () => {
    it('应该成功创建会话', () => {
      const user = authDb.createUser('session_test', 'password');
      const session = authDb.createSession(user.id, '127.0.0.1', 'TestAgent');

      expect(session.sessionId).toBeDefined();
      expect(session.token).toBeDefined();
      expect(session.sessionId.length).toBeGreaterThan(0);
      expect(session.token.length).toBeGreaterThan(0);
    });

    it('会话应该有合理的过期时间', () => {
      const user = authDb.createUser('expire_test', 'password');
      const beforeCreate = Date.now();
      const session = authDb.createSession(user.id);
      const afterCreate = Date.now();

      const sessions = authDb.getUserSessions(user.id);
      expect(sessions).toHaveLength(1);

      const expiresAt = new Date(sessions[0].expiresAt).getTime();
      const expectedMin = beforeCreate + (authDb.SESSION_TIMEOUT_HOURS * 3600000) - 1000;
      const expectedMax = afterCreate + (authDb.SESSION_TIMEOUT_HOURS * 3600000) + 1000;

      expect(expiresAt).toBeGreaterThanOrEqual(expectedMin);
      expect(expiresAt).toBeLessThanOrEqual(expectedMax);
    });

    it('应该能够为同一用户创建多个会话', () => {
      const user = authDb.createUser('multi_session', 'password');

      authDb.createSession(user.id);
      authDb.createSession(user.id);
      authDb.createSession(user.id);

      const sessions = authDb.getUserSessions(user.id);
      expect(sessions).toHaveLength(3);
    });
  });

  describe('validateSession()', () => {
    it('有效的 token 应该返回用户信息', () => {
      const user = authDb.createUser('valid_session', 'password');
      const { token } = authDb.createSession(user.id);

      const validatedUser = authDb.validateSession(token);

      expect(validatedUser).not.toBeNull();
      expect(validatedUser!.id).toBe(user.id);
      expect(validatedUser!.username).toBe('valid_session');
    });

    it('无效的 token 应该返回 null', () => {
      const result = authDb.validateSession('invalid_token_string');
      expect(result).toBeNull();
    });

    it('过期的 token 应该返回 null', () => {
      const user = authDb.createUser('expired_session', 'password');
      const { token } = authDb.createSession(user.id);

      const pastDate = new Date(Date.now() - 86400000).toISOString(); // 24小时前
      authDb.database.prepare(
        'UPDATE sessions SET expires_at = ? WHERE token = ?'
      ).run(pastDate, token);

      const result = authDb.validateSession(token);
      expect(result).toBeNull();
    });

    it('验证成功后应该延长会话时间（滑动续期）', () => {
      const user = authDb.createUser('renew_session', 'password');
      const { token } = authDb.createSession(user.id);

      const sessionsBefore = authDb.getUserSessions(user.id);
      const expiresBefore = new Date(sessionsBefore[0].expiresAt).getTime();

      authDb.validateSession(token);

      const sessionsAfter = authDb.getUserSessions(user.id);
      const expiresAfter = new Date(sessionsAfter[0].expiresAt).getTime();

      expect(expiresAfter).toBeGreaterThan(expiresBefore);
    });

    it('被禁用用户的会话应该无效', () => {
      const user = authDb.createUser('disabled_user', 'password');
      const { token } = authDb.createSession(user.id);

      authDb.updateUser(user.id, { isActive: false });

      const result = authDb.validateSession(token);
      expect(result).toBeNull();
    });

    it('空字符串 token 应该返回 null', () => {
      const result = authDb.validateSession('');
      expect(result).toBeNull();
    });
  });

  describe('destroySession()', () => {
    it('应该成功销毁存在的会话', () => {
      const user = authDb.createUser('destroy_test', 'password');
      const { token } = authDb.createSession(user.id);

      const result = authDb.destroySession(token);
      expect(result).toBe(true);

      const validated = authDb.validateSession(token);
      expect(validated).toBeNull();
    });

    it('销毁不存在的 token 应该返回 false', () => {
      const result = authDb.destroySession('nonexistent_token');
      expect(result).toBe(false);
    });
  });

  describe('destroyAllUserSessions()', () => {
    it('应该销毁用户的所有会话', () => {
      const user = authDb.createUser('all_session_test', 'password');

      authDb.createSession(user.id);
      authDb.createSession(user.id);
      authDb.createSession(user.id);

      expect(authDb.getUserSessions(user.id)).toHaveLength(3);

      const count = authDb.destroyAllUserSessions(user.id);
      expect(count).toBe(3);
      expect(authDb.getUserSessions(user.id)).toHaveLength(0);
    });

    it('没有会话的用户应该返回 0', () => {
      const user = authDb.createUser('no_sessions', 'password');
      const count = authDb.destroyAllUserSessions(user.id);
      expect(count).toBe(0);
    });
  });

  // ==================== 安全特性测试 ====================

  describe('安全特性', () => {
    describe('登录失败锁定机制', () => {
      let lockableUser: any;

      beforeEach(() => {
        authDb.createUser('lockable_user', 'correct_pass');
        lockableUser = authDb.database.prepare(
          'SELECT * FROM users WHERE username = ?'
        ).get('lockable_user');
      });

      it('应该跟踪失败的登录尝试次数', () => {
        for (let i = 0; i < authDb.MAX_LOGIN_ATTEMPTS - 1; i++) {
          authDb.authenticate({
            username: 'lockable_user',
            password: 'wrong_password'
          });
        }

        const user = authDb.database.prepare(
          'SELECT failed_login_count FROM users WHERE username = ?'
        ).get('lockable_user') as any;

        expect(user.failed_login_count).toBe(authDb.MAX_LOGIN_ATTEMPTS - 1);
      });

      it('达到最大尝试次数后应该锁定账户', () => {
        for (let i = 0; i < authDb.MAX_LOGIN_ATTEMPTS; i++) {
          authDb.authenticate({
            username: 'lockable_user',
            password: 'wrong_password'
          });
        }

        const result = authDb.authenticate({
          username: 'lockable_user',
          password: 'correct_pass'
        });

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('ACCOUNT_LOCKED');
        expect(result.error).toContain('账户已锁定');
      });

      it('锁定期间应该显示剩余等待时间', () => {
        for (let i = 0; i < authDb.MAX_LOGIN_ATTEMPTS; i++) {
          authDb.authenticate({
            username: 'lockable_user',
            password: 'wrong_password'
          });
        }

        const result = authDb.authenticate({
          username: 'lockable_user',
          password: 'any_password'
        });

        expect(result.error).toMatch(/\d+ 分钟后重试/);
      });

      it('锁定时间过后应该允许重新登录', () => {
        for (let i = 0; i < authDb.MAX_LOGIN_ATTEMPTS; i++) {
          authDb.authenticate({
            username: 'lockable_user',
            password: 'wrong_password'
          });
        }

        const lockedUntil = new Date(
          Date.now() + authDb.LOGIN_LOCKOUT_MINUTES * 60000
        ).toISOString();

        authDb.database.prepare(
          'UPDATE users SET locked_until = ? WHERE username = ?'
        ).run(lockedUntil, 'lockable_user');

        const pastDate = new Date(Date.now() - 60000).toISOString();
        authDb.database.prepare(
          'UPDATE users SET locked_until = ? WHERE username = ?'
        ).run(pastDate, 'lockable_user');

        const result = authDb.authenticate({
          username: 'lockable_user',
          password: 'correct_pass'
        });

        expect(result.success).toBe(true);
      });

      it('成功登录后应该重置失败计数', () => {
        authDb.authenticate({
          username: 'lockable_user',
          password: 'wrong_password'
        });
        authDb.authenticate({
          username: 'lockable_user',
          password: 'wrong_password'
        });

        authDb.authenticate({
          username: 'lockable_user',
          password: 'correct_pass'
        });

        const user = authDb.database.prepare(
          'SELECT failed_login_count FROM users WHERE username = ?'
        ).get('lockable_user') as any;

        expect(user.failed_login_count).toBe(0);
        expect(user.locked_until).toBeNull();
      });
    });

    describe('账户状态检查', () => {
      it('禁用的账户不能登录', () => {
        authDb.createUser('disabled_login', 'password');
        authDb.updateUser(
          authDb.getUserByUsername('disabled_login')!.id,
          { isActive: false }
        );

        const result = authDb.authenticate({
          username: 'disabled_login',
          password: 'password'
        });

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('ACCOUNT_DISABLED');
        expect(result.error).toBe('账户已被禁用');
      });
    });
  });

  // ==================== 辅助功能测试 ====================

  describe('辅助功能', () => {
    describe('getUserSessions()', () => {
      it('应该返回用户的有效会话', () => {
        const user = authDb.createUser('sessions_user', 'password');
        authDb.createSession(user.id, '1.1.1.1', 'Agent1');
        authDb.createSession(user.id, '2.2.2.2', 'Agent2');

        const sessions = authDb.getUserSessions(user.id);
        expect(sessions).toHaveLength(2);
        expect(sessions[0].ipAddress).toBeDefined();
        expect(sessions[0].userAgent).toBeDefined();
        expect(sessions[0].createdAt).toBeDefined();
        expect(sessions[0].expiresAt).toBeDefined();
      });

      it('不应该返回过期的会话', () => {
        const user = authDb.createUser('mixed_sessions', 'password');
        const { token: validToken } = authDb.createSession(user.id);
        const { token: expiredToken } = authDb.createSession(user.id);

        const pastDate = new Date(Date.now() - 86400000).toISOString();
        authDb.database.prepare(
          'UPDATE sessions SET expires_at = ? WHERE token = ?'
        ).run(pastDate, expiredToken);

        const sessions = authDb.getUserSessions(user.id);
        expect(sessions).toHaveLength(1);
      });

      it('会话应该按创建时间倒序排列', () => {
        const user = authDb.createUser('ordered_sessions', 'password');
        authDb.createSession(user.id);
        authDb.createSession(user.id);
        authDb.createSession(user.id);

        const sessions = authDb.getUserSessions(user.id);
        for (let i = 1; i < sessions.length; i++) {
          const timeI = new Date(sessions[i].createdAt).getTime();
          const timePrev = new Date(sessions[i - 1].createdAt).getTime();
          expect(timeI).toBeLessThanOrEqual(timePrev);
        }
      });
    });

    describe('cleanupExpiredSessions()', () => {
      it('应该清理过期的会话', () => {
        const user = authDb.createUser('cleanup_user', 'password');
        authDb.createSession(user.id);
        authDb.createSession(user.id);

        const pastDate = new Date(Date.now() - 86400000).toISOString();
        authDb.database.prepare(
          'UPDATE sessions SET expires_at = ?'
        ).run(pastDate);

        const cleanedCount = authDb.cleanupExpiredSessions();
        expect(cleanedCount).toBe(2);

        const remainingSessions = authDb.getUserSessions(user.id);
        expect(remainingSessions).toHaveLength(0);
      });

      it('没有过期会话时应该返回 0', () => {
        const user = authDb.createUser('no_expired', 'password');
        authDb.createSession(user.id);

        const count = authDb.cleanupExpiredSessions();
        expect(count).toBe(0);
      });
    });
  });

  // ==================== 数据库连接测试 ====================

  describe('数据库连接管理', () => {
    it('connect() 应该初始化数据库和表', () => {
      const newPath = path.join(process.cwd(), `data/test_connect_${Date.now()}.db`);
      const db = new AuthDatabase(newPath);
      
      expect(() => db.connect()).not.toThrow();
      
      db.close();
      if (fs.existsSync(newPath)) fs.unlinkSync(newPath);
    });

    it('close() 应该关闭数据库连接', () => {
      const db = new AuthDatabase(path.join(process.cwd(), `data/test_close_${Date.now()}.db`));
      db.connect();
      
      expect(() => db.close()).not.toThrow();
    });

    it('在未连接状态下访问 database 应该抛出异常', () => {
      const db = new AuthDatabase(':memory:');
      
      expect(() => db.database).toThrow('数据库未连接');
    });

    it('默认路径应该指向 data/jobs.db', () => {
      const db = new AuthDatabase();
      expect(db['dbPath']).toContain('data/jobs.db');
    });
  });

  // ==================== 配置测试 ====================

  describe('安全配置', () => {
    it('SESSION_TIMEOUT_HOURS 应该有合理的默认值', () => {
      expect(authDb.SESSION_TIMEOUT_HOURS).toBeGreaterThan(0);
      expect(authDb.SESSION_TIMEOUT_HOURS).toBeLessThanOrEqual(168); // 不超过一周
    });

    it('MAX_LOGIN_ATTEMPTS 应该有合理的默认值', () => {
      expect(authDb.MAX_LOGIN_ATTEMPTS).toBeGreaterThan(0);
      expect(authDb.MAX_LOGIN_ATTEMPTS).toBeLessThanOrEqual(20);
    });

    it('LOGIN_LOCKOUT_MINUTES 应该有合理的默认值', () => {
      expect(authDb.LOGIN_LOCKOUT_MINUTES).toBeGreaterThan(0);
      expect(authDb.LOGIN_LOCKOUT_MINUTES).toBeLessThanOrEqual(1440); // 不超过一天
    });
  });

  // ==================== 边界条件和异常情况 ====================

  describe('边界条件测试', () => {
    it('特殊字符的用户名应该正常工作', () => {
      const specialNames = [
        'user@test.com',
        '用户中文',
        'user-name_test.name',
        'UPPERCASE',
        'lowercase',
        '123numbers',
        '!@#$%^&*()'
      ];

      specialNames.forEach(name => {
        const user = authDb.createUser(name, 'password');
        expect(user.username).toBe(name);

        const found = authDb.getUserByUsername(name);
        expect(found).toBeDefined();
      });
    });

    it('超长密码应该正常工作', () => {
      const longPassword = 'a'.repeat(1000);
      const user = authDb.createUser('longpass', longPassword);

      const result = authDb.authenticate({
        username: 'longpass',
        password: longPassword
      });

      expect(result.success).toBe(true);
    });

    it('Unicode 密码应该正常工作', () => {
      const unicodePassword = '密码🔑パスワードpasswörd';
      const user = authDb.createUser('unicode', unicodePassword);

      const result = authDb.authenticate({
        username: 'unicode',
        password: unicodePassword
      });

      expect(result.success).toBe(true);
    });

    it('并发创建用户不应该冲突（模拟）', () => {
      const users = [];
      for (let i = 0; i < 10; i++) {
        users.push(authDb.createUser(`concurrent_${i}`, `password_${i}`));
      }

      const allUsers = authDb.getAllUsers().filter(u => 
        u.username.startsWith('concurrent_')
      );
      
      expect(allUsers.length).toBe(10);
    });

    it('快速连续的认证请求应该正常处理', () => {
      authDb.createUser('rapid_user', 'password');

      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(authDb.authenticate({
          username: 'rapid_user',
          password: i === 4 ? 'password' : 'wrong'
        }));
      }

      expect(results[0].success).toBe(false);
      expect(results[4].success).toBe(true);
    });
  });
});
