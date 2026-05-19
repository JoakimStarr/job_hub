# 爬虫技术文档

> **最后更新**: 2026-05-18 | **版本**: v3.0.0 - 全面重构文档

---

## 目录

- [1. 重构说明](#1-重构说明)
- [2. 架构总览](#2-架构总览)
  - [2.1 整体架构图](#21-整体架构图)
  - [2.2 设计模式与原则](#22-设计模式与原则)
  - [2.3 模块职责划分](#23-模块职责划分)
  - [2.4 文件结构](#24-文件结构)
- [3. 核心组件详解](#3-核心组件详解)
  - [3.1 Spider Configs - 配置注册表](#31-spider-configs---配置注册表)
  - [3.2 Base Spider - 基类体系](#32-base-spider---基类体系)
  - [3.3 Unified Spider - 统一爬虫](#33-unified-spider---统一爬虫)
  - [3.4 Async Multi Crawler - 并发调度器](#34-async-multi-crawler---并发调度器)
  - [3.5 Local Database - 数据库操作](#35-local-database---数据库操作)
  - [3.6 Utils - 工具函数库](#36-utils---工具函数库)
  - [3.7 Logger - 日志系统](#37-logger---日志系统)
  - [3.8 Browser Wrapper - 浏览器封装](#38-browser-wrapper---浏览器封装)
  - [3.9 Constants - 常量定义](#39-constants---常量定义)
- [4. 数据源配置参考](#4-数据源配置参考)
  - [4.1 SUFE - 上海财经大学](#41-sufe---上海财经大学)
  - [4.2 ZUEL - 中南财经政法大学](#42-zuel---中南财经政法大学)
  - [4.3 CUFE - 中央财经大学](#43-cufe---中央财经大学)
  - [4.4 DUFE - 东北财经大学](#44-dufe---东北财经大学)
  - [4.5 SWUFE - 西南财经大学](#45-swufe---西南财经大学)
  - [4.6 UIBE - 对外经济贸易大学](#46-uibe---对外经济贸易大学)
  - [4.7 JXUFE - 江西财经大学现代经济管理学院](#47-jxufe---江西财经大学现代经济管理学院)
  - [4.8 已禁用数据源](#48-已禁用数据源)
- [5. 运行命令](#5-运行命令)
- [6. 最佳实践](#6-最佳实践)
  - [6.1 新增数据源流程](#61-新增数据源流程)
  - [6.2 性能调优指南](#62-性能调优指南)
  - [6.3 代码规范](#63-代码规范)
- [7. 常见问题 FAQ](#7-常见问题-faq)
- [8. 附录](#8-附录)

---

## 1. 重构说明 (2026-05-16 ~ 2026-05-18)

### 架构演进历程

爬虫系统已完成从**独立爬虫文件**到**配置驱动统一架构**的全面重构：

| 阶段 | 架构 | 特点 |
|------|------|------|
| V1 | 独立爬虫文件 | 每个数据源一个 `.py` 文件，大量重复代码 |
| V2 | 基类继承 | `BaseSpider`/`BaseAPISpider`/`BaseBrowserSpider` 三层继承 |
| V3 (当前) | 配置驱动 + 统一实现 | `spider_configs.py` + `UnifiedSpider` + `AsyncMultiCrawler` |

### 核心改进点

- **配置驱动**: 新增数据源只需在 `SPIDERS_CONFIGS` 字典中添加配置，无需编写新类
- **统一入口**: 所有爬虫通过 `create_spider(source)` 创建，通过 `crawl()` 方法执行
- **并发调度**: `AsyncMultiCrawler` 统一管理多源并发、批量写入、进度回调
- **增量去重**: 基于 `source_url` 的数据库级去重 + 内存级 visited_urls 双层去重
- **错误隔离**: 单个数据源失败不影响其他源，失败队列持久化到 `failed_queue.json`

### 核心文件清单

| 文件 | 职责 |
|------|------|
| [spider_configs.py](src/spiders/spider_configs.py) | 统一配置注册表，定义所有数据源的爬取参数和字段映射 |
| [unified_spider.py](src/spiders/unified_spider.py) | 统一爬虫实现，根据配置动态处理不同类型的数据源 |
| [base.py](src/spiders/base.py) | 抽象基类体系：BaseSpider、BaseAPISpider、BaseBrowserSpider、JobData、SpiderStats |
| [crawler.py](src/spiders/crawler.py) | AsyncMultiCrawler 并发调度器，管理多源并发爬取 |
| [database.py](src/spiders/database.py) | LocalDatabase 异步 SQLite 数据库操作封装 |
| [utils.py](src/spiders/utils.py) | 工具函数：HTML解析、日期标准化、公司名清洗等 |
| [logger.py](src/spiders/logger.py) | Loguru 日志系统配置，支持多级别日志输出 |
| [browser_wrapper.py](src/spiders/browser_wrapper.py) | Playwright 浏览器爬虫包装器，动态加载浏览器爬虫模块 |
| [constants.py](src/spiders/constants.py) | 全局常量：User-Agent列表、公司后缀、系统参数 |
| [run.py](src/spiders/run.py) | CLI 入口，交互式选择和数据源管理 |

---

## 2. 架构总览

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLI / API 入口                              │
│                    run.py / Next.js API Route                        │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     AsyncMultiCrawler                               │
│  ┌─────────────┬──────────────┬──────────────┬────────────────────┐ │
│  │ 并发控制     │ 批量写入      │ 进度回调       │ 失败队列           │ │
│  │ semaphore   │ BATCH_SIZE=50│ on_* 回调     │ failed_queue.json  │ │
│  └──────┬──────┴──────┬───────┴──────┬───────┴────────┬───────────┘ │
│         │              │              │                │             │
└─────────┼──────────────┼──────────────┼────────────────┼─────────────┘
          │              │              │                │
    ┌─────▼─────┐  ┌────▼────┐  ┌──────▼──────┐  ┌──────▼──────┐
    │ Unified   │  │ LocalDB │  │ visited_    │  │ failed_     │
    │ Spider ×N │  │ (SQLite)│  │ urls.json   │  │ queue.json  │
    └─────┬─────┘  └─────────┘  └─────────────┘  └─────────────┘
          │
    ┌─────▼──────────────────────────────────────────────┐
    │               UnifiedSpider (策略分发)               │
    │  ┌──────────┬──────────┬──────────┬───────────────┐ │
    │  │ api_post │ api_get  │ html     │ browser_*     │ │
    │  │ POST+JSON│ GET+Params│ BS4解析  │ Playwright   │ │
    │  └────┬─────┴────┬─────┴────┬─────┴───────┬───────┘ │
    │       │          │          │              │         │
    │  SUFE/CUFE/   ZUEL       SWUFE        UIBE/JXUFE/   │
    │  DUFE                                  SmartEdu/NEU │
    └─────────────────────────────────────────────────────┘
                          │
    ┌─────────────────────▼────────────────────────────────┐
    │              spider_configs.py                        │
    │  SPIDER_CONFIGS = { "sufe": {...}, "zuel": {...} }   │
    │  SPIDER_CONFIGS_DISABLED = { "smartedu": {...}, ... } │
    └───────────────────────────────────────────────────────┘
```

### 2.2 设计模式与原则

| 模式 | 应用位置 | 说明 |
|------|----------|------|
| **策略模式** | `UnifiedSpider.crawl()` | 根据 `spider_type` 分派到不同的 `_crawl_*()` 方法 |
| **模板方法模式** | `BaseSpider` → `UnifiedSpider` | 基类定义骨架（initialize→crawl→close），子类填充细节 |
| **工厂方法** | `create_spider()` | 通过 source key 动态创建对应配置的爬虫实例 |
| **配置驱动** | `SPIDER_CONFIGS` 字典 | 数据源的所有行为由配置决定，非硬编码 |
| **观察者模式** | `on_batch_saved/on_progress/on_source_complete` | 回调机制通知外部进度变化 |
| **单例资源** | `LocalDatabase` | 整个爬取周期共享一个数据库连接 |

### 2.3 模块职责划分

```
src/spiders/
├── __init__.py            # 包导出，统一公共API
├── spider_configs.py      # 配置注册表（数据源定义）
├── unified_spider.py      # 统一爬虫核心实现
├── base.py                # 抽象基类 + 数据模型
├── crawler.py             # 并发调度器
├── database.py            # 数据库操作层
├── utils.py               # 工具函数集
├── logger.py              # 日志配置
├── constants.py           # 全局常量
├── browser_wrapper.py     # 浏览器爬虫包装器
├── run.py                 # CLI入口
├── uibe.py                # UIBE浏览器爬虫(独立实现)
└── jxufe_spider.py        # JXUFE浏览器爬虫(独立实现)
```

### 2.4 文件依赖关系

```
run.py ──► crawler.py ──► unified_spider.py ──► base.py
    │              │              │                │
    │              ├──────────────┤                ├──► JobData
    │              │              │                ├──► BaseSpider
    │              │              │                ├──► BaseAPISpider
    │              │              │                └──► BaseBrowserSpider
    │              │              │
    │              │              ├──► spider_configs.py
    │              │              ├──► utils.py ────► constants.py
    │              │              └──► browser_wrapper.py
    │              │
    │              └──► database.py
    │
    └──► spider_configs.py
    └──► constants.py
```

---

## 3. 核心组件详解

### 3.1 Spider Configs - 配置注册表

#### 3.1.1 设计理念

`spider_configs.py` 是整个爬虫系统的**配置中心**。所有数据源的爬取行为（URL、请求方式、字段映射、并发参数）都通过此文件集中定义。

核心理念：
- **声明式配置**: 用字典描述"爬什么"、"怎么爬"，而非编写过程代码
- **字段映射**: 定义源数据字段到 `JobData` 标准字段的映射关系
- **多态支持**: 同一个 `UnifiedSpider` 类通过不同配置处理 7 种不同类型的数据源

#### 3.1.2 SPIDER_CONFIGS 完整定义

当前活跃的 **7 个数据源**：

| Key | 大学名称 | spider_type | 基础URL | 板块/分类 |
|-----|----------|-------------|---------|----------|
| `sufe` | 上海财经大学 | `api_post` | `https://career.sufe.edu.cn` | zpxx/sxzpxx/zpgg (3板块) |
| `zuel` | 中南财经政法大学 | `api_get` | `https://jyzx.zuel.edu.cn` | 全职/实习 (2分类) |
| `cufe` | 中央财经大学 | `api_post` | `http://scc.cufe.edu.cn` | 全职/实习 (2分类) |
| `dufe` | 东北财经大学 | `api_post` | `https://career.dufe.edu.cn` | 全职/实习 (2分类, 复用cufe映射) |
| `swufe` | 西南财经大学 | `html` | `https://job3.swufe.edu.cn` |全职/实习 (2URL模式) |
| `uibe` | 对外经济贸易大学 | `browser_js` | `https://career.uibe.edu.cn` | 浏览器渲染 |
| `jxufe` | 江西财经大学现代经济管理学院 | `browser_js` | `http://career.jxufe.edu.cn` | 浏览器渲染 |

已禁用的 **2 个数据源** (`SPIDER_CONFIGS_DISABLED`)：
- `smartedu`: 国家大学生就业服务平台 (`browser_api`)
- `neu`: 东北大学 (`browser_js`)

#### 3.1.3 配置结构规范

每个数据源配置是一个字典，包含以下标准字段：

```python
{
    # === 必填字段 ===
    "name": str,                  # 内部名称 (如 "sufe_jobs")
    "university": str,            # 显示名称 (如 "上海财经大学")
    "base_url": str,              # 基础URL
    "location": str,              # 默认城市
    "spider_type": str,           # 爬虫类型: api_post | api_get | html | browser_api | browser_js

    # === 分页控制 ===
    "page_size": int,             # 每页条数 (默认10)
    "max_pages": int,             # 最大页数 (默认80)
    "detail_concurrency": int,    # 详情页并发数 (默认8)

    # === URL配置 (根据spider_type不同而异) ===
    # api_post: sections[] 或 list_api_path + detail_api_path
    # api_get: list_api + detail_api + categories[]
    # html: url_patterns{} + selectors{}
    # browser_*: list_url + detail_url_pattern + selectors{}

    # === HTTP配置 ===
    "headers": dict,              # 请求头

    # === 字段映射 ===
    "field_mapping": dict | str,  # JobData字段 -> API字段的映射
}
```

#### 3.1.4 字段映射 (field_mapping) 工作原理

字段映射是配置驱动的核心机制。它定义了如何将各数据源返回的原始字段转换为统一的 `JobData` 数据模型。

**映射格式规则**：

| 格式 | 示例 | 说明 |
|------|------|------|
| 直接映射 | `"title": "zpzt"` | `JobData.title ← raw["zpzt"]` |
| 列表优先 | `"location": ["gzszxmc", "szxmc"]` | 取第一个非空值 |
| 点号路径 | `"company": "corporationinfo.name"` | 支持嵌套对象路径 |
| 数组索引 | `"location": "recruitmentPositionList[0].cityName"` | 支持数组索引 |
| 多值拼接 | `"description": ["zwms", "dwjs"]` | 多个字段拼接为描述 |
| 引用复制 | `"field_mapping": "same_as_cufe"` | DUFE复用CUFE的映射 |

**JobData 标准字段定义**：

```python
@dataclass
class JobData:
    title: str                   # 岗位标题 (必填, 最短2字符)
    company: str                # 公司名称 (必填)
    location: str               # 工作地点
    description: str            # 职位描述
    salary: str = "面议"        # 薪资范围
    requirements: str = ""      # 岗位要求
    job_type: str = "实习"      # 全职/实习
    industry: str = ""          # 行业
    education: str = ""         # 学历要求
    experience: str = ""        # 经验要求
    source: str = ""            # 数据源标识
    university: str = ""        # 所属大学
    source_url: str = ""        # 来源URL (唯一键)
    apply_url: str = ""         # 申请链接
    publish_date: str = ""      # 发布日期 (YYYY-MM-DD)
    deadline: str = ""          # 截止日期
    category: str = ""          # 分类
    tags: str = ""              # 标签
    crawl_time: str             # 爬取时间戳
    data_quality_score: float   # 数据质量评分 (0.0~1.0)
```

#### 3.1.5 辅助函数

```python
def get_spider_config(source: str) -> Dict[str, Any]
    """获取指定数据源的配置，不存在则抛 ValueError"""

def get_all_spider_names() -> List[str]
    """返回所有活跃数据源的 key 列表: ['sufe', 'zuel', 'cufe', ...]"""

def get_spider_display_name(source: str) -> str
    """返回数据源的显示名称 (如 '上海财经大学')"""

def get_lite_http_sources() -> Dict[str, Any]
    """提取HTTP类型数据源的简化配置，供 lite_crawler 使用"""
```

---

### 3.2 Base Spider - 基类体系

#### 3.2.1 类层次结构

```
ABC (抽象基类)
 └── BaseSpider (通用爬虫基类)
      ├── BaseAPISpider (HTTP API爬虫基类)
      └── BaseBrowserSpider (浏览器爬虫基类)
           └── (具体浏览器爬虫: UibeJobSpider, JxufeJobSpider 等)

UnifiedSpider (统一爬虫, 继承 BaseSpider, 不继承 BaseAPISpider/BaseBrowserSpider)
```

#### 3.2.2 SpiderStatus - 状态枚举

```python
class SpiderStatus:
    IDLE          = "idle"           # 空闲
    INITIALIZING  = "initializing"   # 初始化中
    RUNNING       = "running"        # 运行中
    PAUSED        = "paused"         # 已暂停
    COMPLETED     = "completed"      # 已完成
    ERROR         = "error"          # 出错
```

#### 3.2.3 SpiderStats - 统计数据

```python
@dataclass
class SpiderStats:
    start_time: Optional[str]      # 开始时间 ISO格式
    end_time: Optional[str]        # 结束时间 ISO格式
    pages_crawled: int = 0         # 已爬取页面数
    items_extracted: int = 0       # 已提取条目数
    items_valid: int = 0           # 有效条目数
    errors: int = 0                # 错误次数
    retries: int = 0               # 重试次数
    status: str = SpiderStatus.IDLE
```

#### 3.2.4 BaseSpider 核心接口

**初始化与生命周期**：

```python
class BaseSpider(ABC):
    def __init__(self, name: str, config: Optional[Dict] = None):
        """
        Args:
            name: 爬虫名称
            config: 配置字典, 支持:
                - max_runtime_seconds: 最大运行时间(秒), 默认900
                - replace_existing: 是否覆盖已有数据, 默认False
                - incremental_mode: 增量模式 ("conservative"/"strict")
                - existing_url_lookup: URL存在性检查回调函数
        """

    @abstractmethod
    async def initialize(self) -> bool: ...
    @abstractmethod
    async def crawl(self, keyword="", location="", max_items=20) -> List[JobData]: ...

    async def close(self) -> None: ...        # 清理资源
    async def __aenter__(self): ...            # 异步上下文管理器
    async def __aexit__(self, exc_type, exc_val, exc_tb): ...
```

**HTTP 请求（带重试）**：

```python
async def request_with_retry(
    self,
    url: str,
    method: str = "GET",
    headers: Optional[Dict] = None,
    data: Optional[Any] = None,
    max_retries: int = 3,        # 最大重试次数
    timeout: int = 30,            # 超时时间(秒)
    allow_redirects: bool = True,
) -> Optional[str]:               # 返回响应文本或None

async def request_json_with_retry(
    self, url, method="GET", headers=None, data=None,
    max_retries=3, timeout=30, **kwargs
) -> Optional[Dict]:              # 返回解析后的JSON或None
```

**重试策略详情**：

| HTTP状态码 | 处理方式 |
|-----------|---------|
| 200 | 成功返回 |
| 301/302/303/307/308 | 自动跟随重定向（最多重试次数内）|
| 429 (Too Many Requests) | 指数退避等待：`min(2^attempt, 10)` 秒 |
| 502/503 | 同上指数退避 |
| 其他4xx/5xx | 记录警告，继续重试 |
| 超时/网络错误 | 记录警告，随机等待 1~3 秒后重试 |

每次重试间随机延迟 `random.uniform(1, 3)` 秒，避免被反爬检测。

**去重与增量**：

```python
async def get_existing_urls(self, urls: List[str]) -> Set[str]:
    """检查URL是否已存在于数据库。
    两级缓存: 先查内存 _seen_urls, 再通过 existing_url_lookup 回调查数据库
    """

def is_duplicate_url(self, url: str) -> bool: ...
def mark_url_seen(self, url: str) -> None: ...
def is_duplicate_item(self, item_key: str) -> bool: ...
def mark_item_seen(self, item_key: str) -> None: ...

def should_stop_after_existing_page(
    self, existing_count: int, current_page_new_count: int = 0
) -> bool:
    """增量停止策略:
    - strict模式: 已存在>=3且新增<=已存在/2 时停止
    - conservative模式: 只要存在已访问过的就停止
    """

def trim_visited_urls(self, visited: set) -> set:
    """当 visited 超过 MAX_VISITED_URLS(50000) 时，
    清理 VISITED_URLS_CLEANUP_RATIO(30%) 的旧记录
    """
```

**运行时控制**：

```python
def start_runtime_timer(self) -> None: ...    # 启动计时器
def is_time_limit_exceeded(self) -> bool: ...  # 检查是否超时(默认900s)
async def random_delay(self, min_sec=0.5, max_sec=2.0) -> None: ...  # 随机延迟
```

**数据校验**：

```python
async def validate_data(self, job_data: JobData) -> bool:
    """基础校验规则:
    - job_data 非 None
    - title 长度 >= 2
    - company 非空
    """
```

#### 3.2.5 BaseAPISpider

```python
class BaseAPISpider(BaseSpider):
    def __init__(self, name: str, base_url: str, config=None):
        super().__init__(name, config)
        self.base_url = base_url.rstrip("/")

    async def initialize(self) -> bool:
        """创建 aiohttp.ClientSession, 使用不安全CookieJar"""
```

#### 3.2.6 BaseBrowserSpider

```python
class BaseBrowserSpider(BaseSpider):
    def __init__(self, name: str, config=None):
        super().__init__(name, config)
        self.browser = None
        self.context = None
        self.headless = config.get("headless", True)
        self.viewport = config.get("viewport", {"width": 1920, "height": 1080})

    async def initialize(self) -> bool:
        """启动Playwright Chromium, 配置:
        - 反自动化检测脚本注入
        - 中文语言环境 (zh-CN, Asia/Shanghai)
        - 随机User-Agent
        - 视口设置 1920x1080
        """

    async def new_page(self): ...  # 创建新页面

    async def close(self) -> None:
        """按顺序清理: context → browser → playwright → session"""
```

**Chromium 启动参数**：

```python
args = [
    "--disable-blink-features=AutomationControlled",  # 禁用自动化特征
    "--disable-web-security",                          # 禁用Web安全策略
    "--disable-dev-shm-usage",                         # 避免/dev/shm问题(Docker)
    "--no-sandbox",                                    # 禁用沙箱(Docker必需)
    "--disable-setuid-sandbox",
    "--disable-gpu",
    "--window-size=1920,1080",
    "--no-first-run",
    "--mute-audio",                                    # 静音
]
```

**反检测脚本**：

```javascript
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
window.chrome = { runtime: {} };
```

**浏览器路径自动检测**：

| 系统 | 搜索路径 |
|------|---------|
| Linux | `/usr/bin/google-chrome`, `/usr/bin/chromium`, `/usr/bin/microsoft-edge` |
| macOS | Google Chrome.app, Microsoft Edge.app |
| Windows | `ProgramFiles/Google/Chrome/chrome.exe`, `ProgramFiles/Microsoft/Edge/msedge.exe` |

#### 3.2.7 JobData.calculate_quality_score()

```python
def calculate_quality_score(self) -> float:
    """数据质量评分 (满分1.0):
    - title >= 3字符:     +0.2
    - company >= 3字符且非通用名: +0.2
    - location >= 2字符:   +0.15
    - salary != "面议":    +0.15
    - description >= 10字符: +0.1
    - publish_date有效:     +0.1
    - source_url以http开头: +0.1
    """
```

---

### 3.3 Unified Spider - 统一爬虫

#### 3.3.1 设计思路

`UnifiedSpider` 是系统的**核心引擎**，采用**策略模式 + 模板方法模式**的组合设计：

- **策略模式**: `crawl()` 方法根据 `self.spider_type` 分派到不同的私有方法
- **模板方法**: 每个 `_crawl_*()` 方法遵循相同的模式：分页循环 → 获取列表 → 过滤已存在 → 并发获取详情 → 解析数据

#### 3.3.2 初始化流程

```python
class UnifiedSpider(BaseSpider):
    def __init__(self, source: str, config=None, headless=True):
        self.source = source                                    # 数据源key
        self.spider_config = get_spider_config(source)          # 加载配置
        self.base_url = self.spider_config["base_url"]
        self.university = self.spider_config["university"]
        self.location = self.spider_config["location"]
        self.spider_type = self.spider_config["spider_type"]    # 策略类型
        self.detail_concurrency = 8                             # 详情并发数
        self.max_pages = 80                                     # 最大页数(按类型不同)

    async def initialize(self) -> bool:
        """初始化步骤:
        1. 设置状态为 INITIALIZING
        2. 合并默认headers + 配置headers + 随机UA
        3. 若缺少Origin头且为API类型, 自动补充
        4. 创建 aiohttp.ClientSession (timeout=20s, unsafe CookieJar)
        5. 特殊处理: CUFE/DUFE需先访问首页获取Cookie
        6. 设置状态为 IDLE
        """
```

#### 3.3.3 crawl() 主流程

```python
async def crawl(self, keyword="", location="", max_items=0) -> List[JobData]:
    """主流程:
    1. initialize() - 初始化会话
    2. 设置状态 RUNNING, 记录开始时间, 启动运行计时器
    3. 根据 spider_type 分派到对应的 _crawl_*() 方法:
       - "api_post"   → _crawl_api_post()
       - "api_get"    → _crawl_api_get()
       - "html"       → _crawl_html()
       - "browser_*"  → _crawl_browser()
    4. 设置状态 COMPLETED, 记录结束时间
    5. 输出去重统计日志
    6. finally: close() - 关闭会话
    """
```

#### 3.3.4 四种爬取策略详解

##### 策略1: api_post (SUFE / CUFE / DUFE)

**适用场景**: 需要发送 POST 请求的 RESTful API，请求体为 form-urlencoded 格式。

**SUFE 特殊处理** - 三板块模式：

```
crawl_api_post()
  └─ if source == "sufe":
       └─ 遍历 sections[] (zpxx/sxzpxx/zpgg)
            └─ _crawl_sufe_section(section_config)
                 └─ for page in 1..max_pages:
                      ├─ _fetch_sufe_list(section, page)     # POST获取列表
                      ├─ 构建view_url列表
                      ├─ get_existing_urls() 去重过滤
                      ├─ gather_limited() 并发获取详情
                      │   ├─ section=="zpgg"? → _fetch_sufe_notice_job()
                      │   └─ else → _fetch_sufe_detail_job()
                      └─ _parse_sufe_job() 或 _parse_sufe_notice()
  └─ else (cufe/dufe):
       └─ 遍历 position_types[] (全职/实习)
            └─ _crawl_platform_type(position_type)
                 └─ for page in 1..max_pages:
                      ├─ _fetch_platform_list(type, page)    # POST获取列表
                      ├─ 从item["url"]提取recruitmentId
                      ├─ get_existing_urls() 去重
                      ├─ gather_limited() 并发获取详情
                      │   └─ _fetch_platform_detail(item, type)
                      └─ _parse_platform_job()
```

**SUFE 列表请求示例**：

```python
POST https://career.sufe.edu.cn/career//zpxx/search/zpxx
Headers: { Referer: ".../career/zpxx/zpxx", X-Requested-With: "XMLHttpRequest" }
Body: pageNum=1
```

**CUFE/DUFE 详情请求示例**：

```python
POST http://scc.cufe.edu.cn/f/recruitmentinfo/ajax_show?ts={timestamp}
Headers: { Referer: "http://scc.cufe.edu.cn/", X-Requested-With: "XMLHttpRequest" }
Body: ts={timestamp}&recruitmentId={id}
```

##### 策略2: api_get (ZUEL)

**适用场景**: GET 请求的 RESTful API，参数通过 URL query string 传递。

```
crawl_api_get()
  └─ 遍历 categories[] (全职type=1 / 实习type=2)
       └─ _crawl_zuel_category(cat_config)
            └─ for page in 1..max_pages:
                 ├─ _fetch_zuel_list(api_type, page)    # GET ?type=&page=&limit=
                 ├─ 构建source_url列表
                 ├─ get_existing_urls() 去重
                 ├─ gather_limited() 并发获取详情
                 │   └─ _fetch_zuel_detail(item)
                 └─ _parse_zuel_job()
```

**ZUEL 请求示例**：

```python
GET https://jyzx.zuel.edu.cn/api/publicly/recruit/list?type=1&page=1&limit=10&total=0
GET https://jyzx.zuel.edu.cn/api/publicly/recruit/get?id={job_id}
```

##### 策略3: html (SWUFE)

**适用场景**: 直接遍历 HTML 页面 URL，使用 BeautifulSoup 解析 DOM。

```
crawl_html()
  └─ 仅实现 swufe:
       └─ 遍历 url_patterns{} (fulltime/intern)
            └─ _crawl_swufe_pattern(pattern_config)
                 └─ id from start_id, while consecutive_404 < 30:
                      ├─ url = pattern.format(id=current_id)
                      ├─ get_existing_urls() 去重
                      ├─ _fetch_swufe_detail(url, job_type)
                      │   ├─ GET url → HTML文本
                      │   ├─ BeautifulSoup(html, "html.parser")
                      │   ├─ 检测 div.no_page_group (404判断)
                      │   └─ _parse_swufe_job(soup, url, job_type)
                      └─ current_id += 1; 连续404计数
```

**SWUFE URL 模式**：

```python
fulltime: "https://job3.swufe.edu.cn/jobs/jobs-show-{id}.htm"   (start_id=14506)
intern:   "https://job3.swufe.edu.cn/interns/interns_show/id/{id}.htm" (start_id=12250)
```

**终止条件**: 连续 30 个页面返回 404（`div.no_page_group` 存在）则停止。

**跨模式去重** (`_dedup_jobs`)：

```python
def _dedup_jobs(self, existing, new):
    """基于 (title, company) 二元组去重。
    当发现重复时，比较新旧两条数据的完整度评分 (_job_completeness)，
    保留信息更完整的版本。
    """
```

##### 策略4: browser_* (UIBE / JXUFE / SmartEdu / NEU)

**适用场景**: 需要 JavaScript 渲染、加密解密、或复杂交互的场景。

```python
async def _crawl_browser(self, max_items=0):
    """委托给 browser_wrapper.run_browser_spider():
    1. 检查 Playwright 是否可用
    2. 动态加载对应的浏览器爬虫类 (UibeJobSpider/JxufeJobSpider)
    3. 创建实例并调用 crawl(max_items=max_items)
    4. 返回结果列表
    """
```

#### 3.3.5 错误处理机制

| 层级 | 处理方式 | 位置 |
|------|---------|------|
| HTTP错误 | `request_with_retry()` 自动重试3次 + 指数退避 | BaseSpider |
| JSON解析错误 | 返回 None，跳过该条目 | request_json_with_retry() |
| 数据解析错误 | try/except 包裹，返回 None，记录 warning | 各 _parse_*() 方法 |
| 列表为空 | break 终止该分页循环 | 各 _crawl_*() 方法 |
| 详情API异常 | gather_limited 中单个任务失败不影响其他任务 | gather_limited() |
| 整体异常 | catch Exception, 设置 ERROR 状态, 返回空列表 | crawl() |
| 浏览器不可用 | warning 日志提示安装, 返回空列表 | _crawl_browser() |

#### 3.3.6 数据校验与质量评分

每个 `_parse_*()` 方法内部都有完整的 try/except 保护：

```python
def _parse_xxx_job(self, detail, list_item) -> Optional[JobData]:
    try:
        title = detail.get("title", "")
        if not title:          # 标题必检
            return None
        company = clean_company_name(detail.get("company", ""))
        # ... 字段提取与转换 ...
        return JobData(...)    # 构建标准数据模型
    except Exception as e:
        logger.warning(f"[{self.source}] 解析岗位失败: {e}")
        return None             # 解析失败返回None, 不影响其他数据
```

**SWUFE 信息完整度评分** (`_job_completeness`)：

```python
@staticmethod
def _job_completeness(job: JobData) -> int:
    score = 0
    if job.description and len(job.description) > 50:  score += len(description)
    if job.salary and job.salary != '面议':             score += 100
    if job.location and job.location != '':              score += 50
    if job.education and job.education not in ('', '不限'): score += 30
    if job.source_url and 'example.com' not in job.source_url: score += 20
    return score
```

---

### 3.4 Async Multi Crawler - 并发调度器

#### 3.4.1 核心职责

`AsyncMultiCrawler` 是爬虫系统的**编排层**，负责：

1. **并发执行**: 同时启动多个数据源的爬虫
2. **浏览器限制**: 通过信号量控制最多 3 个浏览器同时运行
3. **批量写入**: 每 50 条一批写入数据库
4. **进度通知**: 通过回调函数报告进度
5. **失败处理**: 持久化失败队列
6. **URL去重**: 管理 visited_urls 文件

#### 3.4.2 并发执行机制

```python
class AsyncMultiCrawler:
    BATCH_SIZE = 50                           # 批量写入大小

    def __init__(self, output_dir=None, db_path=None):
        self.db = LocalDatabase(db_path)       # 共享数据库连接
        self._browser_semaphore = asyncio.Semaphore(MAX_BROWSER_CONCURRENCY)  # =3
        self._visited_urls: Set[str] = set()
        self._visited_urls_file = output_dir / "visited_urls.json"
        self._failed_queue_file = output_dir / "failed_queue.json"
        self.on_batch_saved: Callable = None   # 批量保存回调
        self.on_progress: Callable = None      # 进度回调
        self.on_source_complete: Callable = None  # 源完成回调

    async def crawl_all_parallel(self, sources=None, headless=True, max_items=0):
        """并行爬取所有指定数据源:
        1. db.connect() - 连接数据库
        2. _load_visited_urls() - 加载历史URL
        3. 为每个source创建 asyncio.Task
        4. 逐个await task结果 (保证顺序处理写入)
        5. 对每个源的結果:
           - batch写入数据库 (每BATCH_SIZE条一批)
           - log_crawl() 记录日志
           - on_source_complete() 回调通知
        6. _save_visited_urls() - 保存URL集合
        7. db.close() - 关闭数据库
        """
```

**并发模型示意**：

```
时间轴 →

Task(sufe)  ════════════════════▶  写入DB  ✓
Task(zuel)    ════════════════════▶  写入DB  ✓
Task(cufe)      ════════════════════▶  写入DB  ✓
Task(dufe)        ════════════════════▶  写入DB  ✓
Task(swufe)         ════════════════════▶  写入DB  ✓
Task(uibe)  [semaphore] ════════════════════▶  写入DB  ✓
Task(jxufe)         [semaphore] ════════════════════▶  写入DB  ✓
                                          ↑
                                   asyncio.gather() 并发启动
                                   但结果顺序 await 处理
```

#### 3.4.3 浏览器信号量控制

```python
BROWSER_SPIDERS = {'smartedu', 'uibe', 'jxufe', 'neu'}
MAX_BROWSER_CONCURRENCY = 3  # 来自 constants.py

async def crawl_source(self, source_key, headless=True, max_items=0):
    is_browser = source_key in BROWSER_SPIDERS

    async def _run_spider():
        config = {"existing_url_lookup": self.db.get_existing_urls, "headless": headless}
        spider = create_spider(source_key, config=config, headless=headless)
        return await spider.crawl(max_items=max_items)

    if is_browser:
        async with self._browser_semaphore:   # 最多3个浏览器并发
            return await _run_spider()
    else:
        return await _run_spider()            # HTTP无限制
```

#### 3.4.4 批量写入策略

```python
# 在 crawl_all_parallel() 中:
batch = jobs[:self.BATCH_SIZE]   # BATCH_SIZE = 50
while batch:
    inserted = await self.db.insert_jobs_batch(batch)
    if self.on_batch_saved:
        self.on_batch_saved(inserted, SOURCE_NAMES.get(key, key))
    jobs = jobs[self.BATCH_SIZE:]
    batch = jobs[:self.BATCH_SIZE]
```

#### 3.4.5 进度回调系统

```python
# 回调签名:
on_batch_saved: Callable[[int, str], None]   # (插入数量, 数据源名称)
on_progress: Callable[[str, int, int], None]  # (数据源, 当前/总数)
on_source_complete: Callable[[str, Dict], None]  # (数据源key, 结果统计)

# 使用示例:
crawler.on_batch_saved = lambda count, name: logger.info(f"  → 已保存 {count} 条 [{name}]")
crawler.on_source_complete = lambda key, result: logger.info(
    f"  ✓ [{key}] {result.get('status')} | {result.get('count', 0)} 条"
)
```

#### 3.4.6 URL去重机制

```python
# visited_urls.json 结构:
{
    "urls": ["https://...url1", "https://...url2", ...],
    "updated_at": "2026-05-18T10:30:00"
}

# 加载:
async def _load_visited_urls(self):
    data = json.loads(self._visited_urls_file.read_text())
    self._visited_urls = set(data.get("urls", []))

# 保存 (含自动清理):
async def _save_visited_urls(self):
    trimmed = BaseSpider.trim_visited_urls(self._visited_urls)
    # 超过50000条时, 删除最旧的30%
    json.dump({"urls": list(trimmed), "updated_at": ...})
```

**双层去重架构**：

```
请求新URL列表
    │
    ├─ 第一层: 内存 _seen_urls (BaseSpider实例级别, 当前爬取周期)
    │   └─ O(1) 查找, 无IO开销
    │
    └─ 第二层: db.get_existing_urls() (数据库级别, 跨周期持久化)
        └─ SQL IN 查询, 有IO开销但全局唯一
```

#### 3.4.7 失败队列持久化

```python
async def _save_failed_queue(self, failed_items: List[Dict]):
    """追加写入 failed_queue.json
    格式: [{source, url, error, timestamp}, ...]
    可用于后续重试
    """
```

#### 3.4.8 结果汇总

```python
def get_summary(self) -> Dict[str, Any]:
    """返回:
    {
        total_jobs: 总岗位数,
        total_sources: 总数据源数,
        completed_sources: 成功数,
        error_sources: 失败数,
        details: { source_key: {status, count, elapsed, error?} }
    }
    """
```

---

### 3.5 Local Database - 数据库操作

#### 3.5.1 类设计

```python
class LocalDatabase:
    DB_PATH = Path(__file__).parent.parent.parent / "data/jobs.db"

    def __init__(self, db_path=None):
        self.db_path = db_path or DB_PATH
        self._conn: Optional[aiosqlite.Connection] = None
```

#### 3.5.2 连接管理

```python
async def connect(self):
    """建立 aiosqlite 连接:
    - Row factory 设置为 aiosqlite.Row (支持字典式访问)
    - 自动创建表结构和索引
    """

async def close(self):
    """关闭数据库连接, 将 _conn 设为 None"""
```

#### 3.5.3 表结构

**jobs 表**：

```sql
CREATE TABLE IF NOT EXISTS jobs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,
    company         TEXT NOT NULL,
    location        TEXT DEFAULT '',
    salary          TEXT DEFAULT '面议',
    description     TEXT DEFAULT '',
    requirements    TEXT DEFAULT '',
    job_type        TEXT DEFAULT '实习',
    industry        TEXT DEFAULT '',
    education       TEXT DEFAULT '',
    experience      TEXT DEFAULT '',
    source          TEXT DEFAULT '',
    university      TEXT DEFAULT '',
    source_url      TEXT UNIQUE,           -- 唯一键, 用于去重
    apply_url       TEXT DEFAULT '',
    publish_date    TEXT DEFAULT '',
    deadline        TEXT DEFAULT '',
    category        TEXT DEFAULT '',
    tags            TEXT DEFAULT '',
    is_favorite     INTEGER DEFAULT 0,
    is_read         INTEGER DEFAULT 0,
    content_hash    TEXT,                  -- MD5内容哈希
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**crawl_logs 表**：

```sql
CREATE TABLE IF NOT EXISTS crawl_logs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    source         TEXT NOT NULL,
    status         TEXT NOT NULL,
    jobs_count     INTEGER DEFAULT 0,
    error_message  TEXT,
    start_time     TIMESTAMP,
    end_time       TIMESTAMP,
    duration       REAL DEFAULT 0
);
```

#### 3.5.4 索引优化

```sql
CREATE INDEX idx_jobs_source        ON jobs(source);
CREATE INDEX idx_jobs_source_url    ON jobs(source_url);     -- 去重查询核心索引
CREATE INDEX idx_jobs_company       ON jobs(company);
CREATE INDEX idx_jobs_publish_date  ON jobs(publish_date);   -- 时间排序优化
```

#### 3.5.5 批量写入

```python
async def insert_jobs_batch(
    self, jobs: List[JobData], replace_existing: bool = False
) -> int:
    """逐条写入 (非批量INSERT), 但单次commit.

    每条记录的处理流程:
    1. job.to_dict() 转换为字典
    2. _compute_content_hash() 计算MD5哈希
    3. replace_existing=True?
       → INSERT ... ON CONFLICT(source_url) DO UPDATE SET ... (覆盖更新)
       → INSERT OR IGNORE INTO ... (跳过已存在)
    4. IntegrityError → 静默跳过
    5. 其他异常 → 记录warning并跳过

    返回: 成功处理的记录数
    """
```

**content_hash MD5 去重机制**：

```python
@staticmethod
def _compute_content_hash(job: Dict[str, Any]) -> str:
    key_fields = ["title", "company", "location", "salary", "source_url"]
    content = "|".join(str(job.get(f, "")) for f in key_fields)
    return hashlib.md5(content.encode()).hexdigest()
```

> 注意: `content_hash` 目前仅作为字段存储，未用于去重逻辑。实际去重依赖 `source_url UNIQUE` 约束。

#### 3.5.6 增量查询

```python
async def get_existing_urls(self, urls: List[str]) -> Set[str]:
    """SQL: SELECT source_url FROM jobs WHERE source_url IN (...)
    用于爬取前过滤已存在的URL, 实现增量爬取
    """

async def get_all_urls_by_source(self, source: str) -> Set[str]:
    """获取指定数据源的全部URL, 用于全量去重分析"""
```

#### 3.5.7 日志记录

```python
async def log_crawl(
    self, source, status, jobs_count=0,
    error_message=None, start_time=None, end_time=None, duration=0
):
    """记录每次爬取的结果到 crawl_logs 表"""
```

#### 3.5.8 其他操作

```python
async def clean_invalid_data(self, source=None) -> int:
    """清理无效数据: title/company/source_url 为空的记录"""

async def get_job_count(self) -> int: ...
async def get_jobs_by_source(self, source) -> List[Dict]: ...
async def get_dedup_stats(self, source) -> Dict[str, Any]:
    """返回 {total_count, unique_count, duplicate_count}"""
```

---

### 3.6 Utils - 工具函数库

#### 3.6.1 html_to_text()

```python
def html_to_text(html: str) -> str:
    """HTML转纯文本:
    1. <br/> → \\n
    2. 去除所有HTML标签 (<[^>]+>)
    3. 替换HTML实体 (&nbsp; &amp; &lt; &gt;)
    4. 压缩连续空行 (>3个\\n → 2个\\n)
    5. strip首尾空白
    """
```

**使用场景**: 将 API 返回的 HTML 格式的职位描述转为纯文本存储。

#### 3.6.2 gather_limited()

```python
async def gather_limited(
    items: List[Any],
    coro_fn: Callable[[Any], Awaitable[Any]],
    concurrency: int = 4
) -> List[Any]:
    """带并发控制的异步批处理.

    实现:
    1. 创建 asyncio.Semaphore(concurrency)
    2. 为每个 item 创建协程 (内部 acquire/release semaphore)
    3. asyncio.gather(*coroutines) 并发执行
    4. 过滤掉 None 和 Exception 结果

    典型用法:
        results = await gather_limited(
            candidates,
            lambda item: self._fetch_detail(item),
            concurrency=self.detail_concurrency  # 通常为4~8
        )
    """
```

#### 3.6.3 normalize_publish_date()

```python
def normalize_publish_date(date_str: str) -> str:
    """统一日期格式为 YYYY-MM-DD.

    支持的输入格式:
    - 13位毫秒时间戳 (如 SmartEdu 的 publishDate)
    - 10位秒级时间戳
    - ISO格式: "2026-05-15T16:32:56"
    - 常见格式: "2026-05-15 16:32:56", "2026/05/15"
    - 中文格式: "2026年05月15日"

    无法识别的格式返回空字符串 ""
    """
```

#### 3.6.4 clean_company_name()

```python
def clean_company_name(raw: str) -> str:
    """清洗公司名称后缀.
    移除的后缀 (来自 COMPANY_SUFFIXES, 按长度降序匹配):
    - "招聘简章", "校园招聘", "社会招聘", "实习生招聘"
    - "2026届", "2025届", "2024届"
    - "2026年", "2025年", "2024年"
    - "招聘公告", "招聘启事", "校招", "秋招", "春招", "宣讲会", "招聘信息"
    - 年份模式: ".* (20\\d{2}) [届年秋春].*$"

    清洗后长度 < 2 则保留原始值
    """
```

**示例**：

| 输入 | 输出 |
|------|------|
| `"上海汇雅特集团有限公司招聘简章"` | `"上海汇雅特集团有限公司"` |
| `"华为技术有限公司2026届校园招聘"` | `"华为技术有限公司"` |
| `"字节跳动秋招"` | `"字节跳动"` |

#### 3.6.5 extract_salary()

```python
def extract_salary(low, high, unit="K") -> str:
    """格式化薪资字符串.
    - low/high 都有值: "{low}-{high}K"
    - 只有low: "{low}K+"
    - 只有high: "最高{high}K"
    - 都没有: "面议"
    """
```

#### 3.6.6 truncate_text()

```python
def truncate_text(text: str, max_len: int = 2000) -> str:
    """截断文本到指定长度, 超长部分加 "..."
    同时压缩空白字符 (多个空格/tab/换行 → 单个空格)
    """
```

#### 3.6.7 safe_get()

```python
def safe_get(data: dict, *keys, default="") -> Any:
    """安全地获取嵌套字典值.
    safe_get(data, "corporationinfo", "name")
    等价于 data.get("corporationinfo", {}).get("name", "")
    但中间任何层级非dict时返回default
    """
```

#### 3.6.8 is_current_year_date()

```python
def is_current_year_date(date_str: str) -> bool:
    """判断发布日期是否属于当年, 用于筛选最新岗位"""
```

---

### 3.7 Logger - 日志系统

#### 3.7.1 Loguru 配置

```python
# logger.py - setup_logger()

LOG_DIR = Path(__file__).parent.parent.parent / "log"   # 项目根目录/log/

# 四个日志输出目标:

# 1. 控制台 (WARNING级别以上, 彩色)
logger.add(sys.stdout,
    format=LOG_FORMAT,          # 详细格式: 时间 | 级别 | 模块:函数:行号 | 消息
    level="WARNING",
    colorize=True,
    enqueue=True,               # 异步安全
)

# 2. 主日志文件 (DEBUG级别, 按天轮转)
logger.add(LOG_DIR / "spider_{date}.log",
    format=SIMPLE_FORMAT,       # 简洁格式
    level="DEBUG",
    rotation="00:00",           # 午夜轮转
    retention="30 days",        # 保留30天
    compression="zip",          # 压缩旧日志
)

# 3. 错误日志文件 (ERROR级别, 保留90天)
logger.add(LOG_DIR / "error_{date}.log",
    level="ERROR",
    rotation="00:00",
    retention="90 days",
    compression="zip",
    filter=lambda r: r["level"].name == "ERROR",  # 仅ERROR
)

# 4. 调试日志文件 (DEBUG级别, 按大小轮转, 保留7天)
logger.add(LOG_DIR / "debug_{date}.log",
    level="DEBUG",
    rotation="100 MB",          # 100MB轮转
    retention="7 days",
    compression="zip",
    filter=lambda r: r["level"].name == "DEBUG",  # 仅DEBUG
)
```

#### 3.7.2 SpiderLogger 封装

```python
class SpiderLogger:
    """爬虫专用日志记录器, 自动添加 [source] 前缀"""

    def __init__(self, source: str):
        self.source = source
        self.logger = logger.bind(source=source)

    # 基础方法: info/debug/warning/error/critical/success/exception
    # 业务方法:
    def crawl_start(self, max_items=0): ...
    def crawl_complete(self, count, elapsed): ...     # 含速度计算
    def crawl_error(self, error): ...
    def url_filtered(self, total, new, skipped): ...  # 含跳过率
    def data_dedup(self, total, unique, duplicate): ...
    def request_success(self, url, status_code): ...
    def request_failed(self, url, error): ...
    def data_parsed(self, title): ...
    def data_written(self, count): ...
```

#### 3.7.3 日志输出示例

```
2026-05-18 10:30:15.123 | WARNING | spiders.unified_spider:_fetch_sufe_list:225 | [sufe] 获取列表失败 (section=zpxx, page=3): HTTP 429
2026-05-18 10:30:15.456 | INFO    | spiders.database:insert_jobs_batch:143 | 写入数据库: 50 条
2026-05-18 10:30:16.789 | SUCCESS | spiders.crawler:crawl_all_parallel:121 | [sufe] 爬取完成: 320 条, 耗时 45.2s
```

---

### 3.8 Browser Wrapper - 浏览器封装

#### 3.8.1 设计目的

`browser_wrapper.py` 解决了浏览器爬虫的**动态加载问题**：

- UIBE、JXUFE 等数据源需要 Playwright 浏览器渲染
- 这些爬虫是**独立的 .py 文件**（`uibe.py`, `jxufe_spider.py`），不在 `UnifiedSpider` 中实现
- 通过 Python `importlib` 动态加载模块，避免硬编码 import

#### 3.8.2 模块加载流程

```
browser_wrapper.py 导入时:
  │
  ├─ 检查 playwright 是否安装
  │   └─ PLAYWRIGHT_AVAILABLE = True/False
  │
  └─ 如果可用:
       ├─ 加载 constants.py → constants_module
       ├─ 加载 utils.py → utils_module
       ├─ 加载 base.py → base_module
       │
       └─ 加载浏览器爬虫文件:
            ├─ uibe.py → UibeJobSpider
            └─ jxufe_spider.py → JxufeJobSpider
            │
            └─ BROWSER_SPIDERS_AVAILABLE = True/False
```

#### 3.8.3 核心接口

```python
async def run_browser_spider(source: str, max_items=0, headless=True) -> List[Any]:
    """运行指定的浏览器爬虫.
    1. 检查 Playwright 是否安装
    2. 检查爬虫是否加载成功
    3. 根据 source 映射到对应的 Spider 类
    4. 创建实例 → crawl() → 返回结果
    """

def is_browser_spider_available() -> bool:
    """检查浏览器爬虫是否可用 (Playwright + 爬虫文件都就绪)"""

def list_available_sources() -> List[str]:
    """返回可用的浏览器数据源列表"""

async def run_browser_spiders(sources=None, max_items=0, headless=True) -> Dict[str, List[Any]]:
    """批量运行浏览器爬虫, 返回 {source: jobs} 字典"""
```

#### 3.8.4 CLI 入口

```bash
# 列出可用浏览器爬虫
python -m spiders.browser_wrapper --list-sources

# 运行指定浏览器爬虫
python -m spiders.browser_wrapper --sources uibe jxufe --max-items 20

# 显示浏览器窗口 (调试用)
python -m spiders.browser_wrapper --sources uibe --no-headless
```

---

### 3.9 Constants - 常量定义

```python
# constants.py 完整定义

SOURCE_NAMES = {
    'sufe': '上海财经大学',
    'cufe': '中央财经大学',
    'uibe': '对外经济贸易大学',
    'swufe': '西南财经大学',
    'dufe': '东北财经大学',
    'jxufe': '江西财经大学',
    'zuel': '中南财经政法大学',
}

DEFAULT_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 ...",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/119 Edg/119.0.0.0 ...",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 ...",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Firefox/120.0",
]

COMPANY_SUFFIXES = [
    "招聘简章", "校园招聘", "社会招聘", "实习生招聘",
    "2026届", "2025届", "2024届", "2026年", "2025年", "2024年",
    "招聘公告", "招聘启事", "校招", "秋招", "春招", "宣讲会", "招聘信息",
]

MAX_VISITED_URLS = 50000              # URL去重集合上限
VISITED_URLS_CLEANUP_RATIO = 0.3      # 清理比例 (超过上限时删除30%)
BATCH_SIZE = 50                       # 数据库批量写入大小
MAX_BROWSER_CONCURRENCY = 3           # 浏览器最大并发数
```

---

## 4. 数据源配置参考

### 4.1 SUFE - 上海财经大学

| 配置项 | 值 |
|--------|-----|
| **Key** | `sufe` |
| **大学** | 上海财经大学 |
| **基础URL** | `https://career.sufe.edu.cn` |
| **spider_type** | `api_post` |
| **默认城市** | 上海 |
| **page_size** | 10 |
| **max_pages_per_section** | 5 |
| **detail_concurrency** | 8 |

**三板块配置 (sections)**：

| section | label | list_url | detail_url |
|---------|-------|----------|------------|
| `zpxx` | 招聘信息 | `/career//zpxx/search/zpxx` | `/career//zpxx/data/zpxx/{item_id}` |
| `sxzpxx` | 实习信息 | `/career//zpxx/search/sxzpxx` | `/career//zpxx/data/sxzpxx/{item_id}` |
| `zpgg` | 招聘公告 | `/career//news/search/zpgg` | `/career//news/data/{news_type}/{item_id}` |

**字段映射**：

```python
{
    "title": "zpzt",                    # 岗位标题
    "company": "dwmc",                  # 公司名称
    "location": ["gzszxmc", "szxmc"],   # 工作地点 (优先工作地点, 其次区县)
    "salary": "yxmc",                   # 薪资范围
    "publish_date": "fbrq",             # 发布日期
    "deadline": "zpjzrq",               # 截止日期
    "industry": "hyyjmc",               # 行业
    "education": "xlyqmc",              # 学历要求
    "requirements": "zyyqmc",           # 专业要求
    "description": ["zwms", "dwjs"],    # 职位描述 + 公司介绍
    "job_type": "gzlxmc",               # 工作类型
}
```

**特殊逻辑**：
- 招聘公告 (`zpgg`) 使用单独的解析方法 `_parse_sufe_notice()`，薪资固定为"面议"
- 详情数据中的 `zwxxList` 岗位列表取第一个元素的详细信息
- 公司介绍 (`dwjs`) 追加到 description 末尾

**API 请求示例**：

```python
# 列表
POST https://career.sufe.edu.cn/career//zpxx/search/zpxx
Body: pageNum=1
Referer: https://career.sufe.edu.cn/career/zpxx/zpxx

# 详情
POST https://career.sufe.edu.cn/career//zpxx/data/zpxx/{zpxxid}
Body: (空)
```

---

### 4.2 ZUEL - 中南财经政法大学

| 配置项 | 值 |
|--------|-----|
| **Key** | `zuel` |
| **大学** | 中南财经政法大学 |
| **基础URL** | `https://jyzx.zuel.edu.cn` |
| **spider_type** | `api_get` |
| **默认城市** | 武汉 |
| **page_size** | 10 |
| **max_pages_per_category** | 80 |
| **detail_concurrency** | 8 |

**分类配置 (categories)**：

| label | api_type | job_type |
|-------|----------|----------|
| 全职 | `1` | 全职 |
| 实习 | `2` | 实习 |

**字段映射**：

```python
{
    "title": "title",
    "company": "companyName",
    "location": "area",
    "salary": "salary",
    "publish_date": "createTime",
    "education": "education",
    "requirements": "majors",
    "industry": "nature",
    "description": ["companyContent", "dwjj", "zpgw"],  # 多字段拼接
}
```

**API 请求示例**：

```python
# 列表
GET https://jyzx.zuel.edu.cn/api/publicly/recruit/list?type=1&page=1&limit=10&total=0

# 详情
GET https://jyzx.zuel.edu.cn/api/publicly/recruit/get?id={job_id}
```

---

### 4.3 CUFE - 中央财经大学

| 配置项 | 值 |
|--------|-----|
| **Key** | `cufe` |
| **大学** | 中央财经大学 |
| **基础URL** | `http://scc.cufe.edu.cn` |
| **spider_type** | `api_post` |
| **默认城市** | 北京 |
| **page_size** | 10 |
| **max_pages** | 80 |
| **detail_concurrency** | 4 |

**特殊处理**：
- 初始化时先访问首页 `GET http://scc.cufe.edu.cn` 获取 Cookie（解决 302 重定向问题）
- 详情 API 需要毫秒级时间戳参数 `ts`

**字段映射**：

```python
{
    "title": "title",
    "company": "corporationinfo.name",                          # 嵌套路径
    "location": "recruitmentPositionList[0].cityName",           # 数组+嵌套
    "publish_date": "startTime",
    "deadline": "endTime",
    "education": "education",
    "requirements": "majorName",
    "industry": "corporationinfo.corporationNatureValue",
    "description": ["content", "corporationinfo.introduction"],  # HTML转文本 + 公司介绍
    "job_type": "positionTypeValue",                              # 含"招聘"→全职, 否则→实习
    "apply_url": "onlineApplicationUrl",
}
```

**API 请求示例**：

```python
# 列表
POST http://scc.cufe.edu.cn/f/recruitmentinfo/ajax_frontRecruitinfo
Body: pageNo=1&positionType=1

# 详情 (注意 ts 参数同时在 URL 和 POST body 中)
POST http://scc.cufe.edu.cn/f/recruitmentinfo/ajax_show?ts={timestamp}
Body: ts={timestamp}&recruitmentId={id}
```

---

### 4.4 DUFE - 东北财经大学

| 配置项 | 值 |
|--------|-----|
| **Key** | `dufe` |
| **大学** | 东北财经大学 |
| **基础URL** | `https://career.dufe.edu.cn` |
| **spider_type** | `api_post` |
| **默认城市** | 大连 (硬编码) |
| **其他参数** | 与 CUFE 完全相同 |

**特殊之处**：
- `field_mapping: "same_as_cufe"` — 直接复用 CUFE 的字段映射
- `location` 固定为 `"大连"`，不从 API 数据中提取
- 其余行为（API路径、请求方式、解析逻辑）与 CUFE 完全一致

---

### 4.5 SWUFE - 西南财经大学

| 配置项 | 值 |
|--------|-----|
| **Key** | `swufe` |
| **大学** | 西南财经大学 |
| **基础URL** | `https://job3.swufe.edu.cn` |
| **spider_type** | `html` |
| **默认城市** | 成都 |
| **page_size** | 10 |
| **max_pages** | 100 |
| **detail_concurrency** | 8 |

**URL 模式 (url_patterns)**：

| pattern_key | URL模板 | start_id | job_type |
|-------------|---------|----------|----------|
| `fulltime` | `https://job3.swufe.edu.cn/jobs/jobs-show-{id}.htm` | 14506 | 全职 |
| `intern` | `https://job3.swufe.edu.cn/interns/interns_show/id/{id}.htm` | 12250 | 实习 |

**CSS 选择器 (selectors)**：

| 字段 | 选择器 | 说明 |
|------|--------|------|
| title | `div.j-n-txt` | 岗位标题 |
| publish_date | `div.job_date span.cutom_font` | 发布日期 |
| salary | `div.job_msg span` (含"薪酬") | 薪资 |
| location | `span.job_position` (支持title属性) | 工作地点 |
| education | `span.job_academic` | 学历要求 |
| experience | `span.job_money` (含"招聘对象") | 招聘对象 |
| company | `div.com-name` | 公司名称 (需去除"-->"前缀) |
| industry | `div.com-class` | 行业 |
| com_num | `div.com-num` | 公司规模 |
| tags | `div.lab div.li` | 福利标签 |
| description | `div.describe div.txt` | 职位描述 |
| not_found | `div.no_page_group` | 404检测 |

**终止条件**: 连续 30 个页面返回 404 后停止遍历。

**薪资解析特殊逻辑**：
- `span.job_money` 的文本可能是"薪酬：8K-12K"或"招聘对象：应届生"
- 需要通过子元素 `div.txt2` 区分标签和值
- 如果标签是"招聘对象"，存入 experience；否则存入 salary
- 还需扫描 `div.job_msg span` 查找包含"薪酬"的元素

---

### 4.6 UIBE - 对外经济贸易大学

| 配置项 | 值 |
|--------|-----|
| **Key** | `uibe` |
| **大学** | 对外经济贸易大学 |
| **基础URL** | `https://career.uibe.edu.cn` |
| **spider_type** | `browser_js` |
| **默认城市** | 北京 |
| **page_size** | 10 |
| **max_pages** | 50 |
| **detail_concurrency** | 4 |

**特点**：
- 需要 Playwright 浏览器渲染
- 数据可能经过前端 JavaScript 加密（`window.decrypt()` 函数）
- 独立实现在 [uibe.py](src/spiders/uibe.py) 中
- 通过 `browser_wrapper.py` 动态加载

**选择器 (selectors)**：

```python
{
    "list_links": "a[href*='/front/zpxx.jspa?tid=']",
    "detail_title": "h1",
    "detail_content": "div.details-content",
}
```

---

### 4.7 JXUFE - 江西财经大学现代经济管理学院

| 配置项 | 值 |
|--------|-----|
| **Key** | `jxufe` |
| **大学** | 江西财经大学现代经济管理学院 |
| **基础URL** | `http://career.jxufe.edu.cn` |
| **spider_type** | `browser_js` |
| **默认城市** | 南昌 |
| **page_size** | 10 |
| **max_pages** | 50 |
| **detail_concurrency** | 4 |

**特点**：
- 需要 Playwright 浏览器渲染（JS 动态加载内容）
- 独立实现在 [jxufe_spider.py](src/spiders/jxufe_spider.py) 中
- 通过 `browser_wrapper.py` 动态加载

---

### 4.8 已禁用数据源

#### SmartEdu - 国家大学生就业服务平台

| 配置项 | 值 |
|--------|-----|
| **Key** | `smartedu` (已禁用) |
| **大学** | 国家大学生就业服务平台 |
| **基础URL** | `https://24365.smartedu.cn` |
| **spider_type** | `browser_api` |
| **默认城市** | 全国 |

**禁用原因**: 匿名访问受限，只能获取前几页数据，触发"登录后查看"限制后无法继续。

**恢复条件**: 如需重新启用，将配置从 `SPIDER_CONFIGS_DISABLED` 移至 `SPIDER_CONFIGS`。

#### NEU - 东北大学

| 配置项 | 值 |
|--------|-----|
| **Key** | `neu` (已禁用) |
| **大学** | 东北大学 |
| **基础URL** | `http://job.neu.edu.cn` |
| **spider_type** | `browser_js` |
| **默认城市** | 辽宁 |

**禁用原因**: 浏览器爬虫稳定性不足，待优化。

---

## 5. 运行命令

### 5.1 基本命令

```bash
# 进入项目目录
cd /home/joakim/Project/job_hub

# 运行所有爬虫
python3 -m src.spiders.run

# 运行指定爬虫
python3 -m src.spiders.run --sources sufe zuel swufe

# 限制每个源最多爬取数量
python3 -m src.spiders.run --max-items 10

# 显示浏览器窗口 (调试用)
python3 -m src.spiders.run --no-headless

# 列出所有数据源
python3 -m src.spiders.run --list-sources

# 交互式选择
python3 -m src.spiders.run --interactive
```

### 5.2 交互式选择模式

```
============================================================
FinIntern Hub 爬虫系统
============================================================

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
```

### 5.3 Python API 调用

```python
import asyncio
from src.spiders import create_spider, AsyncMultiCrawler

# 方式1: 单独运行某个爬虫
async def crawl_single():
    spider = create_spider("sufe", headless=True)
    jobs = await spider.crawl(max_items=20)
    print(f"获取到 {len(jobs)} 条数据")
    await spider.close()

# 方式2: 并发运行多个爬虫
async def crawl_multiple():
    crawler = AsyncMultiCrawler()

    # 设置回调
    crawler.on_batch_saved = lambda count, name: print(f"保存 {count} 条 [{name}]")

    results = await crawler.crawl_all_parallel(
        sources=["sufe", "zuel", "cufe"],
        headless=True,
        max_items=50,
    )

    summary = crawler.get_summary()
    print(f"总计: {summary['total_jobs']} 条岗位")

# 方式3: 使用异步上下文管理器
async def crawl_with_context():
    spider = create_spider("zuel", headless=True)
    async with spider:
        jobs = await spider.crawl(max_items=10)
    # 自动关闭
```

### 5.4 输出示例

```
============================================================
爬取完成 | 总耗时 185.3s
  总岗位数: 1247
  完成源: 7/7
  失败源: 0
------------------------------------------------------------
  ✓ 上海财经大学       |  320 条 |  45.2s
  ✓ 中南财经政法大学   |  450 条 |  52.1s
  ✓ 中央财经大学       |  180 条 |  38.7s
  ✓ 东北财经大学       |  120 条 |  35.3s
  ✓ 西南财经大学       |   95 条 |  42.8s
  ✓ 对外经济贸易大学    |   52 条 |  68.4s
  ✓ 江西财经大学        |   30 条 |  55.6s
============================================================
```

---

## 6. 最佳实践

### 6.1 新增数据源完整流程

以新增 **XX大学就业网** 为例，假设其提供 GET API 接口：

#### Step 1: 分析数据源

```bash
# 1. 手动访问网站, 分析API结构
# 2. 使用浏览器开发者工具抓包
# 3. 确定请求方式 (GET/POST)、URL模式、参数、返回格式
# 4. 确定是否需要登录/Cookie/加密
```

#### Step 2: 在 spider_configs.py 中添加配置

```python
# 在 SPIDER_CONFIGS 字典中添加:
"xuida": {
    "name": "xuida_jobs",
    "university": "西安交通大学",
    "base_url": "https://job.xjtu.edu.cn",
    "location": "西安",
    "spider_type": "api_get",              # 根据实际情况选择类型
    "list_api": "https://job.xjtu.edu.cn/api/v1/jobs/list",
    "detail_api": "https://job.xjtu.edu.cn/api/v1/jobs/{id}",
    "page_size": 20,
    "max_pages_per_category": 50,
    "detail_concurrency": 6,
    "categories": [
        {"label": "全职", "api_type": "1", "job_type": "全职"},
        {"label": "实习", "api_type": "2", "job_type": "实习"},
    ],
    "headers": {
        "Accept": "application/json",
        "Referer": "https://job.xjtu.edu.cn/",
    },
    "field_mapping": {
        "title": "jobTitle",
        "company": "companyName",
        "location": "workCity",
        "salary": "salaryRange",
        "publish_date": "publishTime",
        "education": "educationRequirement",
        "description": "jobDescription",
    },
},
```

#### Step 3: 更新 constants.py

```python
SOURCE_NAMES['xuida'] = '西安交通大学'
```

#### Step 4: (可选) 如果需要自定义解析逻辑

如果新数据源的解析逻辑无法通过现有 `_crawl_api_get()` 处理（例如需要特殊的认证流程），需要在 `unified_spider.py` 中：

1. 在 `crawl()` 方法中增加新的 `elif` 分支
2. 实现对应的 `_crawl_xxx()` 私有方法
3. 实现 `_fetch_xxx_list()` 和 `_parse_xxx_job()` 方法

#### Step 5: 测试验证

```bash
# 单独测试新数据源
python3 -m src.spiders.run --sources xuida --max-items 5

# 检查数据质量
sqlite3 data/jobs.db "SELECT COUNT(*), source FROM jobs WHERE source='xuida'"
```

#### Step 6: (如果是浏览器类型) 创建独立爬虫文件

```python
# 创建 src/spiders/xuida_spider.py
from .base import BaseBrowserSpider, JobData

class XuidaJobSpider(BaseBrowserSpider):
    async def crawl(self, max_items=0):
        # Playwright 浏览器自动化逻辑
        ...
```

然后在 `browser_wrapper.py` 的 `spider_files` 字典中注册。

### 6.2 性能调优指南

#### 并发数调优

| 参数 | 位置 | 默认值 | 建议 |
|------|------|--------|------|
| `detail_concurrency` | spider_configs | 4~8 | HTTP API 可设 8~16；浏览器类型设 2~4 |
| `MAX_BROWSER_CONCURRENCY` | constants.py | 3 | 服务器内存 < 2G 时降至 2 |
| `BATCH_SIZE` | constants.py | 50 | 数据库写入瓶颈时可降至 20~30 |
| `max_runtime_seconds` | BaseSpider.config | 900 (15分钟) | 生产环境可设 1800~3600 |

#### 超时设置

```python
# unified_spider.py initialize() 中:
aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=20))  # HTTP超时20秒

# base.py request_with_retry():
timeout=30          # 单次请求超时30秒
max_retries=3       # 最大重试3次
```

**调优建议**：
- 目标服务器响应快 → 降低 timeout 到 10~15s
- 目标服务器不稳定 → 提高 max_retries 到 5 次
- 网络环境差 → 提高超时到 30~60s

#### 内存管理

```python
MAX_VISITED_URLS = 50000              # URL去重集合上限
VISITED_URLS_CLEANUP_RATIO = 0.3      # 超限时清理30%
```

**内存估算**：每个 URL 约 100 bytes，50000 URLs ≈ 5MB 内存占用。

### 6.3 代码规范

**命名约定**：

| 类型 | 约定 | 示例 |
|------|------|------|
| 公共方法 | `snake_case` | `crawl_api_post()` |
| 私有方法 | `_前缀` | `_fetch_sufe_list()` |
| 配置key | `snake_case` | `detail_concurrency` |
| 数据源key | 小写英文缩写 | `sufe`, `zuel`, `cufe` |
| 常量 | `UPPER_SNAKE` | `MAX_VISITED_URLS` |

**错误处理规范**：

```python
# ✅ 正确: 每个解析方法都包裹 try/except
def _parse_xxx_job(self, detail, list_item) -> Optional[JobData]:
    try:
        # 解析逻辑
        return JobData(...)
    except Exception as e:
        logger.warning(f"[{self.source}] 解析岗位失败: {e}")
        return None

# ❌ 错误: 让异常冒泡导致整个爬虫崩溃
def _parse_bad(self, detail):
    return JobData(title=detail["missing_key"])  # KeyError!
```

**日志规范**：

```python
# 使用结构化日志, 包含 source 前缀
logger.info(f"[{self.source}] 爬取完成: {len(jobs)} 条")
logger.warning(f"[{self.source}] 获取列表失败: {e}")
logger.error(f"[{self.source}] 爬取失败: {exc}")
```

---

## 7. 常见问题 FAQ

### Q1: 数据库锁定错误 (database is locked)

**现象**: `aiosqlite.OperationalError: database is locked`

**原因**: SQLite 不支持高并发写操作，多个进程/协程同时写入会导致锁冲突。

**解决方案**:
1. 确保只有一个爬虫进程在运行
2. 检查是否有残留的 Python 进程: `ps aux | grep python`
3. `insert_jobs_batch()` 已经采用逐条写入+单次 commit 的策略来减少锁持有时间
4. 如频繁出现，考虑降低 `BATCH_SIZE` 或增大写入间隔

### Q2: 爬虫运行缓慢

**排查步骤**:

| 可能原因 | 检查方式 | 解决方案 |
|---------|---------|---------|
| detail_concurrency 太低 | 查看日志中的并发数 | 提高到 8~16 |
| 网络延迟高 | `ping` 目标服务器 | 使用代理或 CDN |
| 浏览器爬虫过多 | 检查是否同时运行 >3 个浏览器爬虫 | 减少 BROWSER_SOURCES |
| max_runtime_seconds 限制 | 检查是否提前终止 | 增大或设为 0 (无限) |
| 数据库写入瓶颈 | 观察 `on_batch_saved` 间隔 | 降低 BATCH_SIZE |

### Q3: 浏览器爬虫失败

**现象**: `[source] 浏览器爬虫需要Playwright支持`

**解决方案**:

```bash
# 1. 安装 Playwright
pip install playwright

# 2. 安装 Chromium
playwright install chromium

# 3. Docker 环境需要额外依赖
apt-get update && apt-get install -y \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libdbus-1-3 libxkbcommon0 \
    libatspi2.0-0 libxcomposite1 libxdamage1 libxrandr2 \
    libgbm1 libpango-1.0-0 libcairo2 libasound2

# 4. 验证安装
python3 -c "from playwright.async_api import async_playwright; print('OK')"
```

**Docker 特殊配置**:
- 必须加 `--no-sandbox` 参数 (已在 `BaseBrowserSpider` 中配置)
- 推荐 `--disable-dev-shm-usage` 避免 `/dev/shm` 空间不足
- Dockerfile 中需要安装 Chromium 依赖库

### Q4: 数据重复或丢失

**重复数据**:

| 原因 | 定位 | 解决方案 |
|------|------|---------|
| source_url 未正确生成 | 检查 `_build_*_url()` 方法 | 确保 URL 包含唯一 ID |
| replace_existing=False 但 hash 冲突 | 检查 content_hash | 正常情况不应发生 |
| 跨模式爬取同一数据 (如 SWUFE) | 查看 `_dedup_jobs` 日志 | 已有 (title, company) 去重 |

**数据丢失**:

| 原因 | 定位 | 解决方案 |
|------|------|---------|
| 解析异常返回 None | 查看 WARNING 日志 | 修复对应 `_parse_*()` 方法 |
| HTTP 429 被限流 | 查看重试日志 | 降低并发或增加延迟 |
| max_items 限制 | 检查启动参数 | 增大或设为 0 |
| 增量模式下跳过已存在 | 检查 visited_urls | 这是正常行为 |

### Q5: 内存占用过高

**常见原因及解决方案**:

| 原因 | 内存占用 | 解决方案 |
|------|---------|---------|
| visited_urls 过大 | ~5MB/5万条 | 自动清理 30%，无需干预 |
| jobs 列表未释放 | 取决于数据量 | `crawl()` 返回后自动 GC |
| 浏览器实例 | ~100-300MB/个 | 限制 MAX_BROWSER_CONCURRENCY=3 |
| aiohttp 响应缓冲 | 较小 | 及时 await resp.text() |
| BeautifulSoup 对象 | 较大 | `_parse_*()` 返回后自动释放 |

### Q6: 如何只更新已有数据？

```python
# 方式1: 启动时设置 replace_existing=True
config = {"replace_existing": True, "existing_url_lookup": db.get_existing_urls}
spider = create_spider("sufe", config=config)
jobs = await spider.crawl()

# 方式2: 使用 ON CONFLICT UPDATE (database.py 已支持)
await db.insert_jobs_batch(jobs, replace_existing=True)
```

### Q7: 如何查看爬取历史？

```bash
# 方式1: 查看日志
tail -f log/spider_$(date +%Y-%m-%d).log

# 方式2: 查询数据库
sqlite3 data/jobs.db "SELECT * FROM crawl_logs ORDER BY id DESC LIMIT 20"

# 方式3: 查看各源统计
sqlite3 data/jobs.db "SELECT source, COUNT(*) as cnt FROM jobs GROUP BY source"
```

---

## 8. 附录

### 8.1 配置项速查表

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `spider_type` | string | 必填 | `api_post` / `api_get` / `html` / `browser_api` / `browser_js` |
| `base_url` | string | 必填 | 数据源基础 URL |
| `page_size` | int | 10 | 每页条数 |
| `max_pages` | int | 80 | 最大爬取页数 |
| `detail_concurrency` | int | 8 | 详情页并发数 |
| `max_runtime_seconds` | int | 900 | 单源最大运行时间(秒) |
| `BATCH_SIZE` | int | 50 | 数据库批量写入大小 |
| `MAX_BROWSER_CONCURRENCY` | int | 3 | 浏览器最大并发数 |
| `MAX_VISITED_URLS` | int | 50000 | URL去重集合上限 |
| `VISITED_URLS_CLEANUP_RATIO` | float | 0.3 | URL集合清理比例 |

### 8.2 spider_type 对照表

| spider_type | 请求方式 | 解析方式 | 适用场景 | 代表数据源 |
|-------------|---------|---------|---------|-----------|
| `api_post` | HTTP POST (form-urlencoded) | JSON | 表单提交类API | SUFE, CUFE, DUFE |
| `api_get` | HTTP GET (query params) | JSON | RESTful GET API | ZUEL |
| `html` | HTTP GET | BeautifulSoup | HTML静态页面 | SWUFE |
| `browser_api` | 浏览器 + AJAX拦截 | JSON | 需要Cookie/Session的API | SmartEdu |
| `browser_js` | 浏览器渲染 | DOM选择器 | JS动态渲染/加密 | UIBE, JXUFE, NEU |

### 8.3 数据流向图

```
原始数据源
    │
    ▼
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│ HTTP Request │     │ Browser Render   │     │ HTML Parse   │
│ (aiohttp)   │     │ (Playwright)     │     │ (BS4)        │
└──────┬──────┘     └────────┬─────────┘     └──────┬───────┘
       │                     │                      │
       ▼                     ▼                      ▼
  原始JSON/HTML         渲染后的DOM            HTML文本
       │                     │                      │
       └─────────────┬───────┴──────────────────────┘
                     │
                     ▼
           ┌──────────────────┐
           │  _parse_*_job()  │
           │  字段提取+转换     │
           └────────┬─────────┘
                    │
                    ▼
           ┌──────────────────┐
           │    JobData       │
           │  (标准数据模型)    │
           └────────┬─────────┘
                    │
                    ▼
           ┌──────────────────┐
           │ validate_data()  │
           │  数据校验         │
           └────────┬─────────┘
                    │
                    ▼
           ┌──────────────────┐
           │ insert_jobs_batch│
           │  (SQLite写入)     │
           │  去重 + 哈希      │
           └──────────────────┘
```

### 8.4 版本历史

| 版本 | 日期 | 变更说明 |
|------|------|---------|
| v1.0.0 | 2026-05-16 | 初始版本，基于独立爬虫文件的文档 |
| v2.0.0 | 2026-05-16 | 重构文档，反映配置驱动架构 |
| v3.0.0 | 2026-05-18 | 全面重写：架构总览、核心组件详解、最佳实践、FAQ |

### 8.5 文件速查

| 文件 | 行数(约) | 核心类/函数 |
|------|---------|------------|
| [spider_configs.py](src/spiders/spider_configs.py) | ~365 | `SPIDER_CONFIGS`, `get_spider_config()`, `get_lite_http_sources()` |
| [unified_spider.py](src/spiders/unified_spider.py) | ~970 | `UnifiedSpider`, `create_spider()`, 4种策略方法 |
| [base.py](src/spiders/base.py) | ~485 | `BaseSpider`, `BaseAPISpider`, `BaseBrowserSpider`, `JobData`, `SpiderStats` |
| [crawler.py](src/spiders/crawler.py) | ~167 | `AsyncMultiCrawler` |
| [database.py](src/spiders/database.py) | ~265 | `LocalDatabase` |
| [utils.py](src/spiders/utils.py) | ~128 | `html_to_text()`, `gather_limited()`, `normalize_publish_date()`, `clean_company_name()` |
| [logger.py](src/spiders/logger.py) | ~187 | `setup_logger()`, `SpiderLogger` |
| [browser_wrapper.py](src/spiders/browser_wrapper.py) | ~250 | `run_browser_spider()`, `is_browser_spider_available()` |
| [constants.py](src/spiders/constants.py) | ~29 | `SOURCE_NAMES`, `DEFAULT_USER_AGENTS`, `COMPANY_SUFFIXES` |
| [run.py](src/spiders/run.py) | ~156 | CLI 入口, 交互式选择 |
