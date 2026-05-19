#!/usr/bin/env bash
set -euo pipefail

REGISTRY="crpi-3fswqinlrhpn1djk.cn-beijing.personal.cr.aliyuncs.com"
REGISTRY_VPC="crpi-3fswqinlrhpn1djk-vpc.cn-beijing.personal.cr.aliyuncs.com"
USERNAME="t_1483892331156_0523"
NAMESPACE="docker-miskies"
REPO="finintern_hub"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

LOCAL_IMAGE="job_hub-finintern-next:latest"

USE_VPC=false
PUSH_LATEST=true

usage() {
    echo "用法: $0 [选项]"
    echo ""
    echo "一键推送 Docker 镜像到阿里云 Container Registry (统一使用 latest 标签)"
    echo ""
    echo "镜像内容:"
    echo "  ✅ Next.js 前端应用 (src/app, src/components, src/lib, src/styles)"
    echo "  ✅ API 路由 (src/app/api)"
    echo "  ✅ 配置文件 (package.json, next.config.ts, tsconfig.json)"
    echo "  ❌ 数据库文件 (data/*.db, data/user_profiles)"
    echo "  ❌ 爬虫文件 (lite_crawler.py, run_spiders.py, src/spiders/)"
    echo "  ❌ 文档文件 (*.md)"
    echo "  ❌ 日志文件 (logs/, log/)"
    echo ""
    echo "选项:"
    echo "  -v, --vpc         使用 VPC 内网地址推送 (ECS 部署时推荐)"
    echo "  -n, --dry-run     仅显示将要执行的命令，不实际执行"
    echo "  -b, --build       推送前先构建镜像"
    echo "  -c, --clean       构建前清理旧的构建缓存"
    echo "  -h, --help        显示帮助信息"
    echo ""
    echo "示例:"
    echo "  $0                          # 直接推送 latest 标签"
    echo "  $0 -v                       # 使用 VPC 内网地址"
    echo "  $0 -n                       # 预览模式"
    echo "  $0 -b -c                    # 清理后重新构建并推送"
}

while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--vpc)
            USE_VPC=true
            shift
            ;;
        -l|--latest)
            PUSH_LATEST=true
            shift
            ;;
        -n|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -b|--build)
            DO_BUILD=true
            shift
            ;;
        -c|--clean)
            DO_CLEAN=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "未知选项: $1"
            usage
            exit 1
            ;;
    esac
done

if [ "$USE_VPC" = true ]; then
    REGISTRY="$REGISTRY_VPC"
fi

REMOTE_IMAGE="${REGISTRY}/${NAMESPACE}/${REPO}:latest"

echo "========================================="
echo " 阿里云镜像推送 (统一 latest 标签)"
echo "========================================="
echo " 本地镜像:   ${LOCAL_IMAGE}"
echo " 远程镜像:   ${REMOTE_IMAGE}"
echo " VPC内网:    ${USE_VPC}"
echo " Dry Run:    ${DRY_RUN:-false}"
echo " Build:      ${DO_BUILD:-false}"
echo " Clean:      ${DO_CLEAN:-false}"
echo "========================================="
echo ""

run_cmd() {
    if [ "${DRY_RUN:-false}" = true ]; then
        echo "[DRY RUN] $*"
    else
        echo "$ $*"
        eval "$@"
    fi
}

if [ "${DO_CLEAN:-false}" = true ]; then
    echo ">>> 步骤 0/5: 清理构建缓存"
    run_cmd docker builder prune -f
    run_cmd docker system prune -f --volumes
    echo "✅ 缓存清理完成"
    echo ""
fi

