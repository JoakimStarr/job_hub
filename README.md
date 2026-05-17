# FinIntern Hub - 金融实习招聘平台

## 项目简介

FinIntern Hub 是一个基于 Next.js 和 Python 的金融实习招聘信息聚合平台。该平台通过智能爬虫系统从多所财经类高校就业网站采集实习和全职岗位信息，为用户提供统一的岗位搜索、收藏、推荐等服务。

### 核心特性

- 🎯 **多源数据聚合**：支持 9 所财经类高校就业网站的数据采集
- 🚀 **高性能爬虫系统**：异步并发爬取，支持 HTTP API 和浏览器两种模式
- 🔐 **用户权限管理**：基于角色的访问控制（RBAC）
- 🔍 **智能搜索**：支持关键词、地点、行业等多维度筛选
- 💡 **AI 智能推荐**：基于用户画像的岗位推荐系统
- 📊 **数据可视化**：岗位统计、趋势分析等数据展示
- 🐳 **容器化部署**：支持 Docker 一键部署

---

## 技术架构

### 技术栈

#### 前端
- **框架**: Next.js 15.3.3 (App Router)
- **UI 库**: React 18.3.1
- **语言**: TypeScript 5.8.3
- **样式**: CSS-in-JS (内联样式)
- **数据库**: better-sqlite3 (SQLite)

#### 后端爬虫
- **语言**: Python 3.13+
- **异步框架**: asyncio, aiosqlite
- **浏览器自动化**: Playwright (可选)
- **HTML 解析**: BeautifulSoup4
- **日志**: loguru

#### 部署
- **容器化**: Docker + docker-compose
- **运行时**: Node.js 20 Alpine

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        用户界面层                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 首页     │  │ 岗位列表 │  │ 收藏中心 │  │ 系统管理 │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      Next.js 应用层                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 页面组件 │  │ API 路由 │  │ 认证中间件│  │ 状态管理 │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      数据存储层                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              SQLite 数据库 (jobs.db)                  │  │
│  │  - jobs 表 (岗位信息)                                 │  │
│  │  - crawl_logs 表 (爬虫日志)                           │  │
│  │  - users 表 (用户信息)                                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↑
┌─────────────────────────────────────────────────────────────┐
│                    Python 爬虫系统                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ HTTP API │  │ 浏览器   │  │ 数据清洗 │  │ 去重存储 │   │
│  │ 爬虫     │  │ 爬虫     │  │ 模块     │  │ 模块     │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↑
┌─────────────────────────────────────────────────────────────┐
│                   数据源层 (9所高校)                         │
│  SUFE | ZUEL | CUFE | DUFE | SWUFE | UIBE | JXUFE | NEU    │
│                    | SmartEdu                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 目录结构

