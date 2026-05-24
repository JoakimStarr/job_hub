# 订阅预览分析与智能推荐功能 Spec

## Why
用户在"我的订阅"页面创建订阅条件后，目前无法直观地看到这些条件能匹配到哪些岗位。用户需要：
1. 点击"预览"按钮，基于订阅条件对数据库中全部岗位进行AI分析匹配
2. 查看匹配结果和AI给出的专业建议
3. 保存历史记录，支持重新分析
4. 每天汇总发送一次邮件通知新匹配的岗位

## What Changes
- 新增 `subscription_analyses` 和 `subscription_analysis_results` 数据库表
- 新增 `/api/subscriptions/{id}/preview` API 端点（复用现有 AI 分析逻辑）
- 新增 `/api/subscriptions/{id}/analyses/history` 历史查询 API
- 修改前端订阅页面，添加"预览"、"重新分析"按钮和结果展示面板
- 实现增量更新机制：检测新数据 + 条件变更，避免重复分析
- 实现邮件汇总通知功能（每日一次）
- 历史记录保留最近40次

## Impact
- Affected specs: 无直接影响其他 spec
- Affected code:
  - `src/app/api/system/subscriptions/route.ts` - 扩展订阅API
  - `src/lib/db-utils.ts` - 新增表初始化
  - `src/lib/ai-service.ts` - 复用（无需修改）
  - `src/lib/match-engine.ts` - 复用（无需修改）
  - `src/lib/score-engine.ts` - 复用（无需修改）
  - `src/app/api/recommendations/analyze/route.ts` - 参考其AI分析逻辑
  - 前端订阅管理组件 - 新增预览UI

## ADDED Requirements

### Requirement: 订阅预览分析
系统 SHALL 提供订阅预览分析功能，允许用户基于订阅条件对 jobs 表数据进行批量匹配分析和 AI 评估。

#### Scenario: 用户点击预览按钮触发分析
- **WHEN** 用户在订阅列表中点击某条订阅的"预览"按钮
- **THEN** 系统应：
  1. 创建一条新的 analysis 记录，状态为 `running`
  2. 基于 subscription 的筛选条件（keyword, locations, industries, job_types, education）过滤 jobs 表
  3. 对每个匹配的岗位执行本地规则匹配评分（复用 match-engine + score-engine）
  4. 对所有匹配岗位调用 AI 服务生成分析建议（复用 ai-service）
  5. 将分析结果写入 `subscription_analysis_results` 表
  6. 更新 analysis 记录状态为 `completed`，包含统计摘要
  7. 返回分析结果给前端展示

#### Scenario: 增量更新优化
- **WHEN** 用户再次点击"预览"按钮
- **THEN** 系统应：
  1. 计算当前订阅条件的哈希值
  2. 与上次分析的哈希值对比：
     - 如果条件未变且无新 job 数据 → 直接返回缓存结果
     - 如果条件变了 → 全量重扫
     - 如果有新数据 → 只分析新增的 job（id > last_job_id_analyzed）

#### Scenario: 用户点击"重新分析"
- **WHEN** 用户点击"重新分析"按钮
- **THEN** 系统应忽略缓存，强制全量重新分析

### Requirement: 分析历史记录
系统 SHALL 保存每次分析的历史记录，最多保留40条。

#### Scenario: 查看历史分析
- **WHEN** 用户查看某条订阅的分析历史
- **THEN** 系统返回最近40次分析记录的摘要列表

#### Scenario: 清理过期历史
- **WHEN** 某条订阅的分析次数超过40条
- **THEN** 系统自动删除最旧的分析记录及其关联的结果

### Requirement: 邮件汇总通知
系统 SHALL 每日汇总新匹配的岗位并通过邮件发送给用户。

#### Scenario: 定时任务发送邮件
- **WHEN** 每日定时任务运行时
- **THEN** 系统应：
  1. 遍历所有启用的订阅
  2. 检查是否有新的匹配岗位（与上次分析对比）
  3. 如有新匹配，汇总后发送一封邮件
  4. 邮件内容包含：匹配岗位数量、Top-10岗位详情、AI摘要

## MODIFIED Requirements

### Requirement: 订阅管理扩展
现有的 subscriptions 表结构保持不变，但需扩展以下能力：
- 支持通过 subscription_id 关联分析记录
- 支持计算订阅条件的哈希值用于变更检测

## Database Schema

