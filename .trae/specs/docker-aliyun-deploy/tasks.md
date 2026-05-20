# Tasks

- [x] Task 1: 创建 Dockerfile
  - [x] SubTask 1.1: 配置多阶段构建（deps → builder → runner）
  - [x] SubTask 1.2: 配置阿里云 Alpine 和 npm 镜像源
  - [x] SubTask 1.3: 创建非 root 用户（nextjs:nodejs）
  - [x] SubTask 1.4: 添加 HEALTHCHECK 健康检查
  - [x] SubTask 1.5: 暴露 3000 端口并设置 CMD

- [x] Task 2: 创建 .dockerignore
  - [x] SubTask 2.1: 排除 node_modules、.next 等构建产物
  - [x] SubTask 2.2: 排除 .env 等敏感文件
  - [x] SubTask 2.3: 排除数据文件和日志

- [x] Task 3: 创建一键推送脚本 push-to-aliyun.sh
  - [x] SubTask 3.1: 读取 package.json 版本号
  - [x] SubTask 3.2: 构建 Docker 镜像
  - [x] SubTask 3.3: 打标签并推送到阿里云 ACR
  - [x] SubTask 3.4: 推送 latest 标签
  - [x] SubTask 3.5: 显示部署命令和使用帮助

- [x] Task 4: 创建服务器部署脚本 deploy.sh
  - [x] SubTask 4.1: 拉取阿里云镜像
  - [x] SubTask 4.2: 创建数据目录和日志目录
  - [x] SubTask 4.3: 生成 .env 配置文件（如不存在）
  - [x] SubTask 4.4: 使用 docker run 启动容器
  - [x] SubTask 4.5: 健康检查验证

- [x] Task 5: 创建环境变量模板 .env.example
  - [x] SubTask 5.1: 定义所有必需的环境变量
  - [x] SubTask 5.2: 添加配置说明注释

# Task Dependencies
- Task 2 依赖于 Task 1（需要知道构建产物目录）
- Task 3 依赖于 Task 1 和 Task 2
- Task 4 和 Task 5 可以并行执行
