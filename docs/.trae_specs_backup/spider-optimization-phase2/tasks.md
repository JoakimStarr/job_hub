# Tasks - Phase 2: 架构重构

## Task 1: 创建策略基类和注册表 ⭐⭐⭐ (基础设施)
- [ ] 1.1 创建 spiders/strategies/__init__.py 包
- [ ] 1.2 创建 spiders/strategies/base.py 定义 BaseCrawlStrategy 抽象基类
  - [ ] 抽象方法: execute(spider, max_items) -> AsyncIterator[JobData]
  - [ ] 抽象方法: get_type() -> str
  - [ ] 公共辅助方法: _create_session(), _validate_job(), _calculate_quality()
  - [ ] 使用 @retry 和 @measure_time 装饰器
- [ ] 1.3 在 __init__.py 中创建 STRATEGY_MAP 字典
  - [ ] 映射所有 spider_type 到对应 Strategy 类
  - [ ] 提供 get_strategy(type_str) 工厂函数
- [ ] 1.4 编写 BaseCrawlStrategy 的单元测试

## Task 2: 实现 ApiPostStrategy ⭐⭐⭐ (POST API策略)
- [ ] 2.1 创建 spiders/strategies/api_post.py
  - [ ] 从 unified_spider.py 提取 _crawl_api_post() 逻辑
  - [ ] 处理 sufe/cufe/dufe 三种配置差异
  - [ ] 支持 sections 分板块爬取
  - [ ] 实现 execute() 为 async generator
  - [ ] 分页循环 + 详情并发获取 + 解析 + 校验
- [ ] 2.2 应用装饰器 (@retry on network, @measure_time)
- [ ] 2.3 使用 get_logger(source) 结构化日志
- [ ] 2.4 测试 ApiPostStrategy (mock HTTP响应)

## Task 3: 实现 ApiGetStrategy ⭐⭐ (GET API策略)
- [ ] 3.1 创建 spiders/strategies/api_get.py
  - [ ] 从 unified_spider.py 提取 _crawl_api_get() 逻辑
  - [ ] 处理 zuel 类型 (GET参数 + 分页)
  - [ ] 实现 execute() 为 async generator
- [ ] 3.2 应用装饰器和结构化日志
- [ ] 3.3 测试 ApiGetStrategy

## Task 4: 实现 HtmlStrategy ⭐⭐ (HTML解析策略)
- [ ] 4.1 创建 spiders/strategies/html_strategy.py
  - [ ] 从 unified_spider.py 提取 _crawl_html() / _parse_swufe_job() 逻辑
  - [ ] 处理 swufe 类型 (ID枚举 + 连续404检测)
  - [ ] BeautifulSoup 解析优化 (及时del soup释放内存)
  - [ ] 实现 execute() 为 async generator
- [ ] 4.2 应用装饰器和结构化日志
- [ ] 4.3 测试 HtmlStrategy (提供测试HTML)

## Task 5: 实现 BrowserStrategy ⭐⭐⭐ (浏览器策略)
- [ ] 5.1 创建 spiders/strategies/browser_strategy.py
  - [ ] 从 unified_spider.py 提取 _crawl_browser() 逻辑
  - [ ] 处理 browser_js/browser_encrypted/browser_api 三种子类型
  - [ ] 集成 browser_wrapper.py Playwright封装
  - [ ] 浏览器资源管理 (确保finally中关闭)
  - [ ] 实现 execute() 为 async generator
- [ ] 5.2 应用装饰器和结构化日志
- [ ] 5.3 测试 BrowserStrategy (mock或跳过如果无Playwright)

## Task 6: 重构 UnifiedSpider 为调度器 ⭐⭐⭐ (核心重构)
- [ ] 6.1 重构 unified_spider.py
  - [ ] 导入所有 Strategy 类
  - [ ] __init__ 中根据 config['spider_type'] 创建对应 Strategy 实例
  - [ ] 删除所有 _crawl_* 私有方法 (已迁移到Strategy)
  - [ ] 保留公共工具方法 (_validate_job, _compute_content_hash 等)
  - [ ] 目标: unified_spider.py 从970行降到 < 250行
- [ ] 6.2 实现 crawl_stream() 异步生成器接口
  - [ ] 委托给 self._strategy.execute(self, max_items)
  - [ ] 支持 max_items 计数和提前终止
  - [ ] 异常处理和日志记录
- [ ] 6.3 保持 crawl() 向后兼容接口
  - [ ] 内部调用 list(crawl_stream(max_items))
  - [ ] 返回 List[JobData]
- [ ] 6.4 添加 use() 方法支持中间件/插件注册
- [ ] 6.5 更新所有 import 语句确保其他模块正常工作

