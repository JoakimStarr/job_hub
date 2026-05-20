# 阿里云服务器部署指南

> FinIntern Hub 项目从零开始的完整部署方案

---

## 目录

1. [服务器购买与配置](#1-服务器购买与配置)
2. [基础环境安装](#2-基础环境安装)
3. [项目部署](#3-项目部署)
4. [爬虫运行配置](#4-爬虫运行配置)
5. [进程管理（PM2 + systemd）](#5-进程管理pm2--systemd)
6. [Nginx 反向代理与 SSL](#6-nginx-反向代理与-ssl)
7. [域名解析](#7-域名解析)
8. [定时任务（Crontab）](#8-定时任务crontab)
9. [监控与日志](#9-监控与日志)
10. [常见问题排查](#10-常见问题排查)

---

## 1. 服务器购买与配置

### 1.1 推荐配置

| 配置项 | 最低要求 | 推荐配置 | 说明 |
|--------|----------|----------|------|
| **CPU** | 2核 | 4核 | 爬虫需要CPU |
| **内存** | 4GB | 8GB | Node.js + Python |
| **硬盘** | 40GB SSD | 80GB SSD | 数据库+日志 |
| **带宽** | 3Mbps | 5Mbps | 看访问量 |
| **操作系统** | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS | 本文档基于此 |

### 1.2 阿里云购买步骤

1. 登录 [阿里云控制台](https://ecs.console.aliyun.com/)
2. **云服务器 ECS** → **创建实例**
3. 选择配置：
   - **付费模式**：按量付费（测试）/ 包年包月（生产）
   - **实例规格**：ecs.c6.large (2核4G) 或 ecs.c6.xlarge (4核8G)
   - **镜像**：Ubuntu 22.04 LTS
   - **存储**：40-80GB ESSD 云盘
   - **带宽**：按固定带宽 3-5Mbps
4. 设置**安全组规则**（见下方）
5. 设置**登录密码**或绑定**SSH密钥**

### 1.3 安全组配置（重要！）

在阿里云控制台 → ECS → 安全组，添加以下入方向规则：

| 协议 | 端口范围 | 授权对象 | 说明 |
|------|----------|----------|------|
| TCP | 22 | 0.0.0.0/0 | SSH（建议限制IP）|
| TCP | 80 | 0.0.0.0/0 | HTTP |
| TCP | 443 | 0.0.0.0/0 | HTTPS |
| TCP | 3000 | 0.0.0.0/0 | Next.js 开发端口（可选）|

---

## 2. 基础环境安装

### 2.1 连接服务器

```bash
# SSH连接（替换为你的公网IP）
ssh root@你的服务器IP

# 首次连接后更新系统
apt update && apt upgrade -y
```

### 2.2 安装必要工具

```bash
# 基础工具
apt install -y git curl wget vim htop net-tools unzip

# 构建工具（编译 better-sqlite3 需要）
apt install -y build-essential python3-dev

# Node.js (使用 nvm 管理多版本)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# 重新加载 shell
source ~/.bashrc

# 安装 Node.js 20 LTS
nvm install 20
nvm use 20
nvm alias default 20

# 验证安装
node -v   # v20.x.x
npm -v    # 10.x.x
```

### 2.3 安装 Python 环境

```bash
# 检查 Python 版本（Ubuntu 22.04 自带 Python 3.10）
python3 --version  # 应该是 3.10+

# 安装 pip
apt install -y python3-pip python3-venv

# 升级 pip
pip3 install --upgrade pip
```

### 2.4 创建部署用户（推荐）

```bash
# 创建专用用户（不要用 root 运行应用）
adduser deploy
usermod -aG sudo deploy

# 切换到 deploy 用户
su - deploy

# 配置 SSH 密钥（在本地电脑执行）
ssh-copy-id deploy@你的服务器IP
```

---

## 3. 项目部署

### 3.1 克隆项目

```bash
# 切换到 deploy 用户
su - deploy

# 克隆项目（替换为你的仓库地址）
cd /opt
sudo mkdir -p /opt/job_hub
sudo chown deploy:deploy /opt/job_hub
cd /opt/job_hub

git clone 你的仓库地址 .
```

### 3.2 安装前端依赖

```bash
cd /opt/job_hub

# 安装 Node.js 依赖
npm install

# 构建生产版本
npm run build
```

### 3.3 安装 Python 依赖

```bash
cd /opt/job_hub

# 创建虚拟环境（推荐）
python3 -m venv venv
source venv/bin/activate

# 安装 Python 依赖
pip install -r requirements.txt

# 如果没有 requirements.txt，手动安装核心依赖：
pip install \
    aiohttp \
    beautifulsoup4 \
    lxml \
    loguru \
    better-sqlite3 \
    playwright \
    pandas \
    requests

# 安装 Playwright 浏览器（如果需要浏览器爬虫）
playwright install chromium
playwright install-deps
```

### 3.4 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env  # 或 .env.ai.example
nano .env
```

编辑 `.env` 文件：

```bash
# ===== 认证配置 =====
ADMIN_TOKEN=你的随机管理员token_请修改
OPERATOR_TOKEN=你的随机操作员token_请修改
VIEWER_TOKEN=你的随机访客token_请修改
AUTH_SALT=你的随机盐值_至少32字符

# ===== 数据库配置 =====
DATABASE_PATH=/opt/job_hub/data/jobs.db

# ===== 会话配置 =====
SESSION_TIMEOUT_HOURS=24
MAX_LOGIN_ATTEMPTS=5
LOGIN_LOCKOUT_MINUTES=15

# ===== AI 配置（可选）=====
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.openai.com/v1
```

生成随机 Token：

```bash
# 生成随机 token
openssl rand -hex 24
```

### 3.5 初始化数据库目录

```bash
# 创建数据目录
mkdir -p /opt/job_hub/data

# 设置权限
chmod 755 /opt/job_hub/data
```

### 3.6 测试启动

```bash
# 启动 Next.js 开发服务器测试
npm run dev

# 或启动生产服务器
npm run start
```

访问 `http://服务器IP:3000` 测试是否正常。

---

## 4. 爬虫运行配置

### 4.1 爬虫架构说明

```
┌─────────────────────────────────────────────┐
│              爬虫系统架构                     │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────┐   ┌─────────────────────┐    │
│  │ HTTP爬虫  │   │    浏览器爬虫        │    │
│  ├──────────┤   ├─────────────────────┤    │
│  │ • sufe   │   │ • smartedu          │    │
│  │ • zuel   │   │ • uibe             │    │
│  │ • cufe   │   │ • jxufe            │    │
│  │ • dufe   │   │ • neu              │    │
│  │ • swufe  │   └─────────────────────┘    │
│  └──────────┘                              │
│         ↓                                   │
│  ┌─────────────────────┐                   │
│  │   AsyncMultiCrawler │                   │
│  │   (统一调度器)       │                   │
│  └──────────┬──────────┘                   │
│             ↓                               │
│  ┌─────────────────────┐                   │
│  │   SQLite 数据库     │                   │
│  │   jobs.db           │                   │
│  └─────────────────────┘                   │
│                                             │
└─────────────────────────────────────────────┘
```

### 4.2 运行单个爬虫

```bash
cd /opt/job_hub

# 激活 Python 虚拟环境
source venv/bin/activate

# 方式1: 交互式选择
python3 src/spiders/run.py

# 方式2: 直接指定源
python3 src/spiders/run.py --sources sufe,zuel,cufe

# 方式3: 运行所有爬虫
python3 src/spiders/run.py --all

# 方式4: 仅 HTTP 爬虫（快速）
python3 src/spiders/run.py --http-only

# 方式5: 后台运行（输出到日志文件）
nohup python3 src/spiders/run.py --sources sufe > logs/sufe_$(date +%Y%m%d).log 2>&1 &
```

### 4.3 爬虫命令参数

```bash
python3 src/spiders/run.py [选项]

选项:
  --sources SOURCE1,SOURCE2    指定要运行的爬虫源（逗号分隔）
  --all                       运行所有爬虫
  --http-only                 仅运行HTTP爬虫
  --browser-only              仅运行浏览器爬虫
  --list-sources              列出所有可用爬虫
  --days N                    爬取最近N天的数据（默认30）
  --max-pages N               每个源最大页数（默认50）
  --delay SECONDS             请求间隔秒数（默认1.5）
  --output DIR                输出目录（默认 ./data）
  --help                      显示帮助信息
```

### 4.4 可用爬虫列表

| 源代码 | 学校名称 | 类型 | 速度 | 备注 |
|--------|----------|------|------|------|
| `sufe` | 上海财经大学 | HTTP | ⚡ 快 | 推荐 |
| `zuel` | 中南财经政法大学 | HTTP | ⚡ 快 | 推荐 |
| `cufe` | 中央财经大学 | HTTP | ⚡ 快 | 推荐 |
| `dufe` | 东北财经大学 | HTTP | ⚡ 快 | 推荐 |
| `swufe` | 西南财经大学 | HTTP | ⚡ 快 | 推荐 |
| `smarterdu` | 国家就业平台 | Browser | 🐢 慢 | 需Playwright |
| `uibe` | 对外经贸大学 | Browser | 🐢 慢 | 需Playwright |
| `jxufe` | 江西财经大学 | Browser | 🐢 慢 | 需Playwright |
| `neu` | 东北大学 | Browser | 🐢 慢 | 需Playwright |

---

## 5. 进程管理（PM2 + systemd）

### 5.1 使用 PM2 管理 Node.js 进程

```bash
# 全局安装 PM2
npm install -g pm2

# 创建 PM2 配置文件
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'job-hub-web',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/opt/job_hub',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      error_file: '/opt/job_hub/logs/web-error.log',
      out_file: '/opt/job_hub/logs/web-out.log',
      time: true,
    }
  ]
};
EOF

# 创建日志目录
mkdir -p /opt/job_hub/logs

# 启动应用
pm2 start ecosystem.config.js

# 保存进程列表（开机自启）
pm2 save

# 设置 PM2 开机自启
pm2 startup systemd -u deploy --hp /home/deploy
```

### 5.2 使用 Systemd 管理爬虫任务

```bash
# 创建爬虫服务文件
sudo tee /etc/systemd/system/job-hub-spider.service << 'EOF'
[Unit]
Description=Job Hub Spider Service
After=network.target

[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=/opt/job_hub
ExecStart=/opt/job_hub/venv/bin/python3 /opt/job_hub/src/spiders/run.py --sources sufe,zuel,cufe,dufe,swufe --days 7
Restart=always
RestartSec=10
StandardOutput=append:/opt/job_hub/logs/spider.log
StandardError=append:/opt/job_hub/logs/spider-error.log

[Install]
WantedBy=multi-user.target
EOF

# 重载并启用服务
sudo systemctl daemon-reload
sudo systemctl enable job-hub-spider

# 手动启动爬虫
sudo systemctl start job-hub-spider

# 查看状态
sudo systemctl status job-hub-spider

# 查看实时日志
journalctl -u job-hub-spider -f
```

### 5.3 PM2 常用命令

```bash
pm2 list                    # 查看所有进程
pm2 logs job-hub-web       # 查看日志
pm2 restart job-hub-web     # 重启
pm2 stop job-hub-web        # 停止
pm2 delete job-hub-web      # 删除
pm2 monit                   # 监控面板
```

---

## 6. Nginx 反向代理与 SSL

### 6.1 安装 Nginx

```bash
sudo apt install -y nginx

# 启动并设置开机自启
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 6.2 配置反向代理

```bash
# 创建站点配置文件
sudo tee /etc/nginx/sites-available/job-hub << 'EOF'
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名或 IP

    # Next.js 应用
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 静态资源缓存
    location /_next/static {
        proxy_pass http://127.0.0.1:3000;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# 启用站点
sudo ln -sf /etc/nginx/sites-available/job-hub /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

### 6.3 配置 SSL（Let's Encrypt 免费证书）

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 自动获取并配置 SSL（替换为你的域名和邮箱）
sudo certbot --nginx -d your-domain.com -m your@email.com --agree-tos --no-eff-email --redirect

# Certbot 会自动修改 Nginx 配置，添加 SSL 和 HTTP 重定向

# 测试自动续期
sudo certbot renew --dry-run
```

### 6.4 SSL 配置优化（可选）

```bash
# 编辑 Nginx 配置添加安全头
sudo nano /etc/nginx/sites-available/job-hub
```

在 `server` 块中添加：

```nginx
    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # 安全头
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';" always;
```

重载 Nginx：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 7. 域名解析

### 7.1 在域名注册商处添加 DNS 记录

| 记录类型 | 主机记录 | 记录值 | TTL |
|----------|----------|--------|-----|
| A | @ | 你的服务器公网IP | 600 |
| A | www | 你的服务器公网IP | 600 |
| CNAME | @ | your-domain.com | 600 |

### 7.2 阿里云 DNS 配置（如果域名在阿里云）

1. 登录 [阿里云DNS控制台](https://dns.console.aliyun.com/)
2. 找到你的域名 → **解析设置** → **添加记录**
3. 添加上述 DNS 记录

---

## 8. 定时任务（Crontab）

### 8.1 配置自动爬取

```bash
# 编辑 crontab
crontab -e
```

添加以下内容：

```cron
# 每天早上 6:00 自动运行 HTTP 爬虫（快速）
0 6 * * * cd /opt/job_hub && source venv/bin/activate && python3 src/spiders/run.py --sources sufe,zuel,cufe,dufe,swufe --days 7 >> /opt/job_hub/logs/cron_spider.log 2>&1

# 每天早上 7:00 运行浏览器爬虫（较慢）
0 7 * * * cd /opt/job_hub && source venv/bin/activate && python3 src/spiders/run.py --sources smartedu,uibe,jxufe --days 7 >> /opt/job_hub/logs/cron_browser_spider.log 2>&1

# 每周日凌晨清理过期会话
0 3 * * 0 cd /opt/job_hub && source venv/bin/activate && python3 -c "
from datetime import datetime, timedelta
from src.lib.auth_db import getAuthDb
db = getAuthDb()
db.cleanExpiredSessions()
print(f'[{datetime.now()}] Session cleanup completed')
" >> /opt/job_hub/logs/cron_cleanup.log 2>&1

# 每月备份数据库
0 2 1 * * cp /opt/job_hub/data/jobs.db /opt/job_hub/backups/jobs_$(date +\%Y\%m\%d).db
```

### 8.2 Crontab 格式说明

```
* * * * * command
│ │ │ │ │
│ │ │ │ └─── 星期几 (0-6, 0=周日)
│ │ │ └───── 月份 (1-12)
│ │ └─────── 日期 (1-31)
│ └───────── 小时 (0-23)
└─────────── 分钟 (0-59)

示例:
0 6 * * *    → 每天 6:00 执行
*/15 * * * * → 每 15 分钟执行
0 */2 * * *  → 每 2 小时执行
```

---

## 9. 监控与日志

### 9.1 日志位置

| 日志类型 | 位置 | 查看命令 |
|----------|------|----------|
| **Web 应用** | `/opt/job_hub/logs/web-out.log` | `tail -f logs/web-out.log` |
| **Web 错误** | `/opt/job_hub/logs/web-error.log` | `tail -f logs/web-error.log` |
| **爬虫日志** | `/opt/job_hub/logs/spider.log` | `journalctl -u job-hub-spider -f` |
| **Nginx 日志** | `/var/log/nginx/access.log` | `tail -f /var/log/nginx/access.log` |
| **PM2 日志** | `pm2 logs` | `pm2 logs job-hub-web` |

### 9.2 服务器监控脚本

```bash
# 创建监控脚本
cat > /opt/job_hub/scripts/monitor.sh << 'SCRIPT'
#!/bin/bash

echo "===== 服务器状态检查 $(date) ====="

# 1. 磁盘空间
echo -e "\n📁 磁盘空间:"
df -h / | tail -1

# 2. 内存使用
echo -e "\n💾 内存使用:"
free -h | grep Mem

# 3. CPU 负载
echo -e "\n⚡ CPU 负载:"
uptime

# 4. Node.js 进程
echo -e "\n🌐 Web 服务:"
pm2 list 2>/dev/null || echo "PM2 未运行"

# 5. 爬虫服务
echo -e "\n🕷️ 爬虫服务:"
systemctl is-active job-hub-spider

# 6. Nginx 状态
echo -e "\n🔀 Nginx:"
systemctl is-active nginx

# 7. 最近错误日志
echo -e "\n❌ 最近错误 (最后10行):"
tail -10 /opt/job_hub/logs/web-error.log 2>/dev/null || echo "无错误日志"
SCRIPT

chmod +x /opt/job_hub/scripts/monitor.sh

# 运行监控
/opt/job_hub/scripts/monitor.sh
```

### 9.3 设置日志轮转

```bash
# 创建 logrotate 配置
sudo tee /etc/logrotate.d/job-hub << 'EOF'
/opt/job_hub/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0644 deploy deploy
    postrotate
        pm2 reload job-hub-web >/dev/null 2>&1 || true
    endscript
}
EOF
```

---

## 10. 常见问题排查

### Q1: 端口被占用

```bash
# 查看占用端口的进程
lsof -i :3000
lsof -i :80

# 杀死进程
kill -9 PID
```

### Q2: 权限问题

```bash
# 修复文件权限
sudo chown -R deploy:deploy /opt/job_hub
chmod -R 755 /opt/job_hub

# 修复 npm 权限
mkdir -p ~/.npm
chown -R $(whoami) ~/.npm
```

### Q3: 内存不足

```bash
# 查看内存使用
free -h

# 查看占用内存最多的进程
ps aux --sort=-%mem | head -10

# 增加 swap（如果内存不足）
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Q4: 爬虫报错

```bash
# 查看详细错误日志
tail -100 /opt/job_hub/logs/spider-error.log

# 常见错误及解决方案:

# 1. Connection timeout → 检查网络，增加延迟时间
python3 src/spiders/run.py --delay 3

# 2. SSL Error → 更新证书或忽略验证（不推荐）
pip install --upgrade certifi

# 3. 403 Forbidden → 可能被封IP，尝试使用代理
# 4. ModuleNotFoundError → 安装缺失的依赖
pip install 缺失的模块名
```

### Q5: Next.js 构建失败

```bash
# 清除缓存重新构建
rm -rf .next node_modules
npm install
npm run build

# 如果 still fails, 检查 Node 版本
node -v  # 应该 >= 18
```

### Q6: 数据库锁定

```bash
# 如果遇到 "database is locked" 错误
# 1. 确保只有一个爬虫实例在运行
pm2 list | grep spider
ps aux | grep python

# 2. 删除锁文件
rm -f /opt/job_hub/data/jobs.db-journal /opt/job_hub/data/jobs.db-wal

# 3. 重启服务
pm2 restart all
```

---

## 附录：一键部署脚本

```bash
#!/bin/bash
# 一键部署脚本（保存为 deploy.sh，然后 chmod +x deploy.sh && ./deploy.sh）

set -e

echo "========================================="
echo "  FinIntern Hub 一键部署脚本"
echo "========================================="

# 配置变量
APP_DIR="/opt/job_hub"
DOMAIN="your-domain.com"  # 修改为你的域名
EMAIL="your@email.com"    # 修改为你的邮箱

# 1. 更新系统
echo "[1/8] 更新系统..."
apt update && apt upgrade -y

# 2. 安装基础工具
echo "[2/8] 安装基础工具..."
apt install -y git curl wget vim htop net-tools unzip build-essential python3-dev python3-pip python3-venv nginx

# 3. 安装 Node.js
echo "[3/8] 安装 Node.js..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
nvm alias default 20

# 4. 安装 PM2
echo "[4/8] 安装 PM2..."
npm install -g pm2

# 5. 克隆项目
echo "[5/8] 克隆项目..."
mkdir -p $APP_DIR
# git clone your-repo-url $APP_DIR  # 取消注释并修改为实际仓库地址
cd $APP_DIR
npm install
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 6. 构建
echo "[6/8] 构建项目..."
npm run build

# 7. 配置 Nginx
echo "[7/8] 配置 Nginx..."
# ... (参考第6节)

# 8. 配置 SSL
echo "[8/8] 配置 SSL..."
apt install -y certbot python3-certbot-nginx
certbot --nginx -d $DOMAIN -m $EMAIL --agree-tos --no-eff-email --redirect

echo ""
echo "========================================="
echo "  ✅ 部署完成！"
echo "========================================="
echo ""
echo "访问地址: https://$DOMAIN"
echo "项目管理: pm2 monit"
echo "查看日志: tail -f $APP_DIR/logs/web-out.log"
echo ""
```

---

## 快速开始清单

完成以下步骤即可让项目上线：

- [ ] 1. 购买阿里云 ECS（2核4G 起）
- [ ] 2. 配置安全组（开放 22/80/443 端口）
- [ ] 3. SSH 连接服务器
- [ ] 4. 执行基础环境安装（第2节）
- [ ] 5. 克隆项目并安装依赖（第3节）
- [ ] 6. 配置 `.env` 环境变量
- [ ] 7. 用 PM2 启动 Web 服务（第5.1节）
- [ ] 8. 安装配置 Nginx（第6节）
- [ ] 9. 申请 SSL 证书（第6.3节）
- [ ] 10. 配置域名 DNS 解析（第7节）
- [ ] 11. 运行爬虫填充数据（第4节）
- [ ] 12. 设置定时自动爬取（第8节）
- [ ] 13. 配置监控和日志轮转（第9节）

---

**祝部署顺利！如有问题请查阅第10节的常见问题排查。** 🚀
