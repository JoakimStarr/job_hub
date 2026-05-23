# lite_crawler.py 爬虫详细分析

## 一、概述

`lite_crawler.py` 是一个**轻量化单线程爬虫**，专为低内存服务器（< 2GB 内存）设计。它只支持 HTTP 类型数据源（无需浏览器渲染），通过单线程同步方式逐条爬取和写入，内存占用极小（< 50MB）。

### 核心特性

| 特性 | 说明 |
|------|------|
| 执行模式 | 单线程，无并发 |
| 支持数据源 | sufe, zuel, cufe, dufe, swufe（5个） |
| 数据写入 | 逐条写入 SQLite，批量提交 |
| 失败重试 | 5次，指数退避 |
| 去重策略 | 内存 URL 集合 + 数据库 UNIQUE 约束双重去重 |
| 增量爬取 | 基于 URL 去重判断，全页已存在则停止 |
| 定时爬取 | 支持 hourly/daily/weekly 和 cron 表达式 |
| 时间筛选 | 默认只入库最近 2 个月的数据 |

---

## 二、技术路线

### 2.1 技术栈

```
语言:        Python 3
HTTP库:      requests（同步）
HTML解析:    BeautifulSoup4 + lxml（仅 SWUFE 使用）
数据库:      SQLite3（WAL 模式）
日志:        logging 标准库（彩色终端 + 文件双输出）
配置:        spider_configs.py 统一配置
```

### 2.2 架构设计

```
┌─────────────────────────────────────────────────┐
│                   main() 入口                    │
│  argparse 解析命令行参数 → 初始化数据库 → 调度   │
└──────────────────────┬──────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
   crawl_source()  run_scheduled()  --list-sources
   单次爬取入口    定时爬取入口      列出数据源
          │
    ┌─────┼──────┬──────────┬──────────┐
    ▼     ▼      ▼          ▼          ▼
  sufe  zuel   cufe      dufe      swufe
  (API) (API)  (API)     (API)    (HTML)
    │     │      │          │          │
    └─────┴──────┴──────────┴──────┬───┘
                                   ▼
                           insert_job()
                           去重 + 时间筛选 + 写入DB
                                   │
                           trigger_job_alerts()
                           触发职位提醒（调用Web API）
```

### 2.3 数据源分类

| 数据源 | 大学 | 爬取类型 | API风格 | 列表请求方式 |
|--------|------|----------|---------|-------------|
| sufe | 上海财经大学 | API | JSON POST | POST 表单分页 |
| zuel | 中南财经政法大学 | API | JSON GET | GET 参数分页 |
| cufe | 中央财经大学 | API | JSON POST | POST 表单分页 |
| dufe | 东北财经大学 | API | JSON POST | POST 表单分页（同 cufe） |
| swufe | 西南财经大学 | HTML | HTML 页面 | GET URL 分页 |

---

## 三、核心工作流程

### 3.1 主流程（main 函数）

```
1. 解析命令行参数
2. 设置日志级别
3. 初始化数据库（建表 + 预加载 URL 缓存）
4. 如果 --reset-incremental：清除增量状态 + 启用覆盖模式
5. 确定要爬取的数据源列表
6. 如果 --schedule：进入定时爬取模式
7. 否则：单次爬取
   a. 记录会话开始
   b. 更新爬虫状态为 running
   c. 逐个爬取每个数据源
   d. 更新爬虫状态为 completed
   e. 刷新待提交数据
   f. 触发职位提醒（如有新增数据）
   g. 关闭数据库连接
```

### 3.2 单数据源爬取流程（crawl_source）

```
1. 根据数据源标识选择对应的爬取函数
2. 调用爬取函数获取 Iterator[Dict]
3. 逐条调用 insert_job() 写入数据库
   - URL 去重检查
   - 时间范围筛选
   - 插入或覆盖更新
4. 返回成功插入数量
```

---

## 四、各数据源详细爬取逻辑

### 4.1 SUFE（上海财经大学）

**API 特征**: POST 表单提交，JSON 响应

**爬取流程**:

