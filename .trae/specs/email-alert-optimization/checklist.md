# Checklist: 邮件推送与订阅规则优化

## Phase 1: 基础设施
- [ ] user_job_alerts 表包含所有新增字段（keyword_weights, exclude_keywords, match_logic, max_jobs_per_push, daily_max_pushes, quiet_start_hour, quiet_end_hour, push_mode, digest_hour, is_test）
- [ ] 数据库迁移脚本 `scripts/migrate-alerts-v2.ts` 可正确执行，不影响已有数据
- [ ] CRUD 函数正确处理新字段的读写和默认值
- [ ] job_push_index 表创建成功，含 (email, job_id) 复合唯一索引
- [ ] isJobPushedToUser() 正确返回推送状态
- [ ] recordPushToUser() 正确写入推送记录

## Phase 2: 匹配引擎
- [ ] match-cache.ts LRU 缓存实现正确，TTL 10分钟
- [ ] 规则匹配正确应用关键词权重排序
- [ ] 规则匹配正确过滤排除词
- [ ] 规则匹配正确支持 AND 逻辑（全部关键词命中才算匹配）
- [ ] AI 匹配调用前先查询缓存
- [ ] AI 匹配失败时自动重试（最多3次，指数退避）
- [ ] AI 429 错误后 30 分钟内降级到规则匹配
- [ ] 同一岗位对同一用户的多个订阅不重复推送
- [ ] 多订阅命中同一岗位时只推送到匹配度最高的订阅

## Phase 3: 推送控制
- [ ] daily_max_pushes 限制生效，超限后当天不再推送
- [ ] 静默时段（quiet_start_hour ~ quiet_end_hour）内不发送邮件
- [ ] push_mode="digest" 时收集结果在 digest_hour 统一发送
- [ ] 日计数器每日 0 点正确重置
- [ ] force_send=true 跳过所有频率限制和静默检查
- [ ] force_send=false 遵守所有限制规则

## Phase 4: API 与预览
- [ ] POST /api/alerts/preview 返回正确的匹配结果
- [ ] 预览接口不使用数据库中的订阅，仅内存匹配
- [ ] 预览结果包含匹配度、关键词、推荐理由
- [ ] Python --test-email 调用 /api/alerts/trigger 而非自行实现
- [ ] Python 侧冗余函数（call_zhipu_ai, build_ai_prompt, parse_ai_response, send_email_direct 等）已移除
- [ ] Python --test-email 返回正确的统计信息

## Phase 5: 邮件质量
- [ ] 邮件包含有效的退订链接
- [ ] 邮件显示本次推荐平均质量评分
- [ ] 移动端邮件展示正常（响应式样式生效）
- [ ] 摘要模式邮件模板与即时模式正确区分
- [ ] 打开追踪像素仅在用户开启时嵌入
- [ ] 打开追踪正确记录时间到数据库

## Phase 6: 整体验证
- [ ] npm run build 无错误
- [ ] npm run typecheck 无错误
- [ ] E2E 测试全部通过
- [ ] Docker compose 配置无需更新（或已更新环境变量映射）
- [ ] 现有订阅数据迁移后功能正常