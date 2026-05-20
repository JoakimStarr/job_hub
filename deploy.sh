#!/bin/bash

set -euo pipefail

# FinIntern Hub 部署脚本
# 用法: ./deploy.sh [版本标签]
# 示例: ./deploy.sh v1.0.0 或 ./deploy.sh (默认 latest)

# 配置变量
IMAGE_REGISTRY="crpi-3fswqinlrhpn1djk.cn-beijing.personal.cr.aliyuncs.com/docker-miskies/finintern_hub"
VERSION="${1:-latest}"
FULL_IMAGE="${IMAGE_REGISTRY}:${VERSION}"

# 目录配置
BASE_DIR="/opt/job-hub"
DATA_DIR="${BASE_DIR}/data"
LOG_DIR="${BASE_DIR}/log"
ENV_FILE="${BASE_DIR}/.env"

# 容器配置
CONTAINER_NAME="job-hub"
HOST_PORT=3000
CONTAINER_PORT=3000

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的信息
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 Docker 是否安装
check_docker() {
    log_info "检查 Docker 环境..."
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        log_error "Docker 服务未运行或当前用户无权限访问 Docker"
        exit 1
    fi
    log_success "Docker 环境正常"
}

# 创建必要的目录并设置权限
create_directories() {
    log_info "创建数据目录..."
    mkdir -p "${DATA_DIR}"
    mkdir -p "${LOG_DIR}"
    
    # 设置目录权限为容器内的 nextjs 用户 (UID 1001)
    chown -R 1001:1001 "${DATA_DIR}"
    chown -R 1001:1001 "${LOG_DIR}"
    
    log_success "目录创建完成: ${DATA_DIR}, ${LOG_DIR}"
}

# 生成 .env 模板
generate_env_template() {
    cat > "${ENV_FILE}" << 'EOF'
# FinIntern Hub 环境变量配置
# 使用说明：
# 1. 修改所有 TOKEN 为随机字符串（建议使用 openssl rand -base64 32 生成）
# 2. 根据需要配置其他选项
# 3. 重启应用使配置生效

# ============================================
# 认证 Token 配置（重要：必须修改为随机字符串！）
# ============================================

# 管理员 Token - 拥有最高权限，可执行所有操作
# 建议生成方式：openssl rand -base64 32
ADMIN_TOKEN=your_admin_token_here_change_me

# 操作员 Token - 拥有常规操作权限，可管理职位信息
# 建议生成方式：openssl rand -base64 32
OPERATOR_TOKEN=your_operator_token_here_change_me

# 查看者 Token - 仅拥有查看权限，无法修改数据
# 建议生成方式：openssl rand -base64 32
VIEWER_TOKEN=your_viewer_token_here_change_me

# 认证盐值 - 用于加密会话等敏感数据
# 要求：至少32位随机字符串
# 建议生成方式：openssl rand -base64 48
AUTH_SALT=your_auth_salt_here_must_be_at_least_32_characters_long

# ============================================
# 数据库配置
# ============================================

# SQLite 数据库文件路径
DATABASE_PATH=/app/data/jobs.db

# ============================================
# 会话配置
# ============================================

# 会话超时时间（小时）
SESSION_TIMEOUT_HOURS=24

# 最大登录尝试次数
MAX_LOGIN_ATTEMPTS=5

# 登录锁定时间（分钟）
LOGIN_LOCKOUT_MINUTES=15

# ============================================
# AI 配置（可选）
# ============================================

# OpenAI API 密钥
OPENAI_API_KEY=

# OpenAI API 基础 URL
OPENAI_BASE_URL=https://api.openai.com/v1
EOF
}

# 检查并创建 .env 文件
check_env_file() {
    log_info "检查环境变量配置文件..."
    if [[ ! -f "${ENV_FILE}" ]]; then
        log_warn ".env 文件不存在，正在生成模板..."
        generate_env_template
        log_warn "========================================"
        log_warn "请编辑配置文件: ${ENV_FILE}"
        log_warn "修改 Token 为随机字符串后重新运行此脚本"
        log_warn "========================================"
        exit 1
    fi
    log_success ".env 文件已存在"
}

