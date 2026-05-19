# 爬虫系统优化重构方案 (SPIDER_OPTIMIZATION_PLAN)

> **版本**: v1.0.0
> **创建日期**: 2026-05-18
> **状态**: 规划中
> **适用范围**: `/home/joakim/Project/job_hub/spiders/` 全部爬虫模块

---

## 目录

- [1. 文档目标](#1-文档目标)
- [2. 当前架构优势](#2-当前架构优势)
- [3. 当前架构不足](#3-当前架构不足)
  - [3.1 性能瓶颈 (A)](#a-性能瓶颈)
  - [3.2 代码质量问题 (B)](#b-代码质量问题)
  - [3.3 可扩展性限制 (C)](#c-可扩展性限制)
  - [3.4 监控和运维缺陷 (D)](#d-监控和运维缺陷)
  - [3.5 数据质量保障不足 (E)](#e-数据质量保障不足)
- [4. 优化方案详情](#4-优化方案详情)
  - [4.1 方案1: 性能优化](#41-方案1性能优化预期提升2-3倍吞吐量)
  - [4.2 方案2: 代码重构](#42-方案2代码重构提升可维护性50)
  - [4.3 方案3: 可扩展性改进](#43-方案3可扩展性改进)
  - [4.4 方案4: 监控与日志增强](#44-方案4监控与日志增强)
  - [4.5 方案5: 数据质量保障](#45-方案5数据质量保障)
- [5. 实施路线图](#5-实施路线图)
- [6. 风险评估](#6-风险评估)
- [7. 预期收益总结](#7-预期收益总结)

---

## 1. 文档目标

基于当前爬虫系统的架构分析，提出**系统性、可执行的优化方案和重构计划**。

### 核心原则

| 原则 | 说明 |
|------|------|
| **渐进式改造** | 不推翻重写，分阶段迭代，每阶段可独立交付 |
| **向后兼容** | 改造期间保持现有功能正常运行 |
| **可度量** | 每个优化点都有明确的验证指标 |
| **低风险优先** | 先做高收益低风险的改动 |

---

## 2. 当前架构优势

以下设计值得肯定，优化时需保留并增强：

| # | 优势 | 现状 | 保留策略 |
|---|------|------|----------|
| 1 | **配置驱动设计** | `spider_configs.py` 集中管理所有数据源配置，新增数据源只需添加配置无需改代码 | 保持配置驱动，增强配置校验 |
| 2 | **异步并发架构** | `asyncio` + `aiohttp` 实现非阻塞IO高并发 | 保持异步模型，优化并发控制 |
| 3 | **统一接口抽象** | `UnifiedSpider` 屏蔽了底层数据源差异，对外提供统一的 `crawl()` 接口 | 保留接口契约，内部实现策略化 |
| 4 | **渐进式容错** | 浏览器信号量限制、失败队列持久化、URL去重等机制 | 增强容错，增加熔断机制 |
| 5 | **批量写入优化** | 50条一批的批量插入减少事务次数 | 进一步优化为真正的SQL批量插入 |
| 6 | **增量爬取支持** | 基于 `visited_urls` 和时间戳的增量更新 | 保留增量机制，增加更细粒度控制 |

---

## 3. 当前架构不足

### A. 性能瓶颈

#### A.1 database.py 逐条插入

```python
# 当前实现 (L90-142): 逐条execute
for job in batch:
    cursor.execute(INSERT ..., job.to_tuple())
```

**问题分析**:
- 每条 `INSERT` 都是一次独立的 SQL 调用
- 未利用数据库真正的批量化能力
- 50 条 batch 实际产生 50 次 SQL 往返

**影响**: 数据库写入成为主要瓶颈，单源 1000 条数据写入约需 15 秒

---

#### A.2 crawler.py 串行等待

```python
# 当前实现 (L109): 结果串行处理
for key, task in tasks.items():
    jobs = await task  # 必须等前一个完成才能处理下一个
    results[key] = jobs
    # ... 批量写入 ...
```

**问题分析**:
- 虽然爬取阶段是并行 (`asyncio.gather`) 的
- 但结果收集和入库是**严格串行**的
- 先完成的任务必须等待后完成的任务才能开始处理

**影响**: 整体耗时受最慢的数据源拖累（木桶效应）

---

#### A.3 内存占用过高

**问题分析**:
- `UnifiedSpider.crawl()` 将所有 `JobData` 存入内存列表再返回
- 单个数据源可能返回数千条记录
- 9 个数据源同时运行时，内存峰值可达数百 MB

**影响**: 在资源受限环境下可能触发 OOM

```
当前内存模型:
  Source A: [job1, job2, ... jobN]     ← 全部在内存
  Source B: [job1, job2, ... jobM]     ← 全部在内存
  ...
  Source I: [job1, job2, ... jobK]     ← 全部在内存
                    ↓
         峰值 = sum(all sources)
```

---

#### A.4 无连接复用

**问题分析**:
- 每次爬取都创建新的 `aiohttp.ClientSession`
- TCP 连接无法跨请求复用
- DNS 解析每次都要重新执行

**影响**: 大量时间浪费在连接建立上（TCP 握手 + TLS 协商）

---

### B. 代码质量问题

#### B.1 unified_spider.py 过长 (970行)

**问题分析**:
- 包含 4 种爬取策略的全部实现
- 违反单一职责原则 (SRP)
- 难以维护、难以测试、难以 Code Review

```
当前文件结构 (unified_spider.py ~970行):
├── 类定义 + 初始化          (~50行)
├── API POST 策略            (~200行)
├── API GET 策略             (~180行)
├── HTML 爬取策略            (~220行)
├── Browser 策略             (~220行)
└── 公共方法 (解析/校验等)    (~100行)
```

---

#### B.2 错误处理不一致

| 位置 | 处理方式 | 问题 |
|------|----------|------|
| 部分 API 调用 | `try-except` 捕获所有异常 | 吞掉了具体错误信息 |
| 部分网络请求 | 忽略异常继续执行 | 静默失败难以排查 |
| 日志记录 | info/warning/error 混用 | 无法按级别过滤 |

---

#### B.3 魔法数字散落

| 常量 | 值 | 出现位置 | 含义 |
|------|-----|----------|------|
| `MAX_RETRY` | 3 | 多处 | 最大重试次数 |
| `TIMEOUT` | 30 | 多处 | 请求超时(秒) |
| `BATCH_SIZE` | 50 | database.py | 批量写入大小 |
| `MAX_BROWSER_CONCURRENCY` | 3 | crawler.py | 浏览器并发数 |
| `detail_concurrency` | 8 | unified_spider.py | 详情页并发数 |
| `max_section_pages` | 10 | unified_spider.py | 最大翻页数 |

**问题**: 修改一个值需要搜索全部代码，容易遗漏

---

#### B.4 类型注解不完整

**问题分析**:
- 部分函数缺少返回类型注解
- 使用 `Any` 类型过多
- IDE 无法提供完整的类型推导

---

### C. 可扩展性限制

#### C.1 无法动态加载新策略

**现状**: `spider_type` 只能是预定义的几种 (`api_post`, `api_get`, `html`, `browser`)

**痛点**: 如果要支持新类型（如 GraphQL、SSE），必须修改核心代码

---

#### C.2 无中间件机制

**现状**: 无法在请求前后注入通用逻辑

**缺失能力**:
- 代理 IP 轮换
- 请求限流
- 响应缓存
- 请求/响应日志
- 自定义 Header 注入

---

#### C.3 配置热加载不支持

**现状**: 修改 `spider_configs.py` 后必须重启爬虫进程

**痛点**: 调试期频繁重启；生产环境无法动态调整参数

---

### D. 监控和运维缺陷

#### D.1 无实时监控指标

**现状**: 只有文本日志，无结构化的 metrics

**缺失指标**:
- QPS (每秒请求数)
- Latency (延迟分布 p50/p95/p99)
- Success Rate (成功率)
- Error Count (错误计数)
- Active Spiders (活跃爬虫数)

---

#### D.2 日志不够结构化

**现状**: loguru 配置基础，缺少链路追踪能力

**缺失要素**:
- Trace ID (请求链路标识)
- 结构化 JSON 输出 (便于 ELK 分析)
- 日志采样 (避免高峰期 IO 爆炸)

---

#### D.3 无健康检查端点

**现状**: 无法从外部判断爬虫是否正常工作

**需求**:
- `/health` - 存活探针 (Liveness Probe)
- `/ready` - 就绪探针 (Readiness Probe)
- `/metrics` - Prometheus 指标端点

---

### E. 数据质量保障不足

#### E.1 数据校验规则简单

**现状**: 仅检查 `title >= 2` 和 `company` 非空

**缺失校验**:
- salary 格式合法性
- location 格式标准化
- publish_date 日期有效性
- URL 格式合法性

---

#### E.2 去重粒度单一

**现状**: 只靠 `source_url` 和 `content_hash`

**场景漏洞**:
- 同一职位在不同 URL 发布 → 漏去重
- 标题几乎相同但有个别字差异 → 漏去重
- 同公司同岗位不同描述版本 → 难以判断

---

#### E.3 无数据清洗管道

**现状**: 数据直接入库，缺少标准化步骤

**需要清洗的内容**:
| 字段 | 清洗规则示例 |
|------|-------------|
| location | "北京市朝阳区" → "北京" / "北京·朝阳" |
| salary | "15-25K·14薪" → 标准薪资区间 |
| education | "本科及以上" / "大学本科" → 统一为 "本科" |
| job_type | "全职" / "正式员工" / "fulltime" → 统一 |

---

## 4. 优化方案详情

### 4.1 方案1: 性能优化（预期提升2-3倍吞吐量）

#### 4.1.1 数据库批量写入优化

```python
# 优化后的实现
async def insert_jobs_batch(self, jobs: List[JobData]) -> int:
    if not jobs:
        return 0
    
    # 构造批量 INSERT 语句
    placeholders = ",".join(["(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"] * len(jobs))
    flat_values = []
    for job in jobs:
        flat_values.extend(job.to_tuple())
    
    sql = f"""
        INSERT INTO jobs (
            title, company, location, salary, description,
            requirements, job_type, industry, education, experience,
            source, university, source_url, apply_url, content_hash
        )
        VALUES {placeholders}
        ON CONFLICT(source_url) DO UPDATE SET
            title = excluded.title,
            company = excluded.company,
            location = excluded.location,
            salary = excluded.salary,
            description = excluded.description,
            requirements = excluded.requirements,
            job_type = excluded.job_type,
            industry = excluded.industry,
            education = excluded.education,
            experience = excluded.experience,
            apply_url = excluded.apply_url,
            content_hash = excluded.content_hash,
            updated_at = CURRENT_TIMESTAMP
    """
    
    cursor = await self.db.execute(sql, flat_values)
    await self.db.commit()
    return cursor.rowcount
```

**对比**:

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| SQL 调用次数 (50条 batch) | 50 次 | **1 次** | **50x** |
| 1000 条写入耗时 | ~15s | **< 2s** | **7.5x** |
| 数据库锁持有时间 | 累积长 | 单次短 | 冲突减少 |

**注意事项**:
- SQLite 对单次 SQL 有参数数量限制 (默认 999/32766，取决于版本)
- 超 500 条的大 batch 需要分片处理
- 配合 WAL 模式效果更佳

---

#### 4.1.2 异步生成器流式处理

```python
# 优化后的 UnifiedSpider.crawl()
async def crawl(self, max_items: int = 0) -> AsyncIterator[JobData]:
    """流式产出 JobData，降低内存峰值"""
    count = 0
    async with self._create_session() as session:
        for section in self.config.get("sections", []):
            async for page_num in self._iterate_pages(session, section):
                async for item in self._fetch_list(session, page_num, section):
                    if self._should_skip(item):
                        continue
                    detail = await self._fetch_detail(session, item)
                    job = self._parse_job(detail, item)
                    if self._validate(job):
                        yield job
                        count += 1
                        
                    if max_items and count >= max_items:
                        return
```

**消费端适配**:

```python
# AsyncMultiCrawler 中流式消费
async def _consume_stream(self, source_key: str, stream: AsyncIterator[JobData]):
    """流式消费爬虫结果，边爬边写"""
    batch = []
    async for job in stream:
        batch.append(job)
        if len(batch) >= self.config.batch_size:
            await self.db.insert_jobs_batch(batch)
            batch = []
    
    # 写入剩余数据
    if batch:
        await self.db.insert_jobs_batch(batch)
```

**内存模型对比**:

```
优化前:
  Source: [job1, job2, ... jobN]  ← 全部加载到内存
  Memory Peak: O(N)

优化后:
  Source: job1 → [process] → job2 → [process] → ...
  Memory Peak: O(BatchSize) ≈ O(1)
```

**收益**: 内存占用从 O(N) 降到 O(1)，可处理无限量数据

---

#### 4.1.3 连接池复用

```python
# AsyncMultiCrawler.__init__ 优化
import aiohttp

class AsyncMultiCrawler:
    def __init__(self, config=None):
        # 共享 Session，全局复用连接
        self.session = aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(
                limit=100,           # 总连接池大小
                limit_per_host=20,   # 每主机最大连接数
                ttl_dns_cache=300,   # DNS 缓存 TTL (秒)
                force_close=False,   # 允许连接复用
                enable_cleanup_closed=True,  # 自动清理关闭的连接
            ),
            timeout=aiohttp.ClientTimeout(
                total=30,      # 总超时
                connect=10,    # 连接超时
                sock_read=20,  # 读取超时
            ),
        )
    
    async def close(self):
        """必须在程序退出时调用，释放资源"""
        await self.session.close()
```

**收益**:

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| TCP 握手次数 | 每请求一次 | 首次后复用 |
| DNS 解析 | 每请求一次 | 缓存 300s |
| 并发连接管理 | 无限制 | 受控(100/20) |
| 资源泄漏风险 | 高 (忘记 close) | 低 (集中管理) |

---

#### 4.1.4 结果并行消费

```python
# 优化后的结果收集方式
import asyncio

async def crawl_all(self, sources=None):
    tasks = {}
    for key, config in self._get_sources(sources).items():
        tasks[key] = asyncio.create_task(
            self._crawl_and_write(key, config),
            name=f"crawl-{key}"
        )
    
    # 使用 as_completed 并行消费，不等最慢的
    done_count = 0
    total = len(tasks)
    
    for coro in asyncio.as_completed(tasks.values()):
        try:
            source_key, count = await coro
            logger.info(f"[{source_key}] 完成, 获取 {count} 条")
        except Exception as e:
            logger.error(f"爬取失败: {e}")
        done_count += 1
        logger.progress(f"进度: {done_count}/{total}")
```

**收益**: 不再被最慢的数据源阻塞，整体耗时降低

---

### 4.2 方案2: 代码重构（提升可维护性50%）

#### 4.2.1 策略模式拆分

**目录结构**:

```
spiders/
├── strategies/
│   ├── __init__.py          # 策略注册表
│   ├── base.py              # 抽象基类
│   ├── api_post.py          # POST API 策略 (~250行)
│   ├── api_get.py           # GET API 策略 (~220行)
│   ├── html_strategy.py     # HTML 解析策略 (~280行)
│   └── browser_strategy.py  # 浏览器策略 (~300行)
├── unified_spider.py        # 简化为调度器 (< 200行)
└── ...
```

**基类定义**:

```python
# spiders/strategies/base.py
from abc import ABC, abstractmethod
from typing import AsyncIterator, Dict, Any, Optional
from dataclasses import dataclass

@dataclass
class CrawlContext:
    """爬取上下文，传递给策略"""
    session: Any           # aiohttp ClientSession
    config: Dict[str, Any] # 数据源配置
    max_items: int = 0     # 最大抓取数量
    visited_urls: set = None  # 已访问URL集合

class CrawlStrategy(ABC):
    """爬取策略抽象基类"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
    
    @abstractmethod
    async def execute(self, context: CrawlContext) -> AsyncIterator[Dict[str, Any]]:
        """执行爬取策略，产出原始数据字典"""
        pass
    
    @abstractmethod
    def parse_job(self, raw_data: Dict[str, Any], item_data: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
        """将原始数据解析为标准 JobData 格式"""
        pass
    
    @property
    @abstractmethod
    def strategy_type(self) -> str:
        """返回策略类型标识"""
        pass
```

**API POST 策略示例**:

```python
# spiders/strategies/api_post.py
from .base import CrawlStrategy, CrawlContext
from typing import AsyncIterator, Dict, Any, Optional
import aiohttp

class ApiPostStrategy(CrawlStrategy):
    """POST API 爬取策略"""
    
    @property
    def strategy_type(self) -> str:
        return "api_post"
    
    async def execute(self, context: CrawlContext) -> AsyncIterator[Dict[str, Any]]:
        session = context.session
        config = self.config
        count = 0
        
        for section in config.get("sections", []):
            base_url = config.get("base_url", "")
            list_url = section.get("list_url", "")
            url = base_url + list_url
            
            max_pages = min(section.get("max_pages", 10), context.max_items // 20 + 1)
            
            for page_num in range(1, max_pages + 1):
                data = {"pageNum": str(page_num)}
                
                try:
                    async with session.post(url, json=data, headers=config["headers"]) as resp:
                        result = await resp.json()
                except Exception as e:
                    logger.warning(f"[{config['name']}] 第{page_num}页请求失败: {e}")
                    continue
                
                items = self._extract_list(result, section)
                
                for item in items:
                    if context.visited_urls and item.get("url") in context.visited_urls:
                        continue
                    
                    detail = await self._fetch_detail(session, item, config)
                    job = self.parse_job(detail, item)
                    
                    if job:
                        yield job
                        count += 1
                        
                        if context.max_items and count >= context.max_items:
                            return
    
    def _extract_list(self, response: Dict, section: Dict) -> list:
        return response.get("data", {}).get("list", [])
    
    async def _fetch_detail(self, session, item: Dict, config: Dict) -> Dict:
        detail_url = item.get("detailUrl", "")
        if not detail_url:
            return item
        
        base_url = config.get("base_url", "")
        try:
            async with session.get(base_url + detail_url, headers=config["headers"]) as resp:
                return await resp.json()
        except Exception:
            return item
    
    def parse_job(self, raw_data: Dict, item_data: Dict = None) -> Optional[Dict]:
        data = raw_data.get("data", raw_data)
        if not data.get("title") or not data.get("companyName"):
            return None
        
        return {
            "title": data.get("title", ""),
            "company": data.get("companyName", ""),
            "location": data.get("city", {}).get("name", "") if isinstance(data.get("city"), dict) else data.get("city", ""),
            "salary": data.get("salaryDesc", "面议"),
            "description": data.get("positionDescription", ""),
            "requirements": "",
            "job_type": data.get("jobType", "实习"),
            "industry": data.get("industry", ""),
            "education": data.get("education", ""),
            "experience": data.get("experience", ""),
            "source": self.config.get("name", ""),
            "university": "",
            "source_url": item_data.get("url", "") if item_data else "",
            "apply_url": "",
        }
```

**UnifiedSpider 简化为调度器**:

```python
# spiders/unified_spider.py (重构后 < 200行)
from typing import AsyncIterator, Dict, Any, Optional, Set
from .strategies.base import CrawlStrategy, CrawlContext
from .strategies import STRATEGY_MAP

class UnifiedSpider(BaseSpider):
    """统一爬虫调度器 - 负责策略选择和流程编排"""
    
    def __init__(self, source_key: str, config: Dict[str, Any], db=None, visited_urls: Set[str] = None):
        super().__init__(source_key, config, db, visited_urls)
        
        strategy_type = config.get("spider_type", "api_post")
        strategy_class = STRATEGY_MAP.get(strategy_type)
        
        if not strategy_class:
            raise ValueError(f"未知的爬取策略类型: {strategy_type}")
        
        self.strategy = strategy_class(config)
        logger.info(f"[{source_key}] 使用策略: {strategy_type}")
    
    async def crawl(self, max_items: int = 0) -> AsyncIterator[Dict[str, Any]]:
        """流式产出 JobData"""
        import aiohttp
        
        async with aiohttp.ClientSession() as session:
            context = CrawlContext(
                session=session,
                config=self.config,
                max_items=max_items,
                visited_urls=self.visited_urls
            )
            
            async for job_data in self.strategy.execute(context):
                validated = self._validate_and_clean(job_data)
                if validated:
                    yield validated
    
    def _validate_and_clean(self, job_data: Dict) -> Optional[Dict]:
        """数据校验和基本清洗"""
        title = job_data.get("title", "")
        company = job_data.get("company", "")
        
        if len(title) < 2 or not company:
            return None
        
        # 基本清洗
        job_data["title"] = title.strip()
        job_data["company"] = company.strip()
        
        return job_data
```

**策略注册表**:

```python
# spiders/strategies/__init__.py
from .base import CrawlStrategy, CrawlContext
from .api_post import ApiPostStrategy
from .api_get import ApiGetStrategy
from .html_strategy import HtmlStrategy
from .browser_strategy import BrowserStrategy

STRATEGY_MAP: Dict[str, type] = {
    "api_post": ApiPostStrategy,
    "api_get": ApiGetStrategy,
    "html": HtmlStrategy,
    "browser": BrowserStrategy,
}

def register_strategy(name: str, strategy_class: type):
    """注册自定义策略 (插件化支持)"""
    STRATEGY_MAP[name] = strategy_class
```

**收益**:

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| unified_spider.py 行数 | ~970 行 | **< 200 行** |
| 单个策略文件行数 | N/A | **200-300 行** |
| 新增策略难度 | 修改核心文件 | **新增独立文件** |
| 单元测试可行性 | 困难 | **每个策略独立测试** |

---

#### 4.2.2 统一错误处理

```python
# spiders/decorators.py
import functools
import asyncio
import time
from loguru import logger
from typing import Type, Tuple, Any

def retry(max_retries: int = 3, backoff_base: float = 1.5, 
          exceptions: Tuple[Type[Exception], ...] = (Exception,),
          on_retry: callable = None):
    """
    指数退避重试装饰器
    
    Args:
        max_retries: 最大重试次数
        backoff_base: 退避基数 (等待时间 = backoff_base ^ attempt)
        exceptions: 需要重试的异常类型
        on_retry: 重试时的回调函数 (attempt, exception, wait_time) -> None
    """
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    wait = backoff_base ** attempt
                    
                    if on_retry:
                        on_retry(attempt + 1, e, wait)
                    
                    logger.warning(
                        f"[Retry] {func.__name__} 第{attempt+1}/{max_retries}次重试, "
                        f"等待 {wait:.1f}s, 错误: {e}"
                    )
                    await asyncio.sleep(wait)
            
            logger.error(f"[Retry] {func.__name__} 重试{max_retries}次后仍然失败")
            raise last_exception
        
        return wrapper
    return decorator


def measure_time(func):
    """耗时测量装饰器 (自动记录到日志)"""
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        start = time.perf_counter()
        try:
            result = await func(*args, **kwargs)
            return result
        finally:
            elapsed = time.perf_counter() - start
            logger.debug(f"[Perf] {func.__name__} 耗时 {elapsed:.2f}s")
    return wrapper


def catch_and_log(default_return=None, reraise: bool = False):
    """
    异常捕获装饰器 - 统一异常处理模式
    
    Args:
        default_return: 异常时的默认返回值
        reraise: 是否重新抛出异常
    """
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                logger.error(f"[Error] {func.__name__} 执行失败: {e}", exc_info=True)
                if reraise:
                    raise
                return default_return
        return wrapper
    return decorator
```

**使用示例**:

```python
from .decorators import retry, measure_time, catch_and_log

class ApiPostStrategy(CrawlStrategy):
    
    @retry(max_retries=3, backoff_base=2.0, exceptions=(aiohttp.ClientError, asyncio.TimeoutError))
    @measure_time
    async def _fetch_page(self, session, url, data, headers):
        async with session.post(url, json=data, headers=headers, timeout=aiohttp.ClientTimeout(total=30)) as resp:
            return await resp.json()
    
    @catch_and_log(default_return=[], reraise=False)
    async def _extract_list_safely(self, response):
        return response.get("data", {}).get("list", [])
```

---

#### 4.2.3 配置中心化

```python
# spiders/config.py
import os
from dataclasses import dataclass, field
from typing import Optional, List

@dataclass(frozen=True)
class CrawlerConfig:
    """
    全局爬虫配置 (不可变, 线程安全)
    
    使用 frozen=True 确保:
    - 创建后不可修改
    - 自动生成 __hash__
    - 天然线程安全
    """
    
    # === 重试与超时 ===
    max_retry: int = 3
    retry_backoff: float = 1.5
    request_timeout: int = 30
    connect_timeout: int = 10
    
    # === 并发控制 ===
    batch_size: int = 50
    max_browser_concurrency: int = 3
    detail_concurrency: int = 8
    max_section_pages: int = 10
    connection_pool_size: int = 100
    connections_per_host: int = 20
    
    # === 去重与存储 ===
    visited_urls_limit: int = 50000
    cleanup_percent: int = 30
    quality_threshold: float = 0.3
    
    # === 运行控制 ===
    max_runtime: int = 900       # 最大运行时间 (秒)
    enable_wal_mode: bool = True  # SQLite WAL 模式
    
    # === 数据质量 ===
    title_min_length: int = 2
    similarity_threshold: float = 0.85  # 标题去重相似度阈值
    
    # === 日志 ===
    log_dir: str = "logs"
    log_retention_days: int = 7
    
    @classmethod
    def from_env(cls) -> "CrawlerConfig":
        """从环境变量加载配置，支持容器化部署"""
        return cls(
            max_retry=int(os.getenv("CRAWLER_MAX_RETRY", "3")),
            retry_backoff=float(os.getenv("CRAWLER_RETRY_BACKOFF", "1.5")),
            request_timeout=int(os.getenv("CRAWLER_REQUEST_TIMEOUT", "30")),
            batch_size=int(os.getenv("CRAWLER_BATCH_SIZE", "50")),
            max_browser_concurrency=int(os.getenv("CRAWLER_MAX_BROWSER", "3")),
            detail_concurrency=int(os.getenv("CRAWLER_DETAIL_CONCURRENCY", "8")),
            connection_pool_size=int(os.getenv("CRAWLER_POOL_SIZE", "100")),
            visited_urls_limit=int(os.getenv("CRAWLER_VISITED_LIMIT", "50000")),
            max_runtime=int(os.getenv("CRAWLER_MAX_RUNTIME", "900")),
            enable_wal_mode=os.getenv("CRAWLER_WAL_MODE", "true").lower() == "true",
            log_dir=os.getenv("CRAWLER_LOG_DIR", "logs"),
        )
    
    def to_dict(self) -> dict:
        """导出为字典 (用于日志/展示)"""
        from dataclasses import asdict
        return asdict(self)


# 全局单例 (模块级懒加载)
_config_instance: Optional[CrawlerConfig] = None

def get_config() -> CrawlerConfig:
    """获取全局配置实例"""
    global _config_instance
    if _config_instance is None:
        _config_instance = CrawlerConfig.from_env()
    return _config_instance

def reset_config(config: CrawlerConfig = None):
    """重置配置 (主要用于测试)"""
    global _config_instance
    _config_instance = config or CrawlerConfig.from_env()
```

**使用方式**:

```python
from spiders.config import get_config, CrawlerConfig

# 方式1: 直接使用全局配置
config = get_config()
timeout = config.request_timeout  # 30

# 方式2: 测试时注入自定义配置
test_config = CrawlerConfig(max_retry=1, request_timeout=5)
reset_config(test_config)

# 方式3: 环境变量覆盖
# export CRAWLER_MAX_RETRY=5
# export CRAWLER_BATCH_SIZE=100
```

---

### 4.3 方案3: 可扩展性改进

#### 4.3.1 插件化架构

```python
# spiders/plugins/base.py
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from dataclasses import dataclass, field

@dataclass
class RequestContext:
    """请求上下文"""
    url: str
    method: str = "GET"
    headers: Dict[str, str] = field(default_factory=dict)
    params: Dict[str, Any] = field(default_factory=dict)
    data: Any = None
    proxy: Optional[str] = None
    timeout: Optional[int] = None

@dataclass  
class ResponseContext:
    """响应上下文"""
    status_code: int
    headers: Dict[str, str]
    data: Any
    elapsed: float  # 响应时间 (秒)

class CrawlPlugin(ABC):
    """爬虫插件基类"""
    
    @property
    @abstractmethod
    def name(self) -> str:
        """插件名称"""
        pass
    
    @abstractmethod
    async def before_request(self, ctx: RequestContext) -> Optional[RequestContext]:
        """
        请求前钩子
        
        Returns:
            修改后的 RequestContext, 或 None 表示拒绝该请求
        """
        pass
    
    @abstractmethod
    async def after_response(self, req_ctx: RequestContext, resp_ctx: ResponseContext) -> ResponseContext:
        """
        响应后钩子
        
        Returns:
            可能修改过的 ResponseContext
        """
        pass
```

**内置插件实现**:

```python
# spiders/plugins/rate_limit.py
import time
import asyncio
from .base import CrawlPlugin, RequestContext, ResponseContext

class RateLimitPlugin(CrawlPlugin):
    """限速插件 - 控制请求频率"""
    
    def __init__(self, requests_per_second: float = 1.0, per_host: bool = True):
        self.interval = 1.0 / requests_per_second
        self.last_request: float = 0
        self.host_times: Dict[str, float] = {} if per_host else None
        self.per_host = per_host
    
    @property
    def name(self) -> str:
        return "rate_limit"
    
    async def before_request(self, ctx: RequestContext) -> RequestContext:
        now = time.monotonic()
        
        if self.per_host and self.host_times is not None:
            from urllib.parse import urlparse
            host = urlparse(ctx.url).hostname or ""
            last = self.host_times.get(host, 0)
            elapsed = now - last
        else:
            elapsed = now - self.last_request
        
        if elapsed < self.interval:
            await asyncio.sleep(self.interval - elapsed)
        
        if self.per_host and self.host_times is not None:
            self.host_times[host] = time.monotonic()
        else:
            self.last_request = time.monotonic()
        
        return ctx
    
    async def after_response(self, req_ctx: RequestContext, resp_ctx: ResponseContext) -> ResponseContext:
        return resp_ctx


# spiders/plugins/proxy.py
from itertools import cycle
from .base import CrawlPlugin, RequestContext, ResponseContext

class ProxyPlugin(CrawlPlugin):
    """代理 IP 轮换插件"""
    
    def __init__(self, proxy_list: list):
        self.proxies = cycle(proxy_list)
        self.current_proxy = None
    
    @property
    def name(self) -> str:
        return "proxy_rotation"
    
    async def before_request(self, ctx: RequestContext) -> RequestContext:
        self.current_proxy = next(self.proxies)
        ctx.proxy = self.current_proxy
        return ctx
    
    async def after_response(self, req_ctx: RequestContext, resp_ctx: ResponseContext) -> ResponseContext:
        return resp_ctx


# spiders/plugins/cache.py
from .base import CrawlPlugin, RequestContext, ResponseContext
import hashlib
import json

class CachePlugin(CrawlPlugin):
    """响应缓存插件 - 避免重复请求相同 URL"""
    
    def __init__(self, ttl_seconds: int = 300):
        self.cache: Dict[str, tuple] = {}  # key -> (data, timestamp)
        self.ttl = ttl_seconds
        self.hits = 0
        self.misses = 0
    
    @property
    def name(self) -> str:
        return "response_cache"
    
    def _cache_key(self, ctx: RequestContext) -> str:
        raw = f"{ctx.method}:{ctx.url}:{json.dumps(ctx.params, sort_keys=True)}"
        return hashlib.md5(raw.encode()).hexdigest()
    
    async def before_request(self, ctx: RequestContext) -> RequestContext:
        key = self._cache_key(ctx)
        
        if key in self.cache:
            data, ts = self.cache[key]
            if time.monotonic() - ts < self.ttl:
                self.hits += 1
                ctx._cached_response = data  # 标记为命中缓存
                return ctx
        
        self.misses += 1
        return ctx
    
    async def after_response(self, req_ctx: RequestContext, resp_ctx: ResponseContext) -> ResponseContext:
        if hasattr(req_ctx, '_cached_response'):
            return ResponseContext(
                status_code=200,
                headers={},
                data=req_ctx._cached_response,
                elapsed=0.001
            )
        
        key = self._cache_key(req_ctx)
        self.cache[key] = (resp_ctx.data, time.monotonic())
        return resp_ctx
    
    @property
    def stats(self) -> dict:
        return {"hits": self.hits, "misses": self.misses, "size": len(self.cache)}
```

---

#### 4.3.2 中间件管道

```python
# spiders/middleware.py
from typing import List, Callable, Awaitable, Any
from loguru import logger
from .plugins.base import RequestContext, ResponseContext, CrawlPlugin

MiddlewareFn = Callable[[RequestContext, 'NextFn'], Awaitable[ResponseContext]]
NextFn = Callable[[], Awaitable[ResponseContext]]
HandlerFn = Callable[[ResponseContext], Awaitable[Any]]

class MiddlewarePipeline:
    """
    中间件管道 (类似 Koa 的洋葱模型)
    
    执行顺序:
        use(A) → use(B) → use(C) → handler
        响应顺序:
        handler ← C ← B ← A
    """
    
    def __init__(self):
        self.middlewares: List[MiddlewareFn] = []
        self.plugins: List[CrawlPlugin] = []
    
    def use(self, middleware: MiddlewareFn) -> 'MiddlewarePipeline':
        """注册中间件"""
        self.middlewares.append(middleware)
        return self
    
    def add_plugin(self, plugin: CrawlPlugin) -> 'MiddlewarePipeline':
        """注册插件 (自动转换为中间件)"""
        self.plugins.append(plugin)
        
        async def plugin_middleware(ctx: RequestContext, next_fn: NextFn) -> ResponseContext:
            ctx = await plugin.before_request(ctx)
            if ctx is None:
                return ResponseContext(status_code=0, headers={}, data=None, elapsed=0)
            
            resp = await next_fn()
            return await plugin.after_response(ctx, resp)
        
        self.middlewares.append(plugin_middleware)
        return self
    
    async def execute(self, ctx: RequestContext, handler: HandlerFn) -> Any:
        """执行完整中间件链"""
        idx = 0
        mw_count = len(self.middlewares)
        
        async def next_middleware():
            nonlocal idx
            if idx < mw_count:
                mw = self.middlewares[idx]
                idx += 1
                return await mw(ctx, next_middleware)
            else:
                # 所有中间件执行完毕，调用最终处理器
                resp = await handler(ctx)
                return resp
        
        result = await next_middleware()
        return result
```

**使用示例**:

```python
# 构建中间件管道
pipeline = (
    MiddlewarePipeline()
    .add_plugin(RateLimitPlugin(requests_per_second=2.0))
    .add_plugin(ProxyModule(proxy_list=["http://proxy1:8080", "http://proxy2:8080"]))
    .add_plugin(CachePlugin(ttl_seconds=600))
    .use(error_handler_middleware)   # 自定义错误处理
    .use(logging_middleware)         # 请求日志记录
)

# 在 Strategy 中使用
async def fetch_with_pipeline(self, session, url, pipeline):
    ctx = RequestContext(url=url, method="GET")
    
    async def actual_handler(ctx: RequestContext) -> ResponseContext:
        async with session.get(
            ctx.url, 
            proxy=ctx.proxy,
            timeout=aiohttp.ClientTimeout(total=ctx.timeout or 30)
        ) as resp:
            data = await resp.json()
            return ResponseContext(
                status_code=resp.status,
                headers=dict(resp.headers),
                data=data,
                elapsed=...
            )
    
    result = await pipeline.execute(ctx, actual_handler)
    return result.data
```

**洋葱模型示意**:

```
请求流入:
  RateLimit → Proxy → Cache → Logger → [实际请求]
                                              ↓
响应流出:
  [实际响应] ← Logger ← Cache ← Proxy ← RateLimit
```

---

### 4.4 方案4: 监控与日志增强

#### 4.1 Prometheus Metrics

```python
# spiders/metrics.py
from prometheus_client import Counter, Histogram, Gauge, Info
from prometheus_client import start_http_server
import time
from functools import wraps
from typing import Callable, Any

# ========== 定义监控指标 ==========

REQUEST_COUNT = Counter(
    'crawler_requests_total',
    'Total crawl requests',
    ['source', 'method', 'status']  # labels: 用于分组聚合
)

REQUEST_LATENCY = Histogram(
    'crawler_request_duration_seconds',
    'Request latency in seconds',
    ['source', 'method'],
    buckets=[0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0]  # 分位数桶
)

ACTIVE_SPIDERS = Gauge(
    'crawler_active_spiders',
    'Number of currently running spiders'
)

JOBS_DISCOVERED = Counter(
    'crawler_jobs_discovered_total',
    'Total jobs discovered',
    ['source']
)

JOBS_INSERTED = Counter(
    'crawler_jobs_inserted_total',
    'Total jobs inserted into DB',
    ['source', 'status']  # status: new/updated/duplicate
)

FAILED_QUEUE_SIZE = Gauge(
    'crawler_failed_queue_size',
    'Current size of failed queue'
)

MEMORY_USAGE = Gauge(
    'crawler_memory_usage_bytes',
    'Current memory usage in bytes'
)

CRAWLER_INFO = Info(
    'crawler_info',
    'Crawler version and configuration'
)


# ========== 装饰器集成 ==========

def track_request(source: str, method: str = 'crawl'):
    """自动追踪请求指标装饰器"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            REQUEST_COUNT.labels(source=source, method=method, status='started').inc()
            ACTIVE_SPIDERS.inc()
            
            with REQUEST_LATENCY.labels(source=source, method=method).time():
                try:
                    result = await func(*args, **kwargs)
                    REQUEST_COUNT.labels(source=source, method=method, status='success').inc()
                    return result
                except Exception as e:
                    REQUEST_COUNT.labels(source=source, method=method, status='error').inc()
                    raise
                finally:
                    ACTIVE_SPIDERS.dec()
        return wrapper
    return decorator


def start_metrics_server(port: int = 9090):
    """启动 Prometheus metrics HTTP 服务"""
    start_http_server(port)
    logger.info(f"Prometheus metrics server started on :{port}")


# ========== 手动上报辅助 ==========

def report_jobs(source: str, discovered: int, inserted: int, updated: int, duplicates: int):
    """批量上报数据处理指标"""
    JOBS_DISCOVERED.labels(source=source).inc(discovered)
    JOBS_INSERTED.labels(source=source, status='new').inc(inserted)
    JOBS_INSERTED.labels(source=source, status='updated').inc(updated)
    JOBS_INSERTED.labels(source=source, status='duplicate').inc(duplicates)


def update_system_info(version: str, config_summary: dict):
    """更新爬虫元信息"""
    CRAWLER_INFO.info({'version': version, **config_summary})
```

**Grafana Dashboard 设计**:

| 面板名称 | 类型 | 指标 | 说明 |
|----------|------|------|------|
| 总请求数 | TimeSeries | `crawler_requests_total` | 各数据源请求趋势 |
| 请求延迟 P99 | Heatmap | `crawler_request_duration_seconds` | 延迟热力分布 |
| 成功率 | Stat | success / total * 100% | 实时成功率 |
| 活跃爬虫数 | Gauge | `crawler_active_spiders` | 当前运行的爬虫数 |
| 发现职位数 | Counter | `crawler_jobs_discovered_total` | 累计发现职位 |
| 入库职位分布 | Pie | `crawler_jobs_inserted_total` by status | 新增/更新/去重占比 |
| 失败队列 | SingleStat | `crawler_failed_queue_size` | 待重试队列长度 |
| 错误分类 | Table | `crawler_requests_total{status="error"}` by source | 各数据源错误数 |

---

#### 4.2 结构化日志

```python
# spiders/logger.py
import os
import sys
import time
import uuid
import loguru
from contextvars import ContextVar
from typing import Optional

# ========== 链路追踪 ID ==========
trace_id_var: ContextVar[str] = ContextVar('trace_id', default='')
span_id_var: ContextVar[str] = ContextVar('span_id', default='')


def setup_logging(log_dir: str = "logs", level: str = "DEBUG"):
    """初始化结构化日志系统"""
    
    # 移除默认 handler
    loguru.logger.remove()
    
    # 确保日志目录存在
    os.makedirs(log_dir, exist_ok=True)
    
    # 控制台输出 (开发调试用)
    loguru.logger.add(
        sys.stderr,
        level=level,
        format=(
            "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{extra[source]}</cyan> | "
            "<cyan>{extra[trace_id]}</cyan> | "
            "{message}"
        ),
        colorize=True,
    )
    
    # 文件输出 (按天轮转)
    loguru.logger.add(
        f"{log_dir}/crawler_{{time:YYYYMMDD}}.log",
        rotation="00:00",
        retention="7 days",
        compression="gz",
        level=level,
        format=(
            "{time:YYYY-MM-DD HH:mm:ss.SSS} | "
            "{level: <8} | "
            "{extra[source]} | "
            "{extra[trace_id]} | "
            "{message}"
        ),
        enqueue=True,      # 异步写入，不阻塞主线程
        backtrace=True,    # 完整堆栈追溯
        diagnose=True,     # 变量值诊断
        encoding="utf-8",
    )
    
    # JSON 格式输出 (用于 ELK/Loki 收集)
    loguru.logger.add(
        f"{log_dir}/crawler_{{time:YYYYMMDD}}.json.log",
        rotation="00:00",
        retention="3 days",
        serialization="json_encode",  # JSON 格式
        level=level,
        enqueue=True,
    )


def bind_trace_id(trace_id: Optional[str] = None):
    """绑定链路追踪 ID"""
    trace_id_var.set(trace_id or uuid.uuid4().hex[:8])
    span_id_var.set(uuid.uuid4().hex[:4])


def get_trace_id() -> str:
    """获取当前链路追踪 ID"""
    return trace_id_var.get()


def child_span(name: str):
    """创建子 span (用于嵌套操作追踪)"""
    parent = span_id_var.get()
    child = f"{parent}-{name[:4]}" if parent else name[:4]
    span_id_var.set(child)


def get_logger(source: str = "system"):
    """
    获取带 source 和 trace_id 的 logger
    
    Args:
        source: 数据源标识 (如 'boss', 'lagou', 'liepin')
    
    Usage:
        logger = get_logger('boss')
        logger.info('开始爬取第{}页', page_num)
    """
    return loguru.logger.bind(
        source=source,
        trace_id=trace_id_var.get(),
        span_id=span_id_var.get()
    )


# ========== 日志输出示例 ==========
#
# 2026-05-18 10:23:45.123 | INFO     | boss    | a1b2c3d4 | 开始爬取 boss 直聘
# 2026-05-18 10:23:45.456 | DEBUG    | boss    | a1b2c3d4 | 请求列表页 pageNum=1
# 2026-05-18 10:23:46.789 | WARNING  | boss    | a1b2c3d4 | 第3页请求超时, 将重试
# 2026-05-18 10:23:47.012 | ERROR    | boss    | a1b2c3d4 | 详情页解析失败: KeyError 'salary'
```

---

#### 4.3 健康检查端点

```python
# spiders/health.py
from aiohttp import web
import time
import psutil
from typing import Dict, Any
from .metrics import FAILED_QUEUE_SIZE, ACTIVE_SPIDERS

class HealthChecker:
    """爬虫健康检查服务"""
    
    def __init__(self, crawler=None):
        self.crawler = crawler
        self.start_time = time.time()
        self.last_success_time: float = self.start_time
        self.consecutive_errors: int = 0
        self.is_shutting_down: bool = False
    
    def record_success(self):
        """记录成功操作"""
        self.last_success_time = time.time()
        self.consecutive_errors = 0
    
    def record_error(self):
        """记录错误"""
        self.consecutive_errors += 1
    
    async def liveness_handler(self, request: web.Request) -> web.Response:
        """
        存活探针 (Liveness Probe)
        
        - 进程存活即返回 200
        - 用于 K8s 判断是否需要重启 Pod
        """
        return web.json_response({
            "status": "alive",
            "uptime_seconds": round(time.time() - self.start_time, 1)
        })
    
    async def readiness_handler(self, request: web.Request) -> web.Response:
        """
        就绪探针 (Readiness Probe)
        
        - 检查是否可以接收流量
        - 连续错误过多则标记为未就绪
        """
        checks: Dict[str, Any] = {
            "consecutive_errors_ok": self.consecutive_errors < 10,
            "not_shutting_down": not self.is_shutting_down,
        }
        
        all_ok = all(checks.values())
        status = "ready" if all_ok else "not_ready"
        http_status = 200 if all_ok else 503
        
        return web.json_response({
            "status": status,
            "checks": checks,
            "last_success_ago_seconds": round(time.time() - self.last_success_time, 1) if self.last_success_time else None
        }, status=http_status)
    
    async def metrics_handler(self, request: web.Request) -> web.Response:
        """Prometheus metrics 端点"""
        from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
        output = generate_latest()
        return web.Response(
            body=output,
            content_type=CONTENT_TYPE_LATEST
        )
    
    async def detailed_handler(self, request: web.Request) -> web.Response:
        """详细状态端点 (用于人工查看)"""
        process = psutil.Process()
        mem_info = process.memory_info()
        
        return web.json_response({
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "uptime_seconds": round(time.time() - self.start_time, 1),
            "system": {
                "cpu_percent": psutil.cpu_percent(interval=0.1),
                "memory_rss_mb": round(mem_info.rss / 1024 / 1024, 1),
                "memory_percent": round(process.memory_percent(), 1),
                "thread_count": process.num_threads(),
                "fd_count": process.num_fds(),
            },
            "crawler": {
                "active_spiders": int(ACTIVE_SPIDERS._value.get()),
                "failed_queue_size": int(FAILED_QUEUE_SIZE._value.get()),
                "last_success_ago_seconds": round(time.time() - self.last_success_time, 1),
                "consecutive_errors": self.consecutive_errors,
                "is_shutting_down": self.is_shutting_down,
            }
        })


def create_health_app(health_checker: HealthChecker) -> web.Application:
    """创建健康检查 HTTP 应用"""
    app = web.Application()
    app.router.add_get('/health', health_checker.liveness_handler)
    app.router.add_get('/ready', health_checker.readiness_handler)
    app.router.add_get('/metrics', health_checker.metrics_handler)
    app.router.add_get('/status', health_checker.detailed_handler)
    return app
```

**端点说明**:

| 端点 | 用途 | 正常状态码 | 用途 |
|------|------|-----------|------|
| `GET /health` | 存活探针 | 200 | K8s Liveness Probe |
| `GET /ready` | 就绪探针 | 200 / 503 | K8s Readiness Probe |
| `GET /metrics` | Prometheus 指标 | 200 | Prometheus 抓取 |
| `GET /status` | 详细状态 | 200 | 人工查看/调试 |

---

### 4.5 方案5: 数据质量保障

#### 4.5.1 Pydantic 数据校验

```python
# spiders/models.py
from pydantic import BaseModel, validator, Field, ValidationError
from typing import Optional, List
from datetime import date, datetime
import re

def normalize_publish_date(v) -> Optional[date]:
    """解析各种日期格式"""
    if v is None:
        return None
    if isinstance(v, date):
        return v
    if isinstance(v, (int, float)):
        try:
            return datetime.fromtimestamp(v).date()
        except (ValueError, OSError):
            return None
    
    s = str(v).strip()
    if not s:
        return None
    
    formats = [
        "%Y-%m-%d", "%Y/%m/%d", "%Y年%m月%d日",
        "%m-%d", "%m/%d",
        "%Y-%m-%d %H:%M:%S",
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    
    # 相对时间: "3天前", "刚刚", "昨天"
    relative_patterns = [
        (r'(\d+)天前', lambda m: (datetime.now() - __import__('datetime').timedelta(days=int(m.group(1)))).date()),
        (r'昨天', lambda m: (datetime.now() - __import__('datetime').timedelta(days=1)).date()),
        (r'前天', lambda m: (datetime.now() - __import__('datetime').timedelta(days=2)).date()),
        (r'刚刚|今天', lambda m: datetime.now().date()),
    ]
    
    for pattern, handler in relative_patterns:
        match = re.match(pattern, s)
        if match:
            return handler(match)
    
    return None


def extract_salary(salary_str: str) -> str:
    """提取和标准化薪资字符串"""
    if not salary_str or salary_str == "面议":
        return "面议"
    
    # 去除多余空白
    salary_str = re.sub(r'\s+', '', salary_str)
    
    # 匹配常见格式: "15-25K", "8-12K·14薪", "3000-5000元/月"
    pattern = r'(\d+)[\-~至]*(\d+)\s*(K|k|千|万)?\s*(?:\*?(\\d+) ?薪)?(?:元?/?月)?'
    match = re.search(pattern, salary_str)
    
    if match:
        low, high, unit, months = match.groups()
        unit = (unit or "").lower()
        months = int(months) if months else 12
        
        low_val, high_val = int(low), int(high)
        
        if unit == '万':
            low_val, high_val = low_val * 10000, high_val * 10000
        elif unit == 'k':
            low_val, high_val = low_val * 1000, high_val * 1000
        elif unit == '千':
            low_val, high_val = low_val * 1000, high_val * 1000
        
        annual_low = low_val * months
        annual_high = high_val * months
        
        return f"{low}-{high}{unit or '元'}{'·' + str(months) + '薪' if months != 12 else ''}"
    
    return salary_str


class JobDataModel(BaseModel):
    """严格的职位数据模型定义"""
    
    # 基本信息
    title: str = Field(..., min_length=2, max_length=200, description="职位标题")
    company: str = Field(..., min_length=1, max_length=200, description="公司名称")
    location: Optional[str] = Field(default="", max_length=100, description="工作地点")
    salary: Optional[str] = Field(default="面议", max_length=50, description="薪资范围")
    
    # 详细信息
    description: Optional[str] = Field(default="", max_length=10000, description="职位描述")
    requirements: Optional[str] = Field(default="", max_length=5000, description="任职要求")
    
    # 分类标签
    job_type: str = Field(
        default="实习", 
        pattern=r'^(全职|实习|兼职|外包)$',
        description="工作类型"
    )
    industry: Optional[str] = Field(default="", max_length=100, description="所属行业")
    education: Optional[str] = Field(default="", max_length=100, description="学历要求")
    experience: Optional[str] = Field(default="", description="经验要求")
    
    # 来源信息
    source: str = Field(..., description="数据来源平台")
    university: Optional[str] = Field(default="", description="目标院校")
    source_url: str = Field(..., min_length=1, description="来源链接")
    apply_url: Optional[str] = Field(default="", description="申请链接")
    
    # 时间字段
    publish_date: Optional[date] = Field(default=None, description="发布日期")
    deadline: Optional[date] = Field(default=None, description="截止日期")
    
    # 内部字段
    content_hash: Optional[str] = Field(default=None, description="内容哈希")
    
    class Config:
        extra = "ignore"  # 忽略额外字段
        validate_assignment = True  # 赋值时也进行校验
    
    @validator('publish_date', pre=True, always=True)
    def parse_publish_date(cls, v):
        return normalize_publish_date(v)
    
    @validator('salary', pre=True, always=True)
    def normalize_salary(cls, v):
        if isinstance(v, str):
            return extract_salary(v)
        return v or "面议"
    
    @validator('location', pre=True)
    def normalize_location(cls, v):
        if v and isinstance(v, str):
            return v.strip()
        return v or ""
    
    @validator('title', pre=True)
    def clean_title(cls, v):
        if isinstance(v, str):
            return v.strip()
        return v


# ========== 使用示例 ==========
def validate_job(raw_data: dict):
    """校验并转换原始数据"""
    try:
        valid_job = JobDataModel(**raw_data)
        return valid_job.dict(), None
    except ValidationError as e:
        errors = [
            {'field': err['loc'][0], 'message': err['msg'], 'value': err.get('input')}
            for err in e.errors()
        ]
        return None, errors
```

**校验覆盖的字段**:

| 字段 | 校验规则 | 说明 |
|------|----------|------|
| title | 长度 2-200, 去除首尾空白 | 过滤无效标题 |
| company | 长度 1-200, 非空 | 必须有公司名 |
| job_type | 枚举值: 全职/实习/兼职/外包 | 统一分类 |
| publish_date | 多种日期格式解析 | 兼容各平台 |
| salary | 格式提取和标准化 | 统一薪资表示 |
| source_url | 非空 | 保证可溯源 |

---

#### 4.5.2 多维去重

```python
# spiders/deduplicator.py
from difflib import SequenceMatcher
import hashlib
import re
from typing import Set, Optional
from dataclasses import dataclass
from loguru import logger

@dataclass
class DedupResult:
    """去重结果"""
    is_duplicate: bool
    reason: str = ""  # 去重原因
    similarity: float = 0.0  # 相似度 (仅模糊匹配时有值)


class ContentDeduplicator:
    """多维内容去重器"""
    
    def __init__(
        self, 
        existing_urls: Set[str] = None,
        existing_hashes: Set[str] = None,
        similarity_threshold: float = 0.85
    ):
        self.existing_urls: Set[str] = existing_urls or set()
        self.existing_hashes: Set[str] = existing_hashes or set()
        self.threshold = similarity_threshold
        self.seen_titles: dict = {}  # normalized_hash -> normalized_title
        
    def check(self, job: dict) -> DedupResult:
        """
        三维度去重检查
        
        维度1: URL 精确去重 (最快, 最可靠)
        维度2: 内容哈希去重 (标题+公司+地点 组合)
        维度3: 标题相似度去重 (模糊匹配, 防止变体)
        """
        source_url = job.get('source_url', '')
        title = job.get('title', '')
        company = job.get('company', '')
        location = job.get('location', '')
        
        # 维度1: URL 精确匹配
        if source_url and source_url in self.existing_urls:
            return DedupResult(is_duplicate=True, reason="url_exact_match")
        
        # 维度2: 内容哈希匹配
        content = f"{title}|{company}|{location}"
        content_hash = hashlib.md5(content.encode('utf-8')).hexdigest()
        
        if content_hash in self.existing_hashes:
            return DedupResult(is_duplicate=True, reason="content_hash_match")
        
        # 维度3: 标题相似度匹配
        normalized = self._normalize_title(title)
        if normalized:
            title_sig = hashlib.sha256(normalized.encode('utf-8')).hexdigest()
            
            if title_sig in self.seen_titles:
                seen = self.seen_titles[title_sig]
                similarity = SequenceMatcher(None, normalized, seen).ratio()
                
                if similarity > self.threshold:
                    logger.info(
                        f"发现相似标题 (相似度={similarity:.2f}): "
                        f"'{title}' ~ '{seen}'"
                    )
                    return DedupResult(
                        is_duplicate=True, 
                        reason="title_similarity",
                        similarity=similarity
                    )
            else:
                self.seen_titles[title_sig] = normalized
        
        # 通过所有检查，记录已见
        if source_url:
            self.existing_urls.add(source_url)
        self.existing_hashes.add(content_hash)
        
        return DedupResult(is_duplicate=False)
    
    def _normalize_title(self, title: str) -> str:
        """标题标准化 (去除特殊字符、统一大小写、去除冗余)"""
        if not title:
            return ""
        
        # 去除括号及内容
        title = re.sub(r'[【】\[\]()（）]', '', title)
        # 去除特殊标记
        title = re.sub(r'[★☆●○◆◇▸▹►▻→➤✦✧※★☆].*$', '', title)
        # 合并空白
        title = re.sub(r'\s+', '', title)
        # 统一英文大小写
        title = title.lower().strip()
        
        return title
    
    def record(self, job: dict):
        """手动记录一条已处理的 job (用于预加载数据库已有数据)"""
        source_url = job.get('source_url', '')
        title = job.get('title', '')
        company = job.get('company', '')
        location = job.get('location', '')
        
        if source_url:
            self.existing_urls.add(source_url)
        
        content = f"{title}|{company}|{location}"
        content_hash = hashlib.md5(content.encode('utf-8')).hexdigest()
        self.existing_hashes.add(content_hash)
        
        normalized = self._normalize_title(title)
        if normalized:
            title_sig = hashlib.sha256(normalized.encode('utf-8')).hexdigest()
            self.seen_titles[title_sig] = normalized
    
    @property
    def stats(self) -> dict:
        """统计信息"""
        return {
            "known_urls": len(self.existing_urls),
            "known_hashes": len(self.existing_hashes),
            "known_titles": len(self.seen_titles),
        }
```

---

#### 4.5.3 数据清洗管道

```python
# spiders/cleaners.py
import re
from typing import Optional, Callable, Any
from dataclasses import dataclass

@dataclass
class CleanResult:
    """清洗结果"""
    value: Any
    was_cleaned: bool = False
    original: Any = None


class DataCleaner:
    """数据清洗管道"""
    
    def __init__(self):
        self.rules: dict[str, list[Callable]] = {
            'location': [self.clean_location],
            'salary': [self.normalize_salary_text],
            'education': [self.standardize_education],
            'experience': [self.standardize_experience],
            'title': [self.clean_title_text],
            'description': [self.clean_html_tags, self.normalize_whitespace],
        }
    
    def clean(self, job: dict) -> dict:
        """执行全部清洗规则"""
        cleaned = job.copy()
        
        for field, rules in self.rules.items():
            if field in cleaned and cleaned[field]:
                for rule in rules:
                    result = rule(cleaned[field])
                    cleaned[field] = result.value
        
        return cleaned
    
    def clean_location(self, value: str) -> CleanResult:
        """地点标准化"""
        original = value
        value = value.strip()
        
        # 去除 "中国"、"全国" 等无意义前缀
        value = re.sub(r'^[中国全国]*', '', value)
        
        # 标准化分隔符
        value = re.sub(r'[·\-—～~]', '-', value)
        
        # 常见简写映射
        city_map = {
            '北京': '北京', '上海市': '上海', '广州': '广州', '深圳市': '深圳',
            '杭州': '杭州', '成都': '成都', '武汉': '武汉', '南京': '南京',
            '西安': '西安', '重庆': '重庆', '苏州': '苏州', '天津': '天津',
        }
        
        for full, short in city_map.items():
            if value.startswith(full):
                value = value.replace(full, short, 1)
                break
        
        was_cleaned = value != original
        return CleanResult(value=value, was_cleaned=was_cleaned, original=original)
    
    def normalize_salary_text(self, value: str) -> CleanResult:
        """薪资文本标准化"""
        original = value
        value = value.strip()
        
        if value in ('', '面议', '薪资面议', '面谈'):
            return CleanResult(value='面议', was_cleaned=(original != '面议'), original=original)
        
        # 统一单位
        value = re.sub(r'元/月', '', value)
        value = re.sub(r'元/天', '/天', value)
        value = re.sub(r'元/年', '/年', value)
        value = re.sub(r'元/小时', '/时', value)
        
        # 绩效/奖金标注规范化
        value = re.sub(r'[·\*×]?\s*(\d+)\s*[～\-]?\s*(\d+)\s*薪', r'·\1-\2薪', value)
        
        was_cleaned = value != original
        return CleanResult(value=value, was_cleaned=was_cleaned, original=original)
    
    def standardize_education(self, value: str) -> CleanResult:
        """学历标准化"""
        original = value
        value = value.strip()
        
        edu_map = {
            # 本科
            '本科及以上': '本科', '大学本科': '本科', '本科学历': '本科',
            '学士学位': '本科', '本科': '本科', '大四': '本科',
            '统招本科': '本科', '全日制本科': '本科',
            # 大专
            '大专及以上': '大专', '专科': '大专', '大专': '大专',
            '高职大专': '大专', '高职': '大专',
            # 硕士
            '硕士及以上': '硕士', '硕士研究生': '硕士', '硕士': '硕士',
            '研究生': '硕士', 'MPAcc': '硕士',
            # 博士
            '博士研究生': '博士', '博士': '博士',
            # 其他
            '不限': '不限', '学历不限': '不限', '无要求': '不限',
            '高中': '高中', '中专': '中专', '中技': '中技',
        }
        
        for variant, standard in edu_map.items():
            if value.lower() == variant.lower() or variant in value:
                value = standard
                break
        
        was_cleaned = value != original
        return CleanResult(value=value, was_cleaned=was_cleaned, original=original)
    
    def standardize_experience(self, value: str) -> CleanResult:
        """经验要求标准化"""
        original = value
        value = value.strip()
        
        exp_map = {
            '在校生': '应届/在校', '应届毕业生': '应届/在校', '应届生': '应届/在校',
            '1年以下': '1年以内', '1年以内': '1年以内', '经验不限': '不限',
            '1-3年': '1-3年', '3-5年': '3-5年', '5-10年': '5-10年',
            '10年以上': '10年以上', '无工作经验': '应届/在校',
        }
        
        for variant, standard in exp_map.items():
            if variant in value:
                value = standard
                break
        
        was_cleaned = value != original
        return CleanResult(value=value, was_cleaned=was_cleaned, original=original)
    
    def clean_title_text(self, value: str) -> CleanResult:
        """标题清洗"""
        original = value
        value = value.strip()
        
        # 去除首尾特殊字符
        value = re.sub(r'^[\s【\[（(]+|[\s】\]）)+$', '', value)
        # 去除多余空白
        value = re.sub(r'\s{2,}', ' ', value)
        
        was_cleaned = value != original
        return CleanResult(value=value, was_cleaned=was_cleaned, original=original)
    
    def clean_html_tags(self, value: str) -> CleanResult:
        """去除 HTML 标签"""
        original = value
        value = re.sub(r'<[^>]+>', '', value)
        was_cleaned = value != original
        return CleanResult(value=value, was_cleaned=was_cleaned, original=original)
    
    def normalize_whitespace(self, value: str) -> CleanResult:
        """标准化空白字符"""
        original = value
        value = re.sub(r'\n{3,}', '\n\n', value)
        value = re.sub(r'[ \t]+', ' ', value)
        value = value.strip()
        was_cleaned = value != original
        return CleanResult(value=value, was_cleaned=was_cleaned, original=original)
```

**使用方式**:

```python
cleaner = DataCleaner()

raw_job = {
    "title": " 【急招】Python开发工程师  ",
    "company": "某某科技有限公司",
    "location": "中国北京市朝阳区",
    "salary": "15-25K·14薪",
    "education": "本科及以上学历",
    "experience": "1-3年",
    "description": "<p>负责后端开发...</p>\n\n\n\n",
}

cleaned_job = cleaner.clean(raw_job)
# 结果:
# {
#     "title": "急招Python开发工程师",
#     "location": "北京-朝阳",
#     "salary": "15-25K·14薪",
#     "education": "本科",
#     "experience": "1-3年",
#     "description": "负责后端开发...",
# }
```

---

## 5. 实施路线图

### 第一阶段: 基础优化 (1-2周)

**目标**: 解决 P0/P1 问题，提升性能 30%-50%

#### Week 1:

| 日期 | 任务 | 验收标准 |
|------|------|----------|
| Day 1-2 | 数据库批量写入优化 (`executemany`) | 单源 1000 条数据写入时间 < 2 秒 |
| Day 3 | 添加复合索引 (`source + publish_date`) | 常见查询速度提升 > 5 倍 |
| Day 4 | 统一错误处理装饰器 (`@retry`, `@measure_time`) | 代码重复减少 60% |
| Day 5 | 配置中心化 (`config.py` dataclass) | 魔法数字消除率 100% |

#### Week 2:

| 日期 | 任务 | 验收标准 |
|------|------|----------|
| Day 1-2 | 启用 WAL 模式 + 连接池复用 | 并发写入锁冲突减少 90% |
| Day 3 | 日志增强 (结构化 + trace_id) | 日志可追踪率 100% |
| Day 4 | 清理死代码 (过时脚本 + unused imports) | 代码量减少 10% |
| Day 5 | 完善 `requirements.txt` | Python 环境可一键复现 |

**第一阶段验收标准**:

- [ ] 爬虫整体吞吐量提升 ≥ 30%
- [ ] 数据库写入速度提升 ≥ 5 倍
- [ ] 代码 lint 通过率 100%
- [ ] 无 P0/P1 级别遗留问题

---

### 第二阶段: 架构重构 (2-3周)

**目标**: 提升可维护性和可扩展性

#### Week 3-4:

| 周 | 任务 | 交付物 |
|----|------|--------|
| Week 3 | **策略模式拆分** | `spiders/strategies/` 目录 + 4 个 Strategy 类 |
| | - 创建 `spiders/strategies/` 目录 | 目录结构 |
| | - 拆分出 4 个 Strategy 类 (各 200-300 行) | 策略文件 |
| | - UnifiedSpider 简化为调度器 (< 200 行) | 重构后的调度器 |
| | - 编写每个 Strategy 的单元测试 | 测试文件 (覆盖率 > 80%) |
| Week 4 | **中间件管道 + 插件系统** | 可插拔的扩展框架 |
| | - 实现 `MiddlewarePipeline` | 中间件核心 |
| | - 开发 `RateLimitPlugin`, `ProxyPlugin`, `CachePlugin` | 内置插件 |
| | - 支持配置化加载插件 | 插件加载器 |

#### Week 5:

| 日期 | 任务 | 验收标准 |
|------|------|----------|
| Day 1-2 | 异步生成器改造 | UnifiedSpider.crawl() 改为 async generator; AsyncMultiCrawler 支持流式消费; 内存基准测试通过 |
| Day 3-4 | 数据质量保障 | Pydantic 模型校验; 多维去重器; 数据清洗管道 |
| Day 5 | 集成测试 + 性能基准 | 端到端测试全部 9 个数据源; 性能基准报告; 回归测试通过 |

**第二阶段验收标准**:

- [ ] `unified_spider.py` 从 970 行降到 < 200 行
- [ ] 每个 Strategy 有独立单元测试 (覆盖率 > 80%)
- [ ] 内存占用峰值降低 ≥ 50%
- [ ] 新增数据源开发时间 < 2 小时（只需写配置 + Strategy）

---

### 第三阶段: 高级特性 (3-4周)

**目标**: 生产级监控和运维能力

#### Week 6-7:

| 周 | 任务 | 交付物 |
|----|------|--------|
| Week 6 | **Prometheus + Grafana 监控** | 可视化监控系统 |
| | - 集成 prometheus-client-python | Metrics 代码 |
| | - 定义核心指标 (QPS, Latency, Error Rate) | 指标定义 |
| | - 构建 Grafana Dashboard | Dashboard JSON |
| Week 7 | **健康检查 + 自动恢复** | 生产级可靠性 |
| | - `/health` 和 `/ready` 端点 | 健康检查服务 |
| | - 熔断器模式 (Circuit Breaker) | 熔断器实现 |
| | - 失败队列自动重试机制 | 自动恢复逻辑 |

#### Week 8-9:

| 周 | 任务 | 交付物 |
|----|------|--------|
| Week 8 | **分布式扩展准备** | 分布式架构支持 |
| | - Redis 共享去重集合 (替代 JSON 文件) | Redis 集成 |
| | - 任务队列支持 (Celery/RQ) | 队列集成 |
| | - 水平扩展方案 (多进程/多机器) | 扩展文档 |
| Week 9 | **文档和培训** | 知识沉淀 |
| | - 更新技术文档 | 更新后的文档 |
| | - 编写开发者快速入门指南 | 入门指南 |

**第三阶段验收标准**:

- [ ] Grafana Dashboard 包含 ≥ 10 个核心面板
- [ ] 告警响应时间 < 5 分钟
- [ ] 故障自愈率 > 90%（自动重试成功）
- [ ] 支持水平扩展到 ≥ 3 个爬虫节点

---

### 总体甘特图

```
Week:    1    2    3    4    5    6    7    8    9
─────────────────────────────────────────────────────
Phase 1  ████ ████
  批量写入  ██
  复合索引    █
  装饰器        ██
  配置中心          █
  WAL+连接池          ██
  日志增强              █
  死代码清理              █
  requirements             █

Phase 2            ████ ████ ███
  策略拆分               ████████
  中间件+插件                   ████████
  异步生成器                          ██
  数据质量                              ██
  集成测试                                  █

Phase 3                        ████ ████ ████
  Prometheus+Grafana                      ████████
  健康检查+熔断                                ████████
  分布式准备                                        ████████
  文档培训                                                ████████
```

---

## 6. 风险评估

| 风险 | 概率 | 影响 | 缓解措施 | 负责人 |
|------|------|------|----------|--------|
| 策略拆分引入回归 Bug | 中 | 高 | 充分的单元测试 + 集成测试 + 渐进式迁移 | 开发者 |
| 异步生成器改变消费接口 | 低 | 中 | 提供兼容层 + 渐进式迁移 + 文档更新 | 开发者 |
| Prometheus 增加复杂度 | 低 | 低 | 封装为可选 Feature Flag，默认关闭 | 开发者 |
| 第三方依赖 (pydantic/prometheus) | 低 | 低 | 版本锁定 + 兼容性测试 + 备选方案 | 开发者 |
| SQLite 并发写入限制 | 中 | 中 | WAL 模式 + 减少写入频率 + 考虑 PostgreSQL | 开发者 |
| 目标网站反爬策略升级 | 高 | 高 | 代理池 + 请求间隔随机化 + 行为模拟 | 运维 |

### 回滚计划

每个阶段的改动都应具备独立回滚能力：

1. **Git 分支策略**: 每个阶段独立分支 (`phase-1`, `phase-2`, `phase-3`)
2. **特性开关**: 关键改动通过配置项控制启用/禁用
3. **数据备份**: 每次 schema 变更前备份数据库
4. **灰度发布**: 先在 1-2 个数据源上验证，再全量推广

---

## 7. 预期收益总结

### 量化收益

| 维度 | 当前状态 | 优化后 | 提升幅度 |
|------|----------|--------|----------|
| **吞吐量** | ~50 req/s (估) | ~150 req/s | **3 倍** |
| **写入性能** | 1000 条 / 15s | 1000 条 / <2s | **7.5 倍** |
| **内存占用** | O(N) 峰值高 | O(1) 常数级 | **降低 80%** |
| **代码可维护性** | 970 行单文件 | 200 行 + 4 个 Strategy | **提升 4 倍** |
| **开发效率** | 新数据源需 1 天 | 新数据源 < 2 小时 | **提升 10 倍** |
| **可观测性** | 仅日志 | Metrics + Traces + Logs | **质变** |
| **故障恢复** | 手动重启 | 自动熔断 + 重试 | **可用性 99.5%** |

### 质量收益

| 方面 | 提升 |
|------|------|
| **代码质量** | 消除魔法数字，统一错误处理，完整类型注解 |
| **数据质量** | Pydantic 校验 + 多维去重 + 清洗管道 |
| **测试覆盖** | 从接近 0 到 > 80% 策略覆盖率 |
| **文档完善** | 架构文档 + API 文档 + 操作指南 |
| **运维效率** | 健康检查 + 自动告警 + 一键部署 |

### 投入产出比

```
投入:
  时间: 6-9 周 (1-2 人)
  新依赖: pydantic, prometheus-client, aiohttp (已有)
  
产出:
  性能提升: 3-7.5 倍
  维护成本: 降低 60%
  故障恢复: 从小时级降到分钟级
  新功能开发: 从天级降到小时级
  
ROI: 预计 3 个月内收回全部投入
```

---

> **文档维护**: 本文档应随实施进度同步更新。每次阶段完成后，更新对应的状态和验收结果。
>
> **反馈渠道**: 如有疑问或建议，请在项目 Issue 中提出。
