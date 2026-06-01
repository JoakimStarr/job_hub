# 新增爬虫数据源计划（修订版 v2）

## 一、调研结论汇总

### 1.1 高校类候选源 — 发现可行源 ✅

| 高校                 | 平台                     | 状态         | 说明                 |
| ------------------ | ---------------------- | ---------- | ------------------ |
| **浙江工商大学 (ZJGSU)** | 自有系统 jyw\.zjgsu.edu.cn | ✅ **确认可行** | POST API，无需认证，字段完整 |
| 天津财经大学 (TJUF)      | jysd.com               | 不用         | WAF 拦截             |
| 浙江工商大学 (ZJSU-old)  | jysd.com               | 有了         | WAF 拦截             |
| 山东财经大学 (SDUFE)     | jysd.com               | 不用         | WAF 拦截             |
| 安徽财经大学 (AUFE)      | jysd.com               | 不用         | WAF 拦截             |
| 广东财经大学 (GDUFE)     | jysd.com               | ❌          | WAF 拦截             |
| 山西财经大学 (SXUFE)     | jysd.com               | ❌          | WAF 拦截             |
| 河北经贸大学 (HEBUE)     | jysd.com               | ❌          | WAF 拦截             |
| 重庆工商大学 (CTBU)      | jysd.com               | ❌          | WAF 拦截             |
| 南京财经大学 (NUFE)      | 91job.org.cn           | ❌          | 反爬拦截               |
| 首都经济贸易大学 (CUEB)    | 自有系统                   | ❌          | 需要 browser\_js     |

> **重要发现**：浙江工商大学（ZJGSU）使用的是自己的就业系统 `jyw.zjgsu.edu.cn`，**不是 jysd.com 平台**，API 可以直接访问！

### 1.2 浙江工商大学 (ZJGSU) API 详情 ✅

**基础信息**：

* 学校：浙江工商大学

* 就业网：<https://jyw.zjgsu.edu.cn>

* 系统类型：api\_post（与 SUFE 类似）

* 位置：杭州

**列表接口**：

```
POST https://jyw.zjgsu.edu.cn/career/zpxx/search/{xxlb}/{pageNum}/{pageSize}

参数：
  xxlb: 信息类别
    - "zpxx" = 招聘信息（全职）
    - "sxzpxx" = 实习招聘信息
  pageNum: 页码（从1开始）
  pageSize: 每页数量（默认10）

请求头：
  Content-Type: application/x-www-form-urlencoded
  X-Requested-With: XMLHttpRequest
  Referer: https://jyw.zjgsu.edu.cn/career/zpxx/{xxlb}
```

**响应格式**：

```json
{
  "code": 200,
  "data": {
    "total": "15091",
    "list": [
      {
        "zpxxid": "199562890016067584",
        "zpzt": "杭州美屋美居数智科技有限公司深化设计师助理",
        "dwmc": "杭州美屋美居数智科技有限公司",
        "xxdz": "浙江省杭州市萧山区...",
        "fbrq": "2026-05-27",
        "zpjzrq": "2027-09-01",
        "szxmc": "浙江省杭州市萧山区",
        "szsmc": "杭州市",
        "szssmc": "浙江省",
        "xzyjmc": "民营企业",
        "hyyjmc": "建筑业",
        "rsgmmc": "50-99人",
        "xqrs": 16,
        "xqrsmc": "11-20人",
        "jltdyx": "chaoansel@163.com",
        "djs": 13,
        "zpxxwz": null,
        "xxlb": "zpxx"
      }
    ],
    "pageNum": 1,
    "pageSize": 10,
    "pages": 1510
  },
  "message": "操作成功"
}
```

**字段映射**：

| 目标字段           | API 字段        | 说明                                |
| -------------- | ------------- | --------------------------------- |
| title          | zpzt          | 招聘主题/岗位名称                         |
| company        | dwmc          | 单位名称                              |
| location       | szxmc / szsmc | 所在县/市                             |
| industry       | hyyjmc        | 行业                                |
| company\_type  | xzyjmc        | 单位性质                              |
| company\_size  | rsgmmc        | 单位规模                              |
| publish\_date  | fbrq          | 发布日期                              |
| deadline       | zpjzrq        | 招聘截止日期                            |
| recruit\_count | xqrs          | 招聘人数                              |
| contact\_email | jltdyx        | 简历投递邮箱                            |
| views          | djs           | 点击量                               |
| source\_url    | 构造URL         | /career/zpxx/view/{xxlb}/{zpxxid} |

**特点**：

* ✅ POST 请求，无需 Cookie/Auth

* ✅ 返回干净 JSON，字段完整

* ✅ 有招聘信息(zpxx)和实习信息(sxzpxx)两个板块

* ✅ 分页参数简单

* ✅ 数据量大（招聘信息15000+条，实习3000+条）

### 1.3 互联网大厂候选源调研