```
next-app/
├── src/                          # 源代码目录
│   ├── app/                      # Next.js App Router 页面
│   │   ├── api/                  # API 路由
│   │   │   ├── jobs/             # 岗位相关 API
│   │   │   │   ├── route.ts      # 岗位列表 API (GET)
│   │   │   │   └── [id]/         # 岗位详情 API
│   │   │   │       └── route.ts  # 单个岗位操作
│   │   │   ├── favorites/        # 收藏相关 API
│   │   │   │   └── route.ts      # 收藏列表 API
│   │   │   └── stats/            # 统计相关 API
│   │   │       └── route.ts      # 统计数据 API
│   │   ├── crawler/              # 爬虫管理页面
│   │   │   └── page.tsx          # 爬虫控制界面
│   │   ├── favorites/            # 收藏中心页面
│   │   │   └── page.tsx          # 收藏列表界面
│   │   ├── jobs/                 # 岗位列表页面
│   │   │   └── page.tsx          # 岗位搜索界面
│   │   ├── login/                # 登录页面
│   │   │   ├── page.tsx          # 登录界面
│   │   │   └── login-client.tsx  # 登录客户端组件
│   │   ├── recommendations/      # 推荐页面
│   │   │   └── page.tsx          # AI 推荐界面
│   │   ├── system/               # 系统管理页面
│   │   │   └── page.tsx          # 系统状态界面
│   │   ├── users/                # 用户管理页面
│   │   │   └── page.tsx          # 用户管理界面
│   │   ├── globals.css           # 全局样式
│   │   ├── layout.tsx            # 根布局
│   │   └── page.tsx              # 首页
│   ├── components/               # React 组件
│   │   ├── app-shell.tsx         # 应用外壳（导航、侧边栏）
│   │   └── ui.tsx                # UI 组件库
│   ├── lib/                      # 工具库
│   │   ├── api.ts                # API 客户端封装
│   │   ├── auth.ts               # 认证工具函数
│   │   ├── constants.ts          # 常量定义（导航、权限）
│   │   └── types.ts              # TypeScript 类型定义
│   └── spiders/                  # Python 爬虫系统
│       ├── __init__.py           # 包初始化
│       ├── base.py               # 爬虫基类（BaseSpider, BaseAPISpider, BaseBrowserSpider）
│       ├── unified_spider.py     # 统一爬虫实现
│       ├── spider_configs.py     # 爬虫配置（9个数据源配置）
│       ├── crawler.py            # 并发爬虫管理器（AsyncMultiCrawler）
│       ├── database.py           # 数据库操作类（LocalDatabase）
│       ├── run.py                # 爬虫运行入口
│       ├── browser_wrapper.py    # 浏览器爬虫封装
│       ├── cache.py              # 缓存管理
│       ├── connection_pool.py    # 连接池管理
│       ├── constants.py          # 爬虫常量定义
│       ├── incremental.py        # 增量爬取策略
│       ├── jxufe_spider.py       # 江西财经大学爬虫
│       ├── lite_spider.py        # 轻量级爬虫
│       ├── logger.py             # 日志配置
│       ├── performance_spider.py # 性能优化爬虫
│       ├── uibe.py               # 对外经贸大学爬虫
│       ├── utils.py              # 工具函数
│       └── write_queue.py        # 写入队列
├── data/                         # 数据目录
│   └── jobs.db                   # SQLite 数据库
├── log/                          # 日志目录
│   └── .gitignore
├── output/                       # 输出目录
│   └── visited_urls.json         # 已访问 URL 记录
├── public/                       # 静态资源
├── .dockerignore                 # Docker 忽略文件
├── .gitignore                    # Git 忽略文件
├── .npmrc                        # npm 配置
├── API_USAGE_GUIDE.md            # API 使用指南
├── Dockerfile                    # Docker 镜像构建文件
├── docker-compose.yml            # Docker Compose 配置
├── next-env.d.ts                 # Next.js TypeScript 声明
├── next.config.ts                # Next.js 配置
├── package.json                  # Node.js 依赖配置
├── tsconfig.json                 # TypeScript 配置
├── create_test_db.py             # 测试数据库创建脚本
├── init_db.py                    # 数据库初始化脚本
├── run_spiders.py                # 爬虫启动脚本
├── run_browser_spiders.py        # 浏览器爬虫启动脚本
├── README.md                     # 项目说明文档（中文）
├── README_EN.md                  # 项目说明文档（英文）
├── SKILLS_USAGE_GUIDE.md         # 技能使用指南
├── SPIDERS_TECH_DOC.md           # 爬虫技术文档
└── SPIDER_USAGE_GUIDE.md         # 爬虫使用指南
```

---

## 核心模块详解

### 1. 前端模块 (src/app, src/components, src/lib)

#### 1.1 页面路由 (src/app)

| 路径 | 功能 | 权限要求 |
|------|------|----------|
| `/` | 首页，展示统计数据和热门关键词 | `view_stats` |
| `/jobs` | 岗位列表，支持搜索和筛选 | `view_jobs` |
| `/favorites` | 收藏中心，管理收藏的岗位 | `view_jobs` |
| `/crawler` | 爬虫管理，启动/停止爬虫任务 | `manage_crawler` |
| `/system` | 系统状态，查看系统健康状态 | `view_system` |
| `/recommendations` | 智能推荐，AI 推荐和咨询 | `use_recommendations` |
| `/users` | 用户管理，管理用户和权限 | `manage_users` |
| `/login` | 登录页面 | 无 |

