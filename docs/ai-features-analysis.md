# FinIntern Hub AI 功能分析报告

> 分析日期：2026-05-21  
> 项目版本：v7.10.0  
> 技术栈：Next.js 15 + SQLite + Python 爬虫

---

## 一、现有 AI 基础设施

### 1.1 AI 服务核心层

| 组件 | 文件 | 状态 |
|------|------|------|
| 多供应商AI服务 | [ai-service.ts](../src/lib/ai-service.ts) | ✅ 已实现 |
| AI配置（环境变量） | [.env.ai.example](../.env.ai.example) | ✅ 已定义 |

**支持的 AI 供应商：**
- OpenAI（`https://api.openai.com/v1`）
- 智谱（`https://open.bigmodel.cn/api/paas/v4`）
- SiliconFlow（`https://api.siliconflow.cn/v1`）
- DeepSeek（`https://api.deepseek.com/v1`）
- Custom（自定义 `baseUrl`）

**环境变量：**
```
AI_PROVIDER    — 供应商（默认 siliconflow）
AI_API_KEY     — API密钥（必填）
AI_BASE_URL    — 自定义地址
AI_MODEL       — 模型名
AI_TEMPERATURE — 温度（默认 0.7）
AI_MAX_TOKENS  — 最大Token（默认 2000）
```

---

## 二、已实现的 AI 功能

### 2.1 职位AI分析

| 属性 | 内容 |
|------|------|
| 路径 | `POST /api/jobs/[id]/ai-analysis` |
| 实现文件 | [route.ts](../src/app/api/jobs/%5Bid%5D/ai-analysis/route.ts) |
| 类型 | ✅ **已实现**（AI + Mock 降级） |
| 核心调用 | 调用 `aiService.chat()`，失败时回退 `generateMockAnalysis()` |

**功能描述：**
- 对单个职位进行深度分析
- 支持传入简历 profile 进行人岗匹配度分析
- 返回结构化 JSON：评分（总分/技能/学历/匹配率）、推荐等级、建议列表、风险列表、行动计划

**System Prompt 角色：** 专业职业分析师

---

### 2.2 智能推荐分析

| 属性 | 内容 |
|------|------|
| 路径 | `POST /api/recommendations/analyze` |
| 实现文件 | [route.ts](../src/app/api/recommendations/analyze/route.ts) |
| 类型 | ✅ **已实现**（AI + 规则引擎） |
| 核心依赖 | `matchEngine`, `scoreEngine`, `aiService` |

**功能描述：**
- 结合职位信息和用户画像进行全面匹配度分析
- 先用规则引擎（match-engine + score-engine）计算各维度分数
- 将规则计算结果作为 AI 的上下文输入
- AI 生成综合评估和建议

**System Prompt 角色：** 金融行业求职顾问

**规则引擎维度（[match-engine.ts](../src/lib/match-engine.ts)）：**
| 维度 | 权重 | 描述 |
|------|------|------|
| Skills（技能） | 30% | 技能关键词匹配 |
| Education（学历） | 20% | 学历等级匹配 |
| Major（专业） | 15% | 专业相似度矩阵 |
| Location（地点） | 10% | 工作地点匹配 |
| Experience（经验） | 15% | 实习经验匹配 |
| Industry（行业） | 10% | 行业关键词匹配 |

**评分等级（[score-engine.ts](../src/lib/score-engine.ts)）：**
- ≥85：冲刺岗（Sprint Position）
- ≥70：匹配岗（Match Position）
- ≥55：潜力岗（Potential Position）
- <55：挑战岗（Challenge Position）

---

### 2.3 简历解析

| 属性 | 内容 |
|------|------|
| 路径 | `POST /api/resume/parse` |
| 实现文件 | [route.ts](../src/app/api/resume/parse/route.ts) |
| 类型 | ✅ **已实现**（规则引擎） |
| 核心文件 | [resume-parser.ts](../src/lib/resume-parser.ts) |

**功能描述：**
- 解析简历文本提取结构化信息
- **基于正则和关键词匹配，不使用 AI 模型**
- 提取字段：姓名、电话、邮箱、教育背景、技能、实习经历、项目经历、证书、语言
- 返回解析置信度（confidence）和警告（warnings）

**知识库：** [skill_dictionary.json](../data/skill_dictionary.json)
- 金融、技术、软技能词典
- 证书列表、语言列表
- 大学排名分类（顶尖院校、财经类院校）

---

### 2.4 简历诊断