```
1. 构造列表请求
   URL: https://career.sufe.edu.cn/career//zpxx/search/zpxx
   Method: POST
   Data: pageNo={page}&pageSize=10

2. 解析列表响应
   响应格式: {"code": 200, "data": {"list": [...]}}
   每项包含: zpxxid（招聘信息ID）

3. URL 去重检查（全页级别）
   - 构造当前页所有详情页 URL:
     https://career.sufe.edu.cn/career/zpxx/view/zpxx/{zpxxid}
   - 如果当前页所有 URL 都已存在 → 停止爬取

4. 逐条获取详情
   - 跳过已存在的 URL
   - 请求详情 API:
     URL: https://career.sufe.edu.cn/career//zpxx/data/zpxx/{zpxxid}
     Method: POST
   - 解析详情 JSON:
     响应格式: {"data": {...}}

5. 字段映射（从详情 JSON 提取）
   - title:        zwxx.zwmc || detail.zpzt
   - company:      detail.dwmc
   - location:     zwxx.gzszxmc || zwxx.gzszssmc || detail.szxmc
   - salary:       zwxx.yxmc || detail.yxmc（默认"面议"）
   - education:    zwxx.xlyqmc || detail.xlyqmc
   - description:  zwxx.zwms || detail.dwjs（截断500字）
   - requirements: zwxx.zyyqmc
   - industry:     zwxx.hyyjmc || detail.hyyjmc
   - job_type:     zwxx.gzlxmc || detail.gzlxmc（默认"全职"）
   - publish_date: detail.fbrq
   - deadline:     detail.zpjzrq
   - recruit_count:zwxx.xqrs（拼入描述头部）

6. 特殊处理
   - 一个详情可能包含多个职位（zwxxList）
   - 招聘人数拼入描述: "【招聘人数】N人\n\n{description}"
```

**终止条件**:
- 达到 max_items 限制
- 列表页无数据
- API 返回 code != 200
- 当前页所有 URL 已存在
- 超过 MAX_PAGES（20页）

---

### 4.2 ZUEL（中南财经政法大学）

**API 特征**: GET 请求，JSON 响应

**爬取流程**:

```
1. 构造列表请求
   URL: https://jyzx.zuel.edu.cn/api/publicly/recruit/list?type=1&page={page}&limit=10
   Method: GET

2. 解析列表响应
   响应格式: {"code": 0, "data": [...]}
   每项包含: id（招聘ID）

3. URL 去重检查（全页级别）
   - 构造当前页所有详情页 URL:
     https://jyzx.zuel.edu.cn/home/career/internship?id={id}
   - 如果当前页所有 URL 都已存在 → 停止爬取

4. 逐条获取详情
   - 跳过已存在的 URL
   - 请求详情 API:
     URL: https://jyzx.zuel.edu.cn/api/publicly/recruit/get?id={id}
     Method: GET
   - 解析详情 JSON:
     响应格式: {"data": {...}}

5. 字段映射
   - title:        "{jobName} | {companyName}"（拼接格式）
   - company:      companyName || title
   - location:     area || workCity
   - salary:       salary（默认"面议"）
   - education:    education
   - requirements: zpdxjtj
   - description:  "【岗位职责】{zpgw}\n\n【薪酬福利】{xcfl}"（截断500字）
   - contact:      拼接 recruitContact + recruitMobile + lxfs
   - publish_date: createTime（标准化日期格式）

6. 特殊处理
   - title 格式为 "岗位名 | 公司名"
   - 联系方式分三部分拼接: 联系人/电话/邮箱
   - 描述分为岗位职责和薪酬福利两部分
```

**终止条件**: 同 SUFE

---

### 4.3 CUFE/DUFE（中央财经大学/东北财经大学）

**API 特征**: POST 表单提交，JSON 响应（两校共用同一平台系统）

**爬取流程**:

