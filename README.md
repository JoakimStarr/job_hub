# FinIntern Hub - 金融实习招聘平台

## 项目简介

FinIntern Hub 是一个基于 Next.js 和 Python 的金融实习招聘信息聚合平台。该平台通过智能爬虫系统从多所财经类高校就业网站采集实习和全职岗位信息，为用户提供统一的岗位搜索、收藏、AI 智能匹配、简历解析与诊断、AI 推荐咨询等一站式求职服务。

### 核心特性

- 🎯 **多源数据聚合**：支持 9 所财经类高校就业网站的数据采集
- 🚀 **高性能爬虫系统**：异步并发爬取，支持 HTTP API 和浏览器两种模式
- 🤖 **AI 智能匹配**：基于六维评分模型的简历-岗位智能匹配系统
- 📄 **简历解析**：支持 PDF 简历上传和自动解析提取关键信息
- 🧠 **AI 推荐系统**：岗位分析、投递助手、简历优化建议（支持 5 种大语言模型）
- 🔐 **增强认证**：基于 Token 的三级角色权限体系 (admin/operator/viewer)
- 🔍 **智能搜索**：支持关键词、地点、行业等多维度筛选，含层级筛选器
- 📊 **数据可视化**：岗位统计、趋势分析、热门关键词等数据展示
- 📋 **订阅系统**：自定义岗位订阅规则和命中预览
- 🎯 **简历诊断**：基于技能词典的 100 分制简历质量评估
- 🐳 **容器化部署**：支持 Docker 一键部署

---

## 技术架构

### 技术栈

#### 前端
| 技术 | 版本 | 说明 |
|------|------|------|
| Next.js | ^15.3.3 | App Router, Standalone 输出 |
| React | ^18.3.1 | 函数式组件 + Hooks |
| TypeScript | ^5.8.3 | 严格模式 |
| better-sqlite3 | ^11.10.0 | SQLite 数据库驱动 |
| zustand | ^5.0.13 | 轻量状态管理 |
| react-markdown | ^10.1.0 | Markdown 渲染 |

#### 后端爬虫
- **语言**: Python 3.13+
- **异步框架**: asyncio, aiosqlite
- **浏览器自动化**: Playwright (可选)
- **HTML 解析**: BeautifulSoup4
- **日志**: loguru

#### AI 服务（可选）
- **OpenAI**: GPT 系列
- **智谱 AI**: GLM-4
- **SiliconFlow**: Qwen2.5 等开源模型
- **DeepSeek**: deepseek-chat
- **自定义**: 兼容 OpenAI API 格式的任意服务

#### 部署
- **容器化**: Docker + docker-compose
- **运行时**: Node.js 20 Alpine

### 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                          用户界面层                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────┐ │
│  │ 首页     │ │ 岗位列表 │ │ 简历匹配 │ │ 智能推荐 │ │ 收藏  │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └───────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ 数据采集 │ │ 系统状态 │ │ 用户管理 │ │ 登录页面 │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       Next.js 应用层                             │
│  ┌──────────┐ ┌────────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ 页面组件 │ │ API 路由   │ │ 认证中间件│ │ 状态管理 (zustand)│ │
│  │ (9个页面)│ │ (30个端点) │ │ (RBAC)   │ │                    │ │
│  └──────────┘ └────────────┘ └──────────┘ └──────────────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │ 匹配引擎 │ │ 评分引擎 │ │简历解析器 │ │ AI 服务适配       │   │
│  │(6维评分) │ │(分级判定) │ │(正则提取) │ │(5种模型)          │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         数据存储层                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              SQLite 数据库 (jobs.db)                      │  │
│  │  - jobs 表 (岗位信息 + 收藏/已读状态)                     │  │
│  │  - crawl_logs 表 (爬虫日志)                              │  │
│  │  - users 表 (用户信息)                                   │  │
│  │  - subscriptions 表 (订阅规则)                            │  │
│  │  - match_history 表 (匹配历史)                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │ skill_dict.json │  │ major_sim.json │  │ user_profiles/  │  │
│  │ (技能词典)      │  │ (专业相似度)   │  │ (简历数据+上传) │  │
│  └────────────────┘  └────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↑
┌─────────────────────────────────────────────────────────────────┐
│                     Python 爬虫系统                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ HTTP API │ │ 浏览器   │ │ 数据清洗 │ │ 去重存储 │          │
│  │ 爬虫     │ │ 爬虫     │ │ 模块     │ │ 模块     │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              ↑
┌─────────────────────────────────────────────────────────────────┐
│                  数据源层 (9所高校)                              │
│  SUFE | ZUEL | CUFE | DUFE | SWUFE | UIBE | JXUFE | NEU        │
│                   | SmartEdu                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 目录结构

