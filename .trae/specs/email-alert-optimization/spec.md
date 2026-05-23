# 邮件推送与订阅规则优化 Spec

## Why
当前系统的邮件推送和订阅匹配存在多层面的设计缺陷：匹配逻辑粗糙（规则匹配仅做子串查找，AI调用串行且无缓存）、推送控制僵硬（仅支持简单间隔限制，无日总量上限/静默时段）、去重机制不完善（跨订阅不感知）、Python和TypeScript两套实现逻辑重复。这些问题导致用户体验差（无预览、无可控性）、系统稳定性低（AI限流即失败、无重试）、资源利用效率低（重复分析相同岗位）。

## What Changes
- 订阅配置增强：关键词权重、排除词、匹配模式（AND/OR）可选、订阅预览
- 匹配引擎分层优化：缓存优先 → 规则匹配 → AI语义匹配，三级降级策略
- 推送控制精细化：日总量上限、静默时段、摘要/即时两种模式
- 去重范围扩展：跨订阅去重、全局已推送记录索引
- 统一 Python/TypeScript 实现，消除重复逻辑
- 邮件模板增强：退订链接、打开追踪（可选）、移动端适配

## Impact
- Affected specs: 无现有spec依赖
- Affected code: `src/lib/job-matcher.ts`, `src/lib/ai-matcher.ts`, `src/lib/job-alerts-db.ts`, `src/lib/email-service.ts`, `src/app/api/alerts/trigger/route.ts`, `lite_crawler.py`
- **BREAKING**: user_job_alerts 表结构变更（新增字段），需要迁移脚本

## MODIFIED Requirements

### Requirement: 订阅配置模型扩展
系统 SHALL 支持更丰富的订阅配置字段，包括关键词权重、排除词、匹配逻辑选择。

原有字段：`email, keywords, sources, locations, industries, education, min_notify_interval`

新增字段：
- `keyword_weights`: JSON, 关键词权重映射 `{"java": 10, "python": 5}`，影响匹配排序
- `exclude_keywords`: JSON, 排除词列表，包含这些词的岗位直接跳过
- `match_logic`: TEXT, `"or"` (默认) 或 `"and"`，控制关键词逻辑关系
- `max_jobs_per_push`: INTEGER, 单次推送最大岗位数，默认 20
- `daily_max_pushes`: INTEGER, 每天最大推送次数，0=不限，默认 3
- `quiet_start_hour`: INTEGER, 静默时段起始小时 (0-23)，null=不禁用
- `quiet_end_hour`: INTEGER, 静默时段结束小时 (0-23)，null=不禁用
- `push_mode`: TEXT, `"instant"` (即时) 或 `"digest"` (摘要)，默认 `"instant"`
- `digest_hour`: INTEGER, 摘要模式推送时间 (0-23)，默认 9
- `is_test`: INTEGER, 是否为测试订阅，测试订阅只推送预览不实际发送，默认 0

#### Scenario: 用户设置关键词权重
- **WHEN** 用户订阅时设置关键词权重 `{"数据分析": 10, "Python": 5}`
- **THEN** 匹配时命中"数据分析"的岗位排序权重高于命中"Python"的岗位

#### Scenario: 排除词过滤
- **WHEN** 用户设置排除词 `["销售", "客服"]`
- **THEN** 所有包含"销售"或"客服"关键词的岗位被直接过滤，不计入匹配

#### Scenario: AND逻辑匹配
- **WHEN** 用户设置 `match_logic = "and"` 和关键词 `["Java", "Spring"]`
- **THEN** 只有同时匹配"Java"和"Spring"的岗位才会被推送

#### Scenario: 日推送上限
- **WHEN** 用户设置 `daily_max_pushes = 3` 且当天已推送 3 次
- **THEN** 当天后续不再推送，直到次日重置

#### Scenario: 静默时段
- **WHEN** 用户设置 `quiet_start_hour = 22, quiet_end_hour = 8`
- **THEN** 在 22:00-08:00 期间不发送任何推送邮件

#### Scenario: 摘要模式
- **WHEN** 用户设置 `push_mode = "digest"` 且 `digest_hour = 9`
- **THEN** 系统收集当天所有匹配岗位，在 9:00 发送一封汇总邮件

### Requirement: 三级匹配降级策略
系统 SHALL 实现缓存 → 规则 → AI 的三级匹配降级架构。