| 公司                   | 状态         | 说明                         |
| -------------------- | ---------- | -------------------------- |
| **腾讯 (Tencent)**     | ✅ **确认可行** | 有公开 REST API，GET 请求，无需认证   |
| **字节跳动 (ByteDance)** | ⚠️ 需要调研    | 有 API，但需要 CSRF token 验证    |
| **百度 (Baidu)**       | ⚠️ 需要调研    | 有 API，有反调试，需验证是否可纯 HTTP 访问 |
| 美团 (Meituan)         | ❓ 待确认      | React SPA                  |
| 华为 (Huawei)          | ❌ 不可行      | 无公开 API                    |
| 京东 (JD)              | ❌ 不可行      | 需要 API Key                 |
| 小米 (Xiaomi)          | ❓ 待确认      | 需调研                        |
| 快手 (Kuaishou)        | ❓ 待确认      | 需调研                        |

### 1.4 腾讯招聘 API 详情 ✅

**列表接口**：

```
GET https://careers.tencent.com/tencentcareer/api/post/Query
参数：
  pageIndex: 页码 (从1开始)
  pageSize: 每页数量 (默认10)
  language: zh-cn
  area: cn
  timestamp: 当前时间戳(毫秒)
```

**响应格式**：

```json
{
  "Code": 200,
  "Data": {
    "Count": N,
    "Posts": [
      {
        "RecruitPostName": "岗位名称",
        "LocationName": "工作地点",
        "BGName": "事业群",
        "CategoryName": "类别",
        "Responsibility": "岗位职责",
        "LastUpdateTime": "2025-01-01T00:00:00+08:00",
        "RequireWorkYearsName": "工作经验要求",
        "PostURL": "https://careers.tencent.com/jobdesc.html?postId=xxx",
        "ProductName": "产品名称"
      }
    ]
  }
}
```

**特点**：

* ✅ GET 请求，无需 Cookie/Auth

* ✅ 需要 User-Agent 和 Referer 头

* ✅ 返回干净 JSON，字段完整

* ✅ 分页参数简单

***

## 二、执行计划

### 阶段一：编码实现（按优先级）

#### Step 1: 浙江工商大学 (ZJGSU) — P0 ✅

**在** **`spider_configs.py`** **中添加**：

```python
"zjgsu": {
    "name": "zjgsu_jobs",
    "university": "浙江工商大学",
    "base_url": "https://jyw.zjgsu.edu.cn",
    "location": "杭州",
    "spider_type": "api_post",
    "page_size": 10,
    "max_pages_per_section": 50,
    "sections": [
        {
            "section": "zpxx",
            "label": "招聘信息",
            "list_url": "/career/zpxx/search/zpxx",
            "view_url": "/career/zpxx/view/zpxx/{item_id}",
            "referer": "/career/zpxx/zpxx",
            "job_type": "全职",
        },
        {
            "section": "sxzpxx",
            "label": "实习信息",
            "list_url": "/career/zpxx/search/sxzpxx",
            "view_url": "/career/zpxx/view/sxzpxx/{item_id}",
            "referer": "/career/zpxx/sxzpxx",
            "job_type": "实习",
        },
    ],
    "headers": {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
    },
    "field_mapping": {
        "title": "zpzt",
        "company": "dwmc",
        "location": ["szxmc", "szsmc"],
        "industry": "hyyjmc",
        "company_type": "xzyjmc",
        "company_size": "rsgmmc",
        "publish_date": "fbrq",
        "deadline": "zpjzrq",
        "recruit_count": "xqrs",
        "contact_email": "jltdyx",
        "views": "djs",
    },
}
```

**在** **`lite_crawler.py`** **中**：

* 参照 `crawl_sufe()` 的模式（api\_post 类型，多板块）

* 编写 `crawl_zjgsu()` 函数

* 在 `crawl_source()` 中添加 `elif source == "zjgsu":` 分支

#### Step 2: 腾讯 (Tencent) — P1 ✅

**在** **`spider_configs.py`** **中添加**：

```python
"tencent": {
    "name": "tencent_jobs",
    "university": "腾讯",
    "base_url": "https://careers.tencent.com",
    "location": "全国",
    "spider_type": "api_get",
    "list_api": "https://careers.tencent.com/tencentcareer/api/post/Query",
    "page_size": 10,
    "max_pages": 50,
    "headers": {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Referer": "https://careers.tencent.com/search.html",
    },
    "field_mapping": {
        "title": "RecruitPostName",
        "company": "BGName",
        "location": "LocationName",
        "category": "CategoryName",
        "description": "Responsibility",
        "publish_date": "LastUpdateTime",
        "experience": "RequireWorkYearsName",
        "apply_url": "PostURL",
    },
}
```

**在** **`lite_crawler.py`** **中**：

* 参照 `crawl_zuel()` 的模式（api\_get 类型）

* 编写 `crawl_tencent()` 函数

