# Docker 阿里云一键部署配置 Spec

## Why
用户需要将整个程序一键推送到阿里云镜像仓库，并在服务器上通过简单的 `docker run` 命令即可运行，无需额外配置。现有的 Docker 配置已被移动到 trash 目录，需要重新设计一套完整、简洁、易用的方案。

## What Changes
- 创建统一的 Dockerfile，支持多阶段构建
- 创建一键推送脚本 `push-to-aliyun.sh`
- 创建服务器部署脚本 `deploy.sh`
- 创建 `.dockerignore` 文件
- 配置使用阿里云镜像仓库: `crpi-3fswqinlrhpn1djk.cn-beijing.personal.cr.aliyuncs.com/docker-miskies/finintern_hub`

## Impact
- 新增文件: Dockerfile, .dockerignore, push-to-aliyun.sh, deploy.sh
- 镜像标签格式: `crpi-3fswqinlrhpn1djk.cn-beijing.personal.cr.aliyuncs.com/docker-miskies/finintern_hub:[版本号]`
- 服务器部署: 仅需 `docker run` 命令，无需重新配置

## ADDED Requirements

### Requirement: 统一 Dockerfile
The system SHALL provide a single Dockerfile that:
- 使用 Node.js 20 Alpine 作为基础镜像
- 采用多阶段构建（deps → builder → runner）减小镜像体积
- 配置阿里云 Alpine 和 npm 镜像源加速构建
- 创建非 root 用户运行应用（安全最佳实践）
- 暴露 3000 端口
- 包含 HEALTHCHECK 健康检查
- 支持从 package.json 自动读取版本号

#### Scenario: 构建成功
- **GIVEN** 项目代码完整
- **WHEN** 执行 `docker build`
- **THEN** 成功构建镜像，包含所有依赖和构建产物

### Requirement: 一键推送脚本
The system SHALL provide `push-to-aliyun.sh` that:
- 自动读取 package.json 版本号作为镜像标签
- 支持自定义标签参数 `-t`
- 构建并推送镜像到阿里云 ACR
- 同时推送版本标签和 latest 标签
- 提供使用帮助信息
- 推送完成后显示部署命令

#### Scenario: 推送成功
- **GIVEN** 用户已登录阿里云 docker login
- **WHEN** 执行 `./push-to-aliyun.sh`
- **THEN** 镜像成功推送到 `crpi-3fswqinlrhpn1djk.cn-beijing.personal.cr.aliyuncs.com/docker-miskies/finintern_hub:v[版本号]`

### Requirement: 服务器部署脚本
The system SHALL provide `deploy.sh` that:
- 拉取指定版本的阿里云镜像
- 自动创建数据目录和日志目录
- 生成环境变量配置文件模板
- 使用 docker run 启动容器
- 支持数据卷挂载持久化

#### Scenario: 服务器一键部署
- **GIVEN** 服务器已安装 Docker
- **WHEN** 执行 `./deploy.sh`
- **THEN** 容器成功运行，应用可通过 3000 端口访问

### Requirement: 环境变量配置
The system SHALL handle environment variables:
- 敏感信息（Token、API Key）通过环境变量注入
- 提供 `.env.example` 模板文件
- 服务器部署时挂载 .env 文件到容器
- 数据库路径配置为 `/app/data/jobs.db`

## 待确认问题
以下问题需要用户确认：

1. **认证 Token 配置**: 服务器部署时，ADMIN_TOKEN 等认证信息如何提供？
   - 选项A: 手动创建 .env 文件上传到服务器
   - 选项B: 通过脚本交互式输入
   - 选项C: 使用默认测试 Token（不推荐生产环境）

2. **数据持久化**: 数据库和日志是否需要在宿主机持久化？
   - 选项A: 是，挂载宿主机目录（推荐）
   - 选项B: 否，使用 Docker 卷（数据随容器删除而丢失）

3. **端口映射**: 应用使用 3000 端口，服务器上映射到哪个端口？
   - 选项A: 保持 3000:3000
   - 选项B: 映射到 80:3000（需要 root 权限）
   - 选项C: 自定义端口

4. **AI 配置**: OPENAI_API_KEY 是否需要在镜像构建时配置？
   - 选项A: 构建时注入（镜像包含 Key，不推荐）
   - 选项B: 运行时通过环境变量注入（推荐）