- Level 1: 缓存匹配 — 相同 岗位ID+订阅ID 组合在 10 分钟内复用上次结果
- Level 2: 规则匹配 — 基于关键词权重、排除词、AND/OR逻辑进行结构化匹配
- Level 3: AI语义匹配 — 调用LLM进行语义理解分析

#### Scenario: 缓存命中
- **WHEN** 同一订阅在 10 分钟内重复触发针对相同岗位集合的匹配
- **THEN** 直接返回缓存结果，不调用 AI

#### Scenario: AI不可用时降级
- **WHEN** AI 服务返回 429 或超时
- **THEN** 自动降级到规则匹配，并在日志中记录降级原因

### Requirement: 跨订阅去重
系统 SHALL 维护全局已推送记录索引，防止同一岗位向同一用户的不同订阅重复推送。

- 新增 `job_push_index` 表：`(email, job_id, pushed_at)` 唯一索引
- 匹配完成后，先查询此表过滤已推送岗位
- 推送成功后，写入此表

#### Scenario: 跨订阅去重
- **WHEN** 用户有两个订阅（关键词"数据分析"和"Python"），岗位同时匹配两个订阅
- **THEN** 该岗位只推送给匹配度更高的订阅，另一个订阅不会重复收到

### Requirement: 订阅预览功能
系统 SHALL 提供订阅预览接口，用户可在创建/修改订阅前预览匹配结果。

- 新增 `POST /api/alerts/preview` 接口
- 参数：订阅配置（不使用 save，仅内存匹配）
- 返回：最近岗位中匹配的结果及匹配度

#### Scenario: 订阅预览
- **WHEN** 用户在创建订阅界面点击"预览匹配"
- **THEN** 系统从数据库取最近 50 条岗位，展示匹配结果和匹配度

### Requirement: 统一Python/TypeScript匹配实现
系统 SHALL 将匹配核心逻辑统一到 TypeScript 侧，Python 爬虫仅负责触发和数据传输。

- Python `test_email_mode` 改为调用 `/api/alerts/trigger` API（而非自行实现AI调用）
- API 增加 `force_send` 参数，跳过频率限制（用于测试）
- 移除 Python 侧的 `call_zhipu_ai`、`build_ai_prompt`、`parse_ai_response`、`send_email_direct` 等冗余函数

#### Scenario: 统一触发
- **WHEN** 爬虫运行 `--test-email`
- **THEN** 调用 `/api/alerts/trigger` 传入 `force_send=true`，由 API 完成匹配和发送

## ADDED Requirements

### Requirement: 邮件打开追踪（可选）
系统 SHALL 支持可选的邮件打开追踪，用户可在订阅设置中开启/关闭。

- 邮件中嵌入 1x1 像素追踪图片
- 记录打开时间到 `job_alert_history` 表
- 默认关闭，用户主动开启

#### Scenario: 用户开启追踪
- **WHEN** 用户订阅设置 `track_opens = 1`
- **THEN** 邮件中包含追踪像素，后端记录打开时间

### Requirement: AI调用重试与限流
系统 SHALL 在 AI 调用失败时自动重试（最多 3 次），并使用指数退避策略。

- 重试间隔：10s → 20s → 40s
- 429 错误：记录限流时间，后续请求自动延迟
- 连续失败 3 次：标记该订阅降级为规则模式 30 分钟

#### Scenario: AI限流重试
- **WHEN** AI 返回 429 错误
- **THEN** 等待 10s 后重试，最多 3 次；3 次后降级到规则匹配

### Requirement: 匹配结果质量评分
系统 SHALL 为每次匹配提供质量评分（0-100），帮助用户了解推荐质量。

- 规则匹配评分：基于关键词命中数 × 权重 / 总权重 × 100
- AI 匹配评分：来自 AI 模型返回的 relevance_score
- 用户可在邮件中看到质量评分

#### Scenario: 邮件中展示质量评分
- **WHEN** 邮件发送给用户
- **THEN** 邮件头部显示本次推荐的平均质量评分

## REMOVED Requirements

### Requirement: Python侧独立AI调用逻辑
**Reason**: 维护两套匹配逻辑导致逻辑不一致和代码重复。
**Migration**: `lite_crawler.py` 中 `call_zhipu_ai`、`build_ai_prompt`、`parse_ai_response`、`send_email_direct` 函数移除，改为调用统一的 `/api/alerts/trigger` API。