```
1. 构造列表请求
   CUFE: http://scc.cufe.edu.cn/f/recruitmentinfo/ajax_frontRecruitinfo
   DUFE: https://career.dufe.edu.cn/f/recruitmentinfo/ajax_frontRecruitinfo
   Method: POST
   Data: pageNo={page}&positionType=1

2. 解析列表响应
   响应格式: {"state": 1, "object": {"list": [...]}}
   每项包含: url（详情页相对路径，含 recruitmentId 参数）

3. URL 去重检查（全页级别）
   - 构造当前页所有详情页 URL: urljoin(base_url, item.url)
   - 如果当前页所有 URL 都已存在 → 停止爬取

4. 逐条获取详情
   - 从 url 路径中解析 recruitmentId 参数
   - 请求详情 API:
     URL: {base_url}/f/recruitmentinfo/ajax_show
     Method: POST
     Data: recruitmentId={id}
   - 解析详情 JSON:
     响应格式: {"state": 1, "object": {"recruitmentinfo": {...}, "corporationinfo": {...}}}

5. 字段映射
   - title:        "{recruitmentinfo.title} | {corporationinfo.name}"
   - company:      corporationinfo.name
   - location:     recruitmentPositionList[0].cityName
   - salary:       从 content 中正则提取（见下方薪资提取逻辑）
   - education:    recruitmentPositionList[0].studentType
   - requirements: recruitmentPositionList[0].majorName
   - description:  positionDescription || shortContent || content（去HTML标签）
   - industry:     corporationinfo.corporationNatureValue
   - tags:         labelValue（逗号分隔）
   - deadline:     endTime
   - publish_date: startTime（截取前10位）
   - contact:      "邮箱: {resumeReceiveEmail}"

6. 薪资提取逻辑（正则匹配，从 content 字段提取）
   优先级从高到低:
   a. \d+\s*[Kk千]\s*[-~～]\s*\d+\s*[Kk千]     → 如 "8K-15K"
   b. \d+\s*万\s*[-~～]\s*\d+\s*万               → 如 "10万-20万"
   c. \d{3,4}\s*[-~～]\s*\d{3,4}\s*元?\s*/\s*(月|年|天) → 如 "8000-12000/月"
   d. \d+\s*[-~～]\s*\d+\s*元?\s*/\s*(月|年|天)  → 如 "200-500/天"
   匹配不到则默认"面议"

7. 描述回退逻辑
   - 优先使用 positionDescription
   - 如果为空或包含占位文本（"详见招聘简章"/"详见公告"/"详见附件"/"请查看详情"）
   - 则回退到 shortContent 或 content
   - content 中的 HTML 标签会被清除

8. 特殊处理
   - cufe 和 dufe 共用 crawl_platform() 函数
   - dufe 的 field_mapping 标记为 "same_as_cufe"
```

**终止条件**: 同 SUFE

---

### 4.4 SWUFE（西南财经大学）

**API 特征**: HTML 页面爬取，需要 BeautifulSoup 解析

**爬取流程**:

```
1. 构造列表请求
   URL: https://job3.swufe.edu.cn/jobs/jobs_list/page/{page}.htm
   Method: GET

2. 解析列表 HTML
   - 查找列表容器: div.listb.J_allListBox
   - 查找岗位项: div.td-j-name
   - 每项包含: a 标签（href 指向详情页）

3. URL 去重检查（全页级别）
   - 构造当前页所有详情页 URL: urljoin(base_url, a.href)
   - 如果当前页所有 URL 都已存在 → 停止爬取

4. 日期过期检查（SWUFE 特有）
   - 对每个列表项调用 parse_swufe_list_date()
   - 解析发布时间:
     a. 查找父级 div.yli → div.detail → span → div.txt2
     b. 支持 "X小时前"/"X天前"/"X分钟前" 格式 → 转换为日期
     c. 支持 "YYYY-MM-DD" 格式
   - 如果发布时间早于 cutoff_date（默认2个月前）→ 停止爬取

5. 逐条获取详情
   - 跳过已存在的 URL
   - 请求详情页 HTML
   - 调用 parse_swufe_detail() 解析（shared_parsers.py 共用函数）

6. 详情页解析逻辑（parse_swufe_detail）
   a. 检查无效页面: div.no_page_group → 返回 None
   b. 查找主容器（优先级）: new-se-main > main > jobsshow > soup
   c. 提取岗位名称: new-se-main → div.jobname → div.j-n-txt
   d. 提取发布时间: new-se-main → div.job_date → span.cutom_font
   e. 提取薪资/学历/工作地: div.job_msg → span
      - "薪酬："前缀 → salary
      - "学历："前缀 → education
      - "工作地："前缀 → location
   f. 提取公司信息: new-se-main → div.job-com
      - div.com-name → company（清除 HTML 注释）
      - div.com-class → industry
   g. 提取描述/要求: div.describe
      - 标题含"职位描述" → description
      - 标题含"投递"/"要求" → requirements
   h. 提取联系方式: 从整个页面文本正则匹配
      - 邮箱: [\w.-]+@[\w.-]+\.\w+
      - 手机: 1[3-9]\d{9}
   i. 提取标签: div.lab div.li → 逗号分隔
   j. title 格式: "岗位名 | 公司名"

7. 特殊处理
   - 每条详情爬取后 sleep(0.5s)（DETAIL_DELAY）
   - 使用 lxml 解析器（比 html.parser 更快）
   - 解析完成后手动 del soup 释放内存
```