#### 1.2 API 路由 (src/app/api)

| API 路径 | 方法 | 功能 |
|----------|------|------|
| `/api/jobs` | GET | 获取岗位列表（支持分页、筛选） |
| `/api/jobs/[id]` | GET | 获取岗位详情 |
| `/api/jobs/[id]/favorite` | POST | 切换收藏状态 |
| `/api/favorites` | GET | 获取收藏列表 |
| `/api/stats/overview` | GET | 获取统计概览 |
| `/api/stats/trends` | GET | 获取趋势数据 |

#### 1.3 组件库 (src/components)

- **AppShell**: 应用外壳组件，包含侧边栏导航、顶部栏、权限检查
- **UI 组件**: MetricCard, JobCard, Badge, Button, Skeleton, EmptyState, SectionCard

#### 1.4 工具库 (src/lib)

- **api.ts**: API 客户端封装，包含所有 API 调用方法
- **auth.ts**: 认证工具，包含登录、登出、权限检查
- **constants.ts**: 常量定义，包含导航项、权限类型
- **types.ts**: TypeScript 类型定义

### 2. 爬虫系统 (src/spiders)

#### 2.1 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    AsyncMultiCrawler                        │
│  (并发爬虫管理器)                                            │
│  - 管理多个爬虫实例                                          │
│  - 控制浏览器爬虫并发数                                      │
│  - 批量写入数据库                                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    UnifiedSpider                            │
│  (统一爬虫实现)                                              │
│  - 根据 spider_type 动态选择爬取策略                         │
│  - 支持 api_post, api_get, html, browser_* 类型             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    BaseSpider                               │
│  (爬虫基类)                                                  │
│  - HTTP 请求重试机制                                         │
│  - URL 去重                                                  │
│  - 运行时间限制                                              │
│  - 统计信息收集                                              │
└─────────────────────────────────────────────────────────────┘
         ↓                                    ↓
┌──────────────────────┐          ┌──────────────────────┐
│   BaseAPISpider      │          │  BaseBrowserSpider   │
│  (HTTP API 爬虫)      │          │  (浏览器爬虫)         │
│  - aiohttp 会话管理   │          │  - Playwright 集成    │
│  - Cookie 管理        │          │  - 反检测脚本         │
└──────────────────────┘          └──────────────────────┘
```

#### 2.2 数据源配置

| 数据源 | 名称 | 爬取类型 | 说明 |
|--------|------|----------|------|
| sufe | 上海财经大学 | api_post | 推荐，速度快，支持多板块 |
| zuel | 中南财经政法大学 | api_get | 推荐，速度快，支持分类 |
| cufe | 中央财经大学 | api_post | 需要获取 Cookie |
| dufe | 东北财经大学 | api_post | 需要获取 Cookie |
| swufe | 西南财经大学 | html | 直接 URL 遍历 |
| smartedu | 国家大学生就业服务平台 | browser_api | 需要 Playwright |
| uibe | 对外经济贸易大学 | browser_encrypted | 需要 Playwright，加密处理 |
| jxufe | 江西财经大学 | browser_js | 需要 Playwright |
| neu | 东北大学 | browser_js | 需要 Playwright |

#### 2.3 爬虫特性

- ✅ **配置驱动**: 新增数据源只需在 `spider_configs.py` 添加配置
- ✅ **异步并发**: 支持多数据源并发爬取
- ✅ **智能去重**: 基于 URL 和内容哈希去重
- ✅ **增量爬取**: 支持增量更新，避免重复爬取
- ✅ **错误处理**: 完善的异常捕获和日志记录
- ✅ **限流控制**: 浏览器爬虫并发数限制（MAX_BROWSER_CONCURRENCY）
- ✅ **运行时间限制**: 支持设置最大运行时间（默认 900 秒）
- ✅ **批量写入**: 批量插入数据库，提高性能

#### 2.4 核心文件说明

| 文件 | 功能 |
|------|------|
| [base.py](file:///home/joakim/Project/hmAPP/finintern_hub/next-app/src/spiders/base.py) | 爬虫基类，定义爬虫接口和通用方法 |
| [unified_spider.py](file:///home/joakim/Project/hmAPP/finintern_hub/next-app/src/spiders/unified_spider.py) | 统一爬虫实现，根据配置动态处理不同数据源 |
| [spider_configs.py](file:///home/joakim/Project/hmAPP/finintern_hub/next-app/src/spiders/spider_configs.py) | 爬虫配置，包含所有数据源的详细配置 |
| [crawler.py](file:///home/joakim/Project/hmAPP/finintern_hub/next-app/src/spiders/crawler.py) | 并发爬虫管理器，协调多个爬虫实例 |
| [database.py](file:///home/joakim/Project/hmAPP/finintern_hub/next-app/src/spiders/database.py) | 数据库操作类，处理数据存储和查询 |
| [run.py](file:///home/joakim/Project/hmAPP/finintern_hub/next-app/src/spiders/run.py) | 爬虫运行入口，支持命令行参数和交互式选择 |

---

## 快速开始

### 环境要求

- Node.js >= 20.0.0
- Python >= 3.13
- Docker & Docker Compose (可选，用于容器化部署)
- Playwright (可选，用于浏览器爬虫)

### 本地开发

#### 1. 克隆项目

```bash
git clone <repository-url>
cd finintern_hub/next-app
```

#### 2. 安装前端依赖

```bash
npm install
```

#### 3. 安装 Python 依赖

```bash
pip install -r requirements.txt
```

#### 4. 安装 Playwright (可选，用于浏览器爬虫)

```bash
pip install playwright
playwright install chromium
```

#### 5. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

#### 6. 运行爬虫

```bash
# 运行所有爬虫
npm run spiders

