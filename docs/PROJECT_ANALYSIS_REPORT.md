# Job Hub 项目全面分析报告

> 分析日期：2026-05-20 | 版本：v7.4.0

---

## 一、项目概述

**Job Hub (FinIntern Hub)** 是一个金融类实习招聘信息聚合平台，通过爬虫自动采集9所财经/综合类大学就业网站的招聘信息，提供岗位浏览、搜索、筛选、收藏、AI简历匹配与推荐等功能。

### 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端框架 | Next.js (App Router) | ^15.3.3 |
| UI 库 | React | ^18.3.1 |
| 状态管理 | Zustand | ^5.0.13 |
| 数据库 | SQLite (better-sqlite3) | ^11.10.0 |
| Markdown | react-markdown | ^10.1.0 |
| 爬虫语言 | Python | 3.13+ |
| 异步爬虫 | aiohttp + asyncio | ^3.9.0 |
| 浏览器自动化 | Playwright | ^1.40.0 |
| HTML 解析 | BeautifulSoup4 | ^4.12.0 |
| 异步数据库 | aiosqlite | ^0.19.0 |
| 爬虫日志 | loguru | ^0.7.0 |
| 容器化 | Docker + Docker Compose | - |

---

## 二、系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     用户浏览器                               │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP
┌──────────────────────────▼──────────────────────────────────┐
│              Next.js 15 Web 应用 (Port 3000)                │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  页面组件    │  │  API Routes  │  │   Lib 工具库     │   │
│  │  /jobs       │  │  /api/jobs/* │  │  db-utils.ts     │   │
│  │  /match      │  │  /api/auth/* │  │  auth-db.ts      │   │
│  │  /crawler    │  │  /api/match/*│  │  score-engine.ts │   │
│  │  /favorites  │  │  /api/crawler│  │  match-engine.ts │   │
│  │  /system     │  │  /api/resume │  │  ai-service.ts   │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │ better-sqlite3 (同步)
┌──────────────────────────▼──────────────────────────────────┐
│                  SQLite 数据库 (data/jobs.db)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │  jobs    │ │  users   │ │ sessions │ │ login_logs   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│  ┌──────────┐ ┌──────────────────┐ ┌──────────────────┐   │
│  │crawl_logs│ │location_mapping  │ │education_mapping │   │
│  └──────────┘ └──────────────────┘ └──────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │ aiosqlite (异步)
┌──────────────────────────▼──────────────────────────────────┐
│              Python 爬虫系统 (独立进程)                      │
│  ┌────────────────┐  ┌──────────────────┐                   │
│  │ AsyncMultiCrawler│  │  lite_crawler.py │ (备选)          │
│  │ (异步并发爬虫)   │  │  (单线程爬虫)     │                 │
│  └────────┬───────┘  └──────────────────┘                   │
│           │                                                  │
│  ┌────────▼───────────────────────────────────────────┐     │
│  │  UnifiedSpider (策略模式调度)                       │     │
│  │  ├── ApiPostStrategy (sufe/cufe/dufe)              │     │
│  │  ├── ApiGetStrategy (zuel)                         │     │
│  │  ├── HtmlStrategy (swufe)                          │     │
│  │  └── BrowserStrategy (uibe/jxufe/neu/smartedu)     │     │
│  └────────────────────────────────────────────────────┘     │
│  + 中间件管道 (MiddlewarePipeline)                          │
│  + 插件系统 (PluginManager)                                 │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 数据流图

```
[外部大学就业网站] 
    │
    ▼ (HTTP/Playwright)
[Python 爬虫] ──写入──▶ [SQLite jobs.db]
    │                       │
    │                       ▼ (better-sqlite3 读取)
    │               [Next.js API Routes]
    │                       │
    │                       ▼ (JSON Response)
    │               [React 前端页面]
    │                       │
    │                       ▼
    │               [用户浏览器]
```

---

## 三、前端模块分析

### 3.1 API 路由（29个端点）

| 路由 | 方法 | 认证 | 用途 |
|------|------|------|------|
| `/api/jobs` | GET | 无 | 岗位列表（分页、排序、筛选） |
| `/api/jobs/[id]` | GET/PUT | 无 | 岗位详情/更新收藏状态 |
| `/api/jobs/search` | GET | 无 | 关键词搜索 |
| `/api/jobs/filters` | GET | 无 | 获取筛选选项 |
| `/api/jobs/favorites` | GET | 无 | 获取收藏列表 |
| `/api/jobs/[id]/favorite` | POST | 无 | 切换收藏 |
| `/api/jobs/[id]/ai-analysis` | GET | 无 | AI岗位分析 |
| `/api/auth/login` | POST | - | 用户登录 |
| `/api/auth/logout` | POST | Cookie | 用户登出 |
| `/api/auth/me` | GET | Cookie | 获取当前用户 |
| `/api/auth/validate` | POST | - | 验证Session |
| `/api/auth/change-password` | POST | Cookie | 修改密码 |
| `/api/auth/users` | GET/POST | admin | 用户管理 |
| `/api/auth/roles` | GET | admin | 角色列表 |
| `/api/auth/logs` | GET | admin | 登录日志 |
| `/api/crawler/sources` | GET | 无 | 爬虫数据源列表 |
| `/api/crawler/status` | GET | 无 | 爬虫运行状态 |
| `/api/crawler/logs` | GET | 无 | 爬虫日志 |
| `/api/match/jobs` | POST | Cookie | 批量简历匹配 |
| `/api/match/job/[id]` | GET | Cookie | 单个岗位匹配 |
| `/api/recommendations/analyze` | POST | Cookie | AI推荐分析 |
| `/api/recommendations/delivery-assistant` | POST | Cookie | 简历投递助手 |
| `/api/recommendations/history` | GET | Cookie | 推荐历史 |
| `/api/recommendations/resume-advice` | POST | Cookie | 简历优化建议 |
| `/api/resume/parse` | POST | Cookie | 简历解析 |
| `/api/resume/diagnose` | POST | Cookie | 简历诊断 |
| `/api/system/config` | GET | Cookie | 系统配置 |
| `/api/system/status` | GET | Cookie | 系统健康状态 |
| `/api/system/subscriptions` | GET/POST | Cookie | 订阅管理 |
| `/api/stats/overview` | GET | Cookie | 统计概览 |

### 3.2 页面组件（9个页面）

| 路由 | 页面 | 权限要求 |
|------|------|----------|
| `/` | 首页 | 无 |
| `/jobs` | 岗位列表 | 无 |
| `/match` | 简历匹配 | view_jobs |
| `/favorites` | 我的收藏 | 无 |
| `/crawler` | 数据采集 | manage_crawler |
| `/system` | 系统状态 | view_system |
| `/recommendations` | 智能推荐 | use_recommendations |
| `/users` | 用户管理 | manage_users |
| `/login` | 登录页 | - |

### 3.3 核心Lib模块

| 模块 | 职责 |
|------|------|
| `db-utils.ts` | 数据库连接、查询构建、筛选选项、缓存 |
| `auth-db.ts` | 用户认证、Session管理、登录日志 |
| `auth-server.ts` | 服务端认证统一入口 |
| `auth.ts` | 客户端认证工具 |
| `api-response.ts` | 统一API响应格式 |
| `logger.ts` | 结构化日志 |
| `score-engine.ts` | 岗位评分引擎 |
| `match-engine.ts` | 简历匹配引擎 |
| `ai-service.ts` | AI服务调用 |
| `resume-parser.ts` | 简历文件解析 |
| `resume-types.ts` | 简历类型定义 |
| `types.ts` | 通用类型定义 |
| `constants.ts` | 常量定义 |
| `user-agent.ts` | UA解析 |
| `api.ts` | 客户端API调用 |

---

## 四、爬虫系统分析

### 4.1 架构总览

爬虫系统采用 **策略模式 + 中间件管道 + 插件系统** 的架构：

```
AsyncMultiCrawler (并发管理器)
  ├── 共享 HTTP Session (连接池 limit=100)
  ├── 浏览器信号量 (MAX_BROWSER_CONCURRENCY=3)
  └── 为每个数据源创建 UnifiedSpider
        │
        ▼
UnifiedSpider (统一调度器)
  ├── spider_configs.py → 读取配置
  ├── strategies/ → 选择执行策略
  │   ├── api_post.py (POST API 类型)
  │   ├── api_get.py (GET API 类型)
  │   ├── html_strategy.py (HTML 解析类型)
  │   └── browser_strategy.py (浏览器渲染类型)
  ├── middleware/pipeline.py → 中间件洋葱管道
  └── plugins/manager.py → 插件生命周期管理
        │
        ▼
LocalDatabase (数据库操作)
  ├── 批量 UPSERT/INSERT OR IGNORE
  ├── content_hash 去重
  ├── crawl_logs 日志记录
  └── 数据清理功能
```

### 4.2 数据源覆盖（9个）

| 标识 | 学校/平台 | 爬取方式 | 类型 |
|------|-----------|----------|------|
| sufe | 上海财经大学 | API POST | api_post |
| zuel | 中南财经政法大学 | API GET | api_get |
| cufe | 中央财经大学 | API POST | api_post |
| dufe | 东北财经大学 | API POST | api_post |
| swufe | 西南财经大学 | HTML 解析 | html |
| uibe | 对外经济贸易大学 | 浏览器JS渲染 | browser_js |
| jxufe | 江西财经大学 | 浏览器JS渲染 | browser_js |
| smartedu | 国家智慧教育平台 | 浏览器API | browser_api |
| neu | 东北大学 | 浏览器JS渲染 | browser_js |

### 4.3 双爬虫系统对比

| 特性 | AsyncMultiCrawler | lite_crawler.py |
|------|-------------------|-----------------|
| 并发模型 | asyncio 异步并发 | 单线程同步 |
| 支持数据源 | 全部9个 | 仅HTTP类型(5个) |
| 数据库驱动 | aiosqlite | sqlite3 (同步) |
| 内存占用 | 较高 (浏览器需~500MB) | 极低 (< 50MB) |
| 使用场景 | 正常服务器 | 低内存服务器 |
| 代码复用 | 共享 spider_configs | 独立实现 |

---

## 五、发现的问题清单

### 🔴 严重问题 (Critical)

#### C1. SQLite 跨进程并发访问

**问题描述**：Next.js (Node.js better-sqlite3) 和 Python爬虫 (aiosqlite/sqlite3) 同时读写同一个 `data/jobs.db` 文件。SQLite虽然支持WAL模式的多读单写，但跨进程的高频写操作可能导致 `SQLITE_BUSY` 错误。

**影响范围**：前端API路由 + 爬虫系统  
**联动影响**：爬虫写入时，前端查询可能失败或返回不完整数据

**相关文件**：
- [db-utils.ts](file:///home/joakim/Project/job_hub/src/lib/db-utils.ts#L72-L77) - Node.js端 WAL未启用
- [database.py](file:///home/joakim/Project/job_hub/src/spiders/database.py#L71-L74) - Python端启用了WAL
- [auth-db.ts](file:///home/joakim/Project/job_hub/src/lib/auth-db.ts#L111) - 单独启用了WAL

**修复建议**：
1. db-utils.ts `getDb()` 中启用 WAL 模式
2. 爬虫写入时使用 `BEGIN IMMEDIATE` 减少锁等待
3. 考虑引入写入队列或使用消息队列解耦

#### C2. Docker 部署缺少爬虫支持

**问题描述**：Dockerfile 和 docker-compose.yml 仅包含 Node.js/Next.js 应用，完全没有 Python 爬虫的运行环境。根据 [DEPLOYMENT.md](file:///home/joakim/Project/job_hub/DEPLOYMENT.md) 说明，爬虫需要独立运行。

**影响范围**：Docker部署的全部环境  
**联动影响**：Docker容器中无法运行爬虫，数据无法自动更新

**相关文件**：
- [Dockerfile](file:///home/joakim/Project/job_hub/Dockerfile) - 只有Node.js，无Python
- [docker-compose.yml](file:///home/joakim/Project/job_hub/docker-compose.yml#L17-L62) - 只有一个finintern-next服务
- [init_db.py](file:///home/joakim/Project/job_hub/init_db.py) - 数据库初始化脚本未在Docker中使用

**修复建议**：
1. 创建独立的 Dockerfile.spider 用于爬虫服务
2. docker-compose.yml 中添加爬虫服务
3. 或使用 cron job 在宿主机上定时运行爬虫

#### C3. 两套爬虫系统维护成本高

**问题描述**：同时维护 `AsyncMultiCrawler` (src/spiders/) 和 `lite_crawler.py` 两套爬虫系统，存在大量重复代码（数据库操作、请求重试、日志），新增数据源需要两边都修改。

**影响范围**：爬虫系统全部  
**联动影响**：两个系统共用同一个数据库，表结构可能不一致

**相关文件**：
- [lite_crawler.py](file:///home/joakim/Project/job_hub/lite_crawler.py) - 独立实现的完整爬虫
- [crawler.py](file:///home/joakim/Project/job_hub/src/spiders/crawler.py) - 异步并发爬虫
- [database.py](file:///home/joakim/Project/job_hub/src/spiders/database.py#L89-L133) - jobs表结构
- [lite_crawler.py](file:///home/joakim/Project/job_hub/lite_crawler.py#L447-L466) - 不同的jobs表结构

**表结构差异**：
- `database.py`: 字段更完整 (experience, tags, category, is_favorite, is_read, content_hash, created_at, updated_at)
- `lite_crawler.py`: 缺失多个字段 (experience, tags, category, is_favorite, is_read, content_hash, updated_at)

**修复建议**：统一为一个爬虫系统，lite_crawler 引用 spiders 模块的 database.py

### 🟠 严重问题 (High)

#### H1. `.env` 文件不在 `.gitignore` 中

**问题描述**：[.gitignore](file:///home/joakim/Project/job_hub/.gitignore) 只排除了 `.env.local`，没有排除 `.env` 文件。项目根目录存在 `.env` 文件，可能包含真实的API密钥和敏感配置。

**安全风险**：可能泄露 AI_API_KEY、AUTH_SALT 等敏感信息  
**修复建议**：在 .gitignore 中添加 `.env`，如果已提交则需要轮换所有密钥

#### H2. 硬编码路径存在于生产代码

**问题描述**：[crawler/status/route.ts](file:///home/joakim/Project/job_hub/src/app/api/crawler/status/route.ts#L23) 中硬编码了绝对路径 `/home/joakim/Project/job_hub/.crawler.pid`，这在Docker环境或其他用户的机器上完全无法工作。

**修复建议**：使用相对路径或环境变量配置

#### H3. 爬虫状态API无法反映实际状态

**问题描述**：[crawler/status/route.ts](file:///home/joakim/Project/job_hub/src/app/api/crawler/status/route.ts#L19-L33) 通过检查 `.crawler.pid` 文件判断爬虫状态，但爬虫系统(`crawler.py`, `run.py`) 并没有写入PID文件，导致状态永远显示"idle"。

**联动影响**：前端爬虫页面无法获得真实的爬虫运行状态

#### H4. API 路由认证覆盖不完整

**问题描述**：多个关键API路由缺少认证检查：

| 路由 | 问题 |
|------|------|
| `/api/jobs` GET | 无认证，任何人都能访问 |
| `/api/jobs/search` GET | 无认证 |
| `/api/jobs/filters` GET | 无认证 |
| `/api/crawler/sources` GET | 无认证 |
| `/api/crawler/status` GET | 无认证 |

但部分路由（如 `/api/jobs/[id]/favorite`）也没有认证，意味着用户可能不需要登录就能操作。

#### H5. 登录接口缺少速率限制

**问题描述**：[auth/login/route.ts](file:///home/joakim/Project/job_hub/src/app/api/auth/login/route.ts) 没有速率限制，虽然 `auth-db.ts` 有账户锁定机制，但没有IP级别的限流，攻击者可以遍历用户名触发大量登录尝试。

**修复建议**：添加基于IP的速率限制中间件

### 🟡 中等问题 (Medium)

#### M1. 前端 Logger 只输出到控制台

**问题描述**：[logger.ts](file:///home/joakim/Project/job_hub/src/lib/logger.ts) 只使用 `console.log/warn/error` 输出，没有持久化到文件，生产环境中日志会丢失。

**对比**：Python 爬虫的 [logger.py](file:///home/joakim/Project/job_hub/src/spiders/logger.py) 有完整的文件日志、轮转、压缩机制。

**修复建议**：Node.js端添加文件日志输出（如 winston 或 pino）

#### M2. Zustand Store 缺少持久化

**问题描述**：[store/index.ts](file:///home/joakim/Project/job_hub/src/store/index.ts) 使用 Zustand 管理状态，但 `favoriteJobIds` (Set类型) 没有持久化，页面刷新后丢失。

**修复建议**：使用 zustand/middleware persist 或从API重新获取

#### M3. getFilterOptions 性能问题

**问题描述**：[db-utils.ts](file:///home/joakim/Project/job_hub/src/lib/db-utils.ts#L304-L449) 每次调用执行5个 `SELECT * FROM jobs` 全表扫描查询，在数据量大时（>10万条）性能下降严重。

**修复建议**：
1. 依赖缓存机制（已实现5分钟TTL）
2. 添加数据库索引
3. 考虑使用物化视图或定期预计算

#### M4. 爬虫的 SMATEDU 和 NEU 数据源配置不完整

**问题描述**：
- `smartedu` 配置在 `spider_configs.py` 中为 `browser_api`，但 `strategies/` 中没有对应的 `browser_api_strategy.py`
- `neu` 配置为 `browser_js`，但 `selectors` 的 detail_content 使用 `.details-mge .info` 而非标准的信息提取格式

#### M5. 双份 SOURCE_NAME_MAP 维护

**问题描述**：数据源名称映射在两个地方定义：
- [constants.ts](file:///home/joakim/Project/job_hub/src/lib/constants.ts#L11-L21): `SOURCE_NAME_MAP`
- [constants.py](file:///home/joakim/Project/job_hub/src/spiders/constants.py#L1-L11): `SOURCE_NAMES`

新增数据源需要两边同步更新。

#### M6. `dufe` 配置引用 `cufe` 的 field_mapping

**问题描述**：[spider_configs.py](file:///home/joakim/Project/job_hub/src/spiders/spider_configs.py#L151) 中 `dufe` 的 field_mapping 设为 `"same_as_cufe"`，这种字符串引用方式容易出错，且在 lite_crawler 中可能无法正确解析。

#### M7. 爬虫 HTTP Session 超时不一致

**问题描述**：
- [crawler.py](file:///home/joakim/Project/job_hub/src/spiders/crawler.py#L54): 共享Session超时30秒
- [unified_spider.py](file:///home/joakim/Project/job_hub/src/spiders/unified_spider.py#L108): 独立Session超时20秒
- [base.py](file:///home/joakim/Project/job_hub/src/spiders/base.py#L219): request_with_retry 默认超时30秒

当爬虫使用共享Session时（20秒超时），`request_with_retry` 中使用30秒超时可能不一致。

### 🟢 低优先级问题 (Low)

#### L1. trash 目录内容杂多

**问题描述**：[trash](file:///home/joakim/Project/job_hub/trash/) 目录中包含已删除的 Dockerfile、docker-compose、备份数据库等，占用空间且容易混淆。

#### L2. `.dockerignore` 排除了所有 `.md` 文件

**问题描述**：[.dockerignore](file:///home/joakim/Project/job_hub/.dockerignore#L41-L43) 排除了 `docs` 和 `*.md`，但 Docker 镜像不需要这些文件是正确的，不过 `!README.md` 的例外规则说明对 README 有特殊需求。

#### L3. scripts 目录下的脚本可能未使用

- `clean_data.js` - 清理数据脚本
- `init-default-users.ts` - 初始化默认用户
- `init_location_mapping.js` - 初始化位置映射
- `migrate-login-logs.py` / `migrate-users.ts` / `migrate_users.py` - 迁移脚本

这些脚本可能只在特定迁移场景使用，考虑文档化或移到独立的迁移目录。

#### L4. Python `__pycache__` 目录已提交

`src/spiders/__pycache__/` 下存在 `.pyc` 文件，这些应该被 `.gitignore` 排除。

#### L5. Dockerfile 中 Alpine 版本硬编码

**问题描述**：[Dockerfile](file:///home/joakim/Project/job_hub/Dockerfile#L11-L12) 中硬编码了 `v3.23` Alpine仓库地址，当基础镜像升级后这些地址可能失效。

---

## 六、联动问题分析

### 6.1 前端 ↔ 爬虫联动

| 联动点 | 状态 | 问题 |
|--------|------|------|
| 爬虫状态展示 | ❌ 断裂 | PID文件机制不工作，状态永远"idle" |
| 爬虫数据源列表 | ⚠️ 不完全 | [sources/route.ts](file:///home/joakim/Project/job_hub/src/app/api/crawler/sources/route.ts#L13-L21) 硬编码 SOURCE_TYPE_MAP，缺少 smartedu 和 neu |
| 爬虫触发 | ❌ 缺失 | 前端没有触发爬虫的API端点，需要手动SSH运行 |
| 爬虫日志查看 | ⚠️ 有限 | `/api/crawler/logs` 只能查看 crawl_logs 表，无法获取实时日志 |

### 6.2 数据库 ↔ 多写入方联动

| 写入方 | 数据库驱动 | WAL模式 | 事务方式 |
|--------|-----------|---------|----------|
| Next.js (db-utils) | better-sqlite3 | ❌ 未启用 | 自动提交 |
| Next.js (auth-db) | better-sqlite3 | ✅ 已启用 | 自动提交 |
| Python (database.py) | aiosqlite | ✅ 已启用 | BEGIN + COMMIT/ROLLBACK |
| Python (lite_crawler) | sqlite3 | ✅ 已启用 | 自动提交 |

**核心问题**：db-utils.ts 未启用 WAL 模式。当爬虫写入时，Next.js端 `getDb()` 创建的连接使用的是默认的 DELETE 日志模式，可能导致读操作被写操作阻塞。

### 6.3 Docker ↔ 主机联动

**当前状态**：
- Docker只运行Node.js应用
- 爬虫需要在宿主机上单独运行
- 数据库通过 `./data:/app/data` volume共享

**问题**：
- 爬虫写数据库，Docker内应用读数据库，路径不一致
- 爬虫的 `data/jobs.db` 路径是相对于项目根目录
- Docker内路径是 `/app/data/jobs.db`

### 6.4 Schema 不一致

两个爬虫系统创建的 `jobs` 表结构不同：

`database.py` (主爬虫) 比 `lite_crawler.py` 多了以下字段：
- `experience` TEXT
- `tags` TEXT
- `category` TEXT
- `is_favorite` INTEGER
- `is_read` INTEGER
- `content_hash` TEXT
- `updated_at` TIMESTAMP

如果先用 lite_crawler 创建表，再用主爬虫写入，会因缺少字段而报错。

---

## 七、安全问题汇总

| 编号 | 问题 | 严重程度 | 位置 |
|------|------|----------|------|
| S1 | .env 文件未在 .gitignore | 🔴 Critical | [.gitignore](file:///home/joakim/Project/job_hub/.gitignore) |
| S2 | 登录接口无速率限制 | 🟠 High | [login/route.ts](file:///home/joakim/Project/job_hub/src/app/api/auth/login/route.ts) |
| S3 | 多个API路由缺少认证 | 🟠 High | 见H4 |
| S4 | 硬编码绝对路径暴露系统信息 | 🟠 High | [status/route.ts](file:///home/joakim/Project/job_hub/src/app/api/crawler/status/route.ts#L23) |
| S5 | Session Cookie SameSite=lax 而非 strict | 🟡 Medium | [login/route.ts](file:///home/joakim/Project/job_hub/src/app/api/auth/login/route.ts#L76) |
| S6 | 密码哈希使用SHA256而非bcrypt/argon2 | 🟡 Medium | [auth-db.ts](file:///home/joakim/Project/job_hub/src/lib/auth-db.ts#L214-L215) |
| S7 | Docker容器内使用root构建但最终切换nextjs用户 | 🟢 OK | [Dockerfile](file:///home/joakim/Project/job_hub/Dockerfile#L88) |

---

## 八、性能问题汇总

| 编号 | 问题 | 影响 | 位置 |
|------|------|------|------|
| P1 | getFilterOptions 5次全表扫描 | 高延迟 | [db-utils.ts](file:///home/joakim/Project/job_hub/src/lib/db-utils.ts#L327-L357) |
| P2 | db-utils WAL未启用 | 读写阻塞 | [db-utils.ts](file:///home/joakim/Project/job_hub/src/lib/db-utils.ts#L72-L77) |
| P3 | jobs表缺少排序字段索引 | 慢查询 | [database.py](file:///home/joakim/Project/job_hub/src/spiders/database.py#L129-L133) |
| P4 | 爬虫浏览器实例管理 | 内存泄漏风险 | [base.py](file:///home/joakim/Project/job_hub/src/spiders/base.py#L399-L498) |
| P5 | visited_urls 内存集合无限增长 | OOM风险 | [crawler.py](file:///home/joakim/Project/job_hub/src/spiders/crawler.py#L41) |

---

## 九、优化建议

### 9.1 立即修复（本周）
1. `db-utils.ts` 启用 WAL 模式
2. `.gitignore` 添加 `.env`
3. 修复爬虫状态硬编码路径
4. 为关键API添加认证检查

### 9.2 短期优化（1-2周）
1. 统一 lite_crawler 和主爬虫的数据库操作
2. 添加登录速率限制
3. 统一 SOURCE_NAME_MAP 为单一数据源
4. 为 jobs 表高频查询字段添加索引

### 9.3 中期改进（1个月）
1. Docker添加爬虫服务支持
2. 实现爬虫触发API（前端可启动爬虫）
3. 密码哈希升级为 bcrypt
4. Node.js端添加文件日志系统
5. Zustand 状态持久化

### 9.4 长期规划
1. 考虑迁移到 PostgreSQL（解决并发问题）
2. 引入 Redis 作为缓存层
3. 实现爬虫任务队列（Celery/BullMQ）
4. WebSocket 实时推送爬取进度
5. 监控告警系统（爬虫故障通知）

---

## 十、代码统计

| 指标 | 数量 |
|------|------|
| TypeScript/TSX 文件 | ~60+ |
| Python 文件 | ~30+ |
| API 路由 | 29 |
| 页面组件 | 9 |
| UI 组件 | 14 |
| 爬虫数据源 | 9 |
| 数据库表 | 6+ |
| 总代码行数（估） | ~15,000+ |

---

*报告生成时间：2026-05-20 | 分析工具：手动审查 + 自动化搜索*