**终止条件**:
- 同 SUFE
- 额外: 遇到过期数据（发布时间超过 date_filter_months）

---

## 五、关键机制详解

### 5.1 去重机制（双重保障）

```
第一层: 内存 URL 缓存（_url_cache: set）
  ├── 启动时从 DB 预加载所有 source_url
  ├── O(1) 查询速度
  ├── 新插入时实时更新 (mark_url_exists)
  └── 上限 100,000 条（超过警告）

第二层: 数据库 UNIQUE 约束（source_url 字段）
  ├── IntegrityError 捕获 → 视为重复
  └── 最终保底，防止并发场景下的重复插入
```

### 5.2 增量爬取策略

**URL 去重驱动**（非页码记录驱动）:

```
对每个列表页:
  1. 构造当前页所有详情 URL
  2. 检查是否全部已存在
  3. 全部存在 → 停止爬取（认为后续页也已爬过）
  4. 存在新 URL → 逐条爬取详情
  5. 单条 URL 已存在 → 跳过该条
```

**增量状态保存**（crawl_state 表）:
- 记录每个数据源的最后爬取页码、时间、数量
- 但实际爬取逻辑并未使用页码恢复（sufe/zuel/cufe/dufe 都是基于 URL 去重）
- save_crawl_state 在 finally 块中调用，确保异常时也能保存

### 5.3 重试机制

```
fetch_with_retry(url, method, **kwargs):
  最大重试次数: 5
  退避策略: 指数退避 + 随机抖动
    delay = 2^attempt + random(1.0, 3.0)
    attempt=0: 1~4s
    attempt=1: 3~5s
    attempt=2: 5~7s
    attempt=3: 9~11s
    attempt=4: 17~19s

  特殊处理:
  - 403 状态码: 视为反爬拦截，等待后重试
  - 请求异常: 捕获所有 RequestException
  - 每次请求使用随机 User-Agent
  - 超时: 30秒
```

### 5.4 批量提交机制

```
_batch_commit():
  累积计数器 _pending_commits
  每 BATCH_COMMIT_SIZE(50) 条提交一次
  减少 SQLite 写入开销

  爬取结束后:
  _flush_pending_commits() → 提交剩余未提交的记录
```

### 5.5 数据库设计

**SQLite 优化配置**:
```sql
PRAGMA journal_mode=WAL;      -- 写前日志，允许并发读
PRAGMA synchronous=NORMAL;    -- 平衡性能和安全
PRAGMA cache_size=-10000;     -- 10MB 页缓存
```

**表结构**:
| 表名 | 用途 |
|------|------|
| jobs | 岗位数据主表（source_url UNIQUE） |
| crawl_logs | 爬取日志记录 |
| crawler_status | 爬虫全局运行状态（单行表） |
| crawl_state | 增量爬取状态（per-source） |

**索引**:
- idx_jobs_source (source)
- idx_jobs_source_url (source_url)
- idx_jobs_company (company)
- idx_jobs_publish_date (publish_date)

### 5.6 时间筛选机制

```
is_within_date_range(publish_date, months=2):
  1. 无发布日期 → 默认通过
  2. 解析日期失败 → 默认通过
  3. 发布日期 < (当前日期 - months*30天) → 拒绝（视为过期）

  日期解析支持格式:
  - 13位时间戳 → YYYY-MM-DD
  - 10位时间戳 → YYYY-MM-DD
  - ISO 8601: YYYY-MM-DDTHH:MM:SS
  - 常规格式: YYYY-MM-DD HH:MM:SS, YYYY/MM/DD 等
```

### 5.7 反爬措施

```
1. 随机 User-Agent
   - 6 个常见浏览器 UA 随机选择
   - 每次请求独立随机

2. 请求间隔
   - SWUFE: 详情页间隔 0.5s (DETAIL_DELAY)
   - 重试时: 指数退避 + 随机抖动

3. 请求头伪装
   - Accept: application/json, text/html, */*
   - Accept-Language: zh-CN,zh;q=0.9,en;q=0.8
   - Cache-Control: no-cache
```

