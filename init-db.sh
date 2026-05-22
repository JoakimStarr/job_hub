#!/bin/bash
# ============================================================================
# Job Hub 数据库初始化脚本
# 
# 功能：初始化数据库表结构
# - 用户认证相关表（users, sessions, login_logs）
# - 其他业务表（jobs, crawl_state, user_job_alerts等）
# 
# 使用方法：
#   chmod +x init-db.sh
#   ./init-db.sh [db_path]
#
# 参数：
#   db_path - 数据库文件路径（可选，默认为 data/jobs.db）
# ============================================================================

set -e

DB_PATH="${1:-data/jobs.db}"
DB_DIR=$(dirname "$DB_PATH")

echo "============================================"
echo "  Job Hub 数据库初始化脚本"
echo "============================================"
echo ""
echo "数据库路径: $DB_PATH"
echo ""

mkdir -p "$DB_DIR"

if [ -f "$DB_PATH" ]; then
    echo "⚠️  数据库文件已存在: $DB_PATH"
    read -p "是否继续初始化？(y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "已取消初始化"
        exit 0
    fi
    echo ""
fi

sqlite3 "$DB_PATH" << 'EOF'
-- ============================================================================
-- PRAGMA 设置
-- ============================================================================
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;

-- ============================================================================
-- 用户认证相关表
-- ============================================================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('admin', 'operator', 'viewer')),
    permissions TEXT DEFAULT '[]',
    is_active INTEGER DEFAULT 1,
    failed_login_count INTEGER DEFAULT 0,
    locked_until TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP NULL
);

-- 会话表
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

-- 登录日志表
CREATE TABLE IF NOT EXISTS login_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('login_success', 'login_failed', 'logout', 'password_changed')),
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

-- 用户认证相关索引
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_login_logs_user_id ON login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_created_at ON login_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_login_logs_action ON login_logs(action);
CREATE INDEX IF NOT EXISTS idx_login_logs_ip_address ON login_logs(ip_address);

-- ============================================================================
-- 业务数据表
-- ============================================================================

-- 岗位表
CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    company TEXT,
    location TEXT,
    salary TEXT,
    description TEXT,
    requirements TEXT,
    job_type TEXT,
    industry TEXT,
    education TEXT,
    experience TEXT,
    contact TEXT,
    source TEXT NOT NULL,
    university TEXT,
    source_url TEXT UNIQUE,
    apply_url TEXT,
    publish_date TEXT,
    deadline TEXT,
    tags TEXT,
    is_favorite INTEGER DEFAULT 0,
    favorite_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    content_hash TEXT UNIQUE,
    quality_score INTEGER DEFAULT 0
);

-- 爬取状态表
CREATE TABLE IF NOT EXISTS crawl_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT UNIQUE NOT NULL,
    last_page INTEGER DEFAULT 0,
    last_count INTEGER DEFAULT 0,
    extra TEXT DEFAULT '{}',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 用户画像表
CREATE TABLE IF NOT EXISTS user_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT,
    email TEXT,
    education TEXT,
    school TEXT,
    major TEXT,
    graduation_year TEXT,
    skills TEXT,
    experience TEXT,
    certifications TEXT,
    awards TEXT,
    projects TEXT,
    self_introduction TEXT,
    job_intention TEXT,
    expected_salary TEXT,
    expected_location TEXT,
    expected_position TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 职位提醒订阅表
CREATE TABLE IF NOT EXISTS user_job_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    keywords TEXT NOT NULL,
    sources TEXT,
    locations TEXT,
    industries TEXT,
    min_salary TEXT,
    education TEXT,
    enabled INTEGER DEFAULT 1,
    last_notified_at TEXT,
    notify_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 职位提醒推送历史表
CREATE TABLE IF NOT EXISTS job_alert_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id INTEGER NOT NULL,
    job_ids TEXT NOT NULL,
    matched_count INTEGER DEFAULT 0,
    email_sent INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (alert_id) REFERENCES user_job_alerts(id) ON DELETE CASCADE
);

-- AI推荐历史表
CREATE TABLE IF NOT EXISTS recommendation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    mode TEXT,
    input_summary TEXT,
    result TEXT,
    model TEXT,
    tokens_used INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 用户简历表
CREATE TABLE IF NOT EXISTS user_resumes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name TEXT,
    file_path TEXT,
    file_size INTEGER,
    file_type TEXT,
    parsed_content TEXT,
    profile_json TEXT,
    confidence INTEGER DEFAULT 0,
    warnings TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 聊天会话表
CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    title TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 聊天消息表
CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    model TEXT,
    tokens_used INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

-- AI日志表
CREATE TABLE IF NOT EXISTS ai_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT,
    model TEXT,
    endpoint TEXT,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    latency_ms INTEGER,
    status TEXT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 向量嵌入缓存表
CREATE TABLE IF NOT EXISTS embedding_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_hash TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    embedding BLOB NOT NULL,
    model TEXT NOT NULL,
    dimension INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 地点映射表
CREATE TABLE IF NOT EXISTS location_mapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('province', 'city')),
    province TEXT,
    pinyin TEXT,
    first_letter TEXT
);

-- 学历映射表
CREATE TABLE IF NOT EXISTS education_mapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    level INTEGER NOT NULL,
    alias TEXT
);

-- 业务数据索引
CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);
CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs(location);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);
CREATE INDEX IF NOT EXISTS idx_jobs_publish_date ON jobs(publish_date);
CREATE INDEX IF NOT EXISTS idx_jobs_is_favorite ON jobs(is_favorite);
CREATE INDEX IF NOT EXISTS idx_jobs_content_hash ON jobs(content_hash);
CREATE INDEX IF NOT EXISTS idx_crawl_state_source ON crawl_state(source);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created_at ON ai_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_embedding_cache_content_hash ON embedding_cache(content_hash);

-- ============================================================================
-- 插入默认管理员账户
-- 密码: admin123 (请在首次登录后立即修改)
-- ============================================================================

-- 检查是否已存在admin用户
INSERT OR IGNORE INTO users (username, password_hash, salt, role, permissions)
SELECT 
    'admin',
    -- SHA256('admin123' + 'default_admin_salt_32_characters_long')
    '080a2f350b09773191c4c50a57f6b23701e0b2a58b388aa83f4c7a3ccce5b5d7',
    'default_admin_salt_32_characters_long',
    'admin',
    '["view_jobs", "view_stats", "manage_crawler", "view_system", "use_recommendations", "manage_users", "jobs:read", "jobs:write", "crawler:read", "crawler:write", "system:read", "system:write", "users:read", "users:write", "recommendations:read", "recommendations:write", "match:read", "match:write"]';

-- ============================================================================
-- 插入默认学历映射数据
-- ============================================================================

INSERT OR IGNORE INTO education_mapping (name, level, alias) VALUES
    ('不限', 0, ''),
    ('中专', 1, '中技,职高'),
    ('大专', 2, '专科,高职'),
    ('本科', 3, '学士,大学本科'),
    ('硕士', 4, '研究生,硕士研究生'),
    ('博士', 5, '博士研究生'),
    ('博士后', 6, '');

EOF

echo ""
echo "============================================"
echo "  ✅ 数据库初始化完成"
echo "============================================"
echo ""
echo "已创建的表："
sqlite3 "$DB_PATH" ".tables"
echo ""
echo "默认管理员账户："
echo "  用户名: admin"
echo "  密码: admin123"
echo "  ⚠️  请在首次登录后立即修改密码！"
echo ""
echo "数据库文件: $DB_PATH"
echo "数据库大小: $(du -h "$DB_PATH" | cut -f1)"
echo ""