```
job_hub/
├── src/                                # 源代码目录
│   ├── app/                            # Next.js App Router
│   │   ├── api/                        # API 路由 (30 个端点)
│   │   │   ├── auth/                   # 认证模块
│   │   │   │   ├── login/route.ts      # POST   用户登录
│   │   │   │   ├── logout/route.ts     # POST   用户登出
│   │   │   │   ├── me/route.ts         # GET    获取当前用户
│   │   │   │   ├── roles/route.ts      # GET    获取角色列表
│   │   │   │   └── users/route.ts      # GET    获取用户列表
│   │   │   ├── crawler/                # 爬虫管理模块
│   │   │   │   ├── status/route.ts     # GET    爬虫运行状态
│   │   │   │   ├── sources/route.ts    # GET    数据源列表
│   │   │   │   └── logs/route.ts       # GET    爬虫日志
│   │   │   ├── jobs/                   # 岗位模块
│   │   │   │   ├── route.ts            # GET    岗位列表(分页+筛选)
│   │   │   │   ├── search/route.ts     # GET    岗位搜索
│   │   │   │   ├── filters/route.ts    # GET    筛选选项(地点/行业等)
│   │   │   │   ├── favorites/route.ts  # GET    收藏列表
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts        # GET/PATCH  岗位详情/更新
│   │   │   │       ├── favorite/route.ts # POST  切换收藏
│   │   │   │       └── ai-analysis/route.ts # POST AI岗位分析
│   │   │   ├── match/                  # 匹配模块
│   │   │   │   ├── jobs/route.ts       # POST   批量匹配
│   │   │   │   └── job/[id]/route.ts   # POST   单岗位匹配详情
│   │   │   ├── recommendations/        # 推荐模块
│   │   │   │   ├── analyze/route.ts    # POST   AI 岗位分析
│   │   │   │   ├── delivery-assistant/route.ts # POST 投递助手
│   │   │   │   ├── resume-advice/route.ts     # POST 简历建议
│   │   │   │   └── history/route.ts    # GET    推荐历史
│   │   │   ├── resume/                 # 简历模块
│   │   │   │   ├── parse/route.ts      # POST   简历文本解析
│   │   │   │   └── diagnose/route.ts   # POST   简历质量诊断
│   │   │   ├── system/                 # 系统管理模块
│   │   │   │   ├── status/route.ts     # GET    系统状态
│   │   │   │   ├── config/route.ts     # GET/PUT 配置中心
│   │   │   │   ├── subscriptions/
│   │   │   │   │   ├── route.ts        # GET/POST 订阅列表/创建
│   │   │   │   │   └── [id]/
│   │   │   │   │       ├── route.ts    # PUT/DELETE 更新/删除订阅
│   │   │   │   │       └── preview/route.ts # GET 命中预览
│   │   │   │   └── maintenance/
│   │   │   │       └── clean-history/route.ts # POST 清洗历史数据
│   │   │   └── stats/                  # 统计模块
│   │   │       ├── overview/route.ts   # GET    统计概览
│   │   │       └── route.ts            # GET    统计详情
│   │   ├── crawler/page.tsx            # 数据采集页面
│   │   ├── favorites/page.tsx          # 我的收藏页面
│   │   ├── jobs/page.tsx               # 岗位列表页面
│   │   ├── login/                      # 登录页面
│   │   │   ├── page.tsx
│   │   │   └── login-client.tsx
│   │   ├── match/                      # 简历匹配页面
│   │   │   ├── page.tsx
│   │   │   └── match.module.css
│   │   ├── recommendations/page.tsx    # 智能推荐页面
│   │   ├── system/page.tsx             # 系统状态页面
│   │   ├── users/page.tsx              # 用户管理页面
│   │   ├── globals.css                 # 全局样式
│   │   ├── layout.tsx                  # 根布局
│   │   ├── page.tsx                    # 首页
│   │   └── providers.tsx               # 全局 Provider
│   ├── components/                     # React 组件 (12个)
│   │   ├── app-shell.tsx               # 应用外壳（导航、侧边栏、权限）
│   │   ├── ui.tsx                      # UI 组件库
│   │   ├── HierarchicalFilter.tsx      # 层级筛选器
│   │   ├── MatchResults.tsx            # 匹配结果展示
│   │   ├── ResumeUploader.tsx          # 简历上传组件
│   │   ├── ResumeDiagnosis.tsx         # 简历诊断展示
│   │   ├── MarkdownRenderer.tsx        # Markdown 渲染器
│   │   ├── Pagination.tsx              # 分页组件
│   │   ├── Loading.tsx                 # 加载动画
│   │   ├── RefreshButton.tsx           # 刷新按钮
│   │   ├── ThemeToggle.tsx             # 主题切换
│   │   └── Toast.tsx                   # 轻提示
│   ├── lib/                            # 工具库 (12个核心模块)
│   │   ├── match-engine.ts             # 匹配引擎 (六维评分)
│   │   ├── score-engine.ts             # 评分引擎 (分级判定+建议)
│   │   ├── resume-parser.ts            # 简历解析器 (正则提取)
│   │   ├── resume-types.ts             # 简历类型定义
│   │   ├── ai-service.ts               # AI 服务适配 (5种模型)
│   │   ├── api-response.ts             # API 响应标准化
│   │   ├── api.ts                      # API 客户端封装
│   │   ├── auth.ts                     # 认证工具 (Token验证+RBAC)
│   │   ├── db-utils.ts                 # 数据库工具 (连接池+查询构建)
│   │   ├── logger.ts                   # 日志服务
│   │   ├── constants.ts                # 常量定义 (导航/阈值/映射)
│   │   └── types.ts                    # TypeScript 类型定义
│   ├── store/index.ts                  # Zustand 状态管理
│   ├── spiders/                        # Python 爬虫系统
│   │   ├── __init__.py
│   │   ├── base.py                     # 爬虫基类
│   │   ├── unified_spider.py           # 统一爬虫实现
│   │   ├── spider_configs.py           # 爬虫配置 (9个数据源)
│   │   ├── crawler.py                  # 并发爬虫管理器
│   │   ├── database.py                 # 数据库操作类
│   │   ├── run.py                      # 爬虫运行入口
│   │   ├── browser_wrapper.py          # 浏览器爬虫封装
│   │   ├── cache.py                    # 缓存管理
│   │   ├── connection_pool.py          # 连接池管理
│   │   ├── constants.py                # 爬虫常量
│   │   ├── incremental.py              # 增量爬取策略
│   │   ├── jxufe_spider.py             # 江西财经大学爬虫
│   │   ├── lite_spider.py              # 轻量级爬虫
│   │   ├── logger.py                   # 日志配置
│   │   ├── performance_spider.py       # 性能优化爬虫
│   │   ├── uibe.py                     # 对外经贸大学爬虫
│   │   └── utils.py                    # 工具函数
│   ├── styles/                         # 样式文件
│   │   ├── variables.css
│   │   ├── layout.css
│   │   ├── components.css
│   │   └── auth.css
│   └── types/index.ts                  # 全局类型导出
├── data/                               # 数据目录
│   ├── jobs.db                         # SQLite 主数据库
│   ├── skill_dictionary.json           # 技能词典 (金融/技术/软技能/证书/语言/院校)
│   ├── major_similarity.json           # 专业相似度矩阵
│   ├── filter_cache.json               # 筛选选项缓存
│   ├── recommendation_weight_profiles.json # 推荐权重配置
│   ├── quality_metrics_1.json          # 质量指标
│   └── user_profiles/                  # 用户简历数据
│       ├── records/                    # 解析后的简历记录 (60+份)
│       └── uploads/                    # 上传的原始 PDF 简历
├── docs/plans/                         # 设计文档
│   └── 2026-05-16-resume-matching-design.md
├── scripts/                            # 工具脚本
│   ├── clean_data.js                   # 数据清洗
│   ├── clean_locations.js / .ts / _v2.js
│   └── init_location_mapping.js
├── log/                                # 应用日志
├── logs/                               # 爬虫日志
├── output/                             # 输出目录
│   └── visited_urls.json               # 已访问 URL 记录
├── public/                             # 静态资源
├── .dockerignore
├── .env.ai.example                     # AI 环境变量示例
├── .gitignore
├── .npmrc
├── Dockerfile
├── docker-compose.yml
├── next.config.ts
├── package.json
├── tsconfig.json
├── create_test_db.py
├── init_db.py
├── run_spiders.py                      # 爬虫启动脚本
├── run_browser_spiders.py              # 浏览器爬虫启动脚本
├── lite_crawler.py                     # 轻量级爬虫
└── README.md
```

