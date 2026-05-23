# Tasks: 邮件推送与订阅规则优化

## Phase 1: 基础设施 — 数据库迁移与模型扩展
- [ ] Task 1: 扩展 user_job_alerts 表结构
  - [ ] 添加 `keyword_weights`, `exclude_keywords`, `match_logic`, `max_jobs_per_push`, `daily_max_pushes`, `quiet_start_hour`, `quiet_end_hour`, `push_mode`, `digest_hour`, `is_test` 字段
  - [ ] 编写数据库迁移脚本 `scripts/migrate-alerts-v2.ts`
  - [ ] 更新 `job-alerts-db.ts` 中的表创建和 CRUD 函数
  - **验证**: `npm run typecheck` 通过，迁移脚本执行后表结构正确

- [ ] Task 2: 创建跨订阅去重索引表
  - [ ] 在 `job-alerts-db.ts` 中新增 `job_push_index` 表定义
  - [ ] 添加 `(email, job_id)` 复合唯一索引
  - [ ] 实现 `isJobPushedToUser(email, jobId)`, `recordPushToUser(email, jobId)` 函数
  - **验证**: 单元测试验证去重逻辑正确

## Phase 2: 匹配引擎优化
- [ ] Task 3: 实现三级匹配降级架构
  - [ ] 创建 `src/lib/match-cache.ts`：内存 LRU 缓存，TTL 10 分钟
  - [ ] 增强 `job-matcher.ts` 的 `matchJobsToAlert` 函数：
    - [ ] 支持关键词权重计算
    - [ ] 支持排除词过滤
    - [ ] 支持 AND/OR 逻辑切换
    - [ ] 支持 `max_jobs_per_push` 限制
  - [ ] 增强 `ai-matcher.ts` 的 `aiMatchJobsToAlert` 函数：
    - [ ] 集成缓存层（先查缓存）
    - [ ] 添加重试逻辑（指数退避，最多3次）
    - [ ] 429后标记降级 30 分钟
  - **验证**: 单元测试覆盖三级降级场景

- [ ] Task 4: 跨订阅去重集成
  - [ ] 在 `aiMatchJobsToAlert` 中集成 `isJobPushedToUser`
  - [ ] 匹配完成后调用 `recordPushToUser` 记录推送
  - [ ] 同一用户多个订阅命中同一岗位时，只推送到匹配度最高的订阅
  - **验证**: 模拟多订阅场景验证去重

## Phase 3: 推送控制精细化
- [ ] Task 5: 实现精细化频率控制
  - [ ] 在 `trigger/route.ts` 中增加：
    - [ ] 日推送次数检查（`daily_max_pushes`）
    - [ ] 静默时段检查（`quiet_start_hour` ~ `quiet_end_hour`）
    - [ ] 推送模式路由（instant vs digest）
  - [ ] 创建 `src/lib/push-scheduler.ts`：
    - [ ] 摘要模式：定时任务收集匹配结果，在 `digest_hour` 统一发送
    - [ ] 日计数器重置：每日 0 点清零
  - **验证**: 模拟不同时间触发，验证频率控制正确

- [ ] Task 6: 添加 `force_send` 参数支持
  - [ ] `/api/alerts/trigger` 接口增加可选 `force_send: boolean` 参数
  - [ ] `force_send=true` 时跳过所有频率限制和静默时段检查
  - [ ] 在 `_debug` 输出中标注是否为强制模式
  - **验证**: curl 测试 force_send 参数

## Phase 4: API 与预览功能
- [ ] Task 7: 实现订阅预览接口
  - [ ] 新增 `POST /api/alerts/preview` 路由
  - [ ] 参数：完整的订阅配置 JSON（不写入数据库）
  - [ ] 从数据库取最近 50 条岗位进行匹配
  - [ ] 返回匹配结果列表（含匹配度、关键词、推荐理由）
  - **验证**: curl 测试预览接口，确认返回结果正确

- [ ] Task 8: 统一 Python 侧触发逻辑
  - [ ] 重构 `test_email_mode` 函数：移除 `call_zhipu_ai`, `build_ai_prompt`, `parse_ai_response`, `send_email_direct`
  - [ ] 改为调用 `/api/alerts/trigger` API（传入 `force_send=true`）
  - [ ] 保留结果展示和统计逻辑
  - [ ] 移除 `send_email_direct`, `build_email_content`, `call_zhipu_ai`, `get_alerts_from_db`, `get_jobs_from_db`, `build_ai_prompt`, `parse_ai_response` 函数
  - **验证**: 运行 `python3 lite_crawler.py --test-email --test-email-count 20` 确认正常

## Phase 5: 邮件质量提升
- [ ] Task 9: 邮件模板优化
  - [ ] 添加退订链接（调用 `/api/alerts/unsubscribe` 接口）
  - [ ] 添加本次推荐平均质量评分展示
  - [ ] 优化移动端响应式样式
  - [ ] 摘要模式专用邮件模板
  - [ ] 支持可选邮件打开追踪（1x1 像素）
  - **验证**: 发送测试邮件到真实邮箱，检查各端展示效果

## Phase 6: 测试与验证
- [ ] Task 10: 端到端测试
  - [ ] 编写 E2E 测试脚本：
    - [ ] 创建不同配置的订阅（AND/OR、带权重、带排除词）
    - [ ] 触发匹配验证结果正确性
    - [ ] 验证跨订阅去重
    - [ ] 验证频率控制和静默时段
    - [ ] 验证摘要模式
  - **验证**: 所有 E2E 测试通过

# Task Dependencies
- Task 2 依赖 Task 1（数据库迁移完成后才能创建索引表）
- Task 3 依赖 Task 1, Task 2（匹配引擎需要新的字段和去重索引）
- Task 4 依赖 Task 2, Task 3（跨订阅去重依赖索引表和匹配引擎）
- Task 5 依赖 Task 1（频率控制需要新字段）
- Task 6 依赖 Task 5（force_send 需跳过新增的频率控制）
- Task 7 依赖 Task 3（预览接口调用增强后的匹配引擎）
- Task 8 依赖 Task 6（Python 侧需要 force_send 参数）
- Task 9 可与其他任务并行
- Task 10 依赖 Task 1-9 全部完成

# 可并行执行
- Task 1 和 Task 9 可并行
- Task 5 和 Task 7 可并行（在 Task 3 完成后）