### 5.8 覆盖模式（OVERWRITE_MODE）

```
默认关闭，通过 --reset-incremental 启用:
  1. 清除 crawl_state 表所有记录
  2. 设置 OVERWRITE_MODE = True
  3. 跳过全页 URL 去重检查
  4. 跳过单条 URL 去重检查
  5. 已存在的 URL → UPDATE 而非 INSERT
  6. 不存在的 URL → INSERT
```

### 5.9 职位提醒触发

```
爬取完成后，如果 total_count > 0:
  POST http://localhost:3000/api/alerts/trigger
  Body: {"since_minutes": 30}

  检查最近 30 分钟内新增的岗位
  匹配用户订阅条件 → 发送邮件提醒
```

---

## 六、日志系统

### 6.1 双通道输出

| 通道 | 级别 | 格式 | 目标 |
|------|------|------|------|
| 控制台 | INFO+ | 彩色 `HH:MM:SS \| LEVEL \| message` | stdout |
| 文件 | DEBUG+ | `YYYY-MM-DD HH:MM:SS \| LEVEL \| name \| func:line \| message` | logs/crawler_YYYYMMDD.log |

### 6.2 统计信息

CrawlLogger 单例维护以下统计:
- 总岗位数、成功插入数、重复跳过数、错误数、重试数
- 每个数据源独立统计: fetched/success/duplicate/error
- 会话开始/结束时间、总耗时

---

## 七、命令行参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--sources` | 指定数据源 | 全部 |
| `--list-sources` | 列出所有数据源 | - |
| `--max-items` | 每个源最大爬取数量 | 0（不限） |
| `--schedule` | 定时爬取 | - |
| `--log-level` | 日志级别 | INFO |
| `--date-filter` | 时间筛选月数 | 2 |
| `--reset-incremental` | 清除增量状态+覆盖模式 | False |

---

## 八、数据流完整路径

```
用户命令
  │
  ▼
main() → argparse 解析
  │
  ▼
init_database() → 建表 + preload_existing_urls()
  │
  ▼
crawl_source(source, max_items)
  │
  ├── crawl_sufe/zuel/platform/swufe(source_config, max_items)
  │     │
  │     ├── while page <= MAX_PAGES:
  │     │     │
  │     │     ▼
  │     │   fetch_with_retry(list_url)  ← 随机UA + 重试
  │     │     │
  │     │     ▼
  │     │   解析列表 JSON/HTML → items[]
  │     │     │
  │     │     ▼
  │     │   全页 URL 去重检查 → 全部存在则 break
  │     │     │
  │     │     ▼
  │     │   for item in items:
  │     │     │
  │     │     ▼
  │     │   单条 URL 去重 → 已存在则 continue
  │     │     │
  │     │     ▼
  │     │   fetch_with_retry(detail_url)  ← 随机UA + 重试
  │     │     │
  │     │     ▼
  │     │   解析详情 JSON/HTML → job Dict
  │     │     │
  │     │     ▼
  │     │   yield job  ← 生成器逐条返回
  │     │
  │     └── save_crawl_state()
  │
  ▼
insert_job(job, date_filter_months)
  │
  ├── source_url 为空 → return False
  ├── is_within_date_range() → 过期 → return False
  ├── url_exists() → 已存在 → return False
  │
  ▼
INSERT INTO jobs / UPDATE jobs
  │
  ├── mark_url_exists() → 更新内存缓存
  ├── _batch_commit() → 累积50条提交
  └── crawl_logger.log_job_success()

最终:
  _flush_pending_commits()
  trigger_job_alerts()  ← 如有新增
  db.close()
```

---

## 九、配置来源

爬虫配置统一由 [spider_configs.py](file:///home/joakim/Project/job_hub/src/spiders/spider_configs.py) 管理，通过 `get_lite_http_sources()` 函数提取 HTTP 类型数据源的简化配置，返回格式:

```python
{
    "source_key": {
        "name": "大学名称",
        "base_url": "基础URL",
        "list_url": "列表API路径",
        "detail_url": "详情API路径",
        "field_mapping": {字段映射},
    }
}
```

SWUFE 的 HTML 解析器由 [shared_parsers.py](file:///home/joakim/Project/job_hub/src/spiders/shared_parsers.py) 提供，确保主爬虫和 lite_crawler 的字段匹配规则一致。