* 在 `crawl_source()` 中添加 `elif source == "tencent":` 分支

#### Step 3: 其他高校源调研

继续寻找其他可能可行的高校源（非 jysd.com/91job 平台）：

* 北京工商大学 (BTBU)

* 南京审计大学 (NAU)

* 上海对外经贸大学 (SUIBE)

* 浙江财经大学 (ZUFE)

#### Step 4: 字节跳动/百度 — 调研后决策

根据 browser use agent 调研结果决定是否可实现。

### 阶段二：测试验证

每个新增源都需要：

1. 运行 `python lite_crawler.py --sources zjgsu --max-items 5`
2. 运行 `python lite_crawler.py --sources tencent --max-items 5`
3. 检查数据入库正确性
4. 检查 URL 去重逻辑
5. 检查字段映射完整性

### 阶段三：整合与发布

1. 更新文档
2. 更新版本号（建议 v1.2.0，因为新增功能）
3. 提交 git

***

## 三、技术方案要点

### `crawl_zjgsu()` 实现要点

```python
def crawl_zjgsu(source_config: Dict, max_items: int = 0) -> Iterator[Dict]:
    """爬取浙江工商大学（基于URL去重的增量爬取）
    
    与 SUFE 类似，使用 api_post 策略，支持多板块（招聘+实习）
    """
    
    增量策略：
    - POST 请求列表 API，分页参数 pageNum
    - 使用 view_url 模板构造去重 URL
    - 每页检查所有 URL 是否已存在
    - 最多爬取 MAX_PAGES 页
    
    字段映射：
    - title: zpzt (招聘主题)
    - company: dwmc (单位名称)
    - location: szxmc/szsmc (所在县/市)
    - industry: hyyjmc (行业)
    - company_type: xzyjmc (单位性质)
    - company_size: rsgmmc (单位规模)
    - publish_date: fbrq (发布日期)
    - deadline: zpjzrq (截止日期)
    - recruit_count: xqrs (招聘人数)
    - contact_email: jltdyx (简历投递邮箱)
    - source_url: /career/zpxx/view/{xxlb}/{zpxxid}
    - source: "zjgsu"
    - university: "浙江工商大学"
```

### `crawl_tencent()` 实现要点

```python
def crawl_tencent(source_config: Dict, max_items: int = 0) -> Iterator[Dict]:
    """爬取腾讯招聘（基于URL去重的增量爬取）
    
    与 ZUEL 类似，使用 api_get 策略
    """
    
    增量策略：
    - GET 请求列表 API，分页参数 pageIndex
    - 使用 PostURL 作为去重 URL
    - 每页检查所有 URL 是否已存在
    - 最多爬取 MAX_PAGES 页
    
    字段映射：
    - title: RecruitPostName
    - company: BGName（事业群名称）
    - location: LocationName
    - category: CategoryName
    - description: Responsibility（岗位职责）
    - publish_date: LastUpdateTime（需标准化为 YYYY-MM-DD）
    - experience: RequireWorkYearsName
    - source_url: PostURL
    - apply_url: PostURL
    - source: "tencent"
    - university: "腾讯"
```

### 现有代码的修改范围

1. **`spider_configs.py`**:

   * 在 `SPIDER_CONFIGS` 中添加 zjgsu (api\_post 类型，多板块)

   * 在 `SPIDER_CONFIGS` 中添加 tencent (api\_get 类型)

   * 在 `get_lite_http_sources()` 中确保两个源都被包含

2. **`lite_crawler.py`**:

   * 添加 `crawl_zjgsu()` 函数（参照 crawl\_sufe，约 200 行）

   * 添加 `crawl_tencent()` 函数（参照 crawl\_zuel，约 150 行）

   * 在 `crawl_source()` 中添加两个 elif 分支

***

## 四、已确认信息摘要

| 源                | 类型        | 实现难度 | 优先级 | 状态      | 数据量              |
| ---------------- | --------- | ---- | --- | ------- | ---------------- |
| **浙江工商大学 ZJGSU** | api\_post | 低    | P0  | ✅ 可立即实现 | 招聘15000+，实习3000+ |
| **腾讯 Tencent**   | api\_get  | 低    | P1  | ✅ 可立即实现 | 大量               |
| 字节跳动 ByteDance   | api\_post | 中    | P2  | ⚠️ 需要调研 | -                |
| 百度 Baidu         | api\_post | 中    | P2  | ⚠️ 需要调研 | -                |
| 其他财经类高校 (jysd)   | -         | 高    | P3  | ❌ 不可行   | -                |

### 后续优化建议

* **长期**：继续寻找其他非 jysd.com/91job 平台的高校就业系统

* **扩展**：可调研其他综合性招聘平台（如国聘网 iguopin.com）是否有公开 API

* **改进**：如果字节跳动/百度的 CSRF 验证可通过纯 HTTP 方式解决，可以大幅扩展大厂招聘数据源

