/**
 * 用户数据迁移脚本
 *
 * 将现有的环境变量用户迁移到数据库
 * 默认密码: root
 * 角色: admin / operator / viewer
 */

import Database from 'better-sqlite3';
import { createHash, randomBytes } from 'crypto';
import path from 'path';

// ==================== 配置 ====================

const DB_PATH = process.argv[2] || path.join(process.cwd(), 'data', 'jobs.db');
const DEFAULT_PASSWORD = 'root'; // 用户指定的默认密码

// 要迁移的用户列表 (从 .env 迁移)
const USERS_TO_MIGRATE = [
  {
    username: 'admin',
    role: 'admin',
    permissions: [
      'view_jobs', 'view_stats', 'manage_crawler', 'view_system',
      'use_recommendations', 'manage_users',
      'jobs:read', 'jobs:write', 'crawler:read', 'crawler:write',
      'system:read', 'system:write', 'users:read', 'users:write',
      'recommendations:read', 'recommendations:write',
      'match:read', 'match:write',
    ]
  },
  {
    username: 'operator',
    role: 'operator',
    permissions: [
      'view_jobs', 'view_stats', 'manage_crawler', 'view_system',
      'use_recommendations',
      'jobs:read', 'jobs:write', 'crawler:read', 'crawler:write',
      'system:read', 'recommendations:read', 'recommendations:write',
      'match:read', 'match:write',
    ]
  },
  {
    username: 'viewer',
    role: 'viewer',
    permissions: [
      'view_jobs', 'view_stats', 'view_system', 'use_recommendations',
      'jobs:read', 'crawler:read', 'system:read',
      'recommendations:read', 'match:read',
    ]
  }
];

// ==================== 工具函数 ====================

function generateSalt(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

function hashPassword(password: string, salt: string): string {
  return createHash('sha256').update(`${password}${salt}`).digest('hex');
}

// ==================== 主逻辑 ====================

async function migrateUsers() {
  console.log('=' .repeat(60));
  console.log('🚀 开始迁移用户到数据库...');
  console.log(`📁 数据库路径: ${DB_PATH}`);
  console.log(`🔑 默认密码: ${DEFAULT_PASSWORD}`);
  console.log('');

  let db: Database.Database | undefined;

  try {
    // 连接数据库
    db = new Database(DB_PATH);
    
    // 启用 WAL 模式
    db.pragma('journal_mode = WAL');

    console.log('✅ 数据库连接成功\n');

    // 创建认证表 (如果不存在)
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

    console.log('✅ 认证表已就绪\n');

    // 检查是否已有用户
    const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
    
    if (existingUsers.count > 0) {
      console.log(`⚠️ 数据库中已有 ${existingUsers.count} 个用户`);
      
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise<string>((resolve) => {
        rl.question('是否继续覆盖？(y/N): ', resolve);
      });
      rl.close();

      if (answer.toLowerCase() !== 'y') {
        console.log('\n❌ 迁移已取消');
        db.close();
        return;
      }

      // 清空现有用户和会话
      db.exec('DELETE FROM sessions');
      db.exec('DELETE FROM users');
      console.log('✅ 已清空现有用户数据\n');
    }

    // 插入新用户
    let successCount = 0;
    let failCount = 0;

    for (const user of USERS_TO_MIGRATE) {
      try {
        const salt = generateSalt();
        const passwordHash = hashPassword(DEFAULT_PASSWORD, salt);

        const result = db.prepare(`
          INSERT INTO users (username, password_hash, salt, role, permissions)
          VALUES (?, ?, ?, ?, ?)
        `).run(user.username, passwordHash, salt, user.role, JSON.stringify(user.permissions));

        if (result.changes > 0) {
          console.log(`  ✅ ${user.username.padEnd(12)} | 角色: ${user.role.padEnd(10)} | 密码: ${DEFAULT_PASSWORD}`);
          successCount++;
        } else {
          console.log(`  ❌ ${user.username.padEnd(12)} | 插入失败`);
          failCount++;
        }

      } catch (error: any) {
        if (error.message?.includes('UNIQUE constraint')) {
          console.log(`  ⚠️ ${user.username.padEnd(12)} | 已存在，跳过`);
        } else {
          console.error(`  ❌ ${user.username.padEnd(12)} | 错误: ${error.message}`);
          failCount++;
        }
      }
    }

    console.log('');
    console.log('=' .repeat(60));
    console.log(`📊 迁移结果:`);
    console.log(`  ✅ 成功: ${successCount} 个用户`);
    console.log(`  ❌ 失败: ${failCount} 个用户`);
    console.log('');
    console.log(`📝 登录信息:`);
    console.log(`  用户名: admin     | 密码: ${DEFAULT_PASSWORD} | 角色: 管理员`);
    console.log(`  用户名: operator  | 密码: ${DEFAULT_PASSWORD} | 角色: 操作员`);
    console.log(`  用户名: viewer    | 密码: ${DEFAULT_PASSWORD} | 角色:访客`);
    console.log('');
    console.log('⚠️ 请立即修改默认密码！');
    console.log('=' .repeat(60));

    db.close();

  } catch (error) {
    console.error('❌ 迁移失败:', error);
    if (db) db.close();
    process.exit(1);
  }
}

// 执行迁移
migrateUsers();
