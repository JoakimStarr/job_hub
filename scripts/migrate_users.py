#!/usr/bin/env python3
"""
用户数据迁移脚本 (Python版)

将现有的环境变量用户迁移到 SQLite 数据库
默认密码: root

使用方法:
    python3 scripts/migrate_users.py [db_path]
    
示例:
    python3 scripts/migrate_users.py                    # 使用默认路径 data/jobs.db
    python3 scripts/migrate_users.py /path/to/custom.db # 指定数据库路径
"""

import sys
import os
import hashlib
import secrets
import sqlite3
from datetime import datetime
from pathlib import Path


def generate_salt(length: int = 32) -> str:
    """生成随机盐值"""
    return secrets.token_hex(length)


def hash_password(password: str, salt: str) -> str:
    """SHA256 + Salt 哈希"""
    salted = f"{password}{salt}".encode('utf-8')
    return hashlib.sha256(salted).hexdigest()


# 默认密码 (用户指定)
DEFAULT_PASSWORD = "root"

# 要迁移的用户列表
USERS_TO_MIGRATE = [
    {
        'username': 'admin',
        'role': 'admin',
        'permissions': [
            'view_jobs', 'view_stats', 'manage_crawler', 'view_system',
            'use_recommendations', 'manage_users',
            'jobs:read', 'jobs:write', 'crawler:read', 'crawler:write',
            'system:read', 'system:write', 'users:read', 'users:write',
            'recommendations:read', 'recommendations:write',
            'match:read', 'match:write',
        ]
    },
    {
        'username': 'operator',
        'role': 'operator',
        'permissions': [
            'view_jobs', 'view_stats', 'manage_crawler', 'view_system',
            'use_recommendations',
            'jobs:read', 'jobs:write', 'crawler:read', 'crawler:write',
            'system:read', 'recommendations:read', 'recommendations:write',
            'match:read', 'match:write',
        ]
    },
    {
        'username': 'viewer',
        'role': 'viewer',
        'permissions': [
            'view_jobs', 'view_stats', 'view_system', 'use_recommendations',
            'jobs:read', 'crawler:read', 'system:read',
            'recommendations:read', 'match:read',
        ]
    }
]


def migrate_users(db_path: str):
    """执行用户迁移"""
    
    print("=" * 60)
    print("🚀 开始迁移用户到数据库...")
    print(f"📁 数据库路径: {db_path}")
    print(f"🔑 默认密码: {DEFAULT_PASSWORD}")
    print()
    
    db_path = Path(db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # 启用 WAL 模式
        cursor.execute("PRAGMA journal_mode = WAL")
        
        print("✅ 数据库连接成功\n")
        
        # 创建认证表
        cursor.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'viewer',
                permissions TEXT DEFAULT '[]',
                is_active INTEGER DEFAULT 1,
                failed_login_count INTEGER DEFAULT 0,
                locked_until TIMESTAMP NULL,
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
            
            CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
            CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        """)
        
        print("✅ 认证表已就绪\n")
        
        # 检查现有用户
        cursor.execute("SELECT COUNT(*) FROM users")
        existing_count = cursor.fetchone()[0]
        
        if existing_count > 0:
            print(f"⚠️ 数据库中已有 {existing_count} 个用户")
            
            answer = input("是否继续覆盖？(y/N): ").strip().lower()
            
            if answer != 'y':
                print("\n❌ 迁移已取消")
                conn.close()
                return
            
            # 清空现有数据
            cursor.execute("DELETE FROM sessions")
            cursor.execute("DELETE FROM users")
            conn.commit()
            print("✅ 已清空现有用户数据\n")
        
        # 插入新用户
        success_count = 0
        fail_count = 0
        
        for user in USERS_TO_MIGRATE:
            try:
                salt = generate_salt()
                password_hash = hash_password(DEFAULT_PASSWORD, salt)
                
                cursor.execute("""
                    INSERT INTO users 
                    (username, password_hash, salt, role, permissions)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    user['username'],
                    password_hash,
                    salt,
                    user['role'],
                    str(user['permissions'])
                ))
                
                if cursor.rowcount > 0:
                    print(f"  ✅ {user['username']:12s} | 角色: {user['role']:10s} | 密码: {DEFAULT_PASSWORD}")
                    success_count += 1
                else:
                    print(f"  ❌ {user['username']:12s} | 插入失败")
                    fail_count += 1
                    
            except sqlite3.IntegrityError as e:
                if 'UNIQUE' in str(e):
                    print(f"  ⚠️ {user['username']:12s} | 已存在，跳过")
                else:
                    print(f"  ❌ {user['username']:12s} | 错误: {e}")
                    fail_count += 1
            except Exception as e:
                print(f"  ❌ {user['username']:12s} | 错误: {e}")
                fail_count += 1
        
        conn.commit()
        
        # 输出结果
        print()
        print("=" * 60)
        print(f"📊 迁移结果:")
        print(f"  ✅ 成功: {success_count} 个用户")
        print(f"  ❌ 失败: {fail_count} 个用户")
        print()
        print(f"📝 登录信息:")
        print(f"  用户名: {'admin':12s} | 密码: {DEFAULT_PASSWORD:10s} | 角色: 管理员")
        print(f"  用户名: {'operator':12s} | 密码: {DEFAULT_PASSWORD:10s} | 角色: 操作员")
        print(f"  用户名: {'viewer':12s} | 密码: {DEFAULT_PASSWORD:10s} | 角色: 访客")
        print()
        print("⚠️ 请立即修改默认密码！")
        print("=" * 60)
        
        conn.close()
        
    except Exception as e:
        print(f"\n❌ 迁移失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    # 获取数据库路径参数
    if len(sys.argv) > 1:
        db_path = sys.argv[1]
    else:
        # 默认路径
        db_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'data',
            'jobs.db'
        )
    
    migrate_users(db_path)
