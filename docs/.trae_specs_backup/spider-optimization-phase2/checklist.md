# Checklist - Phase 2: 架构重构验收标准

## 功能完整性

### 策略模式
- [ ] BaseCrawlStrategy 抽象基类已定义且包含完整接口
- [ ] STRATEGY_MAP 包含所有7种 spider_type 映射
- [ ] ApiPostStrategy 可正确处理 sufe/cufe/dufe 配置
- [ ] ApiGetStrategy 可正确处理 zuel GET参数分页
- [ ] HtmlStrategy 可正确解析 swufe HTML并检测连续404
- [ ] BrowserStrategy 可正确调用 Playwright 并处理3种browser子类型
- [ ] get_strategy('api_post') 返回 ApiPostStrategy 实例
- [ ] 每个Strategy的 execute() 都是异步生成器 (async for job in strategy.execute(...))

### 异步生成器
- [ ] UnifiedSpider.crawl_stream(max_items=10) 返回 AsyncIterator
- [ ] async for job in spider.crawl_stream(): 可逐条获取JobData
- [ ] max_items=10 时最多产出10条 (不多不少)
- [ ] crawl() 兼容接口仍返回 List[JobData] (非空列表)
- [ ] 内存峰值显著降低 (大量数据场景)

### 中间件管道
- [ ] MiddlewarePipeline.use() 可注册中间件
- [ ] 中间件按注册顺序执行 (洋葱模型: request→handler→response)
- [ ] LoggerMiddleware 记录请求和响应到日志
- [ ] RateLimitMiddleware 限制请求频率 (可配置rps)
- [ ] ErrorHandlerMiddleware 捕获异常并返回兜底值
- [ ] 中间件可通过 context.data 共享状态

### 插件系统
- [ ] CrawlPlugin 基类定义了 before_request/after_response
- [ ] RateLimitPlugin 在检测到429后自动增加等待时间
- [ ] ProxyPlugin 可轮换代理IP列表
- [ ] MetricsPlugin 记录请求数和成功数
- [ ] UnifiedSpider 在请求前后调用插件钩子

### 向后兼容
- [ ] UnifiedSpider(source_key, config, ...) 初始化签名不变
- [ ] spider.crawl(max_items) 返回 List[JobData] (类型不变)
- [ ] spider.close() 正确清理资源
- [ ] AsyncMultiCrawler.crawl_all_parallel() 无需改动即可工作
- [ ] run_spiders.py CLI 命令参数不变
- [ ] 所有现有数据源 (sufe/zuel/swufe/uibe等) 可正常爬取

## 代码质量

### 文件结构
- [ ] spiders/strategies/ 目录存在且包含 __init__.py
- [ ] spiders/strategies/ 包含: base.py, api_post.py, api_get.py, html_strategy.py, browser_strategy.py
- [ ] spiders/middleware/ 目录存在且包含: __init__.py, pipeline.py, base.py
- [ ] spiders/plugins/ 目录存在且包含: base.py, rate_limit.py, proxy.py, metrics.py
- [ ] unified_spider.py 行数 < 250行 (从970行削减)

### 代码规范
- [ ] Python语法检查通过 (py_compile 全部新文件)
- [ ] flake8/pylint 0 error, warning < 15
- [ ] 所有公开函数有 docstring
- [ ] 类型注解覆盖率 > 90%
- [ ] 循环复杂度: 每个函数 < 15
- [ ] 无硬编码魔法数字 (使用 config.get_config())
- [ ] 装饰器使用一致 (@retry on 网络, @measure_time on 操作)

### 设计模式应用
- [ ] 策略模式正确实现 (BaseCrawlStrategy + 4个具体策略)
- [ ] 工厂模式 (get_strategy() 或 STRATEGY_MAP[type])
- [ ] 模板方法 (BaseCrawlStrategy 定义骨架, 子类填充细节)
- [ ] 观察者模式 (中间件管道的next回调链)
- [ ] 单一职责原则 (每个Strategy只负责一种爬取方式)

## 性能指标

### 内存占用
- [ ] 爬取1000条数据时内存峰值 < 50MB (Phase 1 baseline)
- [ ] 流式模式下同一时刻持有的 JobData 对象 ≤ detail_concurrency (8)
- [ ] 无明显内存泄漏 (多次爬取后内存稳定)

### 吞吐量
- [ ] 单源爬取吞吐量 ≥ Phase 1 (不应退化)
- [ ] 多源并发爬取总耗时 ≤ Phase 1 (连接池复用优势)
- [ ] 数据库写入速度不变 (仍使用批量插入)

### 响应时间
- [ ] 首条数据产出时间 < 5秒 (流式优势: 无需等待全部完成)
- [ ] Strategy切换开销 < 1ms (类实例化成本)

## 测试覆盖

### 单元测试
- [ ] BaseCrawlStrategy 子类化测试 (MockSpider)
- [ ] ApiPostStrategy: mock aiohttp响应, 验证解析逻辑
- [ ] ApiGetStrategy: mock aiohttp响应, 验证参数构造
- [ ] HtmlStrategy: 本地HTML文件, 验证BeautifulSoup解析
- [ ] MiddlewarePipeline: 验证执行顺序和context传递
- [ ] RateLimitPlugin: 验证429检测和退避逻辑

### 集成测试
- [ ] sufe 数据源实际爬取 (至少5条) 成功入库
- [ ] zuel 数据源实际爬取 (至少5条) 成功入库
- [ ] swufe 数据源实际爬取 (至少5条) 成功入库
- [ ] 爬取结果字段完整 (title/company/location/source_url等20+字段)
- [ ] 日志含 trace_id 和 source 信息
- [ ] crawl_logs 表有本次爬取记录

### 回归测试
- [ ] 与Phase 1优化的功能不冲突 (WAL/连接池/批量插入/装饰器/config/logger)
- [ ] run_spiders.py --sources sufe zuel --max-items 10 正常完成
- [ ] 无异常退出或死锁
- [ ] 数据库jobs.db文件大小合理 (无异常膨胀)

## 文档与示例

- [ ] SPIDERS_TECH_DOC.md 更新"策略模式"章节 (含架构图)
- [ ] 每个Strategy类有使用示例 (docstring或独立example)
- [ ] 中间件自定义指南 (如何编写自己的middleware)
- [ ] 插件开发指南 (如何编写plugin)
- [ ] Migration Guide (从旧unified_spider迁移到新架构)

## 最终验收标准总结

| 维度 | 标准 | 验证方法 |
|------|------|----------|
| **功能完整** | 4种策略+中间件+插件全部可用 | 集成测试 |
| **向后兼容** | 现有CLI和数据源无需改动 | 回归测试 |
| **代码质量** | unified_spider<250行, 0 error | lint检查 |
| **内存优化** | 峰值内存降低≥50% | memory_profiler |
| **性能不退化** | 吞吐量≥Phase 1 | 基准测试 |
| **可扩展性** | 新增数据源只需添加Strategy+配置 | 架构评估 |
| **测试覆盖** | 核心路径有单元+集成测试 | pytest |
| **文档完善** | 有迁移指南和使用示例 | 文档审查 |

**通过条件**: 以上所有checkbox均勾选 ✅