---

## 核心模块详解

### 1. 前端模块 (src/app, src/components, src/lib)

#### 1.1 页面路由 (src/app)

| 路径 | 功能 | 权限要求 |
|------|------|----------|
| `/` | 首页，展示统计数据和热门关键词 | `view_stats` |
| `/jobs` | 岗位列表，支持多维度搜索和层级筛选 | `view_jobs` |
| `/match` | 简历匹配，四步向导流程 | `view_jobs` |
| `/favorites` | 收藏中心，管理收藏的岗位 | `view_jobs` |
| `/crawler` | 数据采集，启动/停止爬虫任务 | `manage_crawler` |
| `/system` | 系统状态，配置/订阅/数据清洗 | `view_system` |
| `/recommendations` | 智能推荐，AI 分析与咨询 | `use_recommendations` |
| `/users` | 用户管理，账号与权限管理 | `manage_users` |
| `/login` | 登录页面 | 无 |

#### 1.2 API 路由完整表 (30 个端点)

##### 认证 API (`/api/auth/*`)

| 方法 | 路径 | 功能 | 权限 |
|------|------|------|------|
| POST | `/api/auth/login` | 用户登录 (Token 认证) | 无 |
| POST | `/api/auth/logout` | 用户登出 | 无 |
| GET | `/api/auth/me` | 获取当前用户信息 | 已认证 |
| GET | `/api/auth/roles` | 获取角色列表 | `users:read` |
| GET | `/api/auth/users` | 获取用户列表 | `users:read` |

##### 岗位 API (`/api/jobs/*`)

| 方法 | 路径 | 功能 | 权限 |
|------|------|------|------|
| GET | `/api/jobs` | 岗位列表 (分页+7维度筛选) | 无 |
| GET | `/api/jobs/search` | 岗位搜索 | 无 |
| GET | `/api/jobs/filters` | 筛选选项 (地点/行业/类型/学历/来源) | 无 |
| GET | `/api/jobs/favorites` | 收藏列表 (分页+搜索) | 无 |
| GET | `/api/jobs/[id]` | 岗位详情 | 无 |
| PATCH | `/api/jobs/[id]` | 更新岗位 (收藏/已读) | 无 |
| POST | `/api/jobs/[id]/favorite` | 切换收藏状态 | 无 |
| POST | `/api/jobs/[id]/ai-analysis` | AI 岗位分析 (含 Mock 降级) | 无 |

