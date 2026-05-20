# 多阶段构建 Dockerfile for FinIntern Hub
# 使用 Node.js 20 Alpine 作为基础镜像

# ==========================================
# 阶段 1: 依赖安装 (deps)
# ==========================================
FROM node:20-alpine AS deps

# 配置阿里云 Alpine 镜像源
RUN sed -i 's|https://dl-cdn.alpinelinux.org/alpine|http://mirrors.aliyun.com/alpine|g' /etc/apk/repositories \
    && echo "http://mirrors.aliyun.com/alpine/v3.23/main" >> /etc/apk/repositories \
    && echo "http://mirrors.aliyun.com/alpine/v3.23/community" >> /etc/apk/repositories

# 安装 better-sqlite3 编译所需的工具链
RUN apk add --no-cache python3 make g++

# 配置 npm 镜像源
ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN npm config set registry ${NPM_REGISTRY}

WORKDIR /app

# 复制依赖文件
COPY package.json package-lock.json* ./

# 安装生产依赖（包括 better-sqlite3 的编译）
RUN npm ci --prefer-offline --no-audit --no-fund

# ==========================================
# 阶段 2: 构建 (builder)
# ==========================================
FROM node:20-alpine AS builder

# 配置阿里云 Alpine 镜像源
RUN sed -i 's|https://dl-cdn.alpinelinux.org/alpine|http://mirrors.aliyun.com/alpine|g' /etc/apk/repositories \
    && echo "http://mirrors.aliyun.com/alpine/v3.23/main" >> /etc/apk/repositories \
    && echo "http://mirrors.aliyun.com/alpine/v3.23/community" >> /etc/apk/repositories

# 安装 better-sqlite3 编译所需的工具链
RUN apk add --no-cache python3 make g++

# 配置 npm 镜像源
ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN npm config set registry ${NPM_REGISTRY}

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
FROM node:20-alpine AS runner

# 配置阿里云 Alpine 镜像源
RUN sed -i 's|https://dl-cdn.alpinelinux.org/alpine|http://mirrors.aliyun.com/alpine|g' /etc/apk/repositories \
    && echo "http://mirrors.aliyun.com/alpine/v3.23/main" >> /etc/apk/repositories \
    && echo "http://mirrors.aliyun.com/alpine/v3.23/community" >> /etc/apk/repositories

# 安装 curl 用于健康检查
RUN apk add --no-cache curl

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

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
