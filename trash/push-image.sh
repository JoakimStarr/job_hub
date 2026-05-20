#!/usr/bin/env bash
set -euo pipefail

REGISTRY="crpi-3fswqinlrhpn1djk.cn-beijing.personal.cr.aliyuncs.com"
REGISTRY_VPC="crpi-3fswqinlrhpn1djk-vpc.cn-beijing.personal.cr.aliyuncs.com"
USERNAME="t_1483892331156_0523"
NAMESPACE="docker-miskies"
REPO="finintern_hub"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="${SCRIPT_DIR}"

LOCAL_IMAGE="job_hub-finintern-next:latest"
COMPOSE_FILE="docker-compose.build.yml"
DOCKERFILE="Dockerfile.push"

USE_VPC=false
DRY_RUN="false"  # 默认非预览模式

# 从 package.json 读取版本号
PACKAGE_VERSION=$(grep '"version"' "${PROJECT_DIR}/package.json" | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/' || echo "unknown")
VERSION_TAG="v${PACKAGE_VERSION}"  # v7.4.0
REMOTE_IMAGE="${REGISTRY}/${NAMESPACE}/${REPO}:${VERSION_TAG}"
REMOTE_IMAGE_LATEST="${REGISTRY}/${NAMESPACE}/${REPO}:latest"

usage() {
    echo "用法: $0 [选项]"
    echo ""
    echo "一键推送 Docker 镜像到阿里云 Container Registry"
    echo "自动读取 package.json 版本号作为标签，避免 latest 缓存问题"
    echo ""
    echo "选项:"
    echo "  -v, --vpc         使用 VPC 内网地址推送"
    echo "  -n, --dry-run     仅显示将要执行的命令"
    echo "  -b, --build       推送前先构建镜像"
    echo "  -c, --clean       构建前清理缓存"
    echo "  -t, --tag TAG     指定版本标签 (默认: v+package.json版本)"
    echo "  -h, --help        显示帮助"
    echo ""
    echo "示例:"
    echo "  $0 -b -c                    # 构建+清理+推送 (标签: v7.4.0)"
    echo "  $0 -b -c -t v2.5.0         # 构建并推送 (标签: v2.5.0)"
    echo "  $0 -b -c -v                # VPC 内网推送"
}

while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--vpc) USE_VPC=true; shift ;;
        -n|--dry-run) DRY_RUN=true; shift ;;
        -b|--build) DO_BUILD=true; shift ;;
        -c|--clean) DO_CLEAN=true; shift ;;
        -t|--tag) VERSION_TAG="$2"; shift 2 ;;
        -h|--help) usage; exit 0 ;;
        *) echo "未知选项: $1"; usage; exit 1 ;;
    esac
done

if [[ "$USE_VPC" == "true" ]]; then
    REGISTRY="$REGISTRY_VPC"
    REMOTE_IMAGE="${REGISTRY}/${NAMESPACE}/${REPO}:${VERSION_TAG}"
    REMOTE_IMAGE_LATEST="${REGISTRY}/${NAMESPACE}/${REPO}:latest"
fi

echo "========================================="
echo " 阿里云镜像推送 (版本号模式)"
echo "========================================="
echo " 版本标签:   ${VERSION_TAG}"
echo " 本地镜像:   ${LOCAL_IMAGE}"
echo " 远程镜像:   ${REMOTE_IMAGE}"
echo " 同时更新:   ${REMOTE_IMAGE_LATEST}"
echo " VPC内网:    ${USE_VPC}"
echo " Dry Run:    ${DRY_RUN:-false}"
echo " Build:      ${DO_BUILD:-false}"
echo " Clean:      ${DO_CLEAN:-false}"
echo "========================================="
echo ""

run_cmd() {
    if [[ "${DRY_RUN}" == "true" ]]; then
        echo "[DRY RUN] $*"
    else
        echo "$ $*"
        eval "$@"
    fi
}

if [[ "${DO_CLEAN}" == "true" ]]; then
    echo "[1/6] 清理构建缓存"
    run_cmd docker builder prune -f
    run_cmd docker system prune -f --volumes
    echo "OK 缓存清理完成"
    echo ""
fi

