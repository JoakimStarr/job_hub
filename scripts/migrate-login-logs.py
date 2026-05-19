#!/usr/bin/env python3
"""
数据库迁移脚本: 添加 login_logs 表

用于记录用户登录/登出等安全事件日志
"""

import sqlite3
import os
import sys
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'jobs.db')

def run_migration():
    if not os.path.exists(DB_PATH):
        print(f"❌ 数据库文件不存在: {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # 检查表是否已存在
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='login_logs'
        """)
        
        if cursor.fetchone():
            print("✅ login_logs 表已存在，跳过创建")
        else:
            # 创建 login_logs 表
            cursor.executescript("""
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

                CREATE INDEX IF NOT EXISTS idx_login_logs_user_id ON login_logs(user_id);
                CREATE INDEX IF NOT EXISTS idx_login_logs_created_at ON login_logs(created_at);
                CREATE INDEX IF NOT EXISTS idx_login_logs_action ON login_logs(action);
                CREATE INDEX IF NOT EXISTS idx_login_logs_ip_address ON login_logs(ip_address);
            """)
            
            print("✅ login_logs 表创建成功")

        conn.commit()

        # 验证表结构
        cursor.execute("PRAGMA table_info(login_logs)")
        columns = [col[1] for col in cursor.fetchall()]
        expected_columns = [
            'id', 'user_id', 'username', 'action', 'ip_address', 
            'user_agent', 'device_type', 'browser', 'os', 'success',
            'error_code', 'error_message', 'created_at'
        ]
        
        if all(col in columns for col in expected_columns):
            print(f"✅ 表结构验证通过 ({len(columns)} 列)")
        else:
            print(f"⚠️ 表结构可能不完整，期望列: {expected_columns}")

        # 显示索引信息
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='index' AND tbl_name='login_logs' AND name LIKE 'idx_login_logs%'
        """)
        indexes = [idx[0] for idx in cursor.fetchall()]
        print(f"✅ 索引创建完成: {indexes}")

    except Exception as e:
        print(f"❌ 迁移失败: {e}")
        conn.rollback()
        sys.exit(1)
    finally:
        conn.close()

if __name__ == '__main__':
    print(f"📦 开始迁移: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"📂 数据库路径: {DB_PATH}")
    run_migration()
    print("✨ 迁移完成")
