# lite_crawler.py 爬取方法详解

> 文档生成时间：2026-05-20

---

## 目录

1. [整体架构](#整体架构)
2. [核心方法列表](#核心方法列表)
3. [数据源爬取方法](#数据源爬取方法)
4. [辅助工具方法](#辅助工具方法)
5. [数据入库方法](#数据入库方法)
6. [状态管理方法](#状态管理方法)

---

## 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      main() 入口函数                         │
│  ├── 参数解析 (argparse)                                     │
│  ├── 数据库初始化 init_database()                            │
│  ├── 状态管理 set_crawler_status()                           │
│  └── 遍历数据源 crawl_source()                               │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              crawl_source() 数据源调度器                     │
│  ├── crawl_sufe()      → 上海财经大学 (POST API)            │
│  ├── crawl_zuel()      → 中南财经政法大学 (GET API)         │
│  ├── crawl_platform()  → CUFE/DUFE (POST API + 嵌套结构)    │
│  └── crawl_swufe()     → 西南财经大学 (GET API)             │
└──────────────────────────┬──────────────────────────────────┘
                           │ yield job
┌──────────────────────────▼──────────────────────────────────┐
│              insert_job() 数据入库                           │
│  ├── 时间筛选 is_within_date_range()                         │
│  ├── 去重检查 (title + company + source)                     │
│  └── 写入数据库                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 核心方法列表

| 方法名 | 类型 | 功能描述 |
|--------|------|----------|
| `main()` | 入口 | 程序主入口，参数解析和流程控制 |
| `init_database()` | 初始化 | 创建数据库表结构 |
| `crawl_source()` | 调度 | 根据数据源名称分发到具体爬取方法 |
| `crawl_sufe()` | 爬取 | 上海财经大学数据爬取 |
| `crawl_zuel()` | 爬取 | 中南财经政法大学数据爬取 |
| `crawl_platform()` | 爬取 | CUFE/DUFE平台数据爬取 |
| `crawl_swufe()` | 爬取 | 西南财经大学数据爬取 |
| `fetch_with_retry()` | 工具 | HTTP请求重试机制 |
| `insert_job()` | 入库 | 单条数据入库 |
| `insert_jobs_batch()` | 入库 | 批量数据入库 |
| `set_crawler_status()` | 状态 | 更新爬虫全局状态 |
| `get_crawler_status()` | 状态 | 获取爬虫全局状态 |

---

## 数据源爬取方法

### 1. crawl_sufe() - 上海财经大学

**方法签名**:
```python
def crawl_sufe(max_items: int = 0) -> Generator[Dict, None, None]:
```

**爬取类型**: POST API

**API端点**:
- 列表页: `POST https://career.sufe.edu.cn/career/zpxx/list`
- 详情页: `POST https://career.sufe.edu.cn/career/zpxx/view/zpxx/{zpxxid}`

**请求参数**:
```python
list_payload = {
    "page": page,
    "limit": 10,
    "sort": "desc",
    "sortField": "createTime"
}
```

**响应结构**:
```python
{
    "code": 200,
    "data": {
        "list": [
            {
                "zpxxid": "xxx",      # 招聘ID
                "zpzt": "岗位标题",    # title
                "dwmc": "公司名称",    # company
                "gzdd": "工作地点",    # location
                "xzdy": "薪资待遇",    # salary
                "xlyq": "学历要求",    # education
                "zwms": "职位描述"     # description
            }
        ]
    }
}
```

**字段映射**:
| 输出字段 | API字段 | 说明 |
|---------|---------|------|
| title | zpzt | 招聘主题 |
| company | dwmc | 单位名称 |
| location | gzdd | 工作地点 |
| salary | xzdy | 薪资待遇 |
| education | xlyq | 学历要求 |
| description | zwms | 职位描述 |
| publish_date | createTime | 创建时间 |
| source | "上海财经大学" | 固定值 |
| source_url | detail_url | 详情页URL |

**爬取流程**:
```
1. 初始化 page = 1
2. 发送 POST 请求到列表API
3. 解析响应获取 items 列表
4. 如果 items 为空，结束爬取
5. 遍历 items:
   a. 提取 zpxxid
   b. 构造详情页 URL
   c. 发送 POST 请求获取详情
   d. 提取字段并 yield job
6. page += 1，回到步骤2
```

---

### 2. crawl_zuel() - 中南财经政法大学

**方法签名**:
```python
def crawl_zuel(max_items: int = 0) -> Generator[Dict, None, None]:
```

**爬取类型**: GET API

**API端点**:
- 列表页: `GET https://jyzx.zuel.edu.cn/api/recruitmentinfo/recruitmentInfo/list?page={page}&limit=10`
- 详情页: `GET https://jyzx.zuel.edu.cn/api/recruitmentinfo/recruitmentInfo/get?id={id}`

**请求参数**:
```python
params = {
    "page": page,
    "limit": 10
}
```

**响应结构**:
```python
{
    "code": 0,
    "data": [
        {
            "id": "xxx",
            "title": "岗位标题",
            "companyName": "公司名称",
            "workCity": "工作城市",
            "salary": "薪资",
            "education": "学历",
            "description": "描述"
        }
    ]
}
```

**字段映射**:
| 输出字段 | API字段 |
|---------|---------|
| title | title |
| company | companyName |
| location | workCity |
| salary | salary |
| education | education |
| description | description |

**特点**: 直接返回详情数据，无需额外解析

---

### 3. crawl_platform() - CUFE/DUFE 平台

**方法签名**:
```python
def crawl_platform(source: str, max_items: int = 0) -> Generator[Dict, None, None]:
```

**参数**:
- `source`: "cufe" 或 "dufe"
- `max_items`: 最大爬取数量

**爬取类型**: POST API + 嵌套数据结构

**API端点**:
- 列表页: `POST https://scc.cufe.edu.cn/module/getonlinesite`
- 详情页: `POST https://scc.cufe.edu.cn/module/ajax_show`

**请求参数**:
```python
list_payload = {
    "pageNo": page,
    "pageSize": 10,
    "positionType": 1  # 实习类型
}

detail_payload = {
    "recruitmentId": recruitment_id
}
```

**响应结构**:
```python
{
    "state": 1,
    "object": {
        "list": [
            {
                "url": "/module/getonlinesite?recruitmentId=xxx"
            }
        ]
    }
}

# 详情响应
{
    "object": {
        "recruitmentinfo": {
            "title": "岗位标题",
            "workPlace": "工作地点",
            "salary": "薪资"
        },
        "corporationinfo": {
            "name": "公司名称"
        }
    }
}
```

**特殊处理**:
```python
# 从 URL 解析 recruitmentId
url = item.get("url", "")
match = re.search(r'recruitmentId=(\d+)', url)
recruitment_id = match.group(1) if match else None

# 嵌套字段提取
def get_nested_value(data, path, default=""):
    """从嵌套字典中获取值"""
    keys = path.split('.')
    for key in keys:
        if isinstance(data, dict):
            data = data.get(key, default)
        else:
            return default
    return data if data is not None else default

company = get_nested_value(detail_data, "corporationinfo.name")
```

**字段映射**:
| 输出字段 | 嵌套路径 |
|---------|---------|
| title | recruitmentinfo.title |
| company | corporationinfo.name |
| location | recruitmentinfo.workPlace |
| salary | recruitmentinfo.salary |
| education | recruitmentinfo.education |

---

### 4. crawl_swufe() - 西南财经大学

**方法签名**:
```python
def crawl_swufe(max_items: int = 0) -> Generator[Dict, None, None]:
```

**爬取类型**: GET API

**API端点**:
- 列表页: `GET https://job3.swufe.edu.cn/job/api/jobfair/jobfairlist?page={page}`
- 详情页: `GET https://job3.swufe.edu.cn/job/api/jobfair/jobfairinfo/{id}`

**请求参数**:
```python
params = {
    "page": page
}
```

**响应结构**:
```python
{
    "list": [
        {
            "id": "xxx",
            "title": "岗位标题",
            "company": "公司名称",
            "location": "地点",
            "content": "描述"
        }
    ]
}
```

**字段映射**:
| 输出字段 | API字段 |
|---------|---------|
| title | title |
| company | company |
| location | location |
| description | content |

---

## 辅助工具方法

### 1. fetch_with_retry() - HTTP请求重试

**方法签名**:
```python
def fetch_with_retry(
    url: str,
    method: str = "GET",
    **kwargs
) -> Optional[requests.Response]:
```

**参数**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| url | str | - | 请求URL |
| method | str | "GET" | HTTP方法 |
| **kwargs | dict | - | 传递给 requests 的参数 |

**实现逻辑**:
```python
def fetch_with_retry(url, method="GET", **kwargs):
    headers = {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "application/json",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Referer": "https://career.sufe.edu.cn/"
    }
    
    for attempt in range(MAX_RETRIES):  # 默认5次
        try:
            if method == "GET":
                response = requests.get(url, headers=headers, timeout=30, **kwargs)
            else:
                response = requests.post(url, headers=headers, timeout=30, **kwargs)
            
            if response.status_code == 200:
                return response
            
            if response.status_code == 403:
                logger.warning(f"触发反爬，等待重试...")
            
            # 指数退避 + 随机延迟
            delay = 2 ** attempt + random.uniform(1.0, 3.0)
            time.sleep(delay)
            
        except RequestException as e:
            logger.warning(f"请求失败 (尝试 {attempt+1}/{MAX_RETRIES}): {e}")
            time.sleep(2 ** attempt)
    
    return None
```

**特性**:
- 随机 User-Agent（6种预设）
- 指数退避重试（2^attempt + 随机1-3秒）
- 30秒超时
- 403反爬检测

---

### 2. is_within_date_range() - 时间筛选

**方法签名**:
```python
def is_within_date_range(
    date_str: str,
    months: int = 2
) -> bool:
```

**参数**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| date_str | str | - | 日期字符串 |
| months | int | 2 | 筛选月数 |

**支持格式**:
```python
formats = [
    "%Y-%m-%d %H:%M:%S",  # 2024-01-15 10:30:00
    "%Y-%m-%d",           # 2024-01-15
    "%Y/%m/%d %H:%M:%S",  # 2024/01/15 10:30:00
    "%Y/%m/%d",           # 2024/01/15
    "%Y年%m月%d日",       # 2024年01月15日
]
```

**逻辑**:
```python
def is_within_date_range(date_str, months=2):
    if not date_str:
        return True  # 无日期默认通过
    
    for fmt in formats:
        try:
            date = datetime.strptime(date_str.strip(), fmt)
            cutoff = datetime.now() - timedelta(days=months * 30)
            return date >= cutoff
        except ValueError:
            continue
    
    return True  # 解析失败默认通过
```

---

### 3. url_exists() - URL去重检查

**方法签名**:
```python
def url_exists(url: str) -> bool:
```

**实现**:
```python
_url_cache = set()  # 全局内存缓存

def preload_existing_urls():
    """启动时预加载所有已存在URL"""
    global _url_cache
    rows = db.execute("SELECT source_url FROM jobs").fetchall()
    _url_cache = {r[0] for r in rows}
    logger.debug(f"预加载 {len(_url_cache)} 条已存在URL")

def url_exists(url: str) -> bool:
    return url in _url_cache
```

**优势**: O(1) 时间复杂度，避免每次查询数据库

---

## 数据入库方法

### 1. insert_job() - 单条入库

**方法签名**:
```python
def insert_job(
    job: Dict[str, Any],
    date_filter_months: int = 2
) -> bool:
```

**入库流程**:
```
1. 时间筛选检查
   └── 日期超过 months 个月 → 跳过

2. URL去重检查
   └── url_exists(source_url) → 跳过

3. 内容去重检查 (title + company + source)
   ├── 查询已存在记录
   ├── 比较 description 长度
   └── 新数据更短 → 跳过

4. 插入/更新数据库
   └── INSERT INTO jobs (...) VALUES (...)

5. 更新内存缓存
   └── _url_cache.add(source_url)
```

**SQL**:
```sql
INSERT INTO jobs 
(title, company, location, salary, education, description, 
 publish_date, source, university, source_url, apply_url, job_type)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(source_url) DO UPDATE SET
    title = excluded.title,
    company = excluded.company,
    updated_at = CURRENT_TIMESTAMP
```

---

### 2. insert_jobs_batch() - 批量入库

**方法签名**:
```python
def insert_jobs_batch(
    jobs: List[Dict[str, Any]],
    date_filter_months: int = 2
) -> int:
```

**实现**:
```python
def insert_jobs_batch(jobs, date_filter_months=2):
    inserted = 0
    for job in jobs:
        if insert_job(job, date_filter_months):
            inserted += 1
    return inserted
```

**使用场景**: 批量处理时减少数据库连接开销

---

## 状态管理方法

### 1. set_crawler_status() - 更新状态

**方法签名**:
```python
def set_crawler_status(
    status: str,                    # 状态: running/completed/error/idle
    current_source: str = None,     # 当前数据源
    total_sources: int = 0,         # 总数据源数
    completed_sources: int = 0,     # 已完成数
    total_jobs: int = 0             # 总数据条数
) -> None:
```

**实现**:
```python
def set_crawler_status(status, current_source=None, 
                        total_sources=0, completed_sources=0, total_jobs=0):
    import os
    try:
        now = datetime.now().isoformat()
        db.execute("""
            UPDATE crawler_status SET
                is_running = ?,
                status = ?,
                current_source = ?,
                total_sources = ?,
                completed_sources = ?,
                total_jobs = ?,
                last_update = ?,
                pid = ?
            WHERE id = 1
        """, (
            1 if status == 'running' else 0,
            status,
            current_source,
            total_sources,
            completed_sources,
            total_jobs,
            now,
            os.getpid() if status == 'running' else None
        ))
        db.commit()
    except Exception as e:
        logger.warning(f"更新爬虫状态失败: {e}")
```

**状态流转**:
```
idle → running → completed
            ↘ error
```

---

### 2. get_crawler_status() - 获取状态

**方法签名**:
```python
def get_crawler_status() -> dict:
```

**返回结构**:
```python
{
    "is_running": 0,           # 是否运行中
    "status": "completed",     # 状态字符串
    "current_source": "sufe",  # 当前数据源
    "total_sources": 4,        # 总数据源数
    "completed_sources": 4,    # 已完成数
    "total_jobs": 10,          # 总数据条数
    "start_time": "2026-05-20T15:00:00",
    "last_update": "2026-05-20T15:05:00",
    "pid": 12345               # 进程ID
}
```

---

## 命令行参数

```python
parser.add_argument('--sources', nargs='+', 
                    choices=['sufe', 'zuel', 'cufe', 'dufe', 'swufe'],
                    help='指定要爬取的数据源')
parser.add_argument('--max-items', type=int, default=0,
                    help='每个数据源最大爬取数量')
parser.add_argument('--log-level', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
                    default='INFO', help='日志级别')
parser.add_argument('--date-filter', type=int, default=2,
                    help='只入库最近N个月的数据')
parser.add_argument('--schedule', 
                    help='定时运行 (daily/hourly 或 cron表达式)')
```

---

## 使用示例

```bash
# 爬取所有数据源
python lite_crawler.py

# 爬取指定数据源
python lite_crawler.py --sources sufe zuel

# 限制数量
python lite_crawler.py --sources sufe --max-items 100

# 调整时间范围
python lite_crawler.py --date-filter 3

# 定时运行（每天凌晨2点）
python lite_crawler.py --schedule "0 2 * * *"
```
