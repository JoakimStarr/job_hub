/**
 * 用户认证数据库模块
 *
 * 提供 Session + Cookie 的用户认证功能:
 * - users 表: 存储用户凭证和权限
 * - sessions 表: 管理登录会话
 *
 * 安全特性:
 * - 密码 SHA256 + 随机盐值哈希存储
 * - Session Token 使用 crypto.randomBytes
 * - 支持 HttpOnly, Secure, SameSite=Strict Cookie
 * - 会话过期时间可配置 (默认24小时)
 */

import Database from 'better-sqlite3';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import path from 'path';
import { parseUserAgent } from './user-agent';

// ==================== 类型定义 ====================

export interface User {
  id: number;
  username: string;
  role: 'admin' | 'operator' | 'viewer';
  permissions: string[];
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface Session {
  id: string;
  userId: number;
  token: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: string;
  createdAt: string;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  sessionToken?: string;
  error?: string;
  errorCode?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginLog {
  id: number;
  userId?: number;
  username: string;
  action: 'login_success' | 'login_failed' | 'logout' | 'password_changed';
  ipAddress?: string;
  userAgent?: string;
  deviceType?: string;
  browser?: string;
  os?: string;
  success: number;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface LoginLogQueryParams {
  userId?: number;
  action?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface LoginLogStatistics {
  totalLogins: number;
  successfulLogins: number;
  failedLogins: number;
  uniqueUsers: number;
  topIPs: Array<{ ip: string; count: number }>;
  loginByHour: number[];
}

// ==================== AuthDatabase 类 ====================

class AuthDatabase {
  private db: Database.Database | null = null;
  private dbPath: string;

  // 安全配置
  readonly SESSION_TIMEOUT_HOURS = parseInt(process.env.SESSION_TIMEOUT_HOURS || '24');
  readonly MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5');
  readonly LOGIN_LOCKOUT_MINUTES = parseInt(process.env.LOGIN_LOCKOUT_MINUTES || '15');

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), 'data', 'jobs.db');
  }

  /**
   * 连接数据库并初始化认证表
   */
  connect(): void {
    this.db = new Database(this.dbPath);
    
    // 启用 WAL 模式提升并发性能
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    
    this.createAuthTables();
    console.log(`✅ 认证数据库已连接: ${this.dbPath}`);
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  get database(): Database.Database {
    if (!this.db) {
      throw new Error('数据库未连接，请先调用 connect()');
    }
    return this.db;
  }

  // ==================== 表创建 ====================

  private createAuthTables(): void {
    const db = this.database;

    // 用户表
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
      )
    `);

    // 会话表
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 创建索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `);

    // 登录日志表
    db.exec(`
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
      )
    `);

    // 日志索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_login_logs_user_id ON login_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_login_logs_created_at ON login_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_login_logs_action ON login_logs(action);
      CREATE INDEX IF NOT EXISTS idx_login_logs_ip_address ON login_logs(ip_address);
    `);

    console.log('✅ 认证表创建/验证完成');
  }

  // ==================== 密码工具方法 ====================

  static generateSalt(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }

  static hashPassword(password: string, salt: string): string {
    return createHash('sha256').update(`${password}${salt}`).digest('hex');
  }

  static verifyPassword(password: string, salt: string, storedHash: string): boolean {
    const computedHash = AuthDatabase.hashPassword(password, salt);
    
    // 使用 timingSafeEqual 防止时序攻击
    try {
      return timingSafeEqual(
        Buffer.from(computedHash),
        Buffer.from(storedHash)
      );
    } catch {
      // 长度不同时抛出异常，返回 false
      return false;
    }
  }

  static generateSessionToken(): string {
    return randomBytes(48).toString('base64url');
  }

  // ==================== 用户 CRUD ====================

  createUser(
    username: string,
    password: string,
    role: 'admin' | 'operator' | 'viewer' = 'viewer',
    permissions?: string[]
  ): User {
    const db = this.database;

    // 检查用户名是否已存在
    const existing = this.getUserByUsername(username);
    if (existing) {
      throw new Error(`用户名 '${username}' 已存在`);
    }

    // 生成盐值和哈希密码
    const salt = AuthDatabase.generateSalt();
    const passwordHash = AuthDatabase.hashPassword(password, salt);

    // 默认权限映射
    const defaultPermissions: Record<string, string[]> = {
      admin: [
        'view_jobs', 'view_stats', 'manage_crawler', 'view_system',
        'use_recommendations', 'manage_users',
        'jobs:read', 'jobs:write', 'crawler:read', 'crawler:write',
        'system:read', 'system:write', 'users:read', 'users:write',
        'recommendations:read', 'recommendations:write',
        'match:read', 'match:write',
      ],
      operator: [
        'view_jobs', 'view_stats', 'manage_crawler', 'view_system',
        'use_recommendations',
        'jobs:read', 'jobs:write', 'crawler:read', 'crawler:write',
        'system:read', 'recommendations:read', 'recommendations:write',
        'match:read', 'match:write',
      ],
      viewer: [
        'view_jobs', 'view_stats', 'view_system', 'use_recommendations',
        'jobs:read', 'crawler:read', 'system:read',
        'recommendations:read', 'match:read',
      ]
    };

    const finalPermissions = permissions || defaultPermissions[role] || [];

    const result = db.prepare(`
      INSERT INTO users (username, password_hash, salt, role, permissions)
      VALUES (?, ?, ?, ?, ?)
    `).run(username, passwordHash, salt, role, JSON.stringify(finalPermissions));

    const user = this.getUserById(result.lastInsertRowid as number)!;

    console.log(`👤 用户创建成功: ${username} (role=${role})`);
    return user;
  }

  getUserById(id: number): User | undefined {
    const row = this.database.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!row) return undefined;

    return this.sanitizeUser(row);
  }

  getUserByUsername(username: string): User | undefined {
    const row = this.database.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
    if (!row) return undefined;

    return this.sanitizeUser(row);
  }

  getAllUsers(): User[] {
    const rows = this.database.prepare(`
      SELECT 
        id, username, role, permissions, is_active, 
        created_at, last_login_at, failed_login_count
      FROM users 
      WHERE is_active = 1
      ORDER BY id ASC
    `).all() as any[];

    return rows.map(row => ({
      id: row.id,
      username: row.username,
      role: row.role,
      permissions: JSON.parse(row.permissions || '[]'),
      isActive: !!row.is_active,
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at,
      failedLoginCount: row.failed_login_count,
    }));
  }

  updateUser(userId: number, updates: Partial<{
    username: string;
    role: 'admin' | 'operator' | 'viewer';
    permissions: string[];
    isActive: boolean;
    password: string;
  }>): User | undefined {
    const allowedFields = ['username', 'role', 'permissions', 'isActive', 'password'];
    const setClauses: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (!allowedFields.includes(key)) continue;

      if (key === 'password') {
        const salt = AuthDatabase.generateSalt();
        setClauses.push('password_hash = ?', 'salt = ?');
        values.push(AuthDatabase.hashPassword(value as string, salt), salt);
      } else if (key === 'permissions') {
        setClauses.push(`${key} = ?`);
        values.push(JSON.stringify(value));
      } else if (key === 'isActive') {
        setClauses.push('is_active = ?');
        values.push(value ? 1 : 0);
      } else {
        setClauses.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (setClauses.length === 0) return this.getUserById(userId);

    setClauses.push("updated_at = datetime('now')");
    values.push(userId);

    this.database.prepare(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`
    ).run(...values);