# 拉取镜像
pull_image() {
    log_info "拉取镜像: ${FULL_IMAGE}"
    if ! docker pull "${FULL_IMAGE}"; then
        log_error "镜像拉取失败，请检查镜像地址和网络连接"
        exit 1
    fi
    log_success "镜像拉取成功"
}

# 停止并删除旧容器
stop_old_container() {
    log_info "检查旧容器..."
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        log_warn "发现旧容器，正在停止并删除..."
        docker stop "${CONTAINER_NAME}" &> /dev/null || true
        docker rm "${CONTAINER_NAME}" &> /dev/null || true
        log_success "旧容器已清理"
    else
        log_info "未发现旧容器"
    fi
}

# 启动容器
start_container() {
    log_info "启动容器: ${CONTAINER_NAME}"
    docker run -d \
        --name "${CONTAINER_NAME}" \
        --restart unless-stopped \
        -p "${HOST_PORT}:${CONTAINER_PORT}" \
        -v "${DATA_DIR}:/app/data" \
        -v "${LOG_DIR}:/app/log" \
        -v "${ENV_FILE}:/app/.env:ro" \
        "${FULL_IMAGE}"

    log_success "容器启动命令已执行"
}

# 健康检查
health_check() {
    log_info "等待容器启动 (5秒)..."
    sleep 5

    log_info "执行健康检查..."

    # 检查容器是否运行
    if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        log_error "容器未在运行状态"
        log_info "查看容器日志:"
        docker logs "${CONTAINER_NAME}" 2>&1 | tail -20 || true
        exit 1
    fi

    # 检查端口是否可访问
    local max_retries=10
    local retry_count=0
    local health_status="unhealthy"

    while [[ $retry_count -lt $max_retries ]]; do
        if curl -sf "http://localhost:${HOST_PORT}/api/health" &> /dev/null || \
           curl -sf "http://localhost:${HOST_PORT}" &> /dev/null; then
            health_status="healthy"
            break
        fi
        retry_count=$((retry_count + 1))
        log_info "健康检查尝试 ${retry_count}/${max_retries}..."
        sleep 3
    done

    if [[ "$health_status" == "healthy" ]]; then
        log_success "健康检查通过"
        return 0
    else
        log_warn "健康检查未通过，但容器正在运行"
        return 1
    fi
}

# 显示状态信息
show_status() {
    echo ""
    echo "========================================"
    log_success "FinIntern Hub 部署完成!"
    echo "========================================"
    echo ""
    echo -e "${BLUE}访问地址:${NC}"
    echo "  - 本地访问: http://localhost:${HOST_PORT}"
    echo "  - 外部访问: http://$(hostname -I | awk '{print $1}'):${HOST_PORT}"
    echo ""
    echo -e "${BLUE}容器信息:${NC}"
    docker ps --filter "name=${CONTAINER_NAME}" --format "  名称: {{.Names}}\n  状态: {{.Status}}\n  端口: {{.Ports}}"
    echo ""
    echo -e "${BLUE}数据目录:${NC} ${DATA_DIR}"
    echo -e "${BLUE}日志目录:${NC} ${LOG_DIR}"
    echo -e "${BLUE}环境配置:${NC} ${ENV_FILE}"
    echo ""
    echo -e "${BLUE}常用命令:${NC}"
    echo "  查看日志: docker logs -f ${CONTAINER_NAME}"
    echo "  停止服务: docker stop ${CONTAINER_NAME}"
    echo "  启动服务: docker start ${CONTAINER_NAME}"
    echo "  重启服务: docker restart ${CONTAINER_NAME}"
    echo "  进入容器: docker exec -it ${CONTAINER_NAME} /bin/sh"
    echo "========================================"
}

# 主函数
main() {
    echo "========================================"
    echo "  FinIntern Hub 部署脚本"
    echo "  版本: ${VERSION}"
    echo "========================================"
    echo ""

    check_docker
    create_directories
    check_env_file
    pull_image
    stop_old_container
    start_container
    health_check
    show_status
}

# 执行主函数
main "$@"