##### 匹配 API (`/api/match/*`)

| 方法 | 路径 | 功能 | 权限 |
|------|------|------|------|
| POST | `/api/match/jobs` | 批量匹配 (简历 vs 全部岗位) | 已认证 |
| POST | `/api/match/job/[id]` | 单岗位深度匹配 (含建议+行动计划) | 已认证 |

##### 推荐 API (`/api/recommendations/*`)

| 方法 | 路径 | 功能 | 权限 |
|------|------|------|------|
| POST | `/api/recommendations/analyze` | AI 岗位分析 (结合匹配分数) | 已认证 |
| POST | `/api/recommendations/delivery-assistant` | AI 投递策略助手 | 已认证 |
| POST | `/api/recommendations/resume-advice` | AI 简历优化建议 | 已认证 |
| GET | `/api/recommendations/history` | 推荐历史记录 | 无 |

##### 简历 API (`/api/resume/*`)

| 方法 | 路径 | 功能 | 权限 |
|------|------|------|------|
| POST | `/api/resume/parse` | 简历文本解析 (提取结构化信息) | 无 |
| POST | `/api/resume/diagnose` | 简历质量诊断 (100分制评估) | 无 |

##### 系统管理 API (`/api/system/*`)

| 方法 | 路径 | 功能 | 权限 |
|------|------|------|------|
| GET | `/api/system/status` | 系统状态概览 | 无 |
| GET | `/api/system/config` | 获取系统配置 | 无 |
| PUT | `/api/system/config` | 更新系统配置 | `system:write` |
| GET | `/api/system/subscriptions` | 订阅规则列表 | 无 |
| POST | `/api/system/subscriptions` | 创建订阅规则 | `system:write` |
| PUT | `/api/system/subscriptions/[id]` | 更新订阅规则 | `system:write` |
| DELETE | `/api/system/subscriptions/[id]` | 删除订阅规则 | `system:write` |
| GET | `/api/system/subscriptions/[id]/preview` | 订阅命中预览 (最新20条) | 无 |
| POST | `/api/system/maintenance/clean-history` | 清洗历史数据 (按创建时间升序删除) | `system:write` |

##### 爬虫 API (`/api/crawler/*`)

| 方法 | 路径 | 功能 | 权限 |
|------|------|------|------|
| GET | `/api/crawler/status` | 爬虫运行状态 | 无 |
| GET | `/api/crawler/sources` | 数据源列表 (含类型) | 无 |
| GET | `/api/crawler/logs` | 爬虫日志 (最近N条) | 无 |

##### 统计 API (`/api/stats/*`)

| 方法 | 路径 | 功能 | 权限 |
|------|------|------|------|
| GET | `/api/stats/overview` | 统计概览 (总数/收藏/今日/来源分布/热词) | 无 |
| GET | `/api/stats` | 统计详情 (来源/类型/地区分布) | 无 |

#### 1.3 组件库 (src/components)

| 组件 | 功能 |
|------|------|
| **AppShell** | 应用外壳：侧边栏导航 + 顶部栏 + 权限检查 + 布局容器 |
| **UI** | 基础组件: MetricCard, JobCard, Badge, Button, Skeleton, EmptyState, SectionCard |
| **HierarchicalFilter** | 层级筛选器: 省→市→区三级联动，拼音搜索 |
| **MatchResults** | 匹配结果展示: 分数条 + 分级标签 + 维度明细 |
| **ResumeUploader** | 简历上传: PDF 文件选择 + 文本提取 + 解析预览 |
| **ResumeDiagnosis** | 简历诊断: 分数仪表盘 + 亮点/风险/缺口/建议 |
| **MarkdownRenderer** | Markdown 渲染: 支持 AI 回复中的代码块和表格 |
| **Pagination** | 分页组件 |
| **Loading** | 加载骨架屏动画 |
| **RefreshButton** | 带旋转动画的刷新按钮 |
| **ThemeToggle** | 明暗主题切换 |
| **Toast** | 轻提示消息 |

#### 1.4 核心工具库 (src/lib)

| 模块 | 功能 |
|------|------|
| **match-engine.ts** | 匹配引擎: 六维评分 (技能30% + 学历20% + 专业15% + 地点10% + 经验15% + 行业10%) |
| **score-engine.ts** | 评分引擎: 分级判定 (冲刺/匹配/潜力/挑战岗) + 改进建议 + 行动计划 |
| **resume-parser.ts** | 简历解析器: 正则提取姓名/电话/邮箱/教育/技能/实习/项目/证书/语言 |
| **resume-types.ts** | 简历类型: ResumeProfile, MatchScore, MatchResult, ResumeDiagnosis, ParseResult |
| **ai-service.ts** | AI 服务适配: OpenAI/智谱/SiliconFlow/DeepSeek/自定义 五种 provider |
| **api-response.ts** | API 响应标准化: 错误处理 + 分页校验 + 统一响应格式 |
| **api.ts** | API 客户端封装: 所有前端 API 调用方法 |
| **auth.ts** | 认证工具: Token 验证 + SHA256 哈希 + RBAC 权限检查 |
| **db-utils.ts** | 数据库工具: 连接池单例 + WHERE 子句构建器 + 来源名/URL 解析 |
| **logger.ts** | 结构化日志: info/warn/error/api 四级别 + 性能计时 |
| **constants.ts** | 常量: 导航项 (9个) + 分数阈值 + 诊断等级 + 来源映射 |
| **types.ts** | 全局类型: JobItem, PagedResponse, StatsOverview, SystemStatus 等 |

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
cd job_hub
```

#### 2. 安装前端依赖

```bash
npm install
```

#### 3. 安装 Python 依赖

```bash
pip install -r requirements.txt
```

#### 4. 安装 Playwright (可选)

```bash
pip install playwright
playwright install chromium
```

#### 5. 配置环境变量

```bash
# 复制 AI 配置示例
cp .env.ai.example .env.local

