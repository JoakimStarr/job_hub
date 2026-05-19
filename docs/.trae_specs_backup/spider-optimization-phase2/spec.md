# 爬虫系统优化 Phase 2: 架构重构 Spec

## Why
Phase 1已完成基础优化（性能提升1363倍），但unified_spider.py仍有**970行单文件**，包含4种爬取策略的全部实现，违反单一职责原则，难以维护和测试。同时内存占用O(N)问题未解决，缺少插件化扩展能力。

## What Changes
### 核心重构目标

#### 1. 策略模式拆分 (核心)
将 unified_spider.py 拆分为：
- **UnifiedSpider** (调度器, < 200行) - 负责策略选择和生命周期管理
- **ApiPostStrategy** (~250行) - POST API爬取 (sufe/cufe/dufe)
- **ApiGetStrategy** (~200行) - GET API爬取 (zuel)
- **HtmlStrategy** (~250行) - HTML解析爬取 (swufe)
- **BrowserStrategy** (~300行) - 浏览器自动化 (uibe/jxufe/neu/smartedu)

#### 2. 异步生成器流式处理
- crawl() 改为 async generator (AsyncIterator[JobData])
- 边爬取边产出，不累积全量数据到内存
- 内存占用从 O(N) 降到 O(1)

#### 3. 中间件管道系统
- 实现 MiddlewarePipeline (洋葱模型)
- 内置中间件: logger_middleware, rate_limit_middleware, cache_middleware, error_handler_middleware
- 支持自定义中间件插件

#### 4. 插件化架构增强
- CrawlPlugin 基类定义 (before_request/after_response 钩子)
- 内置插件: RateLimitPlugin, ProxyPlugin, MetricsPlugin
- 配置化加载 (spider_configs.py 中声明使用的插件)

## Impact
- Affected code: src/spiders/unified_spider.py (主要), crawler.py, base.py
- Backward compatibility: 保持 UnifiedSpider.crawl() 接口不变（内部改为generator）
- Risk level: 中等（架构级变更，需充分测试）

## ADDED Requirements
### Requirement: 策略模式拆分
系统 SHALL 将 unified_spider.py 的4种爬取逻辑拆分为独立的Strategy类：

1. **BaseCrawlStrategy** - 抽象基类
   ```python
   class BaseCrawlStrategy(ABC):
       @abstractmethod
       async def execute(self, spider: 'UnifiedSpider', max_items: int = 0) -> AsyncIterator[JobData]:
           """执行爬取策略，流式产出JobData"""
           pass
       
       @abstractmethod
       def get_type(self) -> str:
           """返回策略类型标识"""
           pass
   ```

2. **具体策略类**:
   - `ApiPostStrategy` - 处理 api_post 类型 (POST JSON/form-data)
   - `ApiGetStrategy` - 处理 api_get 类型 (GET with params)
   - `HtmlStrategy` - 处理 html 类型 (HTTP + BeautifulSoup)
   - `BrowserStrategy` - 处理 browser_* 类型 (Playwright)

3. **策略注册表**:
   ```python
   STRATEGY_MAP = {
       'api_post': ApiPostStrategy,
       'api_get': ApiGetStrategy,
       'html': HtmlStrategy,
       'browser_js': BrowserStrategy,
       'browser_encrypted': BrowserStrategy,
       'browser_api': BrowserStrategy,
   }
   ```

#### Scenario: 策略动态加载
- **WHEN** UnifiedSpider 初始化时读取 config['spider_type']
- **THEN** 从 STRATEGY_MAP 获取对应 Strategy 类并实例化
- **AND** 后续 crawl() 调用委托给 strategy.execute()

### Requirement: 异步生成器流式处理
系统 SHALL 将 crawl() 方法改为异步生成器：

```python
# 新接口 (保持向后兼容)
async def crawl_stream(self, max_items: int = 0) -> AsyncIterator[JobData]:
    """流式产出JobData，降低内存峰值"""
    async for job in self._strategy.execute(self, max_items):
        yield job

# 原接口 (兼容层)
async def crawl(self, max_items: int = 0) -> List[JobData]:
    """兼容接口：收集所有结果到列表"""
    return [job async for job in self.crawl_stream(max_items)]
```

**性能要求**:
- 单次内存持有 JobData 数量 ≤ detail_concurrency (默认8)
- 支持 max_items 提前终止
- 异常时不丢失已产出的数据

#### Scenario: 大数据源流式处理
- **WHEN** 数据源有10000条岗位需要爬取
- **THEN** 内存峰值从 ~10000个JobData对象降至 ≤8个
- **AND** AsyncMultiCrawler 可边接收边写入数据库

### Requirement: 中间件管道
系统 SHALL 实现洋葱模型中间件管道：

```python
class MiddlewarePipeline:
    def __init__(self):
        self.middlewares: List[Middleware] = []
    
    def use(self, middleware: Middleware) -> 'MiddlewarePipeline':
        self.middlewares.append(middleware)
        return self
    
    async def execute(self, context: CrawlContext, handler: Callable):
        """执行中间件链"""
        idx = 0
        
        async def next_middleware():
            nonlocal idx
            if idx < len(self.middlewares):
                mw = self.middlewares[idx]
                idx += 1
                await mw.process(context, next_middleware)
            else:
                await handler(context)
        
        await next_middleware()
```

**内置中间件**:
1. **LoggerMiddleware** - 记录请求/响应日志
2. **RateLimitMiddleware** - 限速控制 (requests/second)
3. **CacheMiddleware** - 响应缓存 (TTL)
4. **ErrorHandlerMiddleware** - 统一异常捕获

#### Scenario: 中间件链式调用
- **WHEN** 发起爬取请求时
- **THEN** 依次经过 Logger → RateLimit → Cache → 实际请求 → Cache存 → Logger记录
- **AND** 任一中间件可短路返回（如Cache命中）

### Requirement: 插件化架构
系统 SHALL 支持可扩展的插件机制：

```python
class CrawlPlugin(ABC):
    @abstractmethod
    async def before_request(self, session, request_config: dict) -> dict:
        """请求前钩子：可修改request_config"""
        pass
    
    @abstractmethod
    async def after_response(self, response, job_data: JobData) -> Optional[JobData]:
        """响应后钩子：可修改/过滤job_data"""
        pass
```

**内置插件**:
- **RateLimitPlugin** - 自适应限速 (检测到429后降速)
- **ProxyPlugin** - IP代理轮换
- **MetricsPlugin** - Prometheus指标采集

## MODIFIED Requirements
### Requirement: UnifiedSpider接口兼容性
原有接口必须保持可用：
- `__init__(source_key, config, ...)` - 参数不变
- `crawl(max_items)` - 返回List[JobData] (内部使用收集器)
- `close()` - 资源清理
- **新增**: `crawl_stream(max_items)` - 返回AsyncIterator
- **新增**: `use(middleware/plugin)` - 注册中间件/插件

### Requirement: AsyncMultiCrawler适配
crawler.py 的 crawl_source() 应支持流式消费：
```python
# 当前: jobs = await spider.crawl(max_items)  # 等待全部完成
# 优化后:
async for batch in spider.crawl_stream_batches(max_items, batch_size=50):
    await db.insert_jobs_batch(list(batch))  # 边爬边写
```

## REMOVED Requirements
无（纯增量改进）
