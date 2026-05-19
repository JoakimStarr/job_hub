# 爬虫系统优化实施 Spec

## Why

根据 SPIDER\_OPTIMIZATION\_PLAN.md 分析，当前爬虫系统存在5大类问题：性能瓶颈、代码质量问题、可扩展性限制、监控运维缺陷、数据质量不足。需要系统性优化以提升吞吐量3倍、降低内存80%、提升可维护性4倍。

## What Changes

### 第一阶段：基础优化（当前实施）

- **数据库批量写入优化**: 改用真正的SQL批量化（executemany），预期提升7.5倍
- **启用WAL模式 + 连接池复用**: 减少锁冲突90%
- **统一错误处理装饰器**: @retry, @measure\_time, @catch\_and\_log
- **配置中心化**: 创建config.py dataclass，消除魔法数字
- **日志增强**: 结构化日志 + trace\_id链路追踪
- **清理死代码**: 归档过时脚本，完善requirements.txt

### 第二阶段：架构重构（后续）

- 策略模式拆分unified\_spider.py（970行→200行+4个Strategy）
- 异步生成器流式处理（内存O(N)→O(1)）
- 中间件管道 + 插件系统
- Pydantic数据校验 + 多维去重 + 清洗管道

### 第三阶段：高级特性（后续）

- Prometheus + Grafana监控
  - 健康检查端点 + 熔断器
- 分布式扩展准备

## Impact

- Affected code: src/spiders/ 全部模块
- Backward compatibility: 保持UnifiedSpider对外接口不变
- Risk level: 低（渐进式改造，每步可独立回滚）

## ADDED Requirements

### Requirement: 数据库批量写入优化

系统 SHALL 使用executemany()或构造单条多行INSERT语句替代逐条execute:

- 单次SQL调用处理50条batch（而非50次调用）
- 保持ON CONFLICT DO UPDATE语义不变
- 超500条时自动分片处理
- 预期性能: 1000条数据写入时间 < 2秒（原15秒）

#### Scenario: 批量插入性能验证

- **WHEN** 调用insert\_jobs\_batch(jobs)传入50条JobData
- **THEN** 仅执行1次SQL语句，返回影响的行数
- **AND** 写入速度 ≥ 原始实现的5倍

### Requirement: 连接池复用与WAL模式

系统 SHALL 在AsyncMultiCrawler级别共享aiohttp.ClientSession:

- TCPConnector设置limit=100, limit\_per\_host=20
- DNS缓存TTL=300秒
- SQLite启用PRAGMA journal\_mode=WAL
- 并发写入锁冲突减少90%

### Requirement: 统一错误处理装饰器

系统 SHALL 提供三个标准装饰器:

1. **@retry(max\_retries, backoff\_base)** - 指数退避重试
2. **@measure\_time** - 自动记录函数耗时到日志
3. **@catch\_and\_log(default\_return, reraise)** - 统一异常捕获和日志记录
   所有网络请求和数据解析方法都应使用这些装饰器

### Requirement: 配置中心化

系统 SHALL 创建spiders/config.py集中管理所有魔法数字:

- CrawlerConfig dataclass (frozen=True, 不可变)
- 支持环境变量覆盖 (CRAWLER\_\*)
- get\_config()全局单例
- 消除散落在各文件的硬编码常量

### Requirement: 结构化日志增强

系统 SHALL 升级loguru配置:

- 添加trace\_id链路追踪 (ContextVar)
- get\_logger(source)方法绑定source和trace\_id
- 控制台输出 + 文件输出(按天轮转)
- JSON格式输出可选(用于ELK收集)

### Requirement: 死代码清理

系统 SHALL 清理以下冗余文件:

- scripts/clean\_locations.js → 移至trash/
- scripts/clean\_locations.ts → 移至trash/
- scripts/clean\_locations\_v2.js → 移至trash/
- 创建requirements.txt列出Python依赖

## MODIFIED Requirements

### Requirement: UnifiedSpider接口兼容性

原有crawl()方法签名保持不变，内部实现可改为async generator:

```python
# 原接口 (保持兼容)
async def crawl(self, max_items: int = 0) -> List[JobData]:
    ...
```

新增流式接口供AsyncMultiCrawler使用:

```python
# 新增流式接口
async def crawl_stream(self, max_items: int = 0) -> AsyncIterator[JobData]:
    ...
```

## REMOVED Requirements

无
