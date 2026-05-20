# 阿里云镜像推送与服务器部署指南

> 使用现有 `push-image.sh` 脚本一键推送到阿里云 ACR，然后在服务器上拉取运行

---

## 目录

1. [快速开始（3步搞定）](#1-快速开始3步搞定)
2. [本地构建与推送](#2-本地构建与推送)
3. [服务器配置](#3-服务器配置)
4. [服务器拉取与运行](#4-服务器拉取与运行)
5. [爬虫独立运行](#5-爬虫独立运行)
6. [完整流程图](#6-完整流程图)

---

## 1. 快速开始（3步搞定）

### 前提条件

- ✅ 本地已安装 Docker
- ✅ 已有阿里云 ACR 密码
- ✅ 已购买阿里云 ECS 服务器

### 第1步：本地构建并推送镜像

```bash
cd /home/joakim/Project/job_hub

# 使用现成的脚本一键构建+推送
./trash/scripts/push-image.sh -b -c
```

### 第2步：服务器上拉取并运行

```bash
# SSH 到你的服务器
ssh root@你的服务器IP

# 拉取镜像并运行
docker pull crpi-3fswqinlrhpn1djk.cn-beijing.personal.cr.aliyuncs.com/docker-miskies/finintern_hub:latest

docker run -d \
  --name job-hub \
  --restart unless-stopped \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e ADMIN_TOKEN=你的token \
  -v /opt/job_hub/data:/app/data \
  -v /opt/job_hub/log:/app/log \
  crpi-3fswqinlrhpn1djk.cn-beijing.personal.cr.aliyuncs.com/docker-miskies/finintern_hub:latest
```

### 第3步：配置 Nginx 反向代理 + SSL

```bash
# 安装 Nginx 和 Certbot
apt install -y nginx certbot python3-certbot-nginx

# 配置反向代理
cat > /etc/nginx/sites-available/job-hub << 'EOF'
server {
    listen 80;
    server_name your-domain.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/job-hub /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 申请免费 SSL 证书
certbot --nginx -d your-domain.com -m your@email.com --agree-tos --no-eff-email --redirect
```

**完成！** 访问 `https://your-domain.com` 即可看到应用。

---

## 2. 本地构建与推送

### 2.1 项目文件说明

我已经为您创建了与 `push-image.sh` **完全兼容**的配置文件：

| 文件 | 用途 |
|------|------|
| [Dockerfile.push](./Dockerfile.push) | 阿里云推送专用 Dockerfile |
| [docker-compose.build.yml](./docker-compose.build.yml) | 构建专用 compose 文件 |
| [trash/scripts/push-image.sh](./trash/scripts/push-image.sh) | 一键推送脚本 ✅ 已有 |

### 2.2 推送命令详解

```bash
cd /home/joakim/Project/job_hub

# ===== 基础用法 =====

# 直接推送（需要先手动构建）
./trash/scripts/push-image.sh

# 清理缓存 + 构建 + 推送（推荐！）
./trash/scripts/push-image.sh -b -c

# 使用 VPC 内网推送（如果 ECS 在同一 VPC，速度更快）
./trash/scripts/push-image.sh -b -c -v

# 仅预览将要执行的命令（不实际执行）
./trash/scripts/push-image.sh -n

# ===== 参数说明 =====
# -b, --build       推送前先构建镜像
# -c, --clean       构建前清理旧的构建缓存
# -v, --vpc         使用 VPC 内网地址推送（ECS 同区域时更快）
# -n, --dry-run     仅显示将要执行的命令，不实际执行
# -h, --help        显示帮助信息
```

### 2.3 推送流程详解

```
执行 ./trash/scripts/push-image.sh -b -c

步骤 0: 清理构建缓存 (docker builder prune)
   ↓
步骤 1: 构建镜像
   docker compose -f docker-compose.build.yml build --no-cache finintern-next
   ↓
   输出: job_hub-finintern-next:latest (本地镜像)
   ↓
步骤 2: 登录阿里云 ACR
   docker login --username=t_1483892331156_0523 crpi-xxx.aliyuncs.com
   ↓
步骤 3: 标记镜像
   docker tag job_hub-finintern-next:latest → 远程地址:latest
   ↓
步骤 4: 推送到阿里云
   docker push crpi-xxx/docker-miskies/finintern_hub:latest
   ↓
步骤 5: 验证推送结果
   ✅ 完成!
```

### 2.4 镜像内容

推送的镜像包含：
- ✅ Next.js 前端应用 (`src/app`, `src/components`)
- ✅ API 路由 (`src/app/api/**`)
- ✅ 配置文件 (`package.json`, `next.config.ts`)
- ✅ SQLite 数据库支持 (`better-sqlite3`)
- ✅ 用户认证系统 (`auth-db.ts`)

**不包含：**
- ❌ 爬虫代码 (`src/spiders/`) — 服务器单独运行
- ❌ 数据库数据 (`data/*.db`) — 使用 Volume 挂载
- ❌ 文档文件 (`*.md`)
- ❌ 日志文件 (`logs/`)

---

## 3. 服务器配置

### 3.1 安装 Docker

```bash
# SSH 连接到服务器
ssh root@你的服务器IP

# 安装 Docker
curl -fsSL https://get.docker.com | sh
systemctl start docker
systemctl enable docker

# 将当前用户加入 docker 组（可选）
usermod -aG docker $USER
```

### 3.2 登录阿里云 ACR

```bash
# 登录阿里云容器镜像服务
docker login --username=t_1483892331156_0523 crpi-3fswqinlrhpn1djk.cn-beijing.personal.cr.aliyuncs.com

# 输入密码（在阿里云 ACR 控制台设置）
```

### 3.3 创建目录结构

```bash
mkdir -p /opt/job_hub/{data,log,backups}
```

### 3.4 创建环境变量文件

```bash
cat > /opt/job_hub/.env << 'EOF'
# 认证配置
ADMIN_TOKEN=请修改为随机字符串_至少32位
OPERATOR_TOKEN=请修改为随机字符串
VIEWER_TOKEN=请修改为随机字符串
AUTH_SALT=请修改为随机盐值_至少32字符

# 数据库
DATABASE_PATH=/app/data/jobs.db

# 会话
SESSION_TIMEOUT_HOURS=24
MAX_LOGIN_ATTEMPTS=5
LOGIN_LOCKOUT_MINUTES=15

# AI 配置（可选）
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.openai.com/v1
EOF

# 生成随机 Token
openssl rand -hex 24
```

---

## 4. 服务器拉取与运行

### 4.1 方式一：Docker Run（简单直接）

```bash
# 定义变量
REGISTRY="crpi-3fswqinlrhpn1djk.cn-beijing.personal.cr.aliyuncs.com"
IMAGE="${REGISTRY}/docker-miskies/finintern_hub:latest"

# 拉取最新镜像
docker pull ${IMAGE}

# 运行容器
docker run -d \
  --name job-hub \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file /opt/job_hub/.env \
  -v /opt/job_hub/data:/app/data \
  -v /opt/job_hub/log:/app/log \
  ${IMAGE}

# 查看日志
docker logs -f job-hub

# 测试访问
curl http://localhost:3000/api/health
```

### 4.2 方式二：Docker Compose（推荐生产环境）

```bash
# 创建 docker-compose.yml
cat > /opt/job_hub/docker-compose.yml << 'EOF'
services:
  web:
    image: crpi-3fswqinlrhpn1djk.cn-beijing.personal.cr.aliyuncs.com/docker-miskies/finintern_hub:latest
    container_name: job-hub-web
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - .env
    volumes:
      - ./data:/app/data
      - ./log:/app/log
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    container_name: job-hub-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      - web
EOF

# 启动服务
cd /opt/job_hub
docker compose up -d

# 查看状态
docker compose ps
docker compose logs -f
```

### 4.3 更新部署（推送新版本后）

```bash
cd /opt/job_hub

# 拉取新镜像
docker compose pull

# 重新创建容器（使用新镜像）
docker compose up -d

# 清理旧镜像
docker image prune -f
```

---

## 5. 爬虫独立运行

爬虫**不应该**打包到 Docker 镜像中，应该在服务器上**独立运行**。

### 5.1 安装 Python 环境

```bash
# 安装 Python 和依赖
apt install -y python3 python3-pip python3-venv git

# 克隆项目（或仅复制爬虫相关文件）
cd /opt/job_hub
git clone 你的仓库地址 temp
cp -r temp/src/spiders .
cp temp/requirements.txt .
cp temp/src/lib/db-utils.py src/lib/ 2>/dev/null || true
cp -r temp/src/lib/db-utils.* src/lib/ 2>/dev/null || true
rm -rf temp

# 创建虚拟环境并安装依赖
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 5.2 运行爬虫

```bash
cd /opt/job_hub
source venv/bin/activate

# 手动运行一次
python3 src/spiders/run.py --sources sufe,zuel,cufe,dufe,swufe --days 7

# 后台运行（输出到日志）
nohup python3 src/spiders/run.py --sources sufe,zuel,cufe > logs/spider_$(date +%Y%m%d).log 2>&1 &
```

### 5.3 配置定时任务（自动爬取）

```bash
crontab -e

# 添加以下内容：

# 每天 6:00 运行 HTTP 爬虫（快速）
0 6 * * * cd /opt/job_hub && source venv/bin/activate && python3 src/spiders/run.py --sources sufe,zuel,cufe,dufe,swufe --days 7 >> logs/cron_spider.log 2>&1

# 每天 8:00 运行浏览器爬虫（较慢）
0 8 * * * cd /opt/job_hub && source venv/bin/activate && python3 src/spiders/run.py --sources smartedu,uibe,jxefe --days 7 >> logs/cron_browser_spider.log 2>&1

# 每周日凌晨备份数据库
0 3 * * 0 cp /opt/job_hub/data/jobs.db /opt/job_hub/backups/jobs_$(date +\%Y\%m\%d).db
```

### 5.4 创建 Systemd 服务（可选，更稳定）

```bash
sudo tee /etc/systemd/system/job-hub-spider.service << 'EOF'
[Unit]
Description=Job Hub Spider Service
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/job_hub
ExecStart=/opt/job_hub/venv/bin/python3 /opt/job_hub/src/spiders/run.py --sources sufe,zuel,cufe,dufe,swufe --days 7
Restart=always
RestartSec=60

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable job-hub-spider
sudo systemctl start job-hub-spider
```

---

## 6. 完整流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                     完整部署流程                                  │
└─────────────────────────────────────────────────────────────────┘

【本地开发机器】                          【阿里云 ECS 服务器】
      │                                           │
      ▼                                           │
┌─────────────┐                                   │
│ 开发 & 调试  │                                   │
│ npm run dev  │                                   │
└──────┬──────┘                                   │
       │                                           │
       ▼                                           │
┌─────────────────────────┐                       │
│  1. 构建镜像             │                       │
│  ./push-image.sh -b -c  │                       │
│                      │   │                       │
│                      ▼   │                       │
│              ┌──────────┴──────────┐              │
│              │  Docker 构建         │              │
│              │  Dockerfile.push     │              │
│              └──────────┬──────────┘              │
│                         │                         │
│                         ▼                         │
│              ┌─────────────────────┐              │
│              │  job_hub-finintern- │              │
│              │  next:latest        │              │
│              └──────────┬──────────┘              │
│                         │                         │
│                         ▼                         │
│              ┌─────────────────────┐              │
│              │  推送到阿里云 ACR     │─────────────┼──►
│              │  finintern_hub:latest│              │    │
│              └─────────────────────┘              │    │
│                                                   │    │
└───────────────────────────────────────────────────┘    │
                                                          │
                                                          ▼
                                            ┌─────────────────────┐
                                            │  2. 服务器配置        │
                                            │  - 安装 Docker       │
                                            │  - 登录 ACR          │
                                            │  - 配置 .env         │
                                            └──────────┬──────────┘
                                                       │
                                                       ▼
                                            ┌─────────────────────┐
                                            │  3. 拉取并运行        │
                                            │  docker pull ...     │
                                            │  docker run -d ...   │
                                            └──────────┬──────────┘
                                                       │
                              ┌────────────────────────┼────────────────────────┐
                              │                        │                        │
                              ▼                        ▼                        ▼
                   ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
                   │  4a. Web 应用     │    │  4b. Nginx + SSL  │    │  4c. 爬虫任务     │
                   │  :3000            │    │  :80 / :443       │    │  Python 独立运行   │
                   │  用户认证系统      │    │  反向代理          │    │  定时自动爬取     │
                   │  API 路由          │    │  HTTPS 加密        │    │  数据写入共享DB   │
                   └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘
                            │                       │                       │
                            └───────────────────────┼───────────────────────┘
                                                    │
                                                    ▼
                                        ┌─────────────────────┐
                                        │  共享数据层           │
                                        │  /opt/job_hub/data/  │
                                        │  jobs.db (SQLite)    │
                                        └─────────────────────┘
                                                    │
                                                    ▼
                                        ┌─────────────────────┐
                                        │  ✅ 访问应用          │
                                        │  https://your-domain │
                                        └─────────────────────┘
```

---

## 常用命令速查

### 本地（开发机）

```bash
# 构建 + 推送
./trash/scripts/push-image.sh -b -c

# 仅推送（已构建过）
./trash/scripts/push-image.sh

# VPC 内网推送（快）
./trash/scripts/push-image.sh -b -c -v

# 预览模式
./trash/scripts/push-image.sh -n
```

### 服务器（ECS）

```bash
# 拉取最新镜像
docker pull crpi-3fswqinlrhpn1djk.cn-beijing.personal.cr.aliyuncs.com/docker-miskies/finintern_hub:latest

# 启动/停止/重启
docker start job-hub
docker stop job-hub
docker restart job-hub

# 查看日志
docker logs -f job-hub --tail 100

# 进入容器调试
docker exec -it job-hub sh

# 更新部署
docker compose pull && docker compose up -d

# 爬虫手动运行
cd /opt/job_hub && source venv/bin/activate
python3 src/spiders/run.py --sources sufe,zuel,cufe --days 7

# 查看定时任务
crontab -l

# 备份数据库
cp /opt/job_hub/data/jobs.db /opt/job_hub/backups/jobs_$(date +%Y%m%d_%H%M%S).db
```

---

## 故障排查

| 问题 | 解决方案 |
|------|----------|
| **登录失败** | 检查 `.env` 中的 `ADMIN_TOKEN` 是否正确 |
| **数据库错误** | 检查 `/opt/job_hub/data/` 目录权限 `chmod 777 data` |
| **爬虫报错** | 查看 `logs/spider.log`，检查网络连接 |
| **SSL 证书过期** | `certbot renew` 自动续期 |
| **端口被占用** | `lsof -i :3000` 然后 `kill -9 PID` |
| **镜像拉取失败** | 检查网络，使用 VPC 内网地址 |

---

**🎉 现在您可以直接使用 `./trash/scripts/push-image.sh -b -c` 一键推送到阿里云了！**