### subscription_analyses 表
```sql
CREATE TABLE IF NOT EXISTS subscription_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER NOT NULL,
  
  -- 分析元信息
  analyzed_at TEXT DEFAULT CURRENT_TIMESTAMP,
  total_jobs_scanned INTEGER DEFAULT 0,
  new_jobs_count INTEGER DEFAULT 0,
  matched_jobs_count INTEGER DEFAULT 0,
  
  -- 增量追踪
  last_job_id_analyzed INTEGER DEFAULT 0,
  analysis_hash TEXT,
  
  -- AI分析摘要
  ai_summary TEXT,
  ai_model TEXT,
  tokens_used INTEGER,
  
  -- 状态
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
);

CREATE INDEX idx_sa_subscription ON subscription_analyses(subscription_id);
CREATE INDEX idx_sa_status ON subscription_analyses(status);
```

### subscription_analysis_results 表
```sql
CREATE TABLE IF NOT EXISTS subscription_analysis_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  analysis_id INTEGER NOT NULL,
  job_id INTEGER NOT NULL,
  
  -- 匹配得分 (0-100)
  match_score REAL DEFAULT 0,
  skill_match REAL DEFAULT 0,
  education_match REAL DEFAULT 0,
  location_match REAL DEFAULT 0,
  
  -- AI分析
  ai_reasoning TEXT,
  ai_suggestions TEXT,
  
  -- 用户操作标记
  is_read INTEGER DEFAULT 0,
  is_interested INTEGER DEFAULT 0,
  applied_at TEXT,
  
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(analysis_id, job_id),
  FOREIGN KEY (analysis_id) REFERENCES subscription_analyses(id),
  FOREIGN KEY (job_id) REFERENCES jobs(id)
);

CREATE INDEX idx_sar_analysis ON subscription_analysis_results(analysis_id);
CREATE INDEX idx_sar_job ON subscription_analysis_results(job_id);
CREATE INDEX idx_sar_score ON subscription_analysis_results(match_score DESC);
```

## API Design

### POST /api/subscriptions/:id/preview
触发订阅预览分析。

**请求**:
```json
{
  "force_refresh": false  // true = 强制重新分析
}
```

**响应 (200)**:
```json
{
  "analysis_id": 123,
  "status": "completed",
  "summary": {
    "total_scanned": 1500,
    "new_jobs": 23,
    "matched": 8,
    "ai_summary": "根据您设置的金融+上海+本科条件..."
  },
  "results": [
    {
      "job_id": 4567,
      "title": "投资助理 | 渤海银行",
      "company": "渤海银行",
      "location": "天津",
      "salary": "8000-12000",
      "match_score": 87.5,
      "ai_reasoning": "该岗位与您的金融学专业高度匹配...",
      "is_new": true
    }
  ],
  "cached_at": "2026-05-20T19:00:00"
}
```

**响应 (202 - 正在处理)**:
```json
{
  "analysis_id": 124,
  "status": "running",
  "message": "分析正在进行中，请稍后刷新"
}
```

### GET /api/subscriptions/:id/analyses/history
获取分析历史列表。

**响应**:
```json
{
  "total": 15,
  "analyses": [
    {
      "id": 123,
      "analyzed_at": "2026-05-20T19:00:00",
      "status": "completed",
      "total_scanned": 1500,
      "matched_jobs_count": 8,
      "is_cached": false
    }
  ]
}
```

### GET /api/subscriptions/:id/analyses/:analysisId/results
获取某次分析的详细结果（分页）。

**查询参数**: `page=1&limit=20&sort=score_desc`

### POST /api/subscriptions/:id/analyses/:analysisId/results/:resultId/interest
标记某条结果为感兴趣/不感兴趣。

## Frontend Changes

### 订阅列表页改造
每条订阅卡片增加操作按钮：
- **预览** → 触发分析并展示结果弹窗/侧边栏
- **重新分析** → 强制重新分析（分析完成后显示）
- **历史** → 查看历史分析记录

### 结果展示面板
```
┌─────────────────────────────────────────────────────┐
│  📊 分析结果 - 金融实习订阅                          │
│                                                     │
│  扫描: 1500 条 | 新增: 23 条 | 匹配: 8 条           │
│                                                     │
│  🤖 AI 摘要:                                        │
│  根据您设置的金融+上海+本科条件，共找到8个高度...     │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 🟢 87分 | 投资助理 | 渤海银行 | 天津        │   │
│  │ 薪资: 8000-12000 | 本科                     │   │
│  │ 该岗位与您的金融学专业高度匹配...             │   │
│  │ [查看详情] [感兴趣] [投递]                   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 🟡 72分 | 财务专员 | 华泰证券 | 上海         │   │
│  │ ...                                         │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [加载更多]                                          │
└─────────────────────────────────────────────────────┘
```