| 属性 | 内容 |
|------|------|
| 路径 | `POST /api/resume/diagnose` |
| 实现文件 | [route.ts](../src/app/api/resume/diagnose/route.ts) |
| 类型 | ✅ **已实现**（规则引擎） |

**功能描述：**
- 评估简历完整度和质量
- 评分制（0-100）
- 返回：亮点、风险、缺口、改进建议
- 使用大学排名信息进行加分

---

### 2.5 简历建议（AI）

| 属性 | 内容 |
|------|------|
| 路径 | `POST /api/recommendations/resume-advice` |
| 实现文件 | [route.ts](../src/app/api/recommendations/resume-advice/route.ts) |
| 类型 | ✅ **已实现**（AI 驱动） |

**功能描述：**
- AI 分析简历内容并给出优化建议
- 覆盖：简历结构优化、内容表达、关键词优化、亮点突出、常见错误避免
- 支持用户自定义问题

**System Prompt 角色：** 简历优化顾问

---

### 2.6 投递助手（AI）

| 属性 | 内容 |
|------|------|
| 路径 | `POST /api/recommendations/delivery-assistant` |
| 实现文件 | [route.ts](../src/app/api/recommendations/delivery-assistant/route.ts) |
| 类型 | ✅ **已实现**（AI 驱动） |

**功能描述：**
- AI 提供投递策略和建议
- 覆盖：投递时机、投递渠道、投递策略、跟进技巧、面试准备
- 支持用户自定义问题

**System Prompt 角色：** 求职投递顾问

---

### 2.7 推荐历史记录

| 属性 | 内容 |
|------|------|
| 路径 | `GET /api/recommendations/history` |
| 实现文件 | [route.ts](../src/app/api/recommendations/history/route.ts) |
| 类型 | ✅ **已实现**（数据库查询） |

**功能描述：**
- 查询 `match_history` 表的历史记录
- 支持 limit 参数
- 返回结构化匹配历史数据

---

### 2.8 系统状态中的 AI 运行时信息

| 属性 | 内容 |
|------|------|
| 路径 | `GET /api/system/status` |
| 实现文件 | [route.ts](../src/app/api/system/status/route.ts) |
| 类型 | ⚠️ **虚假数据**（硬编码） |

**问题：** `ai_runtime` 字段中的数据（timeout_rate、cache_hit_rate、daily_budget、daily_tokens）全部为硬编码值，没有实际统计。

---

### 2.9 前端页面

| 页面 | 路径 | 功能 |
|------|------|------|
| 智能推荐 | `/recommendations` | 三个Tab：岗位分析、简历建议、投递助手 |
| 简历匹配 | `/match` | 流程：上传→确认→匹配→结果 |

---

## 三、未实现的 AI 功能

### 3.1 ❌ 面试题目生成

