#!/usr/bin/env bash
set -euo pipefail

REGISTRY="crpi-3fswqinlrhpn1djk.cn-beijing.personal.cr.aliyuncs.com"
REGISTRY_VPC="crpi-3fswqinlrhpn1djk-vpc.cn-beijing.personal.cr.aliyuncs.com"
USERNAME="t_1483892331156_0523"
NAMESPACE="docker-miskies"
REPO="finintern_hub"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VERSION="$(node -p "require('$SCRIPT_DIR/package.json').version")"

LOCAL_IMAGE="job_hub-finintern-next:latest"

USE_VPC=false
PUSH_TAG=""

usage() {
    echo "用法: $0 [选项]"
    echo ""
    echo "一键推送 Docker 镜像到阿里云 Container Registry"
    echo ""
    echo "选项:"
    echo "  -t, --tag TAG     指定推送的镜像标签 (默认: v${VERSION})"
    echo "  -v, --vpc         使用 VPC 内网地址推送 (ECS 部署时推荐)"
    echo "  -l, --latest      同时推送 latest 标签"
    echo "  -n, --dry-run     仅显示将要执行的命令，不实际执行"
    echo "  -h, --help        显示帮助信息"
    echo ""
    echo "示例:"
    echo "  $0                          # 推送 v${VERSION}"
    echo "  $0 -t v6.7.0-beta          # 推送指定标签"
    echo "  $0 -v                       # 使用 VPC 内网地址"
    echo "  $0 -l                       # 同时推送 latest"
    echo "  $0 -n                       # 预览模式"
}

while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--tag)
            PUSH_TAG="$2"
            shift 2
            ;;
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

if [ -z "$PUSH_TAG" ]; then
    PUSH_TAG="v${VERSION}"
fi

if [ "$USE_VPC" = true ]; then
    REGISTRY="$REGISTRY_VPC"
fi

REMOTE_IMAGE="${REGISTRY}/${NAMESPACE}/${REPO}:${PUSH_TAG}"

echo "========================================="
echo " 阿里云镜像推送"
echo "========================================="
echo " 本地镜像:   ${LOCAL_IMAGE}"
echo " 远程镜像:   ${REMOTE_IMAGE}"
if [ "${PUSH_LATEST:-false}" = true ]; then
    echo " Latest标签:  ${REGISTRY}/${NAMESPACE}/${REPO}:latest"
fi
echo " VPC内网:    ${USE_VPC}"
echo " Dry Run:    ${DRY_RUN:-false}"
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

echo ">>> 步骤 1/4: 检查本地镜像"
if ! docker image inspect "$LOCAL_IMAGE" >/dev/null 2>&1; then
    echo "❌ 本地镜像 ${LOCAL_IMAGE} 不存在，请先构建:"
    echo "   docker compose build"
    exit 1
fi
IMAGE_ID=$(docker image inspect "$LOCAL_IMAGE" --format '{{.Id}}' | cut -c8-19)
echo "✅ 找到本地镜像 ${LOCAL_IMAGE} (ID: ${IMAGE_ID})"
echo ""

echo ">>> 步骤 2/4: 登录阿里云 Container Registry"
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

echo ">>> 步骤 3/4: 标记镜像"
run_cmd docker tag "$LOCAL_IMAGE" "$REMOTE_IMAGE"
echo "✅ 标记完成: ${REMOTE_IMAGE}"

if [ "${PUSH_LATEST:-false}" = true ]; then
    LATEST_IMAGE="${REGISTRY}/${NAMESPACE}/${REPO}:latest"
    run_cmd docker tag "$LOCAL_IMAGE" "$LATEST_IMAGE"
    echo "✅ 标记完成: ${LATEST_IMAGE}"
fi
echo ""

echo ">>> 步骤 4/4: 推送镜像"
run_cmd docker push "$REMOTE_IMAGE"
echo "✅ 推送完成: ${REMOTE_IMAGE}"

if [ "${PUSH_LATEST:-false}" = true ]; then
    LATEST_IMAGE="${REGISTRY}/${NAMESPACE}/${REPO}:latest"
    run_cmd docker push "$LATEST_IMAGE"
    echo "✅ 推送完成: ${LATEST_IMAGE}"
fi
echo ""

echo "========================================="
echo " ✅ 全部完成!"
echo "========================================="
echo ""
echo "拉取命令:"
echo "  docker pull ${REMOTE_IMAGE}"
echo ""
echo "部署命令:"
echo "  docker run -d -p 3001:3000 -v ./data:/app/data ${REMOTE_IMAGE}"