# 运行指定爬虫
python3 run_spiders.py --sources sufe zuel swufe

# 列出所有可用数据源
npm run spiders:list

# 交互式选择爬虫
python3 run_spiders.py -i
```

### Docker 部署

#### 1. 构建并启动容器

```bash
docker-compose up -d --build
```

#### 2. 查看日志

```bash
docker-compose logs -f
```

#### 3. 停止容器

```bash
docker-compose down
```

---

## 配置说明

### 环境变量

创建 `.env.local` 文件配置环境变量：

```bash
# API 配置
NEXT_PUBLIC_API_URL=/api
API_BACKEND_URL=http://localhost:8080

# Docker 部署端口
NEXT_APP_PORT=3001
```

### Next.js 配置

[next.config.ts](file:///home/joakim/Project/hmAPP/finintern_hub/next-app/next.config.ts) 关键配置：

```typescript
{
  output: 'standalone',          // 独立输出，用于 Docker 部署
  reactStrictMode: true,         // React 严格模式
  rewrites: async () => [...]    // API 代理配置
}
```

### 爬虫配置

爬虫配置位于 [src/spiders/spider_configs.py](file:///home/joakim/Project/hmAPP/finintern_hub/next-app/src/spiders/spider_configs.py)，采用配置驱动架构：

```python
SPIDER_CONFIGS = {
    "sufe": {
        "name": "sufe_jobs",
        "university": "上海财经大学",
        "base_url": "https://career.sufe.edu.cn",
        "spider_type": "api_post",
        "sections": [
            {
                "section": "zpxx",
                "label": "招聘信息",
                "list_url": "/career//zpxx/search/zpxx",
                "detail_url": "/career//zpxx/data/zpxx/{item_id}",
                # ...
            },
        ],
        "field_mapping": {
            "title": "zpzt",
            "company": "dwmc",
            # ...
        },
    },
    # ... 其他数据源配置
}
```

---

## 功能模块

### 1. 用户认证与权限管理

- **认证方式**: JWT Token
- **权限系统**: 基于角色的访问控制（RBAC）
- **权限类型**:
  - `view_jobs`: 查看岗位
  - `view_stats`: 查看统计
  - `manage_crawler`: 管理爬虫
  - `view_system`: 查看系统
  - `use_recommendations`: 使用推荐
  - `manage_users`: 管理用户

### 2. 岗位管理

- **岗位搜索**: 支持关键词、地点、行业、学历等多维度筛选
- **岗位详情**: 展示完整的岗位信息、公司介绍、申请链接
- **收藏功能**: 用户可收藏感兴趣的岗位
- **时间轴**: 记录岗位申请进度

### 3. 爬虫系统

#### 运行爬虫

```bash
# 运行所有 HTTP 爬虫（推荐）
python3 run_spiders.py --sources sufe zuel cufe dufe swufe

