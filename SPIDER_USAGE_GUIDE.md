# 爬虫系统使用指南

## 目录
1. [快速开始](#快速开始)
2. [命令行使用](#命令行使用)
3. [Python API使用](#python-api使用)
4. [爬虫类型说明](#爬虫类型说明)
5. [配置选项](#配置选项)
6. [示例代码](#示例代码)
7. [常见问题](#常见问题)

---

## 快速开始

### 1. 基本使用（命令行）

```bash
# 进入项目目录
cd /home/joakim/Project/hmAPP/finintern_hub/next-app

# 交互式选择爬虫（推荐）
python3 -m src.spiders.run

# 或者使用 -i 参数
python3 -m src.spiders.run -i

# 直接运行指定爬虫
python3 -m src.spiders.run --sources zuel sufe

# 限制每个源最多爬取10条
python3 -m src.spiders.run --max-items 10
```

### 2. 交互式选择界面

运行 `python3 -m src.spiders.run` 后，会显示交互式菜单：

```
================================================================================
FinIntern Hub 爬虫系统
================================================================================

请选择要运行的爬虫：
  1. HTTP爬虫（推荐，速度快）
     - sufe: 上海财经大学
     - zuel: 中南财经政法大学
     - cufe: 中央财经大学
     - dufe: 东北财经大学
     - swufe: 西南财经大学

  2. 浏览器爬虫（需要Playwright，速度慢）
     - smartedu: 国家大学生就业服务平台
     - uibe: 对外经济贸易大学
     - jxufe: 江西财经大学现代经济管理学院
     - neu: 东北大学

  3. 运行所有爬虫
  4. 自定义选择
  0. 退出

请输入选项 (0-4): 
```

**选项说明**：
- **选项1**：运行所有HTTP爬虫（推荐，速度快，无需浏览器）
- **选项2**：运行所有浏览器爬虫（需要安装Playwright）
- **选项3**：运行所有爬虫（HTTP + 浏览器）
- **选项4**：自定义选择特定的爬虫运行
- **选项0**：退出程序

### 2. Python API使用

```python
import asyncio
from spiders import create_spider, LocalDatabase

async def main():
    # 创建数据库连接
    db = LocalDatabase()
    await db.connect()
    
    # 创建爬虫
    spider = create_spider("zuel")
    spider.db = db
    
    # 爬取数据
    jobs = await spider.crawl(max_items=100)
    print(f"爬取完成: {len(jobs)} 条")
    
    # 关闭连接
    await db.close()

asyncio.run(main())
```

---

## 命令行使用

### 可用参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `--sources` | 指定数据源 | `--sources zuel sufe` |
| `--list-sources` | 列出所有数据源 | `--list-sources` |
| `--headless` | 无头模式（默认） | `--headless` |
| `--no-headless` | 显示浏览器窗口 | `--no-headless` |
| `--max-items` | 最大爬取数量 | `--max-items 100` |
| `--output` | 输出目录 | `--output ./output` |
| `--db-path` | 数据库路径 | `--db-path ./data/jobs.db` |

### 使用示例

```bash
# 列出所有可用数据源
python3 -m src.spiders.run --list-sources

# 运行所有爬虫，每个源最多100条
python3 -m src.spiders.run --max-items 100

# 运行指定爬虫（ZUEL和SUFE）
python3 -m src.spiders.run --sources zuel sufe

# 显示浏览器窗口（用于调试）
python3 -m src.spiders.run --sources smartedu --no-headless

# 自定义输出目录和数据库路径
python3 -m src.spiders.run --output ./my_output --db-path ./my_data/jobs.db
```

---

## Python API使用

### 1. 统一爬虫（UnifiedSpider）

**适用场景**：大多数情况下的首选

```python
import asyncio
from spiders import create_spider, LocalDatabase

async def main():
    db = LocalDatabase()
    await db.connect()
    
    # 创建统一爬虫
    spider = create_spider("zuel")
    spider.db = db
    
    # 爬取数据
    jobs = await spider.crawl(max_items=100)
    
    # 查看统计
    stats = spider.stats.to_dict()
    print(f"爬取统计: {stats}")
    
    await db.close()

asyncio.run(main())
```

### 2. 高性能爬虫（PerformanceSpider）

**适用场景**：大规模爬取，需要缓存和异步写入

```python
import asyncio
from spiders import create_performance_spider, LocalDatabase

async def main():
    db = LocalDatabase()
    await db.connect()
    
    # 创建高性能爬虫
    spider = create_performance_spider(
        "zuel",
        enable_cache=True,           # 启用缓存
        enable_write_queue=True,     # 启用异步写入队列
        cache_size=1000,             # 缓存大小
        pool_limit=100,              # 连接池大小
        batch_size=500,              # 批量写入大小
    )
    spider.db = db
    
    # 爬取数据
    jobs = await spider.crawl(max_items=1000)
    
    # 查看性能统计
    stats = spider.get_performance_stats()
    print(f"性能统计: {stats}")
    
    await db.close()

asyncio.run(main())
```

### 3. 轻量级爬虫（LiteSpider）

**适用场景**：小规模爬取，低内存占用

```python
from spiders import create_lite_spider

# 创建轻量级爬虫（同步）
spider = create_lite_spider(
    "zuel",
    request_delay=1.0,  # 请求间隔1秒
)

# 爬取数据（同步，无需async）
jobs = spider.crawl(max_items=100)

# 查看统计
stats = spider.get_stats()
print(f"统计: {stats}")
```

---

## 爬虫类型说明

### 1. API爬虫（推荐）

**数据源**：zuel, sufe, cufe, dufe

**特点**：
- ✅ 速度快，效率高
- ✅ 稳定可靠
- ✅ 无需浏览器

**使用示例**：
```python
spider = create_spider("zuel")  # ZUEL使用GET API
spider = create_spider("sufe")  # SUFE使用POST API
```

### 2. HTML爬虫

**数据源**：swufe

**特点**：
- ✅ 直接解析HTML
- ✅ 无需浏览器
- ⚠️ 需要处理HTML结构变化

**使用示例**：
```python
spider = create_spider("swufe")  # SWUFE使用HTML解析
```

### 3. 浏览器爬虫

**数据源**：smartedu, uibe, jxufe, neu

**特点**：
- ⚠️ 需要浏览器（Playwright）
- ⚠️ 速度较慢
- ✅ 能处理JS动态渲染
- ✅ 已集成到统一系统

**安装依赖**：
```bash
# 安装Playwright
pip install playwright

# 安装浏览器
playwright install chromium
```

**使用方法**：
```bash
# 方式1：交互式选择（推荐）
python3 -m src.spiders.run
# 选择选项2：浏览器爬虫

# 方式2：直接指定
python3 -m src.spiders.run --sources smartedu uibe

# 方式3：运行所有爬虫（包括浏览器爬虫）
python3 -m src.spiders.run
# 选择选项3：运行所有爬虫
```

**Python API使用**：
```python
import asyncio
from spiders import create_spider, LocalDatabase

async def main():
    db = LocalDatabase()
    await db.connect()
    
    # 创建浏览器爬虫
    spider = create_spider("smartedu", headless=True)
    spider.db = db
    
    # 爬取数据
    jobs = await spider.crawl(max_items=10)
    print(f"爬取完成: {len(jobs)} 条")
    
    await db.close()

asyncio.run(main())
```

---

## 配置选项

### 1. 基本配置

```python
config = {
    "max_pages": 50,              # 最大页数
    "detail_concurrency": 8,      # 详情页并发数
    "request_timeout": 20,        # 请求超时（秒）
}

spider = create_spider("zuel", config=config)
```

### 2. 高性能配置

```python
config = {
    "cache_size": 2000,           # 缓存大小
    "cache_ttl": 7200,            # 缓存过期时间（秒）
    "pool_limit": 200,            # 连接池总连接数
    "pool_limit_per_host": 50,    # 每个主机连接数
    "batch_size": 1000,           # 批量写入大小
    "batch_timeout": 10.0,        # 批量写入超时（秒）
}

spider = create_performance_spider("zuel", config=config)
```

### 3. 轻量级配置

```python
config = {
    "request_delay": 2.0,         # 请求间隔（秒）
    "db_path": "./my_data/jobs.db",  # 数据库路径
}

spider = create_lite_spider("zuel", config=config)
```

---

## 示例代码

### 示例1：爬取单个数据源

```python
import asyncio
from spiders import create_spider, LocalDatabase

async def crawl_single_source():
    """爬取单个数据源"""
    db = LocalDatabase()
    await db.connect()
    
    spider = create_spider("zuel")
    spider.db = db
    
    jobs = await spider.crawl(max_items=100)
    print(f"爬取完成: {len(jobs)} 条")
    
    # 查看前5条数据
    for i, job in enumerate(jobs[:5], 1):
        print(f"{i}. {job.title} - {job.company}")
    
    await db.close()

asyncio.run(crawl_single_source())
```

### 示例2：爬取多个数据源

```python
import asyncio
from spiders import AsyncMultiCrawler

async def crawl_multiple_sources():
    """爬取多个数据源"""
    crawler = AsyncMultiCrawler()
    
    # 并发爬取多个数据源
    results = await crawler.crawl_all_parallel(
        sources=["zuel", "sufe", "cufe"],
        max_items=50
    )
    
    # 查看结果
    for source, jobs in results.items():
        print(f"{source}: {len(jobs)} 条")
    
    # 查看统计
    summary = crawler.get_summary()
    print(f"总计: {summary['total_jobs']} 条")

asyncio.run(crawl_multiple_sources())
```

### 示例3：使用增量爬取

```python
import asyncio
from spiders import create_spider, LocalDatabase, IncrementalCrawler

async def incremental_crawl():
    """增量爬取"""
    db = LocalDatabase()
    await db.connect()
    
    # 创建增量爬取管理器
    incremental = IncrementalCrawler(db, "zuel")
    
    # 获取已存在的URL
    existing_urls = await incremental.get_existing_urls()
    print(f"已存在: {len(existing_urls)} 条")
    
    # 创建爬虫
    spider = create_spider("zuel")
    spider.db = db
    
    # 爬取数据（自动去重）
    jobs = await spider.crawl(max_items=100)
    print(f"本次爬取: {len(jobs)} 条")
    
    # 查看增量统计
    stats = incremental.get_stats()
    print(f"增量统计: {stats}")
    
    await db.close()

asyncio.run(incremental_crawl())
```

### 示例4：使用日志系统

```python
from spiders import SpiderLogger

# 创建爬虫日志记录器
logger = SpiderLogger("zuel")

# 记录爬取过程
logger.crawl_start(max_items=100)
logger.url_filtered(total=50, new=30, skipped=20)
logger.request_success("https://example.com/api", 200)
logger.data_parsed("测试岗位标题")
logger.data_written(10)
logger.crawl_complete(count=50, elapsed=10.5)

# 记录错误
try:
    # 可能出错的代码
    result = 1 / 0
except Exception as e:
    logger.exception("发生异常")
```

---

## 常见问题

### 1. 如何选择爬虫类型？

**推荐选择**：
- **统一爬虫（UnifiedSpider）**：大多数情况下的首选
- **高性能爬虫（PerformanceSpider）**：大规模爬取（1000+条）
- **轻量级爬虫（LiteSpider）**：小规模爬取（<100条）或低资源环境

### 2. 如何处理302重定向？

**解决方案**：
```python
# CUFE和DUFE会自动处理302重定向
spider = create_spider("cufe")
# 爬虫会自动访问首页获取Cookie
```

### 3. 如何避免被封禁？

**建议**：
```python
# 1. 设置合理的请求间隔
spider = create_lite_spider("zuel", request_delay=2.0)

# 2. 使用随机User-Agent（已自动启用）

# 3. 限制并发数
config = {"detail_concurrency": 4}
spider = create_spider("zuel", config=config)
```

### 4. 如何查看日志？

**日志文件位置**：
```
next-app/log/
├── spider_2026-05-16.log    # 所有日志
├── error_2026-05-16.log     # 错误日志
└── debug_2026-05-16.log     # 调试日志
```

**查看日志**：
```bash
# 查看所有日志
tail -f log/spider_2026-05-16.log

# 查看错误日志
tail -f log/error_2026-05-16.log

# 查看调试日志
tail -f log/debug_2026-05-16.log
```

### 5. 如何处理异常？

**示例**：
```python
import asyncio
from spiders import create_spider, LocalDatabase, SpiderLogger

async def handle_errors():
    db = LocalDatabase()
    await db.connect()
    
    logger = SpiderLogger("zuel")
    spider = create_spider("zuel")
    spider.db = db
    
    try:
        jobs = await spider.crawl(max_items=100)
        logger.crawl_complete(len(jobs), 10.5)
    except Exception as e:
        logger.exception(f"爬取失败: {e}")
    finally:
        await db.close()

asyncio.run(handle_errors())
```

---

## 数据源列表

| 数据源 | 名称 | 类型 | 推荐爬虫 |
|--------|------|------|----------|
| zuel | 中南财经政法大学 | API GET | UnifiedSpider |
| sufe | 上海财经大学 | API POST | UnifiedSpider |
| cufe | 中央财经大学 | API POST | UnifiedSpider |
| dufe | 东北财经大学 | API POST | UnifiedSpider |
| swufe | 西南财经大学 | HTML | UnifiedSpider |
| smartedu | 国家大学生就业服务平台 | 浏览器 | UnifiedSpider |
| uibe | 对外经济贸易大学 | 浏览器+加密 | UnifiedSpider |
| jxufe | 江西财经大学 | 浏览器 | UnifiedSpider |
| neu | 东北大学 | 浏览器 | UnifiedSpider |

---

## 性能对比

| 爬虫类型 | 速度 | 内存占用 | 适用场景 |
|---------|------|---------|---------|
| UnifiedSpider | 中等 | 中等 | 通用场景 |
| PerformanceSpider | 快 | 高 | 大规模爬取 |
| LiteSpider | 慢 | 低 | 小规模爬取 |

---

## 更多资源

- **技术文档**：`SPIDERS_TECH_DOC.md`
- **日志文件**：`next-app/log/`
- **数据库文件**：`next-app/data/jobs.db`
- **输出文件**：`next-app/output/`

---

## 轻量化单线程爬虫

### 概述

轻量化单线程爬虫专为低内存服务器设计（< 2GB 内存），具有以下特点：

- ✅ 单线程执行，无并发
- ✅ 只支持 HTTP 爬虫（sufe, zuel, cufe, dufe, swufe）
- ✅ 逐条写入数据库，不缓存数据
- ✅ 失败重试 5 次（指数退避）
- ✅ 最小日志输出
- ✅ 内存占用极小（< 50MB）
- ✅ 支持定时爬取

### 基本使用

```bash
# 列出所有数据源
python3 lite_crawler.py --list-sources

# 运行所有爬虫
python3 lite_crawler.py

# 运行指定爬虫
python3 lite_crawler.py --sources sufe zuel

# 限制爬取数量
python3 lite_crawler.py --max-items 100
```

### 定时爬取

```bash
# 每小时爬取一次
python3 lite_crawler.py --schedule hourly

# 每天爬取一次
python3 lite_crawler.py --schedule daily

# 每周爬取一次
python3 lite_crawler.py --schedule weekly

# 使用 cron 表达式（每天凌晨2点）
python3 lite_crawler.py --schedule "0 2 * * *"

# 定时爬取指定数据源
python3 lite_crawler.py --sources sufe zuel --schedule daily
```

### 内存优化策略

| 优化项 | 说明 |
|--------|------|
| 单文件设计 | 所有代码在一个文件中，减少导入开销 |
| 流式处理 | 读取一条 → 处理 → 写入 → 释放内存 |
| 无缓存 | 不缓存任何中间数据 |
| 直接查询数据库 | 不保存已访问 URL 列表 |
| 最小日志 | 只记录错误和最终统计 |
| 使用生成器 | 不使用列表存储数据 |

### 性能对比

| 指标 | 原爬虫 | 轻量化爬虫 |
|------|--------|-----------|
| 内存占用 | ~200MB | <50MB |
| 并发数 | 多线程 | 单线程 |
| 数据缓存 | 批量缓存 | 逐条写入 |
| 浏览器爬虫 | 支持 | 不支持 |
| 适用场景 | 高性能服务器 | 低内存服务器 |

### 部署建议

#### 1. 低内存服务器部署

```bash
# 安装依赖
pip install requests

# 运行爬虫
python3 lite_crawler.py --sources sufe zuel cufe dufe swufe

# 后台运行（使用 nohup）
nohup python3 lite_crawler.py --schedule daily > crawler.log 2>&1 &

# 或使用 screen
screen -S crawler
python3 lite_crawler.py --schedule daily
# 按 Ctrl+A+D 分离会话
```

#### 2. 系统服务（推荐）

创建 systemd 服务文件 `/etc/systemd/system/crawler.service`:

```ini
[Unit]
Description=FinIntern Lite Crawler
After=network.target

[Service]
Type=simple
User=your_user
WorkingDirectory=/path/to/next-app
ExecStart=/usr/bin/python3 lite_crawler.py --schedule daily
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启动服务:
```bash
sudo systemctl daemon-reload
sudo systemctl enable crawler
sudo systemctl start crawler
sudo systemctl status crawler
```

#### 3. 内存监控

```bash
# 查看内存占用
ps aux | grep lite_crawler

# 实时监控
top -p $(pgrep -f lite_crawler)
```

### 可用数据源

| 数据源 | 大学 | 爬取类型 |
|--------|------|----------|
| sufe | 上海财经大学 | HTTP POST |
| zuel | 中南财经政法大学 | HTTP GET |
| cufe | 中央财经大学 | HTTP POST |
| dufe | 东北财经大学 | HTTP POST |
| swufe | 西南财经大学 | HTML |

### 命令行参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `--sources` | 指定数据源 | `--sources sufe zuel` |
| `--list-sources` | 列出所有数据源 | `--list-sources` |
| `--max-items` | 每个数据源最大爬取数量 | `--max-items 100` |
| `--schedule` | 定时爬取 | `--schedule daily` |

### 输出示例

```
============================================================
轻量化单线程爬虫启动
数据源: sufe, zuel, cufe, dufe, swufe
============================================================

▶ 开始爬取 [上海财经大学]
  已完成: 10 条
  已完成: 20 条
✓ [上海财经大学] 完成: 25 条

▶ 开始爬取 [中南财经政法大学]
  已完成: 10 条
✓ [中南财经政法大学] 完成: 15 条

...

============================================================
爬取完成 | 总耗时 45.2s
总岗位数: 125
============================================================
```

---

**版本**：v2.7.0  
**更新时间**：2026-05-16