    console.log(`👤 用户更新成功: user_id=${userId}, 字段: [${Object.keys(updates).join(', ')}]`);
    return this.getUserById(userId);
  }

  deleteUser(userId: number): boolean {
    const db = this.database;

    // 删除该用户的所有会话
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);

    // 软删除
    const result = db.prepare(`
      UPDATE users SET is_active = 0, updated_at = datetime('now')
      WHERE id = ?
    `).run(userId);

    const deleted = result.changes > 0;
    if (deleted) console.log(`🗑️ 用户已删除: user_id=${userId}`);
    return deleted;
  }

  // ==================== 认证逻辑 ====================

  authenticate(
    credentials: LoginCredentials,
    ipAddress?: string,
    userAgent?: string
  ): AuthResult {
    const { username, password } = credentials;
    const db = this.database;

    // 查找用户
    const userRow = db.prepare(
      'SELECT * FROM users WHERE username = ?'
    ).get(username) as any;

    if (!userRow) {
      // 记录登录失败日志 (用户不存在)
      this.logLoginEvent({
        username,
        action: 'login_failed',
        ipAddress,
        userAgent,
        success: false,
        errorCode: 'INVALID_CREDENTIALS',
        errorMessage: '用户名或密码错误',
      });

      return {
        success: false,
        error: '用户名或密码错误',
        errorCode: 'INVALID_CREDENTIALS'
      };
    }

    // 检查账户锁定
    if (userRow.locked_until) {
      const lockedUntil = new Date(userRow.locked_until);
      if (new Date() < lockedUntil) {
        const remainingMinutes = Math.ceil(
          (lockedUntil.getTime() - Date.now()) / 60000
        );
        
        this.logLoginEvent({
          userId: userRow.id,
          username,
          action: 'login_failed',
          ipAddress,
          userAgent,
          success: false,
          errorCode: 'ACCOUNT_LOCKED',
          errorMessage: `账户已锁定，请 ${remainingMinutes} 分钟后重试`,
        });

        return {
          success: false,
          error: `账户已锁定，请 ${remainingMinutes} 分钟后重试`,
          errorCode: 'ACCOUNT_LOCKED'
        };
      }
    }

    // 检查账户激活状态
    if (!userRow.is_active) {
      this.logLoginEvent({
        userId: userRow.id,
        username,
        action: 'login_failed',
        ipAddress,
        userAgent,
        success: false,
        errorCode: 'ACCOUNT_DISABLED',
        errorMessage: '账户已被禁用',
      });

      return {
        success: false,
        error: '账户已被禁用',
        errorCode: 'ACCOUNT_DISABLED'
      };
    }

    // 验证密码
    if (!AuthDatabase.verifyPassword(password, userRow.salt, userRow.password_hash)) {
      this.incrementFailedLoginAttempts(userRow.id);

      const remainingAttempts = this.MAX_LOGIN_ATTEMPTS - userRow.failed_login_count - 1;
      
      // 记录登录失败日志
      this.logLoginEvent({
        userId: userRow.id,
        username,
        action: 'login_failed',
        ipAddress,
        userAgent,
        success: false,
        errorCode: 'INVALID_CREDENTIALS',
        errorMessage: `用户名或密码错误，剩余尝试次数: ${remainingAttempts}`,
      });
      
      if (remainingAttempts <= 0) {
        this.lockUserAccount(userRow.id);
        return {
          success: false,
          error: `登录失败次数过多，账户已锁定 ${this.LOGIN_LOCKOUT_MINUTES} 分钟`,
          errorCode: 'ACCOUNT_LOCKED'
        };
      }

      return {
        success: false,
        error: `用户名或密码错误，剩余尝试次数: ${remainingAttempts}`,
        errorCode: 'INVALID_CREDENTIALS'
      };
    }

    // ✅ 认证成功！创建会话
    const { sessionId, token } = this.createSession(
      userRow.id, ipAddress, userAgent
    );

    // 更新最后登录时间和重置失败计数
    db.prepare(`
      UPDATE users SET 
        last_login_at = datetime('now'),
        failed_login_count = 0,
        locked_until = NULL
      WHERE id = ?
    `).run(userRow.id);

    // 记录登录成功日志
    this.logLoginEvent({
      userId: userRow.id,
      username,
      action: 'login_success',
      ipAddress,
      userAgent,
      success: true,
    });

    // 返回安全的用户信息
    const user: User = {
      id: userRow.id,
      username: userRow.username,
      role: userRow.role,
      permissions: JSON.parse(userRow.permissions || '[]'),
      isActive: true,
      createdAt: userRow.created_at,
      lastLoginAt: new Date().toISOString(),
    };

    console.log(`✅ 用户登录成功: ${username} from ${ipAddress}`);
    return { success: true, user, sessionToken: token };
  }

  createSession(
    userId: number,
    ipAddress?: string,
    userAgent?: string
  ): { sessionId: string; token: string } {
    const sessionId = randomBytes(32).toString('base64url');
    const token = AuthDatabase.generateSessionToken();

    const expiresAt = new Date(Date.now() + this.SESSION_TIMEOUT_HOURS * 3600000);

    this.database.prepare(`
      INSERT INTO sessions (id, user_id, token, ip_address, user_agent, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sessionId, userId, token, ipAddress, userAgent, expiresAt.toISOString());

    console.log(`🔐 会话创建成功: session=${sessionId.substring(0, 8)}..., user_id=${userId}`);
    return { sessionId, token };
  }

  validateSession(token: string): User | null {
    const now = new Date().toISOString();

    const row = this.database.prepare(`
      SELECT s.*, u.username, u.role, u.permissions
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > ? AND u.is_active = 1
    `).get(token, now) as any;

    if (!row) return null;

    // 滑动续期：延长会话时间
    const newExpires = new Date(
      Date.now() + this.SESSION_TIMEOUT_HOURS * 3600000
    ).toISOString();

    this.database.prepare(`
      UPDATE sessions SET expires_at = ? WHERE id = ?
    `).run(newExpires, row.id);

    return {
      id: row.user_id,
      username: row.username,
      role: row.role,
      permissions: JSON.parse(row.permissions || '[]'),
      isActive: true,
      createdAt: row.created_at,
    };
  }

  destroySession(token: string): boolean {
    const result = this.database.prepare(
      'DELETE FROM sessions WHERE token = ?'
    ).run(token);

    const destroyed = result.changes > 0;
    if (destroyed) console.log(`🚪 会话已销毁: token=${token.substring(0, 16)}...`);
    return destroyed;
  }

  destroyAllUserSessions(userId: number): number {
    const result = this.database.prepare(
      'DELETE FROM sessions WHERE user_id = ?'
    ).run(userId);

    const count = result.changes;
    if (count > 0) console.log(`🚪 已销毁用户所有会话: user_id=${userId}, 数量=${count}`);
    return count;
  }

  // ==================== 辅助方法 ====================

  private incrementFailedLoginAttempts(userId: number): void {
    const currentCount = this.getFailedLoginCount(userId);
    const newCount = currentCount + 1;

    this.database.prepare(`
      UPDATE users SET failed_login_count = ? WHERE id = ?
    `).run(newCount, userId);

    if (newCount >= this.MAX_LOGIN_ATTEMPTS) {
      this.lockUserAccount(userId);
    }
  }

  private resetFailedLoginAttempts(userId: number): void {
    this.database.prepare(`
      UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = ?
    `).run(userId);
  }

  private lockUserAccount(userId: number): void {
    const lockUntil = new Date(
      Date.now() + this.LOGIN_LOCKOUT_MINUTES * 60000
    ).toISOString();

    this.database.prepare(`
      UPDATE users SET 
        locked_until = ?,
        failed_login_count = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(lockUntil, this.MAX_LOGIN_ATTEMPTS, userId);

    console.warn(`🔒 用户账户已锁定: user_id=${userId}, 解锁时间: ${lockUntil}`);
  }

  private getFailedLoginCount(userId: number): number {
    const row = this.database.prepare(
      'SELECT failed_login_count FROM users WHERE id = ?'
    ).get(userId) as any;

    return row?.failed_login_count || 0;
  }

  private sanitizeUser(row: any): User {
    return {
      id: row.id,
      username: row.username,
      role: row.role,
      permissions: JSON.parse(row.permissions || '[]'),
      isActive: !!row.is_active,
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at,
    };
  }

  getUserSessions(userId: number): Session[] {
    const now = new Date().toISOString();

    const rows = this.database.prepare(`
      SELECT id, token, ip_address, user_agent, created_at, expires_at
      FROM sessions 
      WHERE user_id = ? AND expires_at > ?
      ORDER BY created_at DESC
    `).all(userId, now) as any[];

    return rows.map(row => ({
      id: row.id,
      userId,
      token: row.token,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    }));
  }

  cleanupExpiredSessions(): number {
    const now = new Date().toISOString();
    const result = this.database.prepare(
      'DELETE FROM sessions WHERE expires_at < ?'
    ).run(now);

    if (result.changes > 0) {
      console.log(`🧹 已清理 ${result.changes} 个过期会话`);
    }

    return result.changes;
  }

  // ==================== 登录日志方法 ====================

  logLoginEvent(params: {
    userId?: number;
    username: string;
    action: 'login_success' | 'login_failed' | 'logout' | 'password_changed';
    ipAddress?: string;
    userAgent?: string;
    success?: boolean;
    errorCode?: string;
    errorMessage?: string;
  }): number {
    const db = this.database;

    // 解析 User-Agent
    let deviceType: string | undefined;
    let browser: string | undefined;
    let os: string | undefined;

    if (params.userAgent) {
      const parsed = parseUserAgent(params.userAgent);
      deviceType = parsed.deviceType;
      browser = parsed.browser;
      os = parsed.os;
    }

    const result = db.prepare(`
      INSERT INTO login_logs (
        user_id, username, action, ip_address, user_agent,
        device_type, browser, os, success, error_code, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.userId,
      params.username,
      params.action,
      params.ipAddress,
      params.userAgent,
      deviceType,
      browser,
      os,
      params.success !== false ? 1 : 0,
      params.errorCode || null,
      params.errorMessage || null
    );

    const logId = result.lastInsertRowid as number;
    
    const actionEmoji = params.action === 'login_success' ? '✅' :
                        params.action === 'login_failed' ? '❌' :
                        params.action === 'logout' ? '🚪' : '🔑';
    console.log(`${actionEmoji} 登录日志已记录: action=${params.action}, user=${params.username}, ip=${params.ipAddress}`);
    
    return logId;
  }

  getLoginLogs(params: LoginLogQueryParams): { logs: LoginLog[]; total: number } {
    const db = this.database;
    const conditions: string[] = [];
    const values: any[] = [];

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

    // 查询总数
    const countResult = db.prepare(
      `SELECT COUNT(*) as count FROM login_logs ${whereClause}`
    ).get(...values) as { count: number };
    const total = countResult.count;

    // 查询日志
    const rows = db.prepare(`
      SELECT * FROM login_logs 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...values, limit, offset) as any[];

    const logs: LoginLog[] = rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      username: row.username,
      action: row.action,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      deviceType: row.device_type,
      browser: row.browser,
      os: row.os,
      success: row.success,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    }));

    return { logs, total };
  }

  getLoginLogStatistics(params?: {
    startDate?: string;
    endDate?: string;
  }): LoginLogStatistics {
    const db = this.database;
    const conditions: string[] = [];
    const values: any[] = [];

    if (params?.startDate) {
      conditions.push("created_at >= ?");
      values.push(params.startDate);
    }

    if (params?.endDate) {
      conditions.push("created_at <= ?");
      values.push(params.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const whereForLogin = `${whereClause}${whereClause ? ' AND' : 'WHERE'} action IN ('login_success', 'login_failed')`;

    // 总登录次数
    const totalResult = db.prepare(
      `SELECT COUNT(*) as count FROM login_logs ${whereForLogin}`
    ).get(...values) as { count: number };

    // 成功登录
    const successResult = db.prepare(
      `SELECT COUNT(*) as count FROM login_logs ${whereForLogin} AND success = 1`
    ).get(...values) as { count: number };

    // 失败登录
    const failedResult = db.prepare(
      `SELECT COUNT(*) as count FROM login_logs ${whereForLogin} AND success = 0`
    ).get(...values) as { count: number };

    // 唯一用户数
    const uniqueUsersResult = db.prepare(
      `SELECT COUNT(DISTINCT user_id) as count FROM login_logs ${whereForLogin}`
    ).get(...values) as { count: number };

    // Top IP 地址
    const topIPsRows = db.prepare(`
      SELECT ip_address as ip, COUNT(*) as count 
      FROM login_logs ${whereForLogin} 
      GROUP BY ip_address 
      ORDER BY count DESC 
      LIMIT 10
    `).all(...values) as Array<{ ip: string; count: number }>;

    // 按小时统计 (24小时)
    const hourlyStats = new Array(24).fill(0);
    const hourlyRows = db.prepare(`
      SELECT strftime('%H', created_at) as hour, COUNT(*) as count
      FROM login_logs ${whereForLogin}
      GROUP BY hour
    `).all(...values) as Array<{ hour: string; count: number }>;

    for (const row of hourlyRows) {
      const hour = parseInt(row.hour, 10);
      if (!isNaN(hour) && hour >= 0 && hour < 24) {
        hourlyStats[hour] = row.count;
      }
    }

    return {
      totalLogins: totalResult.count,
      successfulLogins: successResult.count,
      failedLogins: failedResult.count,
      uniqueUsers: uniqueUsersResult.count,
      topIPs: topIPsRows.filter(row => row.ip),
      loginByHour: hourlyStats,
    };
  }

  getRecentFailedAttempts(username: string, minutes: number = 15, maxAttempts: number = 5): LoginLog[] {
    const since = new Date(Date.now() - minutes * 60000).toISOString();
    
    const rows = this.database.prepare(`
      SELECT * FROM login_logs 
      WHERE username = ? 
        AND action = 'login_failed'
        AND created_at >= ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(username, since, maxAttempts) as any[];

    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      username: row.username,
      action: row.action,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      deviceType: row.device_type,
      browser: row.browser,
      os: row.os,
      success: row.success,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    }));
  }
}

// ==================== 单例导出 ====================

let _authDbInstance: AuthDatabase | null = null;

/**
 * 获取全局认证数据库实例 (单例模式)
 */
function getAuthDb(): AuthDatabase {
  if (!_authDbInstance) {
    _authDbInstance = new AuthDatabase();
    _authDbInstance.connect();
  }
  return _authDbInstance;
}

export { AuthDatabase, getAuthDb };