# 编辑 .env.local，配置以下变量:
# ADMIN_TOKEN=your-admin-token
# OPERATOR_TOKEN=your-operator-token
# VIEWER_TOKEN=your-viewer-token
# AI_PROVIDER=siliconflow  # 或 openai/zhipu/deepseek/custom
# AI_API_KEY=your-api-key
```

#### 6. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

#### 7. 运行爬虫

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

# 认证 Token (必填)
ADMIN_TOKEN=your-secret-admin-token
OPERATOR_TOKEN=your-operator-token
VIEWER_TOKEN=your-viewer-token

# AI 服务配置 (可选)
AI_PROVIDER=siliconflow        # openai | zhipu | siliconflow | deepseek | custom
AI_API_KEY=your-api-key
AI_BASE_URL=https://api.example.com/v1  # 仅 custom 类型需要
AI_MODEL=qwen/Qwen2.5-7B-Instruct
AI_TEMPERATURE=0.7
AI_MAX_TOKENS=2000
```

### Next.js 配置

[next.config.ts](next.config.ts) 关键配置：

```typescript
{
  output: 'standalone',          // 独立输出，用于 Docker 部署
  reactStrictMode: true,         // React 严格模式
  rewrites: async () => [...]    // API 代理配置
}
```

### 爬虫配置