## Task 7: 实现中间件管道系统 ⭐⭐
- [ ] 7.1 创建 spiders/middleware/__init__.py
- [ ] 7.2 创建 spiders/middleware/pipeline.py
  - [ ] MiddlewarePipeline 类 (洋葱模型)
  - [ ] use() 方法注册中间件
  - [ ] execute(context, handler) 执行管道
- [ ] 7.3 创建 spiders/middleware/base.py
  - [ ] Middleware ABC 定义 process(context, next) 接口
- [ ] 7.4 实现内置中间件:
  - [ ] LoggerMiddleware (请求/响应日志)
  - [ ] RateLimitMiddleware (令牌桶限速)
  - [ ] ErrorHandlerMiddleware (异常捕获)
  - [ ] CacheMiddleware (可选, 响应缓存)
- [ ] 7.5 编写中间件管道测试

## Task 8: 实现插件化架构 ⭐
- [ ] 8.1 创建 spiders/plugins/base.py
  - [ ] CrawlPlugin ABC (before_request/after_response)
- [ ] 8.2 实现内置插件:
  - [ ] RateLimitPlugin (自适应限速, 检测429自动退避)
  - [ ] ProxyPlugin (IP轮换)
  - [ ] MetricsPlugin (计数器/耗时统计)
- [ ] 8.3 在 UnifiedSpider 中集成插件系统
  - [ ] plugins 列表在 __init__ 中初始化
  - [ ] execute() 前后调用插件钩子
- [ ] 8.4 支持通过 config 声明启用哪些插件

## Task 9: 适配 AsyncMultiCrawler 流式消费 ⭐⭐
- [ ] 9.1 修改 crawler.py 的 crawl_source()
  - [ ] 支持两种模式: batch_mode=True (原行为) / stream_mode (新增)
  - [ ] stream_mode 下使用 crawl_stream_batches() 边爬边写
- [ ] 9.2 实现 crawl_stream_batches() 生成器方法
  - [ ] yield 固定大小的批次 (默认50条/batch)
  - [ ] 自动调用 insert_jobs_batch 写入数据库
  - [ ] 进度回调通知
- [ ] 9.3 更新 run_spiders.py CLI 添加 --stream-mode 选项

## Task 10: 集成测试与回归验证 ⭐⭐⭐ (验收)
- [ ] 10.1 单元测试: 每个 Strategy 类的核心逻辑
  - [ ] ApiPostStrategy mock测试 (模拟sufe响应)
  - [ ] ApiGetStrategy mock测试 (模拟zuel响应)
  - [ ] HtmlStrategy 测试 (本地HTML文件)
  - [ ] BrowserStrategy 跳过 (需Playwright环境)
- [ ] 10.2 集成测试: 端到端爬取流程
  - [ ] 运行 python3 run_spiders.py --sources sufe --max-items 5
  - [ ] 验证数据正常入库 (jobs表有新记录)
  - [ ] 检查日志输出含 trace_id 和 source
  - [ ] 对比优化前后爬取结果一致性 (字段完整性)
- [ ] 10.3 性能基准对比:
  - [ ] 内存占用对比 (Phase 1 vs Phase 2, 使用 memory_profiler)
  - [ ] 爬取总耗时对比 (应持平或更优)
  - [ ] unified_spider.py 行数统计 (目标 < 250行)
- [ ] 10.4 代码质量检查:
  - [ ] flake8/pylint 通过 (0 error)
  - [ ] 循环复杂度检查 (每个函数 < 15)
  - [ ] 类型注解覆盖率 > 90%
- [ ] 10.5 文档更新:
  - [ ] SPIDERS_TECH_DOC.md 更新策略模式章节
  - [ ] README.md 更新架构图

## Task Dependencies
- [Task 1] 必须最先完成 (基础设施)
- [Task 2,3,4,5] 可并行执行 (依赖Task 1)
- [Task 6] 依赖 [Task 2,3,4,5] (需要所有Strategy就绪)
- [Task 7,8] 可与 [Task 6] 并行 (相对独立)
- [Task 9] 依赖 [Task 6] (需要新的stream接口)
- [Task 10] 必须最后执行 (验收)

## 执行顺序建议
```
Day 1-2:   [Task 1] 策略基类 + 注册表
Day 3-4:   [Task 2+3+4] 三个API/HTML策略 (并行开发)
Day 5-6:   [Task 5] BrowserStrategy (最复杂)
Day 7-8:   [Task 6] 重构UnifiedSpider为调度器 (核心)
Day 9-10:  [Task 7+8] 中间件 + 插件系统 (并行)
Day 11:    [Task 9] 适配AsyncMultiCrawler
Day 12-13: [Task 10] 集成测试 + 性能基准 + 文档
```
