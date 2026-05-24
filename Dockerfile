# 多阶段构建 Dockerfile for FinIntern Hub
# 使用 Node.js 20 (Debian-based) 作为基础镜像，确保 native 模块编译兼容性

# ==========================================
# 阶段 1: 依赖安装 (deps)
# ==========================================
FROM node:20-slim AS deps

# 配置阿里云 Debian 镜像源
RUN rm -f /etc/apt/sources.list.d/debian.sources \
    && echo "deb http://mirrors.aliyun.com/debian bookworm main contrib non-free non-free-firmware" > /etc/apt/sources.list \
    && echo "deb http://mirrors.aliyun.com/debian-security bookworm-security main contrib non-free non-free-firmware" >> /etc/apt/sources.list \
    && echo "deb http://mirrors.aliyun.com/debian bookworm-updates main contrib non-free non-free-firmware" >> /etc/apt/sources.list

# 安装 better-sqlite3 编译所需的工具链
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 配置 npm 镜像源和超时设置
ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN npm config set registry ${NPM_REGISTRY} \
    && npm config set fetch-timeout 120000 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm config set fetch-retries 5

# NODEJS_ORG_MIRROR 用于 node-gyp 下载 Node.js headers，通过 npmmirror 镜像加速
ENV NODEJS_ORG_MIRROR=https://npmmirror.com/mirrors/node
# better-sqlite3 预编译二进制文件镜像
ENV npm_config_better_sqlite3_binary_host_mirror=https://npmmirror.com/mirrors/better-sqlite3

WORKDIR /app

# 复制依赖文件
COPY package.json package-lock.json* ./

# 安装生产依赖（包括 better-sqlite3 的编译）
RUN npm ci --no-audit --no-fund || npm ci --no-audit --no-fund

# ==========================================
# 阶段 2: 构建 (builder)
# ==========================================
FROM node:20-slim AS builder

# 配置阿里云 Debian 镜像源
RUN rm -f /etc/apt/sources.list.d/debian.sources \
    && echo "deb http://mirrors.aliyun.com/debian bookworm main contrib non-free non-free-firmware" > /etc/apt/sources.list \
    && echo "deb http://mirrors.aliyun.com/debian-security bookworm-security main contrib non-free non-free-firmware" >> /etc/apt/sources.list \
    && echo "deb http://mirrors.aliyun.com/debian bookworm-updates main contrib non-free non-free-firmware" >> /etc/apt/sources.list

# 安装 better-sqlite3 编译所需的工具链
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 配置 npm 镜像源和超时设置
ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN npm config set registry ${NPM_REGISTRY} \
    && npm config set fetch-timeout 120000 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm config set fetch-retries 5

# NODEJS_ORG_MIRROR 用于 node-gyp 下载 Node.js headers，通过 npmmirror 镜像加速
ENV NODEJS_ORG_MIRROR=https://npmmirror.com/mirrors/node
# better-sqlite3 预编译二进制文件镜像
ENV npm_config_better_sqlite3_binary_host_mirror=https://npmmirror.com/mirrors/better-sqlite3

WORKDIR /app

# 从 deps 阶段复制 node_modules
COPY --from=deps /app/node_modules ./node_modules

# 复制项目文件
COPY . .

# 构建 Next.js 应用（standalone 输出模式）
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ==========================================
# 阶段 3: 运行 (runner)
# ==========================================
FROM node:20-slim AS runner

# 配置阿里云 Debian 镜像源
RUN rm -f /etc/apt/sources.list.d/debian.sources \
    && echo "deb http://mirrors.aliyun.com/debian bookworm main contrib non-free non-free-firmware" > /etc/apt/sources.list \
    && echo "deb http://mirrors.aliyun.com/debian-security bookworm-security main contrib non-free non-free-firmware" >> /etc/apt/sources.list \
    && echo "deb http://mirrors.aliyun.com/debian bookworm-updates main contrib non-free non-free-firmware" >> /etc/apt/sources.list

# 安装 curl 用于健康检查，以及 tesseract-ocr 用于扫描版 PDF 文字识别
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    tesseract-ocr \
    tesseract-ocr-chi-sim \
    && rm -rf /var/lib/apt/lists/*

# 创建非 root 用户
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid 1001 nextjs

WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 复制 standalone 构建输出
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# 启动命令
CMD ["node", "server.js"]