爬虫配置位于 [src/spiders/spider_configs.py](src/spiders/spider_configs.py)，采用配置驱动架构：

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
            },
        ],
        "field_mapping": {
            "title": "zpzt",
            "company": "dwmc",
        },
    },
}
```

---

## 功能模块

### 1. 用户认证与权限管理 (增强版)

- **认证方式**: 基于 Token 的静态认证 (SHA256 哈希验证)
- **权限体系**: RBAC 三级角色模型

#### 角色与权限矩阵

| 权限 | admin | operator | viewer |
|------|-------|----------|--------|
| view_jobs | ✅ | ✅ | ✅ |
| view_stats | ✅ | ✅ | ✅ |
| manage_crawler | ✅ | ✅ | ❌ |
| view_system | ✅ | ✅ | ✅ |
| use_recommendations | ✅ | ✅ | ✅ |
| manage_users | ✅ | ❌ | ❌ |
| jobs:read/write | ✅ | ✅ | ✅/❌ |
| crawler:read/write | ✅ | ✅ | ✅/❌ |
| system:read/write | ✅ | ❌/✅ | ✅/❌ |
| users:read/write | ✅ | ❌/✅ | ❌ |
| recommendations:read/write | ✅ | ✅ | ✅/❌ |
| match:read/write | ✅ | ✅ | ✅/❌ |

### 2. 岗位管理

- **多维搜索**: 关键词 + 地点(省市区三级) + 行业 + 学历 + 岗位类型 + 数据源
- **层级筛选器**: 省→市→区联动，支持拼音首字母搜索
- **岗位详情**: 完整信息 + AI 分析 (Mock 降级保障)
- **收藏功能**: 一键收藏/取消，独立收藏列表
- **已读标记**: 自动标记已读状态

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

### 4. 简历匹配系统 (全新)

#### 四步向导流程

```
上传简历 (PDF/文本) → 确认解析结果 → 选择筛选条件 → 查看匹配结果
```

#### 六维评分模型

| 维度 | 权重 | 满分 | 说明 |
|------|------|------|------|
| 技能匹配 | 30% | 30 | 岗位要求的技能与候选人技能的重叠度 |
| 学历匹配 | 20% | 20 | 岗位学历要求与候选人最高学历的匹配度 |
| 专业匹配 | 15% | 15 | 基于专业相似度矩阵的专业相关性 |
| 地点匹配 | 10% | 10 | 工作地点与候选人意向地点的一致性 |
| 经验匹配 | 15% | 15 | 实习/工作经历与岗位经验要求的匹配度 |
| 行业匹配 | 10% | 10 | 目标行业与候选人背景的行业相关性 |

#### 分级判定标准

| 等级 | 分数范围 | 含义 | 建议 |
|------|---------|------|------|
| 冲刺岗 | ≥85分 | 高度匹配，强烈推荐 | 优先投递，把握机会 |
| 匹配岗 | ≥70分 | 较好匹配，可以尝试 | 尽快投递，补充相关技能 |
| 潜力岗 | ≥55分 | 有一定差距，但有潜力 | 补充能力后投递，关注类似岗位 |
| 挑战岗 | <55分 | 匹配度较低 | 先提升能力，寻找更匹配的岗位 |

### 5. AI 推荐系统 (全新)

#### 多模型支持

| Provider | 默认模型 | 适用场景 |
|----------|---------|---------|
| OpenAI | gpt-4/o 系列 | 高质量分析，成本较高 |
| 智谱 AI | GLM-4 | 中文场景优化 |
| SiliconFlow | Qwen2.5-7B | 开源免费，性价比高 |
| DeepSeek | deepseek-chat | 深度推理能力强 |
| Custom | 自定义 | 兼容 OpenAI API 格式的任意服务 |

#### 三大功能

1. **岗位 AI 分析** (`/api/recommendations/analyze`)
   - 结合六维匹配分数进行深度分析
   - 自动注入匹配度数据到 AI Prompt
   - 提供优劣势分析和面试准备建议

2. **投递策略助手** (`/api/recommendations/delivery-assistant`)
   - 投递时机选择建议
   - 投递渠道推荐
   - 跟进技巧指导

3. **简历优化建议** (`/api/recommendations/resume-advice`)
   - 简历结构优化
   - 内容表达优化
   - 关键词优化

> **Mock 降级策略**: 当 AI 服务未配置或请求失败时，系统自动返回预设的专业回复，确保功能可用性。

### 6. 简历解析与诊断 (全新)

#### 简历解析 (`/api/resume/parse`)

- **输入**: 纯文本 (50 ~ 100,000 字符)
- **输出**: 结构化的 `ResumeProfile` 对象
- **提取字段**:
  - 基本信息: 姓名、电话、邮箱
  - 教育背景: 学校、专业、学位、时间段 (正则日期识别)
  - 技能清单: 基于 skill_dictionary.json 的金融/技术/软技能
  - 实习经历: 公司、职位、时间段、时长计算
  - 项目经验: 项目名称、角色、描述
  - 证书资质: CFA/CPA/FRM/ACCA 等
  - 语言能力
- **置信度评估**: 5 项指标 (0~1)

#### 简历诊断 (`/api/resume/diagnose`)

- **评分体系**: 100 分制
- **评分维度**:
  - 教育背景: 最高 20 分 (识别顶尖/财经类院校加分)
  - 技能丰富度: 最高 25 分 (每项技能 +3 分，上限 25)
  - 实习经历: 最高 20 分 (2段以上实习额外加分)
  - 项目经验: 最高 15 分
  - 专业证书: 最高 10 分
  - 完整性: 最高 10 分 (联系方式 + 内容长度)
- **输出内容**:
  - 总分 + 亮点 (highlights)
  - 风险提示 (risks)
  - 能力缺口 (gaps)
  - 改进建议 (suggestions)

### 7. 数据统计

- **概览统计**: 总岗位数、收藏数、今日新增、数据源数量
- **来源分布**: 各数据源的岗位占比
- **热门关键词**: 金融领域高频词 Top 10
- **最新岗位**: 最近发布的 6 条岗位
- **详细统计**: 来源/类型/地区分布图表数据

### 8. 系统管理 (扩展)

#### 配置中心 (`/api/system/config`)

- JSON 编辑器界面
- 支持应用名称、版本、爬虫参数、AI 参数配置
- 修改需 `system:write` 权限

#### 订阅管理 (`/api/system/subscriptions`)

完整的 CRUD 操作:
- **创建**: 设置名称 + 关键词 + 地点/行业/类型/学历过滤条件
- **查看**: 所有订阅规则列表
- **更新**: 修改任意字段
- **删除**: 移除订阅规则
- **命中预览**: 查看某订阅规则当前命中的最新 20 条岗位

#### 数据清洗 (`/api/system/maintenance/clean-history`)

- 按创建时间升序删除最早的 N 条记录 (默认 500 条，最大 5000 条)
- 返回删除前后的总数对比
- 需 `system:write` 权限

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
Response: { success: true }

// 获取角色列表
GET /api/auth/roles
Response: [{ id: 'admin', name: '管理员' }, ...]

// 获取用户列表
GET /api/auth/users
Response: AppUser[]
```

### 岗位 API

```typescript
// 获取岗位列表 (支持7种筛选条件)
GET /api/jobs?page=1&page_size=12&keyword=财务&location=北京&job_type=实习&industry=证券&education=本科&source=sufe
Response: PagedResponse<JobItem>

// 岗位搜索
GET /api/jobs/search?q=分析师&page=1&page_size=12
Response: { items, total, page, page_size, pages }

// 获取筛选选项
GET /api/jobs/filters
Response: { locations, job_types, industries, education, sources, provinces }

// 获取岗位详情
GET /api/jobs/{id}
Response: JobItem

// 更新岗位状态 (收藏/已读)
PATCH /api/jobs/{id}
Body: { is_favorite?: boolean, is_read?: boolean }
Response: { success: true }

// 切换收藏状态
POST /api/jobs/{id}/favorite
Response: { success: true, data: { is_favorite: boolean } }

// 获取收藏列表
GET /api/jobs/favorites?page=1&page_size=12&keyword=财务
Response: PagedResponse<JobItem>

// AI 岗位分析 (支持 Mock 降级)
POST /api/jobs/{id}/ai-analysis
Body: { profile?: ResumeProfile }
Response: { score, recommendation, suggestions, risks, action_plan }
```

### 匹配 API