| 属性 | 内容 |
|------|------|
| API 定义 | `API.generateInterviewQuestions(id)` 在 [api.ts](../src/lib/api.ts#L136) |
| 后端路由 | ❌ **未实现**（无对应 `route.ts`） |
| 优先级 | **高** |

**问题：** 前端 API 层已定义接口，但后端无对应实现。

---

### 3.2 ❌ AI 聊天对话（多轮）

| 属性 | 内容 |
|------|------|
| API 定义 | `API.getRecommendationChat(data)` 在 [api.ts](../src/lib/api.ts#L156) |
| 后端路由 | ❌ **未实现**（无对应 `route.ts`） |
| 优先级 | **高** |

**问题：** API 层已定义接口，但后端无对应实现。缺乏多轮对话能力，每次请求都是独立的单轮交互。

---

### 3.3 ❌ 推荐质量监控仪表盘

| 属性 | 内容 |
|------|------|
| API 定义 | `API.getRecommendationQualityDashboard()` 在 [api.ts](../src/lib/api.ts#L160) |
| 后端路由 | ❌ **未实现** |
| 优先级 | **中** |

**问题：** 无法追踪推荐效果，缺乏反馈闭环。

---

### 3.4 ❌ 基于 Embedding 的语义搜索

| 现状 | 搜索方式 | 缺点 |
|------|----------|------|
| 当前 | 关键词精确匹配 | 无法处理同义词、语义相近的查询 |
| 目标 | 向量相似度搜索 | 支持"薪资高的金融岗位"等自然语言查询 |

**优先级：高**

---

### 3.5 ❌ RAG 检索增强生成

**缺失能力：**
- 无知识库（企业信息、行业报告、面试经验等）
- AI 回答完全依赖模型自身知识，无法引用平台数据
- 无法回答"这个公司怎么样"、"这个行业薪资水平如何"等问题

**优先级：高**

---

### 3.6 ❌ 流式 AI 响应（Streaming）

**现状：** 所有 AI 接口都是同步等待完整响应，用户需等待 3-10 秒无反馈。
**目标：** 实现 SSE（Server-Sent Events）流式输出，实时显示生成内容。

**优先级：高**

---

### 3.7 ❌ 简历 AI 智能解析

**现状：** 简历解析完全基于正则和规则引擎，对格式敏感、准确率低。
**目标：** 使用 AI 模型解析简历，提高准确率和鲁棒性，处理 PDF/Word 格式。

**优先级：中**

---

### 3.8 ❌ 智能职位分类与标签

**缺失能力：**
- 没有 AI 自动分类（如：投研类、销售类、技术类、风控类）
- 没有 AI 补充标签（如：热门、急聘、内推、可转正）
- 目前 tags 字段直接使用爬虫原始数据

**优先级：中**

---

### 3.9 ❌ 职位 AI 摘要生成

**缺失能力：**
- 对长职位描述没有自动摘要
- 用户无法快速了解职位核心要点
- 列表页展示不友好

**优先级：中**

---

### 3.10 ❌ 个性化智能推送

**缺失能力：**
- 没有基于用户画像的新职位推送
- 没有订阅机制的 AI 匹配
- 没有邮件/站内通知

**优先级：中**

---

### 3.11 ❌ AI 辅助简历改写

**现状：** 简历建议只提供文字建议，不能直接生成改写后的内容。
**目标：** 用户可选择简历段落，AI 直接生成优化版本。

**优先级：低**

---

### 3.12 ❌ AI 职业规划建议

**缺失能力：**
- 没有基于长期数据的职业发展路径推荐
- 没有学习路径推荐（如：需要补充哪些技能）
- 没有行业趋势分析

**优先级：低**

---

### 3.13 ❌ 多语言支持

**现状：** 所有 Prompt 和回复都是中文。
**目标：** 支持中英文双语输出，面向国际学生。

**优先级：低**

---

### 3.14 ❌ AI 日志分析与异常检测

**现状：** 系统状态中的 AI 运行时数据（timeout_rate、cache_hit_rate 等）是硬编码假数据。
**目标：** 实现真实的数据采集、统计和告警。

**优先级：低**

---

## 四、问题汇总

### 4.1 代码质量问题

| 问题 | 位置 | 说明 |
|------|------|------|
| Mock 分析使用随机值 | [ai-analysis/route.ts](../src/app/api/jobs/%5Bid%5D/ai-analysis/route.ts#L93) | `Math.random()` 生成虚假评分 |
| 简历解析依赖硬编码关键词 | [resume-parser.ts](../src/lib/resume-parser.ts#L157) | `skillKeywords` 列表有限 |
| 简历诊断硬编码评分规则 | [diagnose/route.ts](../src/app/api/resume/diagnose/route.ts#L43) | 固定分数累加 |
| 系统状态 AI 数据全为假数据 | [system/status/route.ts](../src/app/api/system/status/route.ts#L41) | 所有 AI 运行时指标硬编码 |
| API 定义但无实现 | [api.ts](../src/lib/api.ts#L136) | `generateInterviewQuestions`, `getRecommendationChat`, `getRecommendationQualityDashboard` |
| 匹配引擎仅支持预定义技能 | [match-engine.ts](../src/lib/match-engine.ts#L47) | `skillKeywords` 数组无法覆盖所有技能 |

### 4.2 架构问题

| 问题 | 说明 |
|------|------|
| 无流式响应 | 所有 AI 请求同步阻塞，用户体验差 |
| 无上下文管理 | AI 交互均为无状态单轮，无法保持对话上下文 |
| 无 AI 调用统计 | 没有 token 用量、耗时、成功率统计 |
| 无降级策略 | AI 失败时直接回退到 Mock，缺乏渐进式降级 |
| Prompt 分散 | Prompt 散落在各个 route.ts 中，难以维护和统一管理 |
| 无 A/B 测试 | 无法对比不同 Prompt 或模型的推荐效果 |

### 4.3 用户体验问题

| 问题 | 说明 |
|------|------|
| 等待无反馈 | 提交后没有任何阶段性提示 |
| 推荐结果不可交互 | 无法追问或深入对话 |
| 历史记录不完整 | match_history 表存在但智能推荐页面的历史数据为空 |
| 简历上传格式支持有限 | 只支持 txt 文本阅读，不支持 PDF/Word 解析 |
| 无推荐反馈机制 | 无法评价推荐结果好坏 |

---

## 五、AI 功能优化方案

### 5.1 第一期（高优先级）

| 序号 | 功能 | 预估工作量 | 说明 |
|------|------|-----------|------|
| 1 | **补全已定义 API** | 1天 | 实现 `interview-questions`、`recommendations/chat`、`quality-dashboard` 的路由 |
| 2 | **流式响应** | 2天 | 实现 SSE 流式输出，支持打字机效果 |
| 3 | **上下文对话** | 2天 | 基于数据库存储对话历史，实现多轮交互 |
| 4 | **统一 Prompt 管理** | 1天 | 将 Prompt 集中到配置文件或数据库，支持热更新 |

### 5.2 第二期（中优先级）

| 序号 | 功能 | 预估工作量 | 说明 |
|------|------|-----------|------|
| 5 | **Embedding 语义搜索** | 3天 | 集成向量搜索，实现自然语言查询 |
| 6 | **AI 简历解析** | 3天 | 使用 AI 模型代替规则引擎解析简历 |
| 7 | **RAG 知识库** | 3天 | 构建企业信息、行业知识库 |
| 8 | **职位 AI 摘要** | 1天 | AI 自动生成长描述的简短摘要 |

### 5.3 第三期（低优先级）

| 序号 | 功能 | 预估工作量 | 说明 |
|------|------|-----------|------|
| 9 | **个性化推送** | 2天 | 基于用户画像的智能职位推荐和推送 |
| 10 | **简历 AI 改写** | 2天 | AI 辅助优化简历段落表述 |
| 11 | **职业规划建议** | 2天 | AI 生成个性化学习路径和职业规划 |
| 12 | **AI 监控仪表盘** | 2天 | 真实的 AI 调用统计和性能监控 |

---

## 六、架构建议

```
┌─────────────────────────────────────────────────┐
│                  前端页面                         │
│  /recommendations  /match  /jobs  /favorites     │
└──────────────────┬──────────────────────────────┘
                   │ HTTP / SSE
┌──────────────────▼──────────────────────────────┐
│              API 路由层（Next.js）                │
│  ai-analysis  analyze  resume-advice  delivery   │
│  interview-questions  chat  quality-dashboard    │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│               AI 服务核心层                       │
│  ┌────────────┐ ┌──────────┐ ┌──────────────┐   │
│  │  AI Service │ │ Prompt   │ │ Context Mgr  │   │
│  │  (多供应商)  │ │ Manager  │ │ (对话管理)    │   │
│  └────────────┘ └──────────┘ └──────────────┘   │
│  ┌────────────┐ ┌──────────┐ ┌──────────────┐   │
│  │ Embedding  │ │ RAG      │ │ 规则引擎      │   │
│  │ Service    │ │ Knowledge│ │ (降级/补充)   │   │
│  └────────────┘ └──────────┘ └──────────────┘   │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│              数据层                               │
│  SQLite (jobs, profiles, history, feedback)      │
│  Vector Store (embeddings)                       │
│  Knowledge Base (companies, industries)          │
└─────────────────────────────────────────────────┘
```

---

## 七、技术选型建议

| 需求 | 推荐方案 | 说明 |
|------|----------|------|
| 语义搜索 | `sqlite-vec` 或本地向量数据库 | SQLite 原生插件，无需额外部署 |
| RAG 知识库 | 基于 SQLite 存储 + AI 检索 | 利用现有 SQLite 基础设施 |
| 流式响应 | `ReadableStream` + SSE | 原生 Web API，无需额外依赖 |
| 对话上下文 | SQLite 存储 + 窗口管理 | 利用现有数据库 |
| Prompt 管理 | JSON 配置文件 + 数据库 | 支持热更新和版本管理 |
| AI 监控 | 数据库记录 + `logger` 统计 | 轻量级，无需 ELK |

---

## 八、总结

当前项目在 AI 功能上已有一定基础：
- ✅ 多供应商 AI 服务核心
- ✅ 三个 AI 交互功能（职位分析、简历建议、投递助手）
- ✅ 规则匹配引擎
- ✅ 基础简历解析

但存在明显不足：
- ❌ 三个已定义的 API 接口未实现
- ❌ 缺乏流式响应，用户体验差
- ❌ 缺乏语义搜索和 RAG 能力
- ❌ AI 监控数据全是虚假值
- ❌ 简历解析和匹配引擎依赖规则而非 AI
- ❌ 缺乏多轮对话能力

**推荐优先补全已定义的 API 并实现流式响应，这是投入产出比最高的改进方向。**