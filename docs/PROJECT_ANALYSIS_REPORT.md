# FinIntern Hub 项目分析报告

> **报告版本**: v1.0 | **项目版本**: v7.3.0 | **生成日期**: 2026-05-18
> **分析范围**: 全栈代码审查 + 架构分析 + 安全审计 + 性能评估

---

## 目录

- [一、项目概述](#一项目概述)
- [二、完整目录结构树](#二完整目录结构树)
- [三、系统架构图](#三系统架构图)
- [四、核心模块功能详解](#四核心模块功能详解)
  - [4.1 前端模块](#41-前端模块)
  - [4.2 爬虫系统](#42-爬虫系统)
  - [4.3 数据层](#43-数据层)
- [五、技术指标统计](#五技术指标统计)
- [六、数据流图](#六数据流图)
- [七、问题清单](#七问题清单)
- [八、优化建议汇总](#八优化建议汇总)
- [九、附录](#九附录)

---

## 一、项目概述

| 属性 | 值 |
|------|-----|
| **项目名称** | FinIntern Hub (金融实习招聘平台) |
| **当前版本** | v7.3.0 |
| **技术栈** | Next.js 15 + React 18 + TypeScript + Python 3.13 + SQLite |
| **前端框架** | Next.js App Router (Server Components + Client Components) |
| **状态管理** | Zustand 5.x |
| **数据库** | SQLite (better-sqlite3 同步 + aiosqlite 异步双驱动) |
| **AI 集成** | OpenAI / 智谱 AI / SiliconFlow / DeepSeek / 自定义（5种模型适配） |
| **爬虫引擎** | Python asyncio + aiohttp + Playwright (浏览器渲染) |
| **项目定位** | 多源数据聚合的金融实习招聘信息平台，覆盖9所高校就业网站 |

### 项目亮点

- **多源聚合**: 覆盖西南财经大学、上海财经大学、中央财经大学等9所高校就业网
- **智能匹配**: 六维评分模型（技能/学历/专业/地点/经验/行业）实现简历-岗位精准匹配
- **AI 驱动**: 岗位分析、投递建议、简历诊断等多场景 AI 能力
- **配置驱动爬虫**: 统一的 `UnifiedSpider` 通过配置文件动态适配不同数据源
- **RBAC 权限模型**: 三级角色（管理员/操作员/访客）细粒度权限控制

---

## 二、完整目录结构树

```
job_hub/
├── src/
│   ├── app/                                    # Next.js App Router - 页面 + API
│   │   ├── api/                                # 30个 API 路由端点
│   │   │   ├── auth/                           # 认证: login / logout / me / roles / users
│   │   │   │   ├── login/route.ts
│   │   │   │   ├── logout/route.ts
│   │   │   │   ├── me/route.ts
│   │   │   │   ├── roles/route.ts
│   │   │   │   └── users/route.ts
│   │   │   ├── crawler/                        # 爬虫控制: status / sources / logs
│   │   │   │   ├── status/route.ts
│   │   │   │   ├── sources/route.ts
│   │   │   │   └── logs/route.ts
│   │   │   ├── jobs/                           # 岗位: list / search / filters / detail / favorite / ai-analysis
│   │   │   │   ├── route.ts                    # 岗位列表 (GET)
│   │   │   │   ├── search/route.ts             # 关键词搜索
│   │   │   │   ├── filters/route.ts            # 筛选选项
│   │   │   │   ├── [id]/route.ts               # 岗位详情
│   │   │   │   ├── [id]/favorite/route.ts      # 收藏/取消收藏
│   │   │   │   ├── [id]/ai-analysis/route.ts   # AI 分析
│   │   │   │   └── favorites/route.ts          # 收藏列表
│   │   │   ├── match/                          # 匹配: batch / single
│   │   │   │   ├── jobs/route.ts               # 批量匹配
│   │   │   │   └── job/[id]/route.ts           # 单岗位匹配
│   │   │   ├── recommendations/                # AI 推荐: analyze / delivery-assistant / resume-advice / history
│   │   │   │   ├── analyze/route.ts
│   │   │   │   ├── delivery-assistant/route.ts
│   │   │   │   ├── resume-advice/route.ts
│   │   │   │   └── history/route.ts
│   │   │   ├── resume/                         # 简历: parse / diagnose
│   │   │   │   ├── parse/route.ts              # 简历解析
│   │   │   │   └── diagnose/route.ts           # 简历诊断
│   │   │   ├── stats/                          # 统计: overview / trends
│   │   │   │   ├── route.ts                    # 趋势统计
│   │   │   │   └── overview/route.ts           # 概览统计
│   │   │   └── system/                         # 系统: config / status / subscriptions / maintenance
│   │   │       ├── config/route.ts             # 配置管理
│   │   │       ├── status/route.ts             # 系统状态
│   │   │       ├── subscriptions/route.ts      # 订阅 CRUD
│   │   │       ├── subscriptions/[id]/route.ts
│   │   │       ├── subscriptions/[id]/preview/route.ts
│   │   │       └── maintenance/clean-history/route.ts
│   │   │                                       # (共 30 个 API 端点)
│   │   ├── crawler/page.tsx                    # 爬虫控制台页面
│   │   ├── favorites/page.tsx                  # 收藏夹页面
│   │   ├── jobs/page.tsx                       # 岗位列表页 (~378行, 最复杂业务页)
│   │   ├── login/page.tsx                      # 登录页
│   │   ├── login/login-client.tsx              # 登录客户端组件
│   │   ├── match/page.tsx                      # 简历匹配页 (四步向导)
│   │   ├── match/match.module.css
│   │   ├── recommendations/page.tsx            # AI 推荐页 (三 Tab)
│   │   ├── system/page.tsx                     # 系统管理页 (~714行, 最重页面)
│   │   ├── users/page.tsx                      # 用户管理页
│   │   ├── page.tsx                            # 首页仪表盘
│   │   ├── layout.tsx                          # 根布局
│   │   ├── providers.tsx                       # Provider 包裹
│   │   └── globals.css                         # 全局样式入口
│   │                                           # (共 9 个页面组件)
│   ├── components/                             # 13 个 React 组件
│   │   ├── HierarchicalFilter.tsx              # 层级筛选器 (省→市联动)
│   │   ├── Loading.tsx                         # 加载动画
│   │   ├── MarkdownRenderer.tsx                # Markdown 渲染器
│   │   ├── MatchResults.tsx                    # 匹配结果展示
│   │   ├── Pagination.tsx                      # 分页组件
│   │   ├── RefreshButton.tsx                   # 刷新按钮
│   │   ├── ResumeDiagnosis.tsx                 # 简历诊断面板
│   │   ├── ResumeUploader.tsx                  # 简历上传器
│   │   ├── ThemeToggle.tsx                     # 主题切换
│   │   ├── Toast.tsx                           # Toast 通知
│   │   ├── app-shell.tsx                       # 应用外壳 (布局壳 + 权限门卫)
│   │   └── ui.tsx                              # 原子 UI 组件库 (529行, 15个组件)
│   │   ├── hierarchical-filter.module.css
│   │   ├── match-results.module.css
│   │   ├── resume-diagnosis.module.css
│   │   └── resume-uploader.module.css
│   ├── lib/                                    # 12 个业务逻辑模块
│   │   ├── ai-service.ts                       # AI 服务 (5种模型适配)
│   │   ├── api-response.ts                     # API 响应工具
│   │   ├── api.ts                              # API 客户端 (40+ 方法)
│   │   ├── auth.ts                             # 认证授权 (Token + RBAC)
│   │   ├── constants.ts                        # 常量配置
│   │   ├── db-utils.ts                         # 数据库操作 + 缓存 (562行)
│   │   ├── logger.ts                           # 日志服务
│   │   ├── match-engine.ts                     # 匹配算法 (六维评分)
│   │   ├── resume-parser.ts                    # 简历解析器
│   │   ├── resume-types.ts                     # 简历类型定义
│   │   ├── score-engine.ts                     # 评分引擎
│   │   └── types.ts                            # 通用类型定义
│   ├── spiders/                                # 13 个 Python 爬虫模块
│   │   ├── __init__.py
│   │   ├── base.py                             # 爬虫基类 (BaseSpider)
│   │   ├── unified_spider.py                   # 统一爬虫 (~970行, 4种策略)
│   │   ├── spider_configs.py                   # 数据源配置注册表
│   │   ├── crawler.py                          # 并发调度器 (AsyncMultiCrawler)
│   │   ├── database.py                         # SQLite 异步封装 (aiosqlite)
│   │   ├── utils.py                            # 工具函数集
│   │   ├── cache.py                            # 缓存管理
│   │   ├── connection_pool.py                  # HTTP 连接池
│   │   ├── incremental.py                      # 增量采集
│   │   ├── browser_wrapper.py                  # Playwright 浏览器封装
│   │   ├── logger.py                           # 日志 (loguru)
│   │   ├── constants.py                        # 爬虫常量
│   │   ├── run.py                              # CLI 入口
│   │   ├── jxufe_spider.py                     # 江西财经大学
│   │   ├── uibe_spider.py / uibe.py            # 对外经济贸易大学
│   │   ├── sufe_spider.py                      # 上海财经大学 (lite_crawler.py)
│   │   ├── swufe_spider.py                     # 西南财经大学
│   │   ├── zuel_spider.py                      # 中南财经政法大学
│   │   ├── neu_spider.py                       # 东北大学
│   │   ├── smartedu_spider.py                  # 国家智慧教育平台
│   │   └── platform_spider.py / performance_spider.py  # 平台/性能相关
│   ├── store/                                  # Zustand 状态管理
│   │   └── index.ts                            # 全局 Store (user/favorites/filterOptions)
│   ├── types/                                  # TypeScript 类型定义
│   │   └── index.ts                            # 类型导出中心
│   ├── styles/                                 # 全局 CSS
│   │   ├── variables.css                       # CSS 变量 (Design Tokens)
│   │   ├── layout.css                          # 布局样式
│   │   ├── components.css                      # 组件样式
│   │   └── auth.css                            # 认证相关样式
│   └── log/                                    # 运行日志目录
├── data/                                       # 数据存储
│   ├── jobs.db                                 # SQLite 主数据库
│   ├── jobs.db.bak.*                           # 数据库备份
│   ├── filter_cache.json                       # 筛选选项缓存 (5min TTL)
│   ├── major_similarity.json                   # 专业相似度矩阵
│   ├── skill_dictionary.json                   # 技能词典
│   └── user_profiles/                          # 用户简历数据
│       ├── records/                            # 70份简历 JSON 记录
│       ├── uploads/                            # 7份 PDF 简历
│       ├── quality_metrics_1.json
│       └── recommendation_weight_profiles.json
├── scripts/                                    # 数据清洗脚本
│   ├── clean_data.js                           # 主清洗脚本
│   ├── clean_locations.js                      # 地点清洗 (v1, 过时)
│   ├── clean_locations.ts                      # TS 移植版 (过时)
│   ├── clean_locations_v2.js                   # 地点清洗 v2 (被覆盖)
│   └── init_location_mapping.js                # 初始化地点映射
├── docs/                                       # 文档
│   └── plans/                                  # 设计文档
│       └── 2026-05-16-resume-matching-design.md
├── log/                                        # 外部日志
│   └── structured_2026-05-16.json
├── logs/                                       # 爬虫运行日志
│   └── crawler_20260518.log
├── output/                                     # 爬虫输出
│   └── visited_urls.json
├── .env.ai.example                             # AI 配置示例
├── .gitignore
├── .npmrc
├── Dockerfile                                  # 多阶段构建 (node:20-alpine)
├── docker-compose.yml                          # 编排配置
├── next.config.ts                              # Next.js 配置
├── package.json                                # Node.js 依赖
├── tsconfig.json                               # TypeScript 配置
├── README.md                                   # 项目说明
├── README_EN.md                                # 英文说明
├── SPIDERS_TECH_DOC.md                         # 爬虫技术文档
├── SPIDER_USAGE_GUIDE.md                       # 爬虫使用指南
├── API_USAGE_GUIDE.md                          # API 使用指南
├── SKILLS_USAGE_GUIDE.md                       # Skills 使用指南
├── create_test_db.py                           # 测试数据库创建
├── init_db.py                                  # 数据库初始化
├── run_spiders.py                              # 爬虫运行入口
├── lite_crawler.py                             # 轻量爬虫 (sufe 专用)
├── push-image.sh                               # 镜像推送脚本
└── build.log                                   # 构建日志
```

---

## 三、系统架构图

### 3.1 五层总体架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        用户界面层 (Presentation Layer)                        │
│                                                                             │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌───────┐  │
│  │ 首页仪表 │ │ 岗位列表 │ │ 简历匹配  │ │ AI 推荐  │ │ 系统管理 │ │ 登录页 │  │
│  │ Dashboard│ │ JobsPage│ │ MatchPage│ │ Recommend│ │ System  │ │ Login │  │
│  └────┬────┘ └────┬────┘ └─────┬────┘ └────┬─────┘ └────┬────┘ └───┬───┘  │
│       └────────────┴──────────┴──────────┴────────────┴───────────┘         │
│                              │                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  React 18 + CSS Modules + MarkdownRenderer + ThemeToggle + Toast     │   │
│  │  13个组件: JobCard / Pagination / HierarchicalFilter / ...          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Next.js 应用层 (Application Layer)                      │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    App Router + API Routes (30 endpoints)            │    │
│  │  /api/auth/*  /api/jobs/*  /api/match/*  /api/recommendations/*     │    │
│  │  /api/resume/*  /api/stats/*  /api/system/*  /api/crawler/*        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌──────────────────────────┐  ┌──────────────────────────────────────┐     │
│  │   Zustand Global Store   │  │      Middleware Layer                 │     │
│  │  ┌─────────────────────┐ │  │  ┌──────────┐ ┌──────────────────┐  │     │
│  │  │ user: AppUser|null  │ │  │  │ Auth Gate│ │ requireAuth()    │  │     │
│  │  │ favoriteJobIds: Set │ │  │  │(app-shell)│ │requirePermission│  │     │
│  │  │ filterOptions: ...  │ │  │  └──────────┘ └──────────────────┘  │     │
│  │  └─────────────────────┘ │  └──────────────────────────────────────┘     │
│  └──────────────────────────┘                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       业务逻辑层 (Business Logic Layer)                      │
│                                                                             │
│  ┌────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐   │
│  │  db-utils  │ │   auth.ts    │ │match-engine  │ │    ai-service      │   │
│  │  (562行)   │ │ Token+RBAC   │ │六维评分模型  │ │ 5种AI模型适配      │   │
│  │ SQLite CRUD│ │ SHA256哈希   │ │技能30%+学历20%│ │OpenAI/智谱/SF/DS  │   │
│  └────────────┘ └──────────────┘ └──────────────┘ └────────────────────┘   │
│                                                                             │
│  ┌──────────────┐ ┌───────────────┐ ┌────────────┐ ┌──────────────────┐   │
│  │ score-engine │ │resume-parser  │ │ api.ts     │ │    logger.ts      │   │
│  │ 评分计算引擎  │ │ 正则+PDF提取  │ │40+API方法  │ │ 结构化日志服务    │   │
│  └──────────────┘ └───────────────┘ └────────────┘ └──────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         constants.ts                                 │    │
│  │  SOURCE_NAME_MAP / AUTH_TOKEN_KEY / 匹配权重 / 分数阈值 / ...        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        数据存储层 (Data Storage Layer)                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     SQLite Database (jobs.db)                        │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │  jobs 表 (25字段)                                          │    │    │
│  │  │  id | title | company | location | salary | description |   │    │    │
│  │  │  source_url(UNIQUE) | content_hash(去重) | source | ...    │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐   │    │
│  │  │ crawl_logs 表     │  │location_mapping  │  │education_mapping│   │    │
│  │  │ 爬取日志记录       │  │ 地点标准化映射    │  │ 学历层级映射    │   │    │
│  │  └──────────────────┘  └──────────────────┘  └─────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌────────────────────┐  ┌──────────────────────┐  ┌───────────────────┐   │
│  │ filter_cache.json  │  │ major_similarity.json│  │skill_dictionary   │   │
│  │ 双层缓存(内存+文件) │  │ 专业相似度矩阵        │  │ 技能关键词词典    │   │
│  │ 5min TTL           │  │ JSON静态数据          │  │ JSON静态数据      │   │
│  └────────────────────┘  └──────────────────────┘  └───────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     user_profiles/                                   │    │
│  │  records/(70份JSON)  uploads/(7份PDF)  quality_metrics / weights     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  驱动模式: better-sqlite3(前端同步) + aiosqlite(爬虫异步) → 双写风险 ⚠️    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Python 爬虫层 (Crawler Layer)                          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      AsyncMultiCrawler                              │    │
│  │  asyncio.gather() 并发调度  |  Semaphore 信号量限制  | 批量写入50条   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                     │
│              ┌───────────────────────┼───────────────────────┐             │
│              ▼                       ▼                       ▼             │
│  ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────────┐  │
│  │   UnifiedSpider    │ │   BaseAPISpider    │ │   BaseBrowserSpider    │  │
│  │   (~970行)         │ │   (HTTP API策略)   │ │   (Playwright渲染)    │  │
│  │                    │ │                    │ │                        │  │
│  │ 4种抓取策略:        │ │ aiohttp + JSON     │ │ playwright + BS4       │  │
│  │ • api_post         │ └────────────────────┘ └────────────────────────┘  │
│  │ • api_get          │                                                │  │
│  │ • html             │  ┌──────────────────────────────────────────┐   │  │
│  │ • browser_*        │  │         9 个数据源 (高校就业网站)         │   │  │
│  └────────────────────┘  │                                            │   │
│                          │ HTTP API (5个):                              │   │
│  ┌────────────────────┐  │ sufe / cufe / dufe / swufe / zuel / uibe  │   │
│  │ 辅助模块:          │  │                                            │   │
│  │ • database.py      │  │ Browser 渲染 (4个):                         │   │
│  │ • cache.py         │  │ jxufe / neu / smartedu / uibe(部分)       │   │
│  │ • connection_pool  │  └──────────────────────────────────────────┘   │  │
│  │ • incremental.py   │                                                │  │
│  │ • browser_wrapper  │                                                │  │
│  │ • utils.py         │                                                │  │
│  │ • logger.py        │                                                │  │
│  └────────────────────┘                                                │  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 认证与权限流

```
┌──────────┐    Bearer Token     ┌──────────────┐    SHA256+Salt    ┌──────────────┐
│  Client  │ ──────────────────▶ │ verifyAuth() │ ────────────────▶ │ VALID_TOKENS │
│ (Browser)│ ◀────────────────── │   auth.ts    │ ◀──────────────── │    Map       │
└──────────┘   {user, authorized} └──────────────┘   hashed token   └──────────────┘
                                                    │
                                         ┌──────────▼──────────┐
                                         │ 三级角色 (RBAC):      │
                                         │ • admin  (全权限)     │
                                         │ • operator (操作员)   │
                                         │ • viewer  (只读)      │
                                         └─────────────────────┘
```

### 3.2 匹配引擎评分模型

```
                    ┌─────────────────────────────────────┐
                    │        MatchEngine 六维评分模型       │
                    ├─────────────────┬───────────────────┤
                    │   维度          │   权重 / 满分      │
                    ├─────────────────┼───────────────────┤
                    │   技能匹配      │   30% / 30分       │
                    │   学历匹配      │   20% / 20分       │
                    │   专业相关性    │   15% / 15分       │
                    │   地点偏好      │   10% / 10分       │
                    │   经验匹配      │   15% / 15分       │
                    │   行业匹配      │   10% / 10分       │
                    ├─────────────────┼───────────────────┤
                    │   总分          │   100分            │
                    └─────────────────┴───────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ ≥85 优秀 │   │ ≥70 合格 │   │ <70 待提升│
        │ 高度推荐 │   │ 可以尝试 │   │ 需要补强 │
        └──────────┘   └──────────┘   └──────────┘
```

---

## 四、核心模块功能详解

### 4.1 前端模块

#### 4.1.1 API 路由层 (30 个端点)

##### 认证模块 (`/api/auth/*`)

| 端点 | 方法 | 功能 | 认证要求 |
|------|------|------|----------|
| `/api/auth/login` | POST | 登录获取 Token | 无 |
| `/api/auth/logout` | POST | 注销登录 | 有 |
| `/api/auth/me` | GET | 获取当前用户信息 | 有 |
| `/api/auth/roles` | GET | 获取角色列表 | 有 |
| `/api/auth/users` | GET/POST | 用户管理 | admin |

**认证机制**:
- 基于 Token 的无状态认证 (Bearer Token)
- SHA256 哈希 + Salt 存储 (`crypto.createHash('sha256')`)
- 三级 RBAC 角色体系:
  - `admin`: 全部 20+ 权限 (含用户管理、系统配置)
  - `operator`: 14 权限 (不含用户管理和系统写入)
  - `viewer`: 8 只读权限

**安全注意**: 默认 Token 存在硬编码值 (详见问题清单 #1)

```typescript
// src/lib/auth.ts 第 15-17 行
const adminToken = process.env.ADMIN_TOKEN || 'admin-token-default';
const operatorToken = process.env.OPERATOR_TOKEN || 'operator-token-default';
const viewerToken = process.env.VIEWER_TOKEN || 'viewer-token-default';
```

##### 岗位模块 (`/api/jobs/*`)

| 端点 | 方法 | 功能 | 特性 |
|------|------|------|------|
| `/api/jobs` | GET | 分页查询岗位列表 | 支持多维度筛选 |
| `/api/jobs/search` | POST | 关键词搜索 | 多字段模糊匹配 |
| `/api/jobs/filters` | GET | 获取筛选选项 | 5min 缓存 |
| `/api/jobs/[id]` | GET | 岗位详情 | URL 解析与修复 |
| `/api/jobs/[id]/favorite` | POST | 收藏/取消收藏 | 切换式操作 |
| `/api/jobs/[id]/ai-analysis` | POST | AI 岗位分析 | 流式响应支持 |
| `/api/jobs/favorites` | GET | 收藏列表 | 分页 |

**筛选系统**:
- 支持 7 种筛选维度: 关键词、地点、类型、行业、学历、来源、收藏状态
- 多选筛选: `multiLocation`, `multiIndustry`, `multiJobType`
- 层级筛选: 省→市二级联动 (HierarchicalFilter 组件)
- 拼音搜索: 支持拼音首字母和全拼检索

##### 匹配模块 (`/api/match/*`)

| 端点 | 方法 | 功能 | 说明 |
|------|------|------|------|
| `/api/match/jobs` | POST | 批量匹配 | 上传简历后匹配全部岗位 |
| `/api/match/job/[id]` | POST | 单岗位匹配 | 对指定岗位计算匹配度 |

**匹配流程**:

```
PDF 上传 → Resume Parser 提取 → MatchEngine 六维计算 → ScoreEngine 归一化 → 结果排序
```

##### 推荐模块 (`/api/recommendations/*`)

| 端点 | 方法 | 功能 | ⚠️ 安全 |
|------|------|------|---------|
| `/api/recommendations/analyze` | POST | AI 岗位分析 | ✅ 有认证 |
| `/api/recommendations/delivery-assistant` | POST | 投递助手 | ❌ 缺少认证 |
| `/api/recommendations/resume-advice` | POST | 简历建议 | ❌ 缺少认证 |
| `/api/recommendations/history` | GET | 推荐历史 | ❌ 缺少认证 |

##### 其他模块

| 模块 | 端点数 | 主要功能 |
|------|--------|----------|
| `/api/resume/*` | 2 | PDF 解析 + 简历诊断 |
| `/api/stats/*` | 2 | 概览统计 + 趋势分析 |
| `/api/system/*` | 7 | 配置管理 + 订阅 CRUD + 维护操作 |
| `/api/crawler/*` | 3 | 状态监控 + 数据源列表 + 日志查看 |

#### 4.1.2 页面组件 (9 个页面)

| 页面 | 路径 | 复杂度 | 核心功能 |
|------|------|--------|----------|
| **首页仪表盘** | `/` | 中 | 统计概览卡片 + 快捷入口 |
| **岗位列表** | `/jobs` | 高 (~378行) | 筛选栏 + 列表 + 分页 + Modal 详情 |
| **简历匹配** | `/match` | 高 | 四步向导: 上传→解析→匹配→结果 |
| **收藏夹** | `/favorites` | 低 | 已收藏岗位列表 |
| **爬虫控制台** | `/crawler` | 中 | 状态展示 + 日志查看 |
| **AI 推荐** | `/recommendations` | 中 | 三Tab: 分析/投递助手/简历建议 |
| **系统管理** | `/system` | 最高 (~714行) | 配置编辑 + 订阅管理 + 维护操作 |
| **用户管理** | `/users` | 低 | 用户列表 + 角色分配 |
| **登录页** | `/login` | 低 | Token 登录 |

#### 4.1.3 UI 组件库 (13 个组件)

| 组件 | 文件 | 行数 | 用途 |
|------|------|------|------|
| **ui.tsx** | [ui.tsx](src/components/ui.tsx) | ~529 | 15 个原子组件集合 |
| **app-shell.tsx** | [app-shell.tsx](src/components/app-shell.tsx) | - | 布局壳 + 权限门卫 |
| **HierarchicalFilter.tsx** | [HierarchicalFilter.tsx](src/components/HierarchicalFilter.tsx) | - | 省→市层级筛选 |
| **MatchResults.tsx** | [MatchResults.tsx](src/components/MatchResults.tsx) | - | 匹配结果可视化 |
| **ResumeUploader.tsx** | [ResumeUploader.tsx](src/components/ResumeUploader.tsx) | - | PDF 拖拽上传 |
| **ResumeDiagnosis.tsx** | [ResumeDiagnosis.tsx](src/components/ResumeDiagnosis.tsx) | - | 简历质量诊断 |
| **Pagination.tsx** | [Pagination.tsx](src/components/Pagination.tsx) | - | 分页导航 |
| **MarkdownRenderer.tsx** | [MarkdownRenderer.tsx](src/components/MarkdownRenderer.tsx) | - | Markdown 渲染 |
| **ThemeToggle.tsx** | [ThemeToggle.tsx](src/components/ThemeToggle.tsx) | - | 明暗主题切换 |
| **Toast.tsx** | [Toast.tsx](src/components/Toast.tsx) | - | 通知提示 |
| **Loading.tsx** | [Loading.tsx](src/components/Loading.tsx) | - | 加载动画 |
| **RefreshButton.tsx** | [RefreshButton.tsx](src/components/RefreshButton.tsx) | - | 刷新按钮 |
| **StarButton** (内嵌 ui.tsx) | [ui.tsx](src/components/ui.tsx#L126-L140) | - | 收藏星标按钮 |

**ui.tsx 包含的 15 个原子组件**:

| 组件名 | 类型 | 用途 |
|--------|------|------|
| `SectionCard` | 容器 | 区块卡片容器 |
| `MetricCard` | 展示 | 数值指标卡 (带计数动画) |
| `Button` | 表单 | 按钮 (4种变体) |
| `Input` | 表单 | 文本输入框 |
| `Select` | 表单 | 下拉选择框 |
| `Badge` | 展示 | 标签徽章 (6种色调) |
| `EmptyState` | 展示 | 空状态占位 |
| `StarButton` | 交互 | 星标收藏按钮 |
| `JobCard` | 业务 | 岗位信息卡片 |
| `JobDetailModal` | 业务 | 岗位详情弹窗 (含AI分析) |
| `Skeleton` | 展示 | 骨架屏加载态 (3种类型) |
| `FileUpload` | 表单 | 文件拖拽上传区 |
| `TabNav` | 导航 | Tab 选项卡 (键盘可访问) |
| `FilterBar` | 布局 | 筛选栏容器 |

#### 4.1.4 工具库 (12 个模块)

| 模块 | 文件 | 行数 | 核心职责 |
|------|------|------|----------|
| **api.ts** | [api.ts](src/lib/api.ts) | - | API 客户端, 40+ 方法封装 |
| **auth.ts** | [auth.ts](src/lib/auth.ts) | 137 | Token 认证 + RBAC 权限 |
| **db-utils.ts** | [db-utils.ts](src/lib/db-utils.ts) | 562 | SQLite CRUD + 筛选缓存 + 地点标准化 |
| **ai-service.ts** | [ai-service.ts](src/lib/ai-service.ts) | - | 5 种 AI 模型统一适配 |
| **match-engine.ts** | [match-engine.ts](src/lib/match-engine.ts) | 297 | 六维评分匹配算法 |
| **score-engine.ts** | [score-engine.ts](src/lib/score-engine.ts) | - | 评分归一化与分级 |
| **resume-parser.ts** | [resume-parser.ts](src/lib/resume-parser.ts) | - | 正则表达式简历解析 |
| **resume-types.ts** | [resume-types.ts](src/lib/resume-types.ts) | - | 简历数据类型定义 |
| **logger.ts** | [logger.ts](src/lib/logger.ts) | - | 前端结构化日志 |
| **constants.ts** | [constants.ts](src/lib/constants.ts) | - | 全局常量与映射表 |
| **types.ts** | [types.ts](src/lib/types.ts) | - | 通用 TypeScript 类型 |
| **api-response.ts** | [api-response.ts](src/lib/api-response.ts) | - | API 响应格式化工具 |

---

### 4.2 爬虫系统

#### 4.2.1 架构设计: 配置驱动 + 策略模式

```
                    ┌─────────────────────┐
                    │  spider_configs.py   │
                    │  数据源配置注册表     │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   UnifiedSpider     │
                    │   统一爬虫入口       │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
     ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
     │ api_post     │ │ api_get      │ │ html / browser_*  │
     │ POST+JSON    │ │ GET+参数     │ │ BS4 / Playwright  │
     └──────────────┘ └──────────────┘ └──────────────────┘
```

#### 4.2.2 基类体系

```
                    BaseSpider (base.py)
                   /                    \
        BaseAPISpider              BaseBrowserSpider
       (HTTP API)                (浏览器渲染)
            │                          │
    ┌───────┼───────┐                  │
    │       │       │           Playwright
  sufe    cufe    dufe         Browser Wrapper
  swufe   zuel    uibe              │
                               browser_wrapper.py
```

#### 4.2.3 UnifiedSpider 四种策略

| 策略标识 | 适用场景 | 技术实现 | 数据源 |
|----------|----------|----------|--------|
| `api_post` | POST 请求 API | `aiohttp.post()` + JSON Body | sufe, swufe, zuel 等 |
| `api_get` | GET 请求 API | `aiohttp.get()` + Query Params | cufe, dufe 等 |
| `html` | HTML 页面解析 | `aiohttp.get()` + BeautifulSoup | 静态页面 |
| `browser_*` | JS 动态渲染 | Playwright + BS4 | jxufe, neu, smartedu |

#### 4.2.4 并发调度: AsyncMultiCrawler

```
┌─────────────────────────────────────────────────────┐
│                  AsyncMultiCrawler                   │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │         asyncio.gather(*tasks)                │  │
│  │                                               │  │
│  │  Spider₁ ──┐                                  │  │
│  │  Spider₂ ──┼── Semaphore(3) ── 浏览器并发限制  │  │
│  │  Spider₃ ──┘   (Playwright 实例复用)          │  │
│  │                                               │  │
│  │  写入队列: WriteQueue (批量 50 条/batch)      │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**关键参数**:

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `detail_concurrency` | 8 | 详情页并发数 |
| `max_pages` | 80 | 最大翻页数 |
| `batch_size` | 50 | 批量写入条数 |
| `browser_semaphore` | 3 | 浏览器实例上限 |

#### 4.2.5 数据源覆盖 (9 所高校)

| 高校 | 代码 | 策略类型 | 网站 |
|------|------|----------|------|
| 西南财经大学 | swufe | api_post | career.swufe.edu.cn |
| 上海财经大学 | sufe | api_post | career.sufe.edu.cn |
| 中央财经大学 | cufe | api_get | scc.cufe.edu.cn |
| 东北财经大学 | dufe | api_get | scc.dufe.edu.cn |
| 中南财经政法大学 | zuel | api_post | jyzx.zuel.edu.cn |
| 对外经济贸易大学 | uibe | mixed | career.uibe.edu.cn |
| 江西财经大学 | jxufe | browser | jxx.jxufe.edu.cn |
| 东北大学 | neu | browser | career.neu.edu.cn |
| 国家智慧教育平台 | smartedu | browser | www.smartedu.cn |

#### 4.2.6 辅助模块

| 模块 | 文件 | 功能 |
|------|------|------|
| database.py | [database.py](src/spiders/database.py) | aiosqlite 异步封装, 建表/写入/去重 |
| cache.py | [cache.py](src/spiders/cache.py) | URL 去重缓存 (避免重复爬取) |
| connection_pool.py | [connection_pool.py](src/spiders/connection_pool.py) | aiohttp 连接池管理 |
| incremental.py | [incremental.py](src/spiders/incremental.py) | 增量采集 (基于 publish_date) |
| browser_wrapper.py | [browser_wrapper.py](src/spiders/browser_wrapper.py) | Playwright 生命周期管理 |
| utils.py | [utils.py](src/spiders/utils.py) | 文本清理/日期标准化/HTML转文本 |
| logger.py | [logger.py](src/spiders/logger.py) | loguru 结构化日志 |
| constants.py | [constants.py](src/spiders/constants.py) | 爬虫常量与默认配置 |

---

### 4.3 数据层

#### 4.3.1 主数据库: SQLite (jobs.db)

**jobs 表 Schema (25 个字段)**:

```sql
CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    company TEXT,
    location TEXT,
    salary TEXT,
    job_type TEXT,
    industry TEXT,
    education TEXT,
    experience TEXT,
    description TEXT,
    requirements TEXT,
    benefits TEXT,
    source TEXT,
    source_id TEXT,
    source_url TEXT UNIQUE,        -- UNIQUE 约束防重复
    apply_url TEXT,
    publish_date TEXT,
    deadline TEXT,
    content_hash TEXT,             -- 内容哈希去重
    tags TEXT,
    is_favorite INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    raw_data TEXT,
    category TEXT
);
```

**其他表**:

| 表名 | 用途 | 关键字段 |
|------|------|----------|
| `crawl_logs` | 爬取日志记录 | source, status, count, started_at, finished_at |
| `location_mapping` | 地点标准化映射 | name, type(province/city), province, pinyin, first_letter |
| `education_mapping` | 学历层级映射 | name, level(0-6), alias(别名列表) |

#### 4.3.2 JSON 缓存: filter_cache.json

```json
{
  "locations": [...],
  "job_types": [...],
  "industries": [...],
  "education": [...],
  "sources": [...],
  "provinces": [...],
  "locationMapping": [...],
  "educationMapping": [...],
  "updated_at": 1742000000000
}
```

**双层缓存机制**:

```
请求 → 内存缓存 (memoryCache) → 文件缓存 (filter_cache.json) → DB 查询
         ↑ 5min TTL              ↑ 5min TTL           ↑ SELECT DISTINCT * 4
```

#### 4.3.3 数据文件

| 文件 | 大小 | 用途 |
|------|------|------|
| `major_similarity.json` | - | 专业名称相似度矩阵 (用于匹配引擎专业匹配) |
| `skill_dictionary.json` | - | 技能关键词词典 |
| `user_profiles/records/` | 70 份 | 用户简历 JSON 记录 |
| `user_profiles/uploads/` | 7 份 | PDF 格式原始简历 |

---

## 五、技术指标统计

### 5.1 代码量分布

| 语言/类别 | 文件数 | 估算行数 | 占比 |
|-----------|--------|----------|------|
| **TypeScript (.ts/.tsx)** | ~52 | ~9,700 | ~60% |
| **Python (.py)** | ~17 | ~3,800 | ~24% |
| **CSS (.css/.module.css)** | ~10 | ~2,500 | ~16% |
| **JSON / 配置** | ~118+ | - | - |
| **总计** | **~197+** | **~16,000+** | 100% |

> 注: 行数为估算值, 以实际 `wc -l` 统计为准

### 5.2 模块统计

| 类别 | 数量 | 详情 |
|------|------|------|
| API 路由端点 | **30** | auth(5) + jobs(7) + match(2) + recommendations(4) + resume(2) + stats(2) + system(7) + crawler(3) |
| 页面组件 | **9** | /, /jobs, /match, /favorites, /crawler, /recommendations, /system, /users, /login |
| React 组件 | **13** | 含 ui.tsx 内嵌 15 个原子组件 |
| 业务逻辑模块 | **12** | lib/ 目录下 |
| Python 爬虫模块 | **13** | spiders/ 目录下 (含各校专用爬虫) |
| 数据源 | **9** | 5 个 HTTP API + 4 个浏览器渲染 |
| AI 模型支持 | **5** | OpenAI / 智谱 AI / SiliconFlow / DeepSeek / Custom |
| 数据清洗脚本 | **5** | scripts/ 目录 |
| CSS 样式文件 | **4** | variables + layout + components + auth |

### 5.3 依赖清单

**前端 (package.json)**:

| 依赖 | 版本 | 用途 |
|------|------|------|
| next | ^15.3.3 | 全栈框架 |
| react | ^18.3.1 | UI 库 |
| react-dom | ^18.3.1 | DOM 渲染 |
| better-sqlite3 | ^11.10.0 | SQLite 同步驱动 |
| zustand | ^5.0.13 | 状态管理 |
| react-markdown | ^10.1.0 | Markdown 渲染 |

**Python 爬虫 (缺少 requirements.txt)**:

| 依赖 (推测) | 用途 |
|-------------|------|
| aiosqlite | 异步 SQLite 操作 |
| aiohttp | 异步 HTTP 客户端 |
| beautifulsoup4 | HTML 解析 |
| loguru | 日志库 |
| playwright | 浏览器自动化 |

---

## 六、数据流图

### 6.1 用户请求流 (CRUD 操作)

```
┌──────────┐    HTTP Request     ┌──────────────┐    Route Handler    ┌──────────────┐
│  React   │ ──────────────────▶ │  API Client  │ ─────────────────▶ │ Business Logic│
│  Page     │ ◀───────────────── │   api.ts     │ ◀───────────────── │  (lib/*.ts)  │
│ Component │   JSON Response    │  (40+方法)    │   Processed Data   │              │
└──────────┘                    └──────────────┘                    └──────┬───────┘
                                                                          │
                                                                          ▼
                                                               ┌──────────────────┐
                                                               │   SQLite (jobs.db) │
                                                               │  better-sqlite3    │
                                                               └────────┬─────────┘
                                                                        │
                                                                        ▼
                                                               ┌──────────────────┐
                                                               │  JSON Response    │
                                                               │  → Frontend Render│
                                                               └──────────────────┘
```

### 6.2 爬虫采集流

```
┌──────────┐    CLI Command      ┌──────────────────┐    Config Load    ┌──────────────────┐
│ Terminal │ ──────────────────▶ │  run_spiders.py  │ ────────────────▶ │ spider_configs.py │
│ / Cron   │                    │  AsyncMultiCrawl │                  │  9个数据源配置     │
└──────────┘                    └────────┬─────────┘                  └──────────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
           ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
           │ UnifiedSpider│    │ UnifiedSpider│    │  UnifiedSpider    │
           │  (sufe)      │    │  (jxufe)     │    │  (smartedu)       │
           │  api_post    │    │  browser     │    │  browser          │
           └──────┬───────┘    └──────┬───────┘    └────────┬─────────┘
                  │                   │                     │
                  ▼                   ▼                     ▼
           ┌──────────┐        ┌──────────┐         ┌──────────────┐
           │ aiohttp  │        │Playwright│         │  BeautifulSoup│
           │ POST/GET │        │ render   │         │  parse HTML  │
           └────┬─────┘        └────┬─────┘         └──────┬───────┘
                │                   │                      │
                └───────────────────┼──────────────────────┘
                                    ▼
                         ┌──────────────────────┐
                         │   Parse & Normalize   │
                         │  清洗/标准化/去重      │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │   LocalDatabase      │
                         │   (aiosqlite)        │
                         │   Batch Insert 50    │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │     jobs.db          │
                         │   (SQLite 主库)       │
                         └──────────────────────┘
```

### 6.3 简历匹配流

```
┌──────────────┐    File Upload     ┌──────────────────┐    Regex Parse    ┌──────────────────┐
│   User       │ ────────────────▶ │  ResumeUploader  │ ────────────────▶ │  ResumeParser    │
│  (PDF/Text)  │                   │  Component       │                  │  (正则表达式)     │
└──────────────┘                   └──────────────────┘                  └────────┬─────────┘
                                                                              │
                                                                              ▼
                                                                   ┌──────────────────┐
                                                                   │  ResumeProfile   │
                                                                   │ {skills, edu,    │
                                                                   │  internships...} │
                                                                   └────────┬─────────┘
                                                                            │
                                                                            ▼
                                                                 ┌──────────────────────┐
                                                                 │    MatchEngine        │
                                                                 │  六维评分计算:         │
                                                                 │  skills(30%) + edu(20%)│
                                                                 │  + major(15%) + loc(10%)│
                                                                 │  + exp(15%) + ind(10%) │
                                                                 └──────────┬───────────┘
                                                                            │
                                                                            ▼
                                                                 ┌──────────────────────┐
                                                                 │   ScoreEngine         │
                                                                 │   归一化 + 分级       │
                                                                 │   ≥85优秀/≥70合格/<70 │
                                                                 └──────────┬───────────┘
                                                                            │
                                                                            ▼
                                                                 ┌──────────────────────┐
                                                                 │   MatchResults UI     │
                                                                 │   匹配度 + 差距 + 风险 │
                                                                 └──────────────────────┘
```

---

## 七、问题清单

按严重程度从高到低排列, 共 28 项。

---

### 🔴 P0 - 严重问题 (必须立即修复)

#### #1 安全漏洞 - 硬编码默认 Token

| 属性 | 详情 |
|------|------|
| **位置** | [auth.ts:15-17](src/lib/auth.ts#L15-L17), [docker-compose.yml:14-16](docker-compose.yml#L14-L16) |
| **问题描述** | `ADMIN_TOKEN`, `OPERATOR_TOKEN`, `VIEWER_TOKEN` 存在明文默认值回退 |
| **风险等级** | 🔴 **严重** - 未配置环境变量时, 攻击者可用默认凭据登录管理员账户 |
| **影响范围** | 所有部署环境, 尤其是生产环境 |

**问题代码**:

```typescript
// src/lib/auth.ts 第 15-17 行
const adminToken = process.env.ADMIN_TOKEN || 'admin-token-default';
const operatorToken = process.env.OPERATOR_TOKEN || 'operator-token-default';
const viewerToken = process.env.VIEWER_TOKEN || 'viewer-token-default';
```

```yaml
# docker-compose.yml 第 14-16 行
ADMIN_TOKEN: ${ADMIN_TOKEN:-finintern-admin-2024}
OPERATOR_TOKEN: ${OPERATOR_TOKEN:-finintern-operator-2024}
VIEWER_TOKEN: ${VIEWER_TOKEN:-finintern-viewer-2024}
```

**修复方案**:
1. 移除所有默认值回退, 启动时检查必需的环境变量
2. 若未配置则拒绝启动并输出明确错误信息
3. 在 CI/CD 流水线中强制要求 secrets 注入

---

#### #2 安全漏洞 - 3 个推荐 API 缺少认证

| 属性 | 详情 |
|------|------|
| **位置** | [delivery-assistant/route.ts](src/app/api/recommendations/delivery-assistant/route.ts), [resume-advice/route.ts](src/app/api/recommendations/resume-advice/route.ts), [history/route.ts](src/app/api/recommendations/history/route.ts) |
| **问题描述** | 这 3 个 API 端点完全没有调用 `requireAuth()` 进行身份验证 |
| **风险等级** | 🔴 **严重** - 可被匿名滥用消耗 AI API 额度或泄露推荐历史数据 |
| **影响范围** | AI 推荐功能的 3/4 端点 |

**问题代码** (以 delivery-assistant 为例):

```typescript
// src/app/api/recommendations/delivery-assistant/route.ts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // ❌ 缺少: const user = requireAuth(request);
    // ❌ 缺少: 权限检查
    ...
  }
}
```

**修复方案**:
在每个路由处理函数开头添加:

```typescript
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const user = requireAuth(request);  // 添加此行
  // ... 后续逻辑
}
```

---

### 🟠 P1 - 高优先级问题

#### #3 性能瓶颈 - 匹配引擎全表扫描

| 属性 | 详情 |
|------|------|
| **位置** | [/api/match/jobs/route.ts](src/app/api/match/jobs/route.ts) |
| **问题描述** | 使用 `SELECT * FROM jobs` 将全部岗位加载到内存, 再逐个计算匹配度 |
| **风险等级** | 🟠 **高** - 数据量 >10,000 条时响应时间 >10 秒 |
| **预期影响** | 用户体验严重下降, 可能导致请求超时 |

**优化方案**:
1. **粗筛阶段**: 先用 SQL WHERE 子句过滤学历/地点/行业等硬性条件
2. **倒排索引**: 为技能字段建立倒排索引, 快速定位候选集
3. **分批计算**: 每次只计算 Top-K (如 top 100), 避免全量排序

---

#### #4 性能瓶颈 - 缺少复合索引

| 属性 | 详情 |
|------|------|
| **位置** | [jobs.db](data/jobs.db) 的 `jobs` 表 |
| **问题描述** | 常见查询模式 `WHERE source=? AND publish_date>?` 无对应复合索引 |
| **风险等级** | 🟠 **高** - 大数据量下筛选性能差 |

**推荐的索引**:

```sql
-- 来源 + 发布时间复合索引 (最常用查询模式)
CREATE INDEX IF NOT EXISTS idx_jobs_source_publish
ON jobs(source, publish_date DESC);

-- 收藏状态索引
CREATE INDEX IF NOT EXISTS idx_jobs_favorite
ON jobs(is_favorite);

-- 来源 + 类型复合索引
CREATE INDEX IF NOT EXISTS idx_jobs_source_type
ON jobs(source, job_type);

-- 发布时间索引 (用于增量同步)
CREATE INDEX IF NOT EXISTS idx_jobs_publish_date
ON jobs(publish_date DESC);
```

---

#### #5 代码质量 - 4 个冗余/过时文件

| 文件 | 状态 | 建议 |
|------|------|------|
| [scripts/clean_locations.js](scripts/clean_locations.js) | v1, 被 v2 替代 | 移至 `trash/` |
| [scripts/clean_locations.ts](scripts/clean_locations.ts) | TS 移植版, 同样过时 | 移至 `trash/` |
| [scripts/clean_locations_v2.js](scripts/clean_locations_v2.js) | v2, 被 clean_data.js 覆盖 | 移至 `trash/` |
| **保留** | [scripts/clean_data.js](scripts/clean_data.js) | 当前主清洗脚本 |

**操作建议**: 将 3 个过时文件移入 `trash/` 目录, 统一使用 `clean_data.js`。

---

#### #6 代码质量 - ui.tsx 文件过大 (529 行, 15 个组件)

| 属性 | 详情 |
|------|------|
| **位置** | [ui.tsx](src/components/ui.tsx) |
| **当前规模** | 529 行, 内含 15 个独立组件 |
| **问题** | 违反单一职责原则, 难以维护和测试 |

**建议拆分方案**:

| 新文件 | 包含组件 | 预估行数 |
|--------|----------|----------|
| `form.tsx` | Button, Input, Select, FileUpload | ~120 |
| `feedback.tsx` | Toast, Skeleton, EmptyState | ~100 |
| `display.tsx` | SectionCard, MetricCard, Badge, StarButton | ~150 |
| `job.tsx` | JobCard, JobDetailModal | ~190 |
| `navigation.tsx` | TabNav, FilterBar | ~60 |
| `layout.tsx` | joinClassNames 工具函数 | ~10 |

---

#### #7 代码质量 - unified_spider.py 过长 (970 行)

| 属性 | 详情 |
|------|------|
| **位置** | [unified_spider.py](src/spiders/unified_spider.py) |
| **当前规模** | ~970 行 |
| **问题** | 单文件承担 4 种抓取策略, 可读性和可测试性差 |

**建议拆分方案**:

```
unified_spider.py (主入口, ~150行)
├── strategies/
│   ├── api_post_strategy.py    # POST API 策略
│   ├── api_get_strategy.py     # GET API 策略
│   ├── html_strategy.py        # HTML 解析策略
│   └── browser_strategy.py     # 浏览器渲染策略
```

---

#### #8 代码质量 - Zustand Store 未充分利用

| 属性 | 详情 |
|------|------|
| **位置** | [store/index.ts](src/store/index.ts), [JobsPage](src/app/jobs/page.tsx), [FavoritesPage](src/app/favorites/page.tsx) |
| **问题描述** | `favoriteJobIds` 和 `filterOptions` 已在 Store 中定义, 但未被任何页面组件使用 |
| **影响** | 跨页面状态不共享, 导致重复网络请求 (如收藏列表和岗位列表各自独立请求) |

**Store 定义** (已存在但未使用):

```typescript
// store/index.ts
interface AppState {
  user: AppUser | null;
  favoriteJobIds: Set<number>;           // ← 已定义, 未使用
  setFavorite: (jobId: number, isFavorite: boolean) => void;
  filterOptions: FilterOptions | null;    // ← 已定义, 未使用
  setFilterOptions: (options: FilterOptions) => void;
}
```

**修复方案**:
1. 在 `JobsPage` 中使用 `useAppStore(s => s.filterOptions)` 缓存筛选选项
2. 在 `JobsPage` 和 `FavoritesPage` 中共享 `favoriteJobIds`, 收藏操作即时反馈

---

#### #9 数据库问题 - 双驱动并发写入冲突风险

| 属性 | 详情 |
|------|------|
| **涉及方** | 前端 (better-sqlite3 同步) vs 爬虫 (aiosqlite 异步) |
| **目标** | 同一个 `jobs.db` 文件 |
| **风险等级** | 🟠 **高** - 高频爬取时可能出现 `"database is locked"` 错误 |
| **触发条件** | 爬虫正在批量写入时, 前端同时执行读写操作 |

**优化方案**:

```sql
-- 启用 WAL 模式, 允许并发读写
PRAGMA journal_mode=WAL;
PRAGMA busy_timeout=5000;  -- 等待锁释放超时 (ms)
```

在 [db-utils.ts 的 getDb()](src/lib/db-utils.ts#L72-L77) 中添加:

```typescript
export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH, { readonly: false, fileMustExist: false });
    dbInstance.pragma('journal_mode = WAL');     // 添加
    dbInstance.pragma('busy_timeout = 5000');     // 添加
  }
  return dbInstance;
}
```

---

#### #10 依赖管理 - 缺少 requirements.txt

| 属性 | 详情 |
|------|------|
| **位置** | 项目根目录 |
| **问题描述** | Python 爬虫依赖未声明, 环境不可复现 |
| **影响** | 新开发者无法一键安装依赖, CI/CD 无法自动安装 |

**建议创建 `requirements.txt`**:

```
aiosqlite>=0.19.0
loguru>=0.7.0
aiohttp>=3.9.0
beautifulsoup4>=4.12.0
playwright>=1.40.0
lxml>=5.0.0
```

---

### 🟡 P2 - 中优先级问题

#### #11 性能 - 筛选选项全表扫描

| 属性 | 详情 |
|------|------|
| **位置** | [db-utils.ts getFilterOptions()](src/lib/db-utils.ts#L304-L449) |
| **问题描述** | 每次 cache miss 时对 `jobs` 表执行 4 次 `SELECT DISTINCT`, 将全部数据拉到应用层再做 `countOccurrences()` |
| **优化方向** | 使用 SQL 聚合函数 `GROUP BY` + `COUNT()` 减少数据传输量 |

**当前实现** (4次全表扫描):

```typescript
const locations = db.prepare(`SELECT location FROM jobs WHERE ...`).all();
const jobTypes = db.prepare(`SELECT job_type FROM jobs WHERE ...`).all();
const industries = db.prepare(`SELECT industry FROM jobs WHERE ...`).all();
const education = db.prepare(`SELECT education FROM jobs WHERE ...`).all();
// 然后在 JS 中做 splitAndNormalize + countOccurrences
```

**优化为单次聚合查询**:

```sql
SELECT location, COUNT(*) as cnt FROM jobs
WHERE location IS NOT NULL AND location != ''
GROUP BY location ORDER BY cnt DESC;
```

---

#### #12 性能 - LIKE '%keyword%' 无法使用索引

| 属性 | 详情 |
|------|------|
| **位置** | [db-utils.ts buildJobWhereClause()](src/lib/db-utils.ts#L100-L165) |
| **问题描述** | 所有搜索条件使用 `LIKE '%xxx%'` 前缀通配符, 导致无法利用 B-Tree 索引 |
| **优化方向** | |
| - **短期**: 改用右匹配 `GLOB '*keyword'` 或 `LIKE 'keyword%'` (仅末尾通配) |
| - **中期**: 引入 FTS5 全文搜索引擎 |
| - **长期**: 集成 MeiliSearch/Elasticsearch |

---

#### #13 用户体验 - 爬虫控制端点不存在

| 属性 | 详情 |
|------|------|
| **位置** | [crawler/page.tsx](src/app/crawler/page.tsx) |
| **问题描述** | 页面调用 `API.startCrawler()` / `API.stopCrawler()` 但对应路由返回 404 |
| **影响** | 爬虫控制台的启动/停止按钮无法正常工作 |

**修复方案**: 实现 `/api/crawler/start` 和 `/api/crawler/stop` 端点, 或移除页面上无效的控制按钮。

---

#### #14 用户体验 - 推荐历史字段不匹配

| 属性 | 详情 |
|------|------|
| **位置** | [recommendations/page.tsx](src/app/recommendations/page.tsx) vs [/api/recommendations/history/route.ts](src/app/api/recommendations/history/route.ts) |
| **问题描述** | 前端期望的字段结构与 API 返回的实际字段不一致 |
| **影响** | 推荐历史可能无法正确渲染或部分数据丢失 |

**修复方案**: 统一字段定义, 前后端共享 TypeScript 类型。

---

#### #15 代码质量 - 魔法数字和硬编码字符串散落

| 类别 | 示例 | 出现位置 |
|------|------|----------|
| **匹配权重** | 30/20/15/10/15/10 | [match-engine.ts:192-207](src/lib/match-engine.ts#L192-L207) |
| **分数阈值** | 85/70/55 | score-engine.ts |
| **并发参数** | 8/3/50 | unified_spider.py |
| **路径硬编码** | PID文件路径, 日志目录 | crawler.py, logger.py |
| **TTL 硬编码** | 5*60*1000 (5分钟) | db-utils.ts:168 |

**修复方案**: 统一到 `constants.ts` / `constants.py` 或独立的配置文件中。

---

#### #16 代码质量 - 类型定义双重路径

| 类型 | 存在位置 A | 存在位置 B |
|------|------------|------------|
| `AppUser` | [types/index.ts](src/types/index.ts) | [lib/types.ts](src/lib/types.ts) (re-export) |
| `ResumeProfile` | [types/index.ts](src/types/index.ts) | [lib/resume-types.ts](src/lib/resume-types.ts) (re-export) |

**问题**: 同一类型有两个导入源, 开发者容易混淆, 且可能导致类型不一致。

**修复方案**: 统一为单一导入源 (推荐 `lib/types.ts` 作为唯一真实来源, `types/index.ts` 仅做 barrel export)。

---

#### #17 数据库 - 无迁移机制

| 属性 | 详情 |
|------|------|
| **位置** | [init_db.py](init_db.py), [spiders/database.py](src/spiders/database.py) |
| **问题描述** | 使用 `CREATE TABLE IF NOT EXISTS` 创建表, 无法处理 Schema 变更 (如新增字段/修改约束) |
| **影响** | 升级时需要手动修改数据库或删除重建, 存在数据丢失风险 |

**修复方案**: 引入版本化迁移机制:

```
migrations/
├── 001_initial.sql
├── 002_add_category_field.sql
├── 003_create_indexes.sql
└── _migration_log table (记录已执行的迁移)
```

---

#### #18 部署 - Dockerfile 缺少 HEALTHCHECK

| 属性 | 详情 |
|------|------|
| **位置** | [Dockerfile](Dockerfile) |
| **问题描述** | 未定义 HEALTHCHECK 指令, 容器编排器无法自动检测健康状态 |
| **影响** | 容器故障时无法自动重启, 负载均衡可能将流量路由到不健康的容器 |

**修复方案**:

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/system/status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
```

---

### 🟢 P3 - 低优先级建议

#### #19 功能增强 - API 速率限制中间件

为所有 API 端点添加速率限制, 防止恶意请求和 AI 额度滥用。建议使用令牌桶或滑动窗口算法。

#### #20 功能增强 - WebSocket/SSE 实时推送新岗位

当爬虫采集到新岗位时, 通过 Server-Sent Events 推送给在线用户, 无需手动刷新。

#### #21 功能增强 - CSV/Excel 导出功能

允许用户导出筛选后的岗位列表为 CSV 或 Excel 格式, 方便离线分析和分享。

#### #22 功能增强 - 集成全文搜索引擎

引入 SQLite FTS5 或外部 MeiliSearch, 解决 LIKE '%keyword%' 性能问题 (#12 的长期方案)。

#### #23 功能增强 - 添加单元测试

当前测试覆盖率估计接近 0%。建议优先为核心模块编写测试:
- `match-engine.ts` (纯函数, 易于测试)
- `auth.ts` (认证逻辑)
- `db-utils.ts` (数据访问层)
- `resume-parser.ts` (文本解析)

#### #24 功能增强 - 国际化 (i18n) 准备

提取所有硬编码的中文字符串到语言包, 为未来多语言支持做准备。

#### #25 用户体验 - 系统 JSON 编辑器增加语法高亮

[system/page.tsx](src/app/system/page.tsx) 中的 JSON 编辑器是纯文本 textarea, 建议集成 Monaco Editor 或 CodeMirror 提供语法高亮和错误检测。

#### #26 用户体验 - MarkdownRenderer 增加插件

当前 [MarkdownRenderer](src/components/MarkdownRenderer.tsx) 仅基础渲染, 建议添加:
- `remark-gfm` (GitHub Flavored Markdown: 表格/删除线/任务列表)
- `rehype-highlight` (代码块语法高亮)

#### #27 监控告警 - 集成 Prometheus + Grafana

暴露 `/metrics` 端点, 收集关键指标:
- API 请求延迟 (P50/P95/P99)
- 爬虫成功率/失败率
- 数据库查询耗时
- AI API 调用次数和成本

#### #28 审计日志 - 追踪用户操作记录

记录关键操作 (登录/登出/配置修改/数据清洗/爬虫启停) 到审计日志表, 支持事后追溯和安全审计。

---

## 八、优化建议汇总

### 按类别总结

| 类别 | 问题编号 | 预期收益 | 实施复杂度 | 优先级 |
|------|----------|----------|------------|--------|
| **安全性** | #1, #2 | 消除认证绕过和数据泄露风险 | 低 | P0 |
| **性能** | #3, #4, #11, #12 | 查询速度提升 10-100x | 中 | P1-P2 |
| **代码质量** | #5, #6, #7, #8, #15, #16 | 可维护性显著提升 | 中 | P1-P2 |
| **数据可靠性** | #9, #17 | 消除数据损坏和锁定风险 | 中 | P1-P2 |
| **工程化** | #10, #18, #23 | 环境一致性和可测试性 | 低 | P1-P3 |
| **用户体验** | #13, #14, #25, #26 | 功能完善度和易用性 | 低 | P2-P3 |
| **功能扩展** | #19, #20, #21, #22, #24, #27, #28 | 产品竞争力提升 | 高 | P3 |

### 实施路线图建议

```
Phase 1 (立即, 1-2天):
  ┌────────────────────────────────────────┐
  │ ✅ #1 移除硬编码默认Token               │
  │ ✅ #2 添加缺失的认证中间件              │
  │ ✅ #10 创建 requirements.txt            │
  └────────────────────────────────────────┘

Phase 2 (短期, 1周):
  ┌────────────────────────────────────────┐
  │ ✅ #4 添加数据库复合索引                │
  │ ✅ #9 启用WAL模式解决并发冲突           │
  │ ✅ #5 清理冗余文件                      │
  │ ✅ #13/#14 修复前端功能缺陷             │
  │ ✅ #18 添加Docker HEALTHCHECK           │
  └────────────────────────────────────────┘

Phase 3 (中期, 2-4周):
  ┌────────────────────────────────────────┐
  │ ✅ #3 优化匹配引擎性能                  │
  │ ✅ #6 拆分ui.tsx                        │
  │ ✅ #7 拆分unified_spider.py             │
  │ ✅ #8 接入Zustand Store                 │
  │ ✅ #11 优化筛选选项查询                  │
  │ ✅ #15 统一魔法数字                      │
  │ ✅ #16 统一类型定义路径                  │
  │ ✅ #17 引入数据库迁移机制               │
  └────────────────────────────────────────┘

Phase 4 (长期, 持续迭代):
  ┌────────────────────────────────────────┐
  │ 🔲 #12 FTS5全文搜索                    │
  │ 🔲 #19 速率限制中间件                   │
  │ 🔲 #20 SSE实时推送                     │
  │ 🔲 #21 CSV/Excel导出                   │
  │ 🔲 #23 单元测试 (目标覆盖率 >60%)       │
  │ 🔲 #27 Prometheus监控                  │
  │ 🔲 #28 审计日志                         │
  └────────────────────────────────────────┘
```

---

## 九、附录

### A. 关键文件索引

#### 核心配置文件

| 文件 | 用途 |
|------|------|
| [package.json](package.json) | Node.js 依赖和脚本 |
| [tsconfig.json](tsconfig.json) | TypeScript 编译配置 |
| [next.config.ts](next.config.ts) | Next.js 框架配置 |
| [Dockerfile](Dockerfile) | 容器镜像构建 (多阶段) |
| [docker-compose.yml](docker-compose.yml) | 服务编排配置 |
| [.env.ai.example](.env.ai.example) | AI 服务配置模板 |

#### 前端核心模块

| 文件 | 行数 | 职责 |
|------|------|------|
| [auth.ts](src/lib/auth.ts) | 137 | 认证授权 (Token + RBAC) |
| [db-utils.ts](src/lib/db-utils.ts) | 562 | 数据库操作 + 缓存 + 地点标准化 |
| [api.ts](src/lib/api.ts) | - | API 客户端 (40+ 方法) |
| [match-engine.ts](src/lib/match-engine.ts) | 297 | 六维评分匹配算法 |
| [ai-service.ts](src/lib/ai-service.ts) | - | 5 种 AI 模型适配 |
| [constants.ts](src/lib/constants.ts) | - | 全局常量和映射表 |
| [store/index.ts](src/store/index.ts) | 47 | Zustand 全局状态 |
| [ui.tsx](src/components/ui.tsx) | 529 | 15 个原子 UI 组件 |
| [app-shell.tsx](src/components/app-shell.tsx) | - | 布局壳 + 权限门卫 |

#### 爬虫核心模块

| 文件 | 行数 | 职责 |
|------|------|------|
| [unified_spider.py](src/spiders/unified_spider.py) | ~970 | 统一爬虫 (4种策略) |
| [crawler.py](src/spiders/crawler.py) | - | 并发调度器 |
| [base.py](src/spiders/base.py) | - | 爬虫基类 |
| [spider_configs.py](src/spiders/spider_configs.py) | - | 数据源配置注册表 |
| [database.py](src/spiders/database.py) | - | 异步数据库操作 |
| [run.py](src/spiders/run.py) | - | CLI 入口 |

#### 页面组件

| 文件 | 行数(约) | 复杂度 |
|------|----------|--------|
| [system/page.tsx](src/app/system/page.tsx) | ~714 | 最高 |
| [jobs/page.tsx](src/app/jobs/page.tsx) | ~378 | 高 |
| [match/page.tsx](src/app/match/page.tsx) | - | 高 |
| [recommendations/page.tsx](src/app/recommendations/page.tsx) | - | 中 |
| [crawler/page.tsx](src/app/crawler/page.tsx) | - | 中 |
| [page.tsx](src/app/page.tsx) | - | 中 |

### B. 术语表

| 术语 | 解释 |
|------|------|
| **RBAC** | Role-Based Access Control, 基于角色的访问控制 |
| **WAL** | Write-Ahead Logging, SQLite 的预写日志模式, 允许并发读写 |
| **FTS5** | Full-Text Search 5, SQLite 内置的全文搜索扩展 |
| **Zustand** | 轻量级 React 状态管理库 |
| **App Router** | Next.js 13+ 的文件系统路由方案 |
| **Server Component** | Next.js 服务端组件, 在服务器渲染, 不发送 JS 到客户端 |
| **Strategy Pattern** | 策略设计模式, 通过接口/基类统一不同算法的实现 |
| **Inverted Index** | 倒排索引, 从关键词到文档 ID 的映射, 用于快速检索 |
| **SSE** | Server-Sent Events, 服务器向客户端单向推送技术 |
| **Semaphore** | 信号量, 用于控制并发资源访问数量 |
| **Content Hash** | 内容哈希, 用于数据去重 |

### C. 技术栈参考

| 技术 | 版本 | 官方文档 |
|------|------|----------|
| Next.js | 15.x | https://nextjs.org/docs |
| React | 18.x | https://react.dev |
| TypeScript | 5.x | https://www.typescriptlang.org/docs |
| Zustand | 5.x | https://zustand.docs.pmnd.rs |
| better-sqlite3 | 11.x | https://github.com/WiseLibs/better-sqlite3 |
| Python | 3.13 | https://docs.python.org/3.13 |
| aiohttp | - | https://docs.aiohttp.org |
| Playwright | - | https://playwright.dev |
| BeautifulSoup4 | - | https://www.crummy.com/software/BeautifulSoup/bs4/doc |
| loguru | - | https://loguru.readthedocs.io |
| aiosqlite | - | https://aiosqlite.omnilib.dev |

---

> **免责声明**: 本报告基于静态代码分析生成, 部分性能数据和风险评估为推测性质。建议结合实际负载测试和生产监控数据进行验证。
>
> **报告生成工具**: AI-Assisted Code Analysis | **最后更新**: 2026-05-18