# 运行浏览器爬虫（需要 Playwright）
python3 run_spiders.py --sources smartedu uibe jxufe neu

# 限制每个数据源最大爬取数量
python3 run_spiders.py --sources sufe --max-items 100

# 显示浏览器窗口（调试用）
python3 run_spiders.py --sources smartedu --no-headless
```

#### 爬虫输出示例

```
============================================================
爬取完成 | 总耗时 45.2s
  总岗位数: 1250
  完成源: 5/5
  失败源: 0
------------------------------------------------------------
  ✓ 上海财经大学       |  320 条 |  12.3s
  ✓ 中南财经政法大学    |  280 条 |  10.5s
  ✓ 中央财经大学       |  250 条 |   8.7s
  ✓ 东北财经大学       |  200 条 |   7.2s
  ✓ 西南财经大学       |  200 条 |   6.5s
============================================================
```

### 4. 数据统计

- **概览统计**: 总岗位数、收藏数、今日新增、数据源数量
- **热门关键词**: 基于岗位信息的高频词分析
- **趋势分析**: 岗位发布趋势图
- **数据源统计**: 各数据源爬取情况

### 5. AI 推荐系统

- **岗位推荐**: 基于用户画像的智能推荐
- **简历建议**: AI 分析简历并给出改进建议
- **面试问题生成**: 根据岗位要求生成面试问题
- **投递助手**: 智能投递建议

---

## API 文档

### 认证 API

```typescript
// 登录
POST /api/auth/login
Body: { username: string, password: string }
Response: { access_token: string, user: AppUser }

// 获取当前用户
GET /api/auth/me
Headers: { Authorization: "Bearer {token}" }
Response: AppUser

// 登出
POST /api/auth/logout
```

### 岗位 API

```typescript
// 获取岗位列表
GET /api/jobs?page=1&page_size=20&keyword=财务&location=北京
Response: PagedResponse<JobItem>

// 获取岗位详情
GET /api/jobs/{id}
Response: JobItem

// 切换收藏状态
POST /api/jobs/{id}/favorite
Response: { success: boolean }

// 获取收藏列表
GET /api/jobs/favorites?page=1&page_size=20
Response: PagedResponse<JobItem>
```

### 统计 API

```typescript
// 获取概览统计
GET /api/stats/overview
Response: StatsOverview

// 获取趋势数据
GET /api/stats/trends?days=7
Response: TrendData[]
```

### 爬虫 API

```typescript
// 获取爬虫状态
GET /api/crawler/status
Response: CrawlerStatus

// 启动爬虫
POST /api/crawler/start
Body: { sources?: string[], max_items?: number }
Response: { success: boolean }

// 停止爬虫
POST /api/crawler/stop
Response: { success: boolean }
```

---

## 开发指南

### 代码规范

- **TypeScript**: 严格模式，所有类型必须明确定义
- **React**: 函数式组件，使用 Hooks
- **Python**: 遵循 PEP 8 规范，使用类型注解
- **命名约定**:
  - 组件: PascalCase
  - 函数/变量: camelCase
  - 常量: UPPER_SNAKE_CASE
  - 文件: kebab-case

### 添加新数据源

1. 在 `src/spiders/spider_configs.py` 中添加配置：

```python
SPIDER_CONFIGS = {
    "new_source": {
        "name": "new_source_jobs",
        "university": "新数据源名称",
        "base_url": "https://example.com",
        "spider_type": "api_post",  # 或 api_get, html, browser_api, browser_js
        "list_url": "/api/jobs",
        "detail_url": "/api/jobs/{id}",
        "field_mapping": {
            "title": "jobTitle",
            "company": "companyName",
            # ... 其他字段映射
        },
        # ... 其他配置
    }
}
```

2. 在 `src/spiders/constants.py` 中添加数据源名称：

```python
SOURCE_NAMES = {
    "new_source": "新数据源名称",
}
```

3. 测试爬虫：

```bash
python3 run_spiders.py --sources new_source --max-items 10
```

### 添加新页面

1. 在 `src/app/` 下创建页面目录：

```bash
mkdir src/app/new-page
touch src/app/new-page/page.tsx
```

2. 编写页面组件：

```typescript
'use client';

