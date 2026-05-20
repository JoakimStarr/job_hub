# Checklist

## Dockerfile 检查项
- [x] Dockerfile 使用多阶段构建（deps → builder → runner）
- [x] 配置了阿里云 Alpine 镜像源
- [x] 配置了 npm 镜像源参数
- [x] 创建了非 root 用户运行应用
- [x] 包含 HEALTHCHECK 健康检查
- [x] 暴露 3000 端口
- [x] 镜像可以成功构建

## .dockerignore 检查项
- [x] 排除了 node_modules
- [x] 排除了 .next 构建产物
- [x] 排除了 .env 敏感文件
- [x] 排除了数据文件（*.db）
- [x] 排除了日志文件

## push-to-aliyun.sh 检查项
- [x] 脚本可以读取 package.json 版本号
- [x] 支持自定义标签参数 -t
- [x] 成功构建镜像
- [x] 成功推送到阿里云 ACR（版本标签）
- [x] 成功推送到阿里云 ACR（latest 标签）
- [x] 显示正确的部署命令

## deploy.sh 检查项
- [x] 脚本可以拉取阿里云镜像
- [x] 自动创建数据目录
- [x] 自动创建日志目录
- [x] 生成 .env 配置文件（如果不存在）
- [x] 使用 docker run 成功启动容器
- [x] 容器健康检查通过
- [x] 应用可以通过 3000 端口访问

## 整体功能检查项
- [x] 本地构建成功
- [x] 推送到阿里云成功
- [x] 服务器上一键部署成功
- [x] 数据持久化正常工作
- [x] 环境变量正确注入