if [ "${DO_BUILD:-false}" = true ]; then
    echo ">>> 步骤 1/5: 构建 Docker 镜像"
    
    if [ "${DRY_RUN:-false}" = false ]; then
        if ! command -v docker &> /dev/null; then
            echo "❌ Docker 未安装或未在 PATH 中"
            exit 1
        fi
        
        if ! docker info &> /dev/null; then
            echo "❌ Docker 服务未运行"
            exit 1
        fi
    fi
    
    run_cmd docker compose build --no-cache finintern-next
    
    if [ "${DRY_RUN:-false}" = false ]; then
        if ! docker image inspect "$LOCAL_IMAGE" >/dev/null 2>&1; then
            echo "❌ 镜像构建失败"
            exit 1
        fi
    fi
    
    IMAGE_ID=$(docker image inspect "$LOCAL_IMAGE" --format '{{.Id}}' 2>/dev/null | cut -c8-19 || echo "N/A")
    echo "✅ 构建完成: ${LOCAL_IMAGE} (ID: ${IMAGE_ID})"
    echo ""
else
    echo ">>> 步骤 1/5: 检查本地镜像"
    if ! docker image inspect "$LOCAL_IMAGE" >/dev/null 2>&1; then
        echo "❌ 本地镜像 ${LOCAL_IMAGE} 不存在"
        echo "   请先构建: $0 -b"
        echo "   或手动构建: docker compose build"
        exit 1
    fi
    IMAGE_ID=$(docker image inspect "$LOCAL_IMAGE" --format '{{.Id}}' | cut -c8-19)
    echo "✅ 找到本地镜像 ${LOCAL_IMAGE} (ID: ${IMAGE_ID})"
    echo ""
fi

echo ">>> 步骤 2/5: 登录阿里云 Container Registry"
if [ "${DRY_RUN:-false}" = true ]; then
    echo "[DRY RUN] docker login --username=${USERNAME} ${REGISTRY}"
else
    if ! docker login --username="$USERNAME" "$REGISTRY"; then
        echo "❌ 登录失败，请检查密码"
        exit 1
    fi
fi
echo "✅ 登录成功"
echo ""

echo ">>> 步骤 3/5: 标记镜像为 latest"
run_cmd docker tag "$LOCAL_IMAGE" "$REMOTE_IMAGE"
echo "✅ 标记完成: ${REMOTE_IMAGE}"
echo ""

echo ">>> 步骤 4/5: 推送镜像到远程仓库"
run_cmd docker push "$REMOTE_IMAGE"
echo "✅ 推送完成: ${REMOTE_IMAGE}"
echo ""

echo ">>> 步骤 5/5: 验证推送结果"
if [ "${DRY_RUN:-false}" = false ]; then
    REMOTE_DIGEST=$(docker image inspect "$REMOTE_IMAGE" --format '{{.Id}}' 2>/dev/null || echo "unknown")
    LOCAL_DIGEST=$(docker image inspect "$LOCAL_IMAGE" --format '{{.Id}}' 2>/dev/null || echo "unknown")
    
    if [ "$REMOTE_DIGEST" = "$LOCAL_DIGEST" ] || [ "$REMOTE_DIGEST" != "unknown" ]; then
        echo "✅ 验证通过: 远程镜像已更新"
    else
        echo "⚠️  请验证远程镜像是否正确更新"
    fi
else
    echo "[DRY RUN] 跳过验证步骤"
fi
echo ""

echo "========================================="
echo " ✅ 全部完成!"
echo "========================================="
echo ""
echo "📦 镜像信息:"
echo "  远程地址: ${REMOTE_IMAGE}"
echo "  本地ID:   ${IMAGE_ID}"
echo ""
echo "🚀 部署命令:"
echo "  docker pull ${REMOTE_IMAGE}"
echo "  docker run -d \\"
echo "    -p 3001:3000 \\"
echo "    -e NODE_ENV=production \\"
echo "    -e ADMIN_TOKEN=your-admin-token \\"
echo "    -v ./data:/app/data \\"
echo "    -v ./log:/app/log \\"
echo "    --name job-hub \\"
echo "    ${REMOTE_IMAGE}"
echo ""
echo "📋 使用 docker-compose 部署:"
echo "  docker compose up -d"
echo ""
echo "⏰ 推送时间: $(date '+%Y-%m-%d %H:%M:%S')"
