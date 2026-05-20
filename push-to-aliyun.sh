#!/bin/bash

set -euo pipefail

# 镜像仓库配置
REGISTRY="crpi-3fswqinlrhpn1djk.cn-beijing.personal.cr.aliyuncs.com"
REPOSITORY="docker-miskies/finintern_hub"
IMAGE_NAME="${REGISTRY}/${REPOSITORY}"

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_JSON="${SCRIPT_DIR}/package.json"

# 显示帮助信息
show_help() {
    cat << EOF
FinIntern Hub 一键推送脚本

用法: $(basename "$0") [选项]

选项:
    -t <tag>    自定义镜像标签（默认从 package.json 读取 version）
    -h          显示帮助信息

示例:
    $(basename "$0")              # 使用 package.json 中的版本号推送
    $(basename "$0") -t v1.0.0    # 使用自定义标签推送
    $(basename "$0") -h           # 显示帮助

说明:
    1. 自动从 package.json 读取 version 作为镜像标签（格式：v{version}）
    2. 同时推送版本标签和 latest 标签
    3. 推送完成后显示服务器部署命令
EOF
}

# 解析命令行参数
CUSTOM_TAG=""
while getopts "t:h" opt; do
    case $opt in
        t)
            CUSTOM_TAG="$OPTARG"
            ;;
        h)
            show_help
            exit 0
            ;;
        \?)
            echo "错误: 无效的选项 -$OPTARG" >&2
            show_help
            exit 1
            ;;
        :)
            echo "错误: 选项 -$OPTARG 需要参数" >&2
            show_help
            exit 1
            ;;
    esac
done

# 检查 package.json 是否存在
if [[ ! -f "$PACKAGE_JSON" ]]; then
    echo "错误: 未找到 package.json 文件: $PACKAGE_JSON" >&2
    exit 1
fi

# 获取版本号
if [[ -n "$CUSTOM_TAG" ]]; then
    VERSION_TAG="$CUSTOM_TAG"
    echo "使用自定义标签: $VERSION_TAG"
else
    # 从 package.json 读取 version
    VERSION=$(grep -o '"version"[^,]*' "$PACKAGE_JSON" | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+' || true)

    if [[ -z "$VERSION" ]]; then
        echo "错误: 无法从 package.json 读取 version" >&2
        exit 1
    fi

    VERSION_TAG="v${VERSION}"
    echo "从 package.json 读取版本: $VERSION"
fi

echo "========================================"
echo "镜像仓库: $IMAGE_NAME"
echo "版本标签: $VERSION_TAG"
echo "========================================"

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "错误: Docker 未安装或未在 PATH 中" >&2
    exit 1
fi

# 检查是否已登录阿里云仓库
echo ""
echo "检查 Docker 登录状态..."
if ! docker info &> /dev/null; then
    echo "错误: Docker 守护进程未运行或未登录" >&2
    echo "请先运行: docker login $REGISTRY" >&2
    exit 1
fi

# 构建镜像
echo ""
echo "步骤 1/4: 构建 Docker 镜像..."
docker build -t "${IMAGE_NAME}:${VERSION_TAG}" -t "${IMAGE_NAME}:latest" "$SCRIPT_DIR"

if [[ $? -ne 0 ]]; then
    echo "错误: 镜像构建失败" >&2
    exit 1
fi

echo "✓ 镜像构建成功"

# 推送版本标签
echo ""
echo "步骤 2/4: 推送版本标签 ${VERSION_TAG}..."
docker push "${IMAGE_NAME}:${VERSION_TAG}"

if [[ $? -ne 0 ]]; then
    echo "错误: 推送版本标签失败" >&2
    echo "请确保已登录阿里云镜像仓库: docker login $REGISTRY" >&2
    exit 1
fi

echo "✓ 版本标签推送成功"

# 推送 latest 标签
echo ""
echo "步骤 3/4: 推送 latest 标签..."
docker push "${IMAGE_NAME}:latest"

if [[ $? -ne 0 ]]; then
    echo "错误: 推送 latest 标签失败" >&2
    exit 1
fi

echo "✓ latest 标签推送成功"

# 清理本地镜像（可选）
echo ""
echo "步骤 4/4: 清理本地镜像..."
docker rmi "${IMAGE_NAME}:${VERSION_TAG}" "${IMAGE_NAME}:latest" &> /dev/null || true
echo "✓ 本地镜像已清理"

# 显示完成信息和部署命令
echo ""
echo "========================================"
echo "✓ 推送完成！"
echo "========================================"
echo ""
echo "镜像地址:"
echo "  ${IMAGE_NAME}:${VERSION_TAG}"
echo "  ${IMAGE_NAME}:latest"
echo ""
echo "========================================"
echo "服务器部署命令:"
echo "========================================"
echo ""
echo "# 1. 登录阿里云镜像仓库（如未登录）"
echo "docker login ${REGISTRY}"
echo ""
echo "# 2. 拉取最新镜像"
echo "docker pull ${IMAGE_NAME}:${VERSION_TAG}"
echo ""
echo "# 3. 停止并删除旧容器（根据实际情况修改容器名）"
echo "docker stop job-hub || true"
echo "docker rm job-hub || true"
echo ""
echo "# 4. 启动新容器（根据实际需求调整端口和参数）"
echo "docker run -d \\"
echo "  --name job-hub \\"
echo "  --restart always \\"
echo "  -p 3000:3000 \\"
echo "  -v /opt/job-hub/data:/app/data \\"
echo "  -v /opt/job-hub/log:/app/log \\"
echo "  -v /opt/job-hub/.env:/app/.env:ro \\"
echo "  ${IMAGE_NAME}:${VERSION_TAG}"
echo ""
echo "# 或使用 latest 标签"
echo "docker run -d --name job-hub --restart always -p 3000:3000 \\"
echo "  -v /opt/job-hub/data:/app/data \\"
echo "  -v /opt/job-hub/log:/app/log \\"
echo "  -v /opt/job-hub/.env:/app/.env:ro \\"
echo "  ${IMAGE_NAME}:latest"
echo ""
echo "========================================"
