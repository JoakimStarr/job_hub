# Tasks

- [ ] Task 1: 数据库表创建与初始化
  - [ ] 1.1 在 `db-utils.ts` 中添加 `subscription_analyses` 和 `subscription_analysis_results` 表的初始化函数
  - [ ] 1.2 添加索引优化查询性能
  - [ ] 1.3 添加清理过期历史记录的函数（保留最近40条）

- [ ] Task 2: 核心分析引擎实现
  - [ ] 2.1 创建 `src/lib/subscription-analyzer.ts` 核心分析模块
  - [ ] 2.2 实现订阅条件哈希计算（用于检测条件变更）
  - [ ] 2.3 实现增量扫描逻辑（基于 last_job_id_analyzed）
  - [ ] 2.4 实现本地规则匹配（复用 match-engine + score-engine）
  - [ ] 2.5 实现 AI 批量分析（复用 ai-service，支持批量调用）
  - [ ] 2.6 实现结果存储和统计摘要生成

- [ ] Task 3: API 端点实现
  - [ ] 3.1 创建 `POST /api/subscriptions/:id/preview` 端点
  - [ ] 3.2 创建 `GET /api/subscriptions/:id/analyses/history` 端点
  - [ ] 3.3 创建 `GET /api/subscriptions/:id/analyses/:analysisId/results` 端点（分页）
  - [ ] 3.4 创建 `POST /api/subscriptions/:id/analyses/:analysisId/results/:resultId/interest` 端点
  - [ ] 3.5 添加认证和权限检查

- [ ] Task 4: 前端 UI 实现
  - [ ] 4.1 订阅列表卡片添加"预览"、"重新分析"、"历史"按钮
  - [ ] 4.2 创建分析结果展示组件（SubscriptionAnalysisPanel）
  - [ ] 4.3 实现结果列表展示（匹配分数、AI建议、岗位信息）
  - [ ] 4.4 实现历史记录查看面板
  - [ ] 4.5 实现加载状态和错误处理

- [ ] Task 5: 邮件通知功能
  - [ ] 5.1 创建邮件服务模块 `src/lib/email-service.ts`
  - [ ] 5.2 实现邮件模板（HTML格式，包含匹配岗位摘要）
  - [ ] 5.3 创建定时任务脚本或 API 触发端点
  - [ ] 5.4 实现每日汇总逻辑（遍历订阅、检测新匹配、发送邮件）

- [ ] Task 6: 集成测试与验证
  - [ ] 6.1 测试首次预览分析流程（全量扫描）
  - [ ] 6.2 测试增量更新逻辑（无新数据返回缓存）
  - [ ] 6.3 测试条件变更后的全量重扫
  - [ ] 6.4 测试"重新分析"按钮功能
  - [ ] 6.5 测试历史记录清理（超过40条自动删除）
  - [ ] 6.6 测试邮件发送功能

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 2]
- [Task 4] depends on [Task 3]
- [Task 5] depends on [Task 2]
- [Task 6] depends on [Task 3, Task 4, Task 5]