```typescript
// 批量匹配 (简历 vs 全部岗位)
POST /api/match/jobs
Body: {
  profile: ResumeProfile,
  filters?: { location?, jobType?, industry?, maxResults? }
}
Response: { matches: MatchResult[], total, processingTime }

// 单岗位深度匹配
POST /api/match/job/{id}
Body: { profile: ResumeProfile }
Response: {
  score: MatchScore,
  recommendation: string,       // "冲刺岗" | "匹配岗" | "潜力岗" | "挑战岗"
  suggestions: string[],
  actionPlan: string[],
  matchColor: string,           // 十六进制颜色值
  priority: 'high' | 'medium' | 'low'
}
```

### 推荐 API

```typescript
// AI 岗位分析 (自动注入匹配分数)
POST /api/recommendations/analyze
Body: { job_id?: number, profile?: string, prompt?: string }
Response: { result: string, model: string, usage: object }

// 投递策略助手
POST /api/recommendations/delivery-assistant
Body: { profile?: string, prompt?: string }
Response: { result: string, model: string, usage: object }

// 简历优化建议
POST /api/recommendations/resume-advice
Body: { profile?: string, prompt?: string }
Response: { result: string, model: string, usage: object }

// 推荐历史
GET /api/recommendations/history?limit=10
Response: { history: MatchHistoryItem[], total }
```

### 简历 API

```typescript
// 简历文本解析
POST /api/resume/parse
Body: { text: string }           // 50 ~ 100,000 字符
Response: ParseResult            // { profile, confidence, warnings[] }

// 简历质量诊断
POST /api/resume/diagnose
Body: { profile: ResumeProfile }
Response: ResumeDiagnosis         // { score, highlights[], risks[], gaps[], suggestions[] }
```

### 系统管理 API

```typescript
// 系统状态
GET /api/system/status
Response: SystemStatus

// 配置中心
GET /api/system/config
PUT /api/system/config
Body: { app?, crawler?, ai? }

// 订阅 CRUD
GET /api/system/subscriptions
POST /api/system/subscriptions
Body: { name, keyword?, locations?, industries?, job_types?, education? }
PUT /api/system/subscriptions/{id}
DELETE /api/system/subscriptions/{id}

// 订阅命中预览
GET /api/system/subscriptions/{id}/preview
Response: JobItem[]  // 最新 20 条命中岗位

// 数据清洗
POST /api/system/maintenance/clean-history?limit=500
Response: { success, deleted, total_before, total_after }
```

### 爬虫 API

```typescript
// 爬虫状态
GET /api/crawler/status
Response: CrawlerStatus

// 数据源列表
GET /api/crawler/sources
Response: [{ key, name, enabled, type }]

// 爬虫日志
GET /api/crawler/logs?limit=50
Response: LogEntry[]
```

### 统计 API