if [[ "${DO_BUILD}" == "true" ]]; then
    echo "[2/6] 构建 Docker 镜像"
    
    if [[ "${DRY_RUN}" == "false" ]]; then
        if ! command -v docker >/dev/null 2>&1; then
            echo "ERROR Docker 未安装"
            exit 1
        fi
        if ! docker info >/dev/null 2>&1; then
            echo "ERROR Docker 服务未运行"
            exit 1
        fi
        if [ ! -f "${PROJECT_DIR}/${COMPOSE_FILE}" ]; then
            echo "ERROR Compose 文件不存在: ${COMPOSE_FILE}"
            exit 1
        fi
    fi
    
    run_cmd docker compose -f "${PROJECT_DIR}/${COMPOSE_FILE}" build --no-cache finintern-next
    
    if [[ "${DRY_RUN}" == "false" ]]; then
        if ! docker image inspect "$LOCAL_IMAGE" >/dev/null 2>&1; then
            echo "ERROR 镜像构建失败"
            exit 1
        fi
    fi
    
    IMAGE_ID=$(docker image inspect "$LOCAL_IMAGE" --format '{{.Id}}' 2>/dev/null | cut -c8-19 || echo "N/A")
    IMAGE_SIZE=$(docker image inspect "$LOCAL_IMAGE" --format '{{.Size}}' 2>/dev/null | awk '{printf "%.0f MB", $1/1024/1024}' || echo "N/A")
    echo "OK 构建完成: ${LOCAL_IMAGE}"
    echo "   ID:   ${IMAGE_ID}"
    echo "   大小: ${IMAGE_SIZE}"
    echo ""
else
    echo "[2/6] 检查本地镜像"
    if ! docker image inspect "$LOCAL_IMAGE" >/dev/null 2>&1; then
        echo "ERROR 本地镜像不存在，请使用 -b 参数构建"
        exit 1
    fi
    IMAGE_ID=$(docker image inspect "$LOCAL_IMAGE" --format '{{.Id}}' | cut -c8-19)
    IMAGE_SIZE=$(docker image inspect "$LOCAL_IMAGE" --format '{{.Size}}' | awk '{printf "%.0f MB", $1/1024/1024}')
    echo "OK 找到本地镜像 (ID: ${IMAGE_ID}, 大小: ${IMAGE_SIZE})"
    echo ""
fi

echo "[3/6] 登录阿里云 ACR"
if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[DRY RUN] docker login --username=${USERNAME} ${REGISTRY}"
else
    if ! docker login --username="$USERNAME" "$REGISTRY"; then
        echo "ERROR 登录失败，请检查密码"
        exit 1
    fi
fi
echo "OK 登录成功"
echo ""

echo "[4/6] 标记并推送版本镜像 (${VERSION_TAG})"
run_cmd docker tag "$LOCAL_IMAGE" "$REMOTE_IMAGE"
run_cmd docker push "$REMOTE_IMAGE"
echo "OK 版本镜像推送完成: ${REMOTE_IMAGE}"
echo ""

echo "[5/6] 更新 latest 标签"
run_cmd docker tag "$LOCAL_IMAGE" "$REMOTE_IMAGE_LATEST"
run_cmd docker push "$REMOTE_IMAGE_LATEST"
echo "OK latest 标签已更新"
echo ""

echo "[6/6] 完成"
echo ""
echo "========================================="
echo " OK 全部完成!"
echo "========================================="
echo ""
echo "版本信息:"
echo "  版本标签: ${VERSION_TAG}"
echo "  镜像ID:   ${IMAGE_ID}"
echo "  镜像大小: ${IMAGE_SIZE}"
echo ""
echo "远程地址:"
echo "  版本镜像: ${REMOTE_IMAGE}"
echo "  Latest:   ${REMOTE_IMAGE_LATEST}"
echo ""
echo "服务器部署命令 (使用版本号):"
echo "  ----------------------------------------"
echo "  # 删除旧容器和镜像"
echo "  docker stop job-hub 2>/dev/null; docker rm job-hub 2>/dev/null"
echo "  docker rmi \$(docker images -q ${REGISTRY}/${NAMESPACE}/${REPO}) 2>/dev/null || true"
echo ""
echo "  # 拉取指定版本并运行"
echo "  docker pull ${REMOTE_IMAGE}"
echo "  docker run -d \\"
echo "    --name job-hub \\"
echo "    --restart unless-stopped \\"
echo "    -p 3000:3000 \\"
echo "    -e NODE_ENV=production \\"
echo "    -e ADMIN_TOKEN=your-token \\"
echo "    -v /opt/job_hub/data:/app/data \\"
echo "    -v /opt/job_hub/log:/app/log \\"
echo "    ${REMOTE_IMAGE}"
echo ""
echo "  # 验证版本"
echo "  docker inspect job-hub --format '{{.Image}}'"
echo "----------------------------------------"
echo ""
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