import { AppShell } from '@/components/app-shell';

export default function NewPage() {
  return (
    <AppShell title="新页面" description="页面描述">
      {/* 页面内容 */}
    </AppShell>
  );
}
```

3. 在 `src/lib/constants.ts` 中添加导航项：

```typescript
export const NAV_ITEMS: NavItem[] = [
  // ... 其他导航项
  { 
    key: 'new-page', 
    label: '新页面', 
    href: '/new-page', 
    description: '页面描述',
    emoji: '🆕',
    permission: 'view_jobs'
  },
];
```

---

## 部署指南

### Docker 部署（推荐）

#### 1. 准备环境变量

创建 `.env` 文件：

```bash
NEXT_PUBLIC_API_URL=/api
API_BACKEND_URL=http://host.docker.internal:8080
NEXT_APP_PORT=3001
```

#### 2. 构建并启动

```bash
docker-compose up -d --build
```

#### 3. 查看日志

```bash
docker-compose logs -f finintern-next
```

#### 4. 访问应用

访问 http://localhost:3001

### 手动部署

#### 1. 构建应用

```bash
npm run build
```

#### 2. 启动服务

```bash
npm start
```

#### 3. 配置反向代理

使用 Nginx 或其他反向代理服务器：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 性能优化

### 前端优化

- ✅ 使用 Next.js App Router 的服务端渲染
- ✅ 代码分割和懒加载
- ✅ 图片优化（Next.js Image 组件）
- ✅ CSS 优化（避免不必要的重绘）

### 爬虫优化

- ✅ 异步并发爬取
- ✅ 浏览器爬虫并发数限制
- ✅ 批量数据库写入
- ✅ URL 去重缓存
- ✅ 增量爬取策略
- ✅ 运行时间限制

### 数据库优化

- ✅ 索引优化（source_url, company, publish_date）
- ✅ 批量插入减少事务次数
- ✅ 定期清理历史数据

---

## 常见问题

### 1. 爬虫运行失败

**问题**: 浏览器爬虫报错 "Playwright not found"

**解决方案**:
```bash
pip install playwright
playwright install chromium
```

### 2. 数据库锁定

**问题**: SQLite 数据库锁定错误

**解决方案**:
- 确保没有多个进程同时写入数据库
- 使用 WAL 模式：`PRAGMA journal_mode=WAL;`

### 3. Docker 容器启动失败

**问题**: 容器启动后立即退出

**解决方案**:
- 检查日志：`docker-compose logs finintern-next`
- 确保端口未被占用
- 检查环境变量配置

### 4. API 请求超时

**问题**: 前端请求 API 超时

**解决方案**:
- 检查后端服务是否正常运行
- 检查网络连接
- 增加超时时间（默认 30 秒）

---

## 许可证

本项目仅供学习和研究使用。

---

## 联系方式

如有问题或建议，请提交 Issue 或 Pull Request。

---

## 更新日志

### v0.2.1 (2026-05-16)
- 📝 更新 README.md，完善项目结构说明
- 📝 添加核心模块详解
- 📝 优化文档结构和可读性

### v0.2.0 (2026-05-16)
- ✨ 重构爬虫系统，采用配置驱动架构
- ✨ 新增统一爬虫实现
- ✨ 支持异步并发爬取
- 🐛 修复数据库锁定问题
- 📝 完善技术文档

### v0.1.0
- 🎉 初始版本发布
- ✨ 基础爬虫功能
- ✨ 用户认证系统
- ✨ 岗位管理功能