```typescript
// 统计概览
GET /api/stats/overview
Response: StatsOverview

// 统计详情
GET /api/stats
Response: { total_jobs, favorite_jobs, read_jobs, source_stats, job_type_stats, location_stats, recent_jobs }
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

### 添加新的 AI 推荐功能

1. 在 `src/lib/ai-service.ts` 中确认所需 AI 能力已支持（或新增 provider）

2. 创建 API 路由:

```typescript
// src/app/api/recommendations/new-feature/route.ts
import { aiService } from '@/lib/ai-service';
import { requireAuth, AuthError } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    requireAuth(request);

    if (!aiService) {
      return NextResponse.json(
        { error: 'AI服务未配置' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const response = await aiService.chat([
      { role: 'system', content: '你的系统提示词' },
      { role: 'user', content: body.prompt },
    ]);

    return NextResponse.json({ result: response.content });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('错误:', error);
    return handleApiError(error, { path: '/api/recommendations/new-feature' });
  }
}
```

3. 在前端调用即可。

### 添加新的匹配维度

1. 在 [match-engine.ts](src/lib/match-engine.ts) 的 `MatchEngine` 类中添加新方法:

```typescript
private matchNewDimension(profile: ResumeProfile, job: JobItem): number {
  // 实现匹配逻辑
  return score; // 返回 0 ~ maxScore 的分数
}
```

2. 在 `match()` 方法中调用并加入 breakdown:

```typescript
const breakdown = {
  // ...现有维度
  newDimension: this.matchNewDimension(profile, job),
};
```

3. 在 `calculateTotalScore()` 中添加权重:

```typescript
const weights = {
  // ...现有权重
  newDimension: 0.05, // 新维度权重
};
```

4. 在 [score-engine.ts](src/lib/score-engine.ts) 中补充对应的建议生成逻辑。

### 添加新数据源

1. 在 `src/spiders/spider_configs.py` 中添加配置:

```python
SPIDER_CONFIGS = {
    "new_source": {
        "name": "new_source_jobs",
        "university": "新数据源名称",
        "base_url": "https://example.com",
        "spider_type": "api_post",
        "list_url": "/api/jobs",
        "detail_url": "/api/jobs/{id}",
        "field_mapping": {
            "title": "jobTitle",
            "company": "companyName",
        },
    }
}
```

2. 在 `src/lib/constants.ts` 中添加数据源名称:

```python
SOURCE_NAME_MAP = {
    "new_source": "新数据源名称",
}
```

3. 测试:

```bash
python3 run_spiders.py --sources new_source --max-items 10
```

### 添加新页面

1. 在 `src/app/` 下创建页面目录:

```bash
mkdir src/app/new-page
touch src/app/new-page/page.tsx
```

2. 编写页面组件:

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

3. 在 `src/lib/constants.ts` 中添加导航项:

```typescript
export const NAV_ITEMS: NavItem[] = [
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

创建 `.env` 文件:

```bash
NEXT_PUBLIC_API_URL=/api
API_BACKEND_URL=http://host.docker.internal:8080
NEXT_APP_PORT=3001
ADMIN_TOKEN=your-admin-token
OPERATOR_TOKEN=your-operator-token
VIEWER_TOKEN=your-viewer-token
AI_PROVIDER=siliconflow
AI_API_KEY=your-api-key
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

使用 Nginx 或其他反向代理服务器:

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
- ✅ 筛选选项缓存 (filter_cache.json)
- ✅ 层级筛选器按需加载城市数据
- ✅ CSS Modules 避免全局样式冲突

### 匹配引擎优化

- ✅ 批量匹配时限制最大返回数量 (MAX_MATCH_RESULTS = 50)
- ✅ 内存中排序后截断，减少网络传输
- ✅ 专业相似度预加载 (major_similarity.json)

### AI 服务优化

- ✅ Mock 降级策略，避免 AI 不可用时功能完全不可用
- ✅ 可配置 temperature 和 max_tokens 控制成本
- ✅ 统一的 chat 接口抽象，切换模型零代码改动

### 爬虫优化

- ✅ 异步并发爬取
- ✅ 浏览器爬虫并发数限制
- ✅ 批量数据库写入
- ✅ URL 去重缓存
- ✅ 增量爬取策略
- ✅ 运行时间限制

### 数据库优化

- ✅ 单例连接池 (getDb)
- ✅ 参数化查询防 SQL 注入
- ✅ WHERE 子句动态构建器 (buildJobWhereClause)
- ✅ 索引优化 (source_url, company, publish_date)
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

### 4. AI 服务不可用

**问题**: AI 推荐功能返回 "AI服务未配置"

**解决方案**:
- 检查 `.env.local` 中是否配置了 `AI_API_KEY`
- 确认 `AI_PROVIDER` 值正确 (siliconflow/openai/zhipu/deepseek/custom)
- 如使用 custom 类型，需同时配置 `AI_BASE_URL` 和 `AI_MODEL`
- 未配置 AI 时，岗位分析等功能会自动降级为 Mock 模式

### 5. 简历解析不准确

**问题**: 解析结果缺少某些字段

**解决方案**:
- 确保输入文本长度 ≥ 50 字符
- 检查简历格式是否符合中文简历常见模板
- 解析 warnings 字段查看具体哪些字段未能识别
- 可手动编辑解析结果后再进行匹配

### 6. 匹配分数偏低

**问题**: 大部分岗位匹配分数在 40~60 分之间

**解决方案**:
- 这是正常现象，六维评分模型较为严格
- 55~70 分为"潜力岗"，表示有基本匹配度
- ≥70 分为"匹配岗"，属于较好的匹配结果
- 可通过补充技能描述、详细实习经历来提高匹配分数

---

## 许可证

本项目仅供学习和研究使用。

---

## 联系方式

如有问题或建议，请提交 Issue 或 Pull Request。

---

## 更新日志

### v7.3.0 (2026-05-18) — 当前版本

- ✨ 新增 AI 智能匹配引擎 (六维评分模型: 技能/学历/专业/地点/经验/行业)
- ✨ 新增简历解析功能 (PDF 文本提取 + 正则解析 + 结构化输出)
- ✨ 新增简历诊断功能 (基于 skill_dictionary.json 的 100 分制质量评估)
- ✨ 新增 AI 推荐系统 (支持 OpenAI/智谱/SiliconFlow/DeepSeek/自定义 5 种模型)
- ✨ 新增三大 AI 功能: 岗位分析、投递助手、简历优化建议
- ✨ 新增订阅系统和命中预览 (完整 CRUD)
- ✨ 增强认证系统 (RBAC 三级角色: admin/operator/viewer，细粒度权限控制)
- ✨ 新增系统管理页面 (配置中心 JSON 编辑器 / 订阅管理 / 数据清洗)
- ✨ 新增简历匹配页面 (/match) 四步向导流程
- ✨ 新增智能推荐页面 (/recommendations) 多 tab AI 对话界面
- ✨ 新增层级筛选器组件 (省→市→区三级联动 + 拼音搜索)
- ✨ 新增 AI 岗位分析接口 (Mock 降级策略保障可用性)
- ✨ 新增岗位搜索和独立筛选选项 API
- ✨ 重构 API 路由架构 (从 6 个端点扩展到 30 个端点)
- 🔄 重构数据库工具层 (连接池单例 + 动态 WHERE 构建器 + URL 解析)
- 🔄 新增 12 个核心 lib 模块 (match-engine, score-engine, resume-parser, ai-service 等)
- 🔄 新增 6 个业务组件 (MatchResults, ResumeUploader, ResumeDiagnosis, MarkdownRenderer 等)
- 🐛 修复多个性能和安全问题

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
