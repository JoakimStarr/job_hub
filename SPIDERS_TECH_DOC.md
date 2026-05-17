# 爬虫技术文档

## 重构说明 (2026-05-16)

### 架构改进

爬虫系统已完成重构，采用**配置驱动架构**，将所有爬虫合并为统一的实现：

#### 核心文件

1. **spider\_configs.py** - 统一爬虫配置文件
   - 定义所有数据源的配置（API URL、字段映射、请求头等）
   - 支持多种爬虫类型：api\_post、api\_get、html、browser\_api、browser\_js
2. **unified\_spider.py** - 统一爬虫实现
   - 根据配置动态处理不同数据源
   - 消除重复代码，提高可维护性
   - 统一的错误处理和日志记录
3. **utils.py** - 公共工具函数
   - `html_to_text()` - HTML转文本
   - `gather_limited()` - 并发控制
   - 其他通用工具函数

#### 重构优势

- ✅ **代码复用**：消除重复代码，减少维护成本
- ✅ **配置驱动**：新增数据源只需添加配置，无需编写新代码
- ✅ **统一接口**：所有爬虫使用相同的API接口
- ✅ **易于扩展**：支持多种爬虫类型，便于添加新数据源
- ✅ **测试验证**：已通过ZUEL和SUFE爬虫测试

#### 使用方法

```Python
from spiders import create_spider

# 创建爬虫实例
spider = create_spider("zuel", headless=True)

# 爬取数据
jobs = await spider.crawl(max_items=10)

# 关闭爬虫
await spider.close()
```

#### 旧文件处理

旧的独立爬虫文件已移动到 `trash/spiders_old/` 目录，保留备份。`run_browser_spiders.py` 也已移动到 `trash/` 目录，不再使用。

***

## 目录

1. [SUFE - 上海财经大学](#1-sufe---上海财经大学)
2. [CUFE - 中央财经大学](#2-cufe---中央财经大学)
3. [DUFE - 东北财经大学](#3-dufe---东北财经大学)
4. [UIBE - 对外经济贸易大学](#4-uibe---对外经济贸易大学)
5. [SWUFE - 西南财经大学](#5-swufe---西南财经大学)
6. [JXUFE - 江西财经大学](#6-jxufe---江西财经大学)
7. [ZUEL - 中南财经政法大学](#7-zuel---中南财经政法大学)

***

## 1. SUFE - 上海财经大学

### 基本信息

- **数据源名称**: 国家大学生就业服务平台
- **基础URL**: `https://24365.smartedu.cn`
- **爬虫类型**: 浏览器 + API (AJAX)
- **继承基类**: `BaseBrowserSpider`

### API结构

#### 列表API

```
GET https://24365.smartedu.cn/student/jobs/jobslist/ajax/
```

**参数**:

| 参数名      | 类型     | 说明        |
| -------- | ------ | --------- |
| offset   | int    | 页码偏移，从1开始 |
| limit    | int    | 每页数量，默认10 |
| jobType  | string | 岗位类型      |
| areaCode | string | 地区代码      |
| jobName  | string | 岗位名称关键词   |

**返回结构**:

```json
{
  "flag": true,
  "data": {
    "list": [
      {
        "jobId": "12345",
        "jobName": "软件工程师",
        "recName": "XX科技有限公司",
        "areaCodeName": "北京",
        "lowMonthPay": 10,
        "highMonthPay": 15,
        "publishDate": 1704067200000,
        "degreeName": "本科",
        "major": "计算机相关",
        "recScale": "100-499人",
        "recProperty": "民营企业"
      }
    ],
    "pagenation": {
      "count": 1000,
      "pageSize": 10
    }
  },
  "global": []
}
```

### 字段映射

| API字段                    | JobData字段     | 处理方式                 |
| ------------------------ | ------------- | -------------------- |
| jobName                  | title         | 直接映射                 |
| recName                  | company       | 直接映射                 |
| areaCodeName             | location      | 直接映射                 |
| lowMonthPay/highMonthPay | salary        | 格式化为 `{low}-{high}K` |
| publishDate              | publish\_date | 毫秒时间戳转换              |
| degreeName               | education     | 直接映射                 |
| major                    | description   | 拼接到描述                |
| recScale                 | description   | 拼接到描述                |
| recProperty              | description   | 拼接到描述                |

### 直接调用API方法

```python
import requests
import time

# 列表API
list_url = "https://24365.smartedu.cn/student/jobs/jobslist/ajax/"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Referer": "https://24365.smartedu.cn/student/jobs/index.html",
    "X-Requested-With": "XMLHttpRequest"
}
params = {
    "offset": 1,  # 页码，从1开始
    "limit": 10,  # 每页数量
    "_": int(time.time() * 1000)  # 时间戳防缓存
}
response = requests.get(list_url, headers=headers, params=params)
data = response.json()

# 检测匿名访问限制
if data.get("global") and "登录后查看" in data["global"][0].get("des", ""):
    print("触发匿名访问限制")
else:
    jobs = data["data"]["list"]
    for job in jobs:
        print(f"岗位: {job['jobName']}, 公司: {job['recName']}")
```

### 直接调用API方法

```python
import requests

# 1. 获取列表数据
list_url = "https://jyzx.zuel.edu.cn/api/publicly/recruit/list"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://jyzx.zuel.edu.cn/home/career?type=6"
}
params = {
    "type": 1,  # 1=全职, 2=实习
    "page": 1,
    "limit": 10,
    "total": 0
}
response = requests.get(list_url, headers=headers, params=params)
list_data = response.json()

# 2. 获取详情数据
job_id = list_data["data"][0]["id"]
detail_url = f"https://jyzx.zuel.edu.cn/api/publicly/recruit/get?id={job_id}"
response = requests.get(detail_url, headers=headers)
detail_data = response.json()
```

### 直接调用API方法

```python
import requests
from bs4 import BeautifulSoup

# 直接访问详情页URL
job_id = 14506
url = f"https://job3.swufe.edu.cn/jobs/jobs-show-{job_id}-.htm"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}
response = requests.get(url, headers=headers)
html = response.text

# 检测页面是否存在
soup = BeautifulSoup(html, "html.parser")
if soup.find("div", class_="no_page_group"):
    print("页面不存在 (404)")
else:
    # 提取字段
    title = soup.select_one("div.j-n-txt").get_text(strip=True)
    company = soup.select_one("div.com-name").get_text(strip=True)
    salary_span = soup.select_one("span.job_money")
    # ... 其他字段
    print(f"岗位: {title}, 公司: {company}")
```

### 爬取策略

1. 使用 Playwright 浏览器访问 `https://24365.smartedu.cn/student/jobs/index.html`
2. 通过页面内 AJAX 请求获取列表数据
3. 检测 `global[0].des` 是否包含"登录后查看"，若包含则 break 退出
4. 增量去重：通过 `get_existing_urls()` 检查已存在URL

### 特殊处理

- **匿名访问限制**: 匿名会话只能访问前几页，检测到限制后立即停止
- **薪资格式**: API返回的是数字（单位K），需格式化为字符串

***

## 2. SUFE - 上海财经大学

### 基本信息

- **数据源名称**: 上海财经大学
- **基础URL**: `https://career.sufe.edu.cn`
- **爬虫类型**: 纯 HTTP API (POST)
- **继承基类**: `BaseSpider`

### API结构

#### 招聘信息列表API

```
POST https://career.sufe.edu.cn/career//zpxx/search/zpxx
Content-Type: application/x-www-form-urlencoded

pageNum=1
```

**请求头**:

```
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
Accept: application/json, text/plain, */*
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
Origin: https://career.sufe.edu.cn
Referer: https://career.sufe.edu.cn/career/zpxx/zpxx
X-Requested-With: XMLHttpRequest
```

**返回结构**:

```json
{
  "code": 200,
  "data": {
    "total": "28126",
    "list": [
      {
        "zpxxid": "195569100108468224",
        "zpzt": "财务专员 | 上海汇雅特集团有限公司",
        "dwmc": "上海汇雅特集团有限公司",
        "fbrq": "2026-05-15",
        "zpjzrq": "2027-05-15",
        "szxmc": "上海市静安区",
        "szsmc": "上海市",
        "hyyjmc": "租赁和商务服务业",
        "rsgmmc": "20人以下",
        "xqrs": 2,
        "jltdyx": "hr@huiyate.com.cn",
        "xxlb": "zpxx"
      }
    ]
  }
}
```

#### 详情API

```
POST https://career.sufe.edu.cn/career//zpxx/data/zpxx/{zpxxid}
Content-Type: application/x-www-form-urlencoded

(空请求体)
```

**返回结构**:

```json
{
  "code": 200,
  "data": {
    "zpxxid": "195553854190915584",
    "zpzt": "山东高速集团有限公司2026年上半年 校园招聘公告",
    "dwmc": "山东高速集团有限公司",
    "fbrq": "2026-05-15",
    "zpjzrq": "2026-05-27",
    "szxmc": "山东省济南市市辖区",
    "szsmc": "济南市",
    "hyyjmc": "房地产业",
    "rsgmmc": "10000人以上",
    "xxdz": "山东省济南市龙奥北路8号",
    "dwjs": "山东高速集团是由省委管理...",
    "zwxxList": [
      {
        "zwmc": "山东高速集团有限公司2026年上半年 校园招聘公告",
        "gzlxmc": "全职",
        "zwlbymc": "其他人员",
        "gzszxmc": "山东省济南市历下区",
        "yxmc": "6000--6499",
        "xlyqmc": "不限,本科,硕士,博士",
        "zyyqmc": "不限专业",
        "xqrs": "399",
        "zwms": "岗位职责..."
      }
    ]
  }
}
```

### 直接调用API方法

```python
import requests

# 1. 获取列表数据
list_url = "https://career.sufe.edu.cn/career//zpxx/search/zpxx"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "Origin": "https://career.sufe.edu.cn",
    "Referer": "https://career.sufe.edu.cn/career/zpxx/zpxx",
    "X-Requested-With": "XMLHttpRequest"
}
response = requests.post(list_url, headers=headers, data={"pageNum": "1"})
list_data = response.json()

# 2. 获取详情数据
zpxxid = list_data["data"]["list"][0]["zpxxid"]
detail_url = f"https://career.sufe.edu.cn/career//zpxx/data/zpxx/{zpxxid}"
response = requests.post(detail_url, headers=headers)
detail_data = response.json()
```

### 字段映射

| API字段           | JobData字段     | 处理方式                | <br />     |
| --------------- | ------------- | ------------------- | :--------- |
| zpzt            | title         | 直接映射（可能含"           | "分隔的岗位和公司） |
| dwmc            | company       | 直接映射                | <br />     |
| gzszxmc 或 szxmc | location      | 优先工作地点，其次所在区县       | <br />     |
| yxmc            | salary        | 直接映射（如"6000--6499"） | <br />     |
| fbrq            | publish\_date | 日期格式化               | <br />     |
| zpjzrq          | deadline      | 日期格式化               | <br />     |
| hyyjmc          | industry      | 直接映射                | <br />     |
| xlyqmc          | education     | 直接映射（可能含多个学历）       | <br />     |
| zyyqmc          | requirements  | 专业要求                | <br />     |
| zwms            | description   | 职位描述                | <br />     |
| dwjs            | description   | 追加公司介绍              | <br />     |
| gzlxmc          | job\_type     | 直接映射                | <br />     |

### 爬取策略

1. 分三个板块爬取：招聘信息(zpxx)、实习信息(sxzpxx)、招聘公告(zpgg)
2. 每个板块最多爬取 `max_section_pages` 页
3. 详情页并发获取，并发数 `detail_concurrency=8`
4. 直接调用 POST API，无需浏览器

***

## 3. CUFE - 中央财经大学

### 基本信息

- **数据源名称**: 中央财经大学
- **基础URL**: `http://scc.cufe.edu.cn`
- **爬虫类型**: 纯 HTTP API (POST)
- **继承基类**: `SamePlatformSpider` (公共平台基类)

### API结构

#### 列表API

```
POST http://scc.cufe.edu.cn/f/recruitmentinfo/ajax_frontRecruitinfo
Content-Type: application/x-www-form-urlencoded

pageNo=1&positionType=1
```

**参数说明**:

| 参数名          | 说明         |
| ------------ | ---------- |
| pageNo       | 页码         |
| positionType | 1=全职, 2=实习 |

**返回结构**:

```json
{
  "state": 1,
  "object": {
    "list": [
      {
        "title": "投资经理",
        "url": "/f/recruitmentinfo/show?recruitmentId=12345",
        "corporationinfo": {
          "name": "XX投资公司",
          "corporationScaleValue": "100-499人",
          "corporationNatureValue": "国有企业"
        },
        "startTime": "2025-01-10",
        "endTime": "2025-03-10",
        "education": "硕士",
        "majorName": "金融、经济",
        "positionNum": 2
      }
    ],
    "pageSize": 10,
    "count": 500
  }
}
```

#### 详情API

```
POST http://scc.cufe.edu.cn/f/recruitmentinfo/ajax_show?ts={timestamp}
Content-Type: application/x-www-form-urlencoded

ts={timestamp}
recruitmentId={recruitmentId}
```

**URL参数说明**:

| 参数名 | 类型   | 说明                     |
| --- | ---- | ---------------------- |
| ts  | long | 时间戳（毫秒级），用于防缓存和验证请求时效性 |

**POST数据说明**:

| 参数名           | 类型     | 说明                |
| ------------- | ------ | ----------------- |
| ts            | long   | 时间戳（毫秒级），与URL参数一致 |
| recruitmentId | string | 招聘信息唯一标识符（UUID格式） |

**关键请求头**:

| 请求头              | 值                                                                                                       | 说明                 |
| ---------------- | ------------------------------------------------------------------------------------------------------- | ------------------ |
| Content-Type     | application/x-www-form-urlencoded; charset=UTF-8                                                        | 表单编码               |
| X-Requested-With | XMLHttpRequest                                                                                          | 标识AJAX请求           |
| Referer          | <http://scc.cufe.edu.cn/frontpage/cufe/html/recruitmentinfoForm.html?positionDetailId={recruitmentId}&> | 来源页面               |
| Origin           | <http://scc.cufe.edu.cn>                                                                                | 请求来源               |
| Cookie           | jy.cufe.session.id={session\_id}                                                                        | 会话ID（可选，建议先访问首页获取） |
| token            | {token\_value}                                                                                          | API访问令牌（可选）        |

**返回结构**:

```json
{
    "state": 1,
    "msg": "操作成功",
    "object": {
        "ename": "recruitmentinfo1",
        "flag": false,
        "recruitmentinfos": {
            "pageNo": 1,
            "pageSize": 3,
            "count": 0,
            "firstPage": true,
            "lastPage": true,
            "length": 8,
            "list": [],
            "totalPage": 1,
            "firstResult": 0,
            "maxResults": 3,
            "cauFrontPageStr": "<div class=\"dataNum\">共<span> 0 </span>条记录 <lable style='display:none;margin-left:10px;'>跳转到第 <input style='width:30px;height:auto;text-align:center;border: 1px solid#ccc;' type='text'oninput='if(value>1)value=1' value='1' onblur=\"if(this.value!=1)page(this.value,3,'');\"> 页 </lable></div><ul class=\"fPage\"><li><a class=\"next prev\" ><em>上一页</em></a></li><li><li class=\"active\"><a href=\"javascript:\">1</a></li>\n</li><li><a class=\"next\" ><em>下一页</em></a></li></ul>"
        },
        "recruitmentinfo": {
            "corporationinfo": {
                "introduction": "山东华融控股集团股份有限公司成立于2006年10月23日，工商注册号：91370100795338151H，企业类型为股份有限公司，注册地址济南市高新区舜华路2000号舜泰广场B5-B号楼，注册资本2.3533亿元人民币，营业范围：创业投资及咨询。公司严格按照现代企业制度和《创业投资企业管理暂行办法》建立，是山东省发展和改革委员会首批备案的创业投资企业之一。\r\n\r\n公司下设战略规划部、投资业务部、...",
                "logoUrl": "/frontupload/corporationImages/202311/20231103100216c34e80cb8074491a880b8a7c27e9b980.png",
                "corporationNatureValue": "其他企业(含民营企业等)",
                "url": "/f/corporationinfo/details?corporationinfoId=1d07ae0ffbfc4434a0d639e6c2f2bcc1",
                "name": "山东华融控股集团股份有限公司",
                "id": "1d07ae0ffbfc4434a0d639e6c2f2bcc1",
                "corporationinfoIntroduction": "山东华融控股集团股份有限公司成立于2006年10月23日，工商注册号：91370100795338151H，企业类型为股份有限公司，注册地址济南市高新区舜华路2000号舜泰广场B5-B号楼，注册资本2.3533亿元人民币，营业范围：创业投资及咨询。公司严格按照现代企业制度和《创业投资企业管理暂行办法》建立，是山东省发展和改革委员会首批备案的创业投资企业之一。公司下设战略规划部、投资业务部、...",
                "corporationScaleValue": "500人以上"
            },
            "positionTypeValue": "招聘信息",
            "flag": false,
            "education": "硕士",
            "resumeReceiveEmail": "296015644@qq.com",
            "recruitmentPositionList": [
                {
                    "id": "ed00c81157e94e2f87e7b82c4eba655b",
                    "positionName": "投资经理助理",
                    "studentType": "硕士",
                    "major": "1fe55dc4de534fc89d8b2563b313f858,3047234bf25f40b7ac11b379ecd1ef83,85e5b9f9ad2f41988c02bb2a20e2aebe,99661536beda470fa4c2bd220574e6fa,9ced4c47a1ef44cfb00f67a5dc2846dc,9f4ea994b7334df18c27a5b715e293af,abea5c5b57344a81831819849c8237e2,ae3d046e45cc4df3b0d10fe1fffd30f8,c724cbe293d547ecad0e27d7c31633e7,d8af2bfbf62e49a188f0f2eb85b111cd,dd8b4ade783e4671a6c8b2d5749bc77c,f099dd16efc24a5d9881590a2b447403,fabec21422414a598c51df395d0d6570,fefdd7a051d611e8840ceae0a28cd587,ff02156151d611e8840ceae0a28cd587,ff0215e151d611e8840ceae0a28cd587,ff022da751d611e8840ceae0a28cd587,ff022f0d51d611e8840ceae0a28cd587,ff022f5751d611e8840ceae0a28cd587,7f491b10e7d14bd08ca6954e194f00f7,83415641d4d147d18a9c14a334244e4f,adac85c740ec477a8307b71f6f247a5f,ff02357451d611e8840ceae0a28cd587,450f757149fb465e873eb1b090365908,a8e0f0a1e26645bcaa0ea7347bd97c26,ff02280051d611e8840ceae0a28cd587,0abfbbb3eafd497695b7e777cdda658a,0c637538f6ae4e4d8b010ee383b3f6e8,0e088aa09e804b9fbd720057a33f32a3,28cabaa7268e4ae293e6f083031c0a29,3f83917f1cd144e3abd83ed52fd46f12,44c081ff56e04a78977d6905133b6b0a,4d614816dce4498286daba093637ae6a,79c443c880d44d1c880c07fe2ee07518,83d0fa6326b744f1bbde24be4ebeae7a,932d880c45bf4e0896d51745adee4c9b,c41bd78bac8f47ba96c32c2202c67c60,e59f24cfb4044494a702d1ffa5bc10e0,f1148459da03476093fb728bff4e85b3,fefdd43b51d611e8840ceae0a28cd587,fefdd76651d611e8840ceae0a28cd587,ff02166151d611e8840ceae0a28cd587,ff0216e151d611e8840ceae0a28cd587,ff0225f751d611e8840ceae0a28cd587,ff02369351d611e8840ceae0a28cd587,354d6a7e61654879bbc60f0f02929e06,bf50822a91554fd5a472c0aaa0b8c074,cbbe7a9624a04b269f646f678e4d9521,e242922d1e8d4529a87d7358736a8c9c,ff02146951d611e8840ceae0a28cd587,01a60b2f9d834dcc9b2acaf6695e014f,0d9d96571448438e8add216ee7986440,252c0457fd26429a8e3641fccba2218c,28a9bc863d514c2791c5f2126face3ca,379f08bed81f4f5f92c822c8c3f043d7,5d51c256bb534d7a96847791075ab869,a99a5530a2804cceb871541a6f84943a,f0ab8bc375834356964f898988905f70,ff02176051d611e8840ceae0a28cd587,ff0217dd51d611e8840ceae0a28cd587,ff021cd451d611e8840ceae0a28cd587,ff02256551d611e8840ceae0a28cd587,ff022fa751d611e8840ceae0a28cd587,3961b21d406743459ad8d08802b30180,7acdaf0ad3de48a2953f72c2f0413b19,7b24b0ce879f40c997f94a11566e1fb6,91610c89ad054171947783c50bbcf4e5,9505f44349d4485a9669677fbf78449a,a0fed084717543479aced6a5c280e8bd,a3dc9be63dfd46758a51cef099ff4950,abc4610a19e742db9f284b7097bb261c,d6809ad325c94a458b28b9a43ab713a8,e0323584a3dd40adbeb77c5c82afe43f,fefdd57251d611e8840ceae0a28cd587,fefdd5d251d611e8840ceae0a28cd587,fefdd61e51d611e8840ceae0a28cd587,fefdd66851d611e8840ceae0a28cd587,fefdd6b251d611e8840ceae0a28cd587,ff0227b651d611e8840ceae0a28cd587,ff0235ba51d611e8840ceae0a28cd587,ff02372251d611e8840ceae0a28cd587,ff02376d51d611e8840ceae0a28cd587,ff0237b451d611e8840ceae0a28cd587,ff023e0c51d611e8840ceae0a28cd587",
                    "majorName": "金融学（互联网金融）,★金融工程,金融学（北外英语联培）,双培金融学（金融与监管科技）,双培金融学,金融学（留学生）,双培金融学（国际金融）,金融学类,金融学专业实验班,双培金融学（互联网金融）,金融科技（北航计算机科学与技术专业联培）,金融科技,双培金融科技,金融学,金融工程,金融学（国际货币与国际金融）,证券投资,国际金融学,金融,财政学,财政学（财政理论与政策）,政府经济与管理,区域经济学,投资学（二学位）,★投资学,投资学,会计学（管理会计方向）,双培会计学（数字化转型）,工商管理类 （会计学院）,工商管理类（会计学院）,双培会计学,财务管理（公司金融方向）,双培财务管理（智能财务决策）,财务管理（留学生）,会计学（注册会计师）,双培财务管理,会计学（注册会计师方向）,会计学（会计学-法学双学位项目）,会计学（留学生）,会计,会计学,会计学（管理会计）,财务管理,会计学（注册会计师专门化）,审计,国际贸易学,产业经济学,国民经济学,金融学,经济学（数理经济与数理金融）,财政学（财政基础理论）,财政学类,税收学（税务师）,★税收学,税收学（全球税收治理菁英班）,财政学,税收学（北理工“人工智能+税收”联培项目）,财政学（二学位）,税收学,税收学（国际税收）,税收学（注册税务师）,资产评估,税务,国际商务,国防经济,数字经济（成思危拔尖班）,区域经济学,经济学（基地班）,互联网经济学,数字经济,经济学（第二专业）,经济学（二学位）,经济学类,政治经济学,世界经济,产业经济学,劳动经济学,国民经济学,经济学,西方经济学,经济思想史,经济史,人口、资源与环境经济学,国民经济管理",
                    "demandNumber": "5",
                    "positionDescription": "岗位职责：1、负责搜集具有股权融资需求的项目信息；2、跟随项目团队参与项目尽调工作；3、协助投资经理完成项目调尽报告；4、对公司关注的行业进行行业研究 任职要求：1、对股权投资具有深厚的兴趣；2、具有扎实的专业基础知识和较强的文字写作能力；3、具有较强的工作责任心和人际交往能力；4、具有娴熟的机动车驾驶技术和较强的羽毛球技能者优先录用。签定劳动合同后缴纳五险一金、同末双休、享受国家规定的法定节假日及带薪年休假、单位免费提供午餐、享受通信及交通和住房补助，晋升通道畅通。本科及以上学历有意者请将个人简历发送至296015644@qq.com,也可致电0531-82823309咨询",
                    "city": "370100",
                    "cityName": "山东省济南市"
                }
            ],
            "browseNumber": "64",
            "otherLabel": "工作环境优越，工资高压力小。",
            "title": "华融控股集团招聘投资经理助理",
            "isPost": "0",
            "content": "<p>山东华融控股集团股份有限公司成立于2006年10月23日，注册地址济南市高新区舜华路2000号舜泰广场B5-B号楼，注册资本1亿元人民币，公司严格按照现代企业制度和《创业投资企业管理暂行办法》建立，是山东省发展和改革委员会首批备案的创业投资企业之一。</p>\r\n\r\n<p>公司现有山西华融龙宫煤业有限公司、山东华玫生物科技有限公司、山东益兴创业投资有限公司、山东汇益创业投资有限公司等多家控股子公司，参股山东盛鑫矿业有限公司、天津久日新材料股份有限公司、山东圣泉集团股份有限公司、山东力诺特玻股份有限公司、山东神戎电子股份有限公司等多家企业，并与北京互联投资基金等投资机构成立合伙基金。</p>",
            "positionNum": 1,
            "titleColor": "",
            "onlineApplicationUrl": "",
            "startTime": "2026-05-15 16:32:56",
            "fileURL": "",
            "shortContent": "山东华融控股集团股份有限公司成立于2006年10月23日，注册地址济南市高新区舜华路2000号舜泰广场B5-B号楼，注册资本1亿元人民币，公司严格按照现代企业制度和《创业投资企业管理暂行办法》建立，是山东省发展和改革委员会首批备案的创业投资企业之一。\r\n\r\n公司现有山西华融龙宫煤业有限公司、山东华玫生物科技有限公司、山东益兴创业投资有限公司、山东汇益创业投资有限公司等多家控股子公司，参股山东盛鑫矿",
            "releaseFlag": "0",
            "isFrontShow": "1",
            "isReceive": "1",
            "url": "/f/recruitmentinfo/show?recruitmentId=74fa168a57814cd59bfe538ab1114aef",
            "isOpen": "0",
            "corporationNatureValue": "其他企业(含民营企业等)",
            "labelValue": [
                "五险一金",
                "季度奖金",
                "带薪年假",
                "交通补助",
                "通讯津贴",
                "午餐补助",
                "岗位晋升",
                "公司有食堂"
            ],
            "endTime": "2026-11-15 00:00:00",
            "majorName": "金融学（留学生）,数字经济,双培金融科技,财政学（财政理论与政策）,经济学,财政学（二学位）,世界经济,金融学专业实验班,财务管理（公司金融方向）,政府经济与管理,税收学（税务师）,★投资学,数字经济（成思危拔尖班）,经济史,政治经济学,投资学（二学位）,双培会计学,工商管理类（会计学院）,会计学（注册会计师专门化）,税收学（国际税收）,税收学,双培金融学（国际金融）,工商管理类 （会计学院）,审计,劳动经济学,★金融工程,会计学（管理会计方向）,互联网经济学,西方经济学,双培金融学,税收学（注册税务师）,财政学,会计学（注册会计师方向）,国防经济,会计学（管理会计）,税收学（北理工“人工智能+税收”联培项目）,金融学,双培财务管理（智能财务决策）,经济学（二学位）,经济学类,金融学（互联网金融）,国际贸易学,经济学（第二专业）,会计学,双培财务管理,★税收学,区域经济学,国际商务,双培金融学（金融与监管科技）,财务管理（留学生）,金融学（国际货币与国际金融）,会计,金融,人口、资源与环境经济学,会计学（注册会计师）,税务,财政学类,金融学类,资产评估,税收学（全球税收治理菁英班）,金融科技（北航计算机科学与技术专业联培）,双培会计学（数字化转型）,经济思想史,国民经济学,财务管理,财政学（财政基础理论）,金融学（北外英语联培）,证券投资,会计学（会计学-法学双学位项目）,国民经济管理,产业经济学,金融工程,双培金融学（互联网金融）,投资学,经济学（基地班）,会计学（留学生）,国际金融学,经济学（数理经济与数理金融）,金融科技"
        },
        "recruitmentPositionSize": 1
    },
    "jessionid": "f04e23c8a3b84bbb9d902fb536af5f8f"
}
```

**返回字段说明**:

| 字段路径                                                                  | 类型     | 说明                        |
| --------------------------------------------------------------------- | ------ | ------------------------- |
| state                                                                 | int    | 状态码，1表示成功                 |
| msg                                                                   | string | 操作消息                      |
| object.recruitmentinfo                                                | object | 招聘信息主体                    |
| object.recruitmentinfo.title                                          | string | 招聘标题                      |
| object.recruitmentinfo.positionTypeValue                              | string | 岗位类型（招聘信息/实习信息）           |
| object.recruitmentinfo.education                                      | string | 学历要求（逗号分隔）                |
| object.recruitmentinfo.majorName                                      | string | 专业要求（逗号分隔）                |
| object.recruitmentinfo.positionNum                                    | int    | 招聘人数                      |
| object.recruitmentinfo.browseNumber                                   | string | 浏览次数                      |
| object.recruitmentinfo.startTime                                      | string | 发布时间（YYYY-MM-DD HH:mm:ss） |
| object.recruitmentinfo.endTime                                        | string | 截止时间（YYYY-MM-DD HH:mm:ss） |
| object.recruitmentinfo.content                                        | string | 招聘公告HTML内容                |
| object.recruitmentinfo.onlineApplicationUrl                           | string | 在线申请链接                    |
| object.recruitmentinfo.corporationinfo                                | object | 公司信息                      |
| object.recruitmentinfo.corporationinfo.name                           | string | 公司名称                      |
| object.recruitmentinfo.corporationinfo.introduction                   | string | 公司介绍                      |
| object.recruitmentinfo.corporationinfo.corporationNatureValue         | string | 公司性质                      |
| object.recruitmentinfo.corporationinfo.corporationScaleValue          | string | 公司规模                      |
| object.recruitmentinfo.recruitmentPositionList                        | array  | 岗位列表                      |
| object.recruitmentinfo.recruitmentPositionList\[].positionName        | string | 岗位名称                      |
| object.recruitmentinfo.recruitmentPositionList\[].studentType         | string | 学生类型（学历要求）                |
| object.recruitmentinfo.recruitmentPositionList\[].majorName           | string | 专业要求                      |
| object.recruitmentinfo.recruitmentPositionList\[].demandNumber        | string | 需求人数                      |
| object.recruitmentinfo.recruitmentPositionList\[].positionDescription | string | 岗位描述                      |
| object.recruitmentinfo.recruitmentPositionList\[].cityName            | string | 工作城市                      |

### 字段映射

| API字段                                          | JobData字段     | 处理方式               |
| ---------------------------------------------- | ------------- | ------------------ |
| title                                          | title         | 直接映射               |
| corporationinfo.name                           | company       | 清洗后缀               |
| recruitmentPositionList\[0].cityName           | location      | 取第一个岗位的城市          |
| -                                              | salary        | 固定"面议"             |
| startTime                                      | publish\_date | 日期格式化（截取前10位）      |
| endTime                                        | deadline      | 日期格式化（截取前10位）      |
| education                                      | education     | 直接映射               |
| majorName                                      | requirements  | 专业要求               |
| corporationinfo.corporationNatureValue         | industry      | 直接映射               |
| content                                        | description   | HTML转文本            |
| corporationinfo.introduction                   | description   | 追加公司介绍             |
| recruitmentPositionList\[].positionDescription | description   | 追加岗位描述             |
| positionTypeValue                              | job\_type     | 映射：招聘信息→全职，实习信息→实习 |
| onlineApplicationUrl                           | apply\_url    | 直接映射               |

### 直接调用API方法

```python
import requests
import time

# 1. 获取列表数据
list_url = "http://scc.cufe.edu.cn/f/recruitmentinfo/ajax_frontRecruitinfo"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "X-Requested-With": "XMLHttpRequest",
    "Origin": "http://scc.cufe.edu.cn",
    "Referer": "http://scc.cufe.edu.cn/"
}
response = requests.post(list_url, headers=headers, data={"pageNo": "1", "positionType": "1"})
list_data = response.json()

# 2. 获取详情数据
recruitment_id = list_data["object"]["list"][0]["recruitmentId"]
ts = int(time.time() * 1000)
detail_url = "http://scc.cufe.edu.cn/f/recruitmentinfo/ajax_show"
params = {"ts": ts}
data = {"ts": ts, "recruitmentId": recruitment_id}
response = requests.post(detail_url, params=params, data=data, headers=headers)
detail_data = response.json()

# 3. 提取字段
info = detail_data["object"]["recruitmentinfo"]
title = info["title"]
company = info["corporationinfo"]["name"]
publish_date = info["startTime"][:10]
deadline = info["endTime"][:10]
education = info["education"]
industry = info["corporationinfo"]["corporationNatureValue"]

# 4. 提取岗位列表
positions = info["recruitmentPositionList"]
for pos in positions:
    position_name = pos["positionName"]
    location = pos["cityName"]
    description = pos["positionDescription"]
    print(f"岗位: {position_name}, 地点: {location}")
```

### 爬取策略

1. 分全职(positionType=1)和实习(positionType=2)两类爬取
2. 详情页并发获取，并发数 `detail_concurrency=4`
3. 302重定向处理：初始化时先访问首页获取Cookie

***

## 4. DUFE - 东北财经大学

### 基本信息

- **数据源名称**: 东北财经大学
- **基础URL**: `https://career.dufe.edu.cn`
- **爬虫类型**: 纯 HTTP API (POST)
- **继承基类**: `SamePlatformSpider` (与CUFE共用)

### API结构

与 CUFE 完全相同，仅基础URL不同。

### 字段映射

与 CUFE 相同，仅 `location` 硬编码为"大连"。

***

## 5. UIBE - 对外经济贸易大学

### 基本信息

- **数据源名称**: 对外经济贸易大学
- **基础URL**: `https://career.uibe.edu.cn`
- **爬虫类型**: 浏览器 + AJAX (加密)
- **继承基类**: `BaseBrowserSpider`

### API结构

#### 列表API (页面内AJAX)

```
POST https://career.uibe.edu.cn/front/zp_query/zpxxQuery.do
Content-Type: multipart/form-data

pageNo=1&pageSize=10
```

**返回结构** (加密):

```json
{
  "msg": "Y",
  "data": [
    {
      "tid": "12345",
      "title": "国际贸易专员",
      "dwmc": "XX进出口公司",
      "dwszddm": "北京",
      "updateTime": "2025-01-15",
      "createTime": "2025-01-10"
    }
  ],
  "curPage": 1,
  "pageSize": 10,
  "pageCount": 50
}
```

### 解密方式

```javascript
window.decrypt(raw, 'abcdef0123456789', '0123456789abcdef')
```

### 字段映射

| API字段      | JobData字段     | 处理方式    |
| ---------- | ------------- | ------- |
| title      | title         | 直接映射    |
| dwmc       | company       | 清洗后缀    |
| dwszddm    | location      | 直接映射    |
| createTime | publish\_date | 日期格式化   |
| tid        | source\_url   | 拼接详情URL |

### 爬取策略

1. 使用 Playwright 访问列表页
2. 通过页面内 JavaScript 调用 AJAX 获取加密数据
3. 使用 `window.decrypt()` 解密数据

***

## 6. SWUFE - 西南财经大学

### 基本信息

- **数据源名称**: 西南财经大学
- **基础URL**: `https://job3.swufe.edu.cn`
- **爬虫类型**: 纯 HTTP HTML (直接URL遍历)
- **继承基类**: `BaseSpider`

### URL结构

#### 全职岗位

```
https://job3.swufe.edu.cn/jobs/jobs-show-{id}-.htm
起始ID: 14506
```

#### 实习岗位

```
https://job3.swufe.edu.cn/interns/interns_show/id/{id}.htm
起始ID: 12250
```

### HTML结构

#### 页面不存在检测

```html
<div class="no_page_group">
  <div class="no_page">
    <div class="sorry_box">抱歉，你访问的页面找不到了！</div>
  </div>
</div>
```

#### 关键字段选择器

| 字段            | CSS选择器                         | 说明   |
| ------------- | ------------------------------ | ---- |
| title         | `div.j-n-txt`                  | 岗位标题 |
| publish\_date | `div.job_date span.cutom_font` | 发布日期 |
| salary        | `div.job_msg span` (含"薪酬：")    | 薪资   |
| location      | `span.job_position`            | 工作地点 |
| education     | `span.job_academic`            | 学历要求 |
| experience    | `span.job_money` (含"招聘对象")     | 招聘对象 |
| company       | `div.com-name`                 | 公司名称 |
| industry      | `div.com-class`                | 公司行业 |
| com\_num      | `div.com-num`                  | 公司规模 |
| tags          | `div.lab div.li`               | 福利标签 |
| description   | `div.describe div.txt`         | 职位描述 |

### 字段映射

| HTML字段               | JobData字段   | 处理方式                  |
| -------------------- | ----------- | --------------------- |
| div.j-n-txt          | title       | 直接映射                  |
| div.com-name         | company     | 清洗"-->"前缀             |
| span.job\_position   | location    | 提取文本，支持title属性        |
| 薪酬span               | salary      | 提取"薪酬："后的文本           |
| span.job\_academic   | education   | 去除"学历："前缀             |
| span.job\_money      | experience  | 若为"招聘对象"则存入experience |
| div.com-class        | industry    | 直接映射                  |
| div.lab div.li       | tags        | 逗号连接                  |
| div.describe div.txt | description | 直接映射                  |

### 爬取策略

1. 直接遍历URL ID，从起始ID递增
2. 检测 `div.no_page_group` 判断页面是否存在
3. 连续30个404页面后停止
4. 使用 BeautifulSoup4 解析HTML

***

## 7. JXUFE - 江西财经大学

### 基本信息

- **数据源名称**: 江西财经大学现代经济管理学院
- **基础URL**: `http://career.jxufe.edu.cn`
- **爬虫类型**: 浏览器 + API
- **继承基类**: `BaseBrowserSpider`

### API结构

#### 列表API

```
GET http://career.jxufe.edu.cn/module/getonlines
```

**核心参数**:

| 参数名           | 说明              |
| ------------- | --------------- |
| start\_page   | 页码，从 1 开始       |
| recruit\_type | `正式招聘` / `实习招聘` |
| count         | 每页条数，固定 15      |
| start         | 固定 1            |

**返回结构**:

```json
{
  "code": 1,
  "data": [
    {
      "recruitment_id": "3514473",
      "recruit_type": "正式招聘",
      "title": "斐意特咨询(Fitt Consulting Group) 2026春季校园招聘公告",
      "company_name": "斐意特（北京）管理咨询有限公司",
      "work_city": "北京市",
      "create_time": "2026-05-15",
      "professionals": "不限专业",
      "company_industry": "",
      "content": "..."
    }
  ]
}
```

#### 详情页

```
URL: http://career.jxufe.edu.cn/detail/online?id={recruitment_id}
```

### 字段映射

| API字段             | JobData字段              | 处理方式                |
| ----------------- | ---------------------- | ------------------- |
| title             | title                  | 直接映射                |
| company\_name     | company                | 清洗后缀                |
| work\_city        | location               | 直接映射                |
| create\_time      | publish\_date          | 格式化日期               |
| professionals     | requirements           | 直接映射                |
| company\_industry | industry               | 直接映射                |
| content           | description            | HTML/文本摘要           |
| recruit\_type     | job\_type              | `正式招聘`→全职，`实习招聘`→实习 |
| recruitment\_id   | source\_url/apply\_url | 拼接详情URL             |

### 爬取策略

1. 先请求 `module/getonlines`，仅变更 `start_page`
2. 分别按 `正式招聘` 和 `实习招聘` 两类分页抓取
3. 根据 `recruitment_id` 拼接详情页并访问
4. 从详情页补充岗位正文后入库

***

## 8. NEU - 东北大学

### 基本信息

- **数据源名称**: 东北大学
- **基础URL**: `http://job.neu.edu.cn`
- **爬虫类型**: 浏览器 (JS动态渲染)
- **继承基类**: `BaseBrowserSpider`

### HTML结构

#### 列表页

```
URL: http://job.neu.edu.cn/campus
选择器: a[href*='/campus/view/id/']
```

#### 详情页

```
标题: .title-message h5
摘要: .zp-details
正文: .details-mge .info
```

### 字段映射

| HTML字段             | JobData字段   | 处理方式    |
| ------------------ | ----------- | ------- |
| a链接文本              | title       | 直接映射    |
| 标题文本               | company     | 清洗后缀    |
| -                  | location    | 硬编码"辽宁" |
| -                  | salary      | 固定"面议"  |
| .details-mge .info | description | 直接映射    |

### 爬取策略

1. 使用 Playwright 访问列表页，等待JS渲染
2. 提取所有岗位链接
3. 逐个访问详情页获取完整信息

***

## 9. ZUEL - 中南财经政法大学

### 基本信息

- **数据源名称**: 中南财经政法大学
- **基础URL**: `https://jyzx.zuel.edu.cn`
- **爬虫类型**: 纯 HTTP API (GET)
- **继承基类**: `BaseSpider`

### API结构

#### 列表API

```
GET https://jyzx.zuel.edu.cn/api/publicly/recruit/list?type=1&page=1&limit=10&total=0
```

**参数说明**:

| 参数名   | 说明         |
| ----- | ---------- |
| type  | 1=全职, 2=实习 |
| page  | 页码         |
| limit | 每页数量       |

**返回结构**:

```json
{
  "code": 0,
  "data": [
    {
      "id": "12345",
      "title": "法务专员",
      "companyName": "XX律师事务所",
      "createTime": "2025-01-15",
      "area": "武汉",
      "salary": "8-12K",
      "education": "硕士"
    }
  ],
  "count": 500
}
```

#### 详情API

```
GET https://jyzx.zuel.edu.cn/api/publicly/recruit/get?id=12345
```

**返回结构**:

```json
{
    "id": 6453,
    "addType": "2",
    "companyId": null,
    "companyName": "新疆公招",
    "title": "2026年新疆招录乡镇公务员",
    "fieldId": 5,
    "holdTime": "2026-05-20 14:00",
    "holdTimeOneDate": "2026/05/20 00:00:00",
    "holdTimeOneType": 1,
    "holdTimeOneHour": "14:00",
    "holdTimeTwoDate": null,
    "holdTimeTwoType": null,
    "holdTimeTwoHour": null,
    "holdTimeThreeDate": null,
    "holdTimeThreeType": null,
    "holdTimeThreeHour": null,
    "choiceHoldTimeDate": "2026/05/20 00:00:00",
    "choiceHoldTimeType": 1,
    "choiceHoldTimeHour": "14:00",
    "applyTimeType": "1",
    "jobName": "详见附件",
    "number": null,
    "majors": "详见附件",
    "area": "\\",
    "education": "本科,硕士,博士",
    "scale": "100",
    "email": "jiuye@zuel.edu.cn",
    "recruitWebsite": null,
    "recruitMobile": "18719955518",
    "recruitContact": "谢水法",
    "leader": null,
    "leaderMobile": null,
    "salary": "\\",
    "salaryType": "0",
    "salaryMin": null,
    "salaryMax": null,
    "content": "<p style=\"text-indent:43px;line-height:37px\"><strong><span style=\"font-family: 仿宋_GB2312;font-size: 21px\">招录时间：</span></strong><span style=\"font-family: 仿宋_GB2312;font-size: 21px\"><span style=\"font-family:仿宋_GB2312\">计划于</span><span style=\"font-family:Times New Roman\">5</span><span style=\"font-family:仿宋_GB2312\">月底开始笔试</span></span></p><p style=\"text-indent:43px;line-height:37px\"><strong><span style=\"font-family: &#39;Times New Roman&#39;;font-size: 21px\"><span style=\"font-family:仿宋_GB2312\">招录条件：</span></span></strong><span style=\";font-family:&#39;Times New Roman&#39;;font-size:21px\"><span style=\"font-family:仿宋_GB2312\">大学本科及以上学历、学士及以上学位；应届毕业生（含离校</span>2<span style=\"font-family:仿宋_GB2312\">年内未就业毕业生）；中国共产党党员（含预备党员）；年满</span><span style=\"font-family:Times New Roman\">18</span><span style=\"font-family:仿宋_GB2312\">周岁及以上，</span><span style=\"font-family:Times New Roman\">35</span><span style=\"font-family:仿宋_GB2312\">周岁及以下，其中本科生</span><span style=\"font-family:Times New Roman\">25</span><span style=\"font-family:仿宋_GB2312\">周岁及以下、硕士研究生</span><span style=\"font-family:Times New Roman\">30</span><span style=\"font-family:仿宋_GB2312\">周岁及以下、博士研究生</span><span style=\"font-family:Times New Roman\">35</span><span style=\"font-family:仿宋_GB2312\">周岁及以下。</span></span></p><p style=\"text-indent:43px\"><span style=\";font-family:仿宋_GB2312;font-size:21px\">2026年应届高校毕业生及2年择业期内高校毕业生</span></p><p style=\"text-indent:43px;line-height:37px\"><strong><span style=\"font-family: &#39;Times New Roman&#39;;font-size: 21px\"><span style=\"font-family:仿宋_GB2312\">招录程序：</span></span></strong><span style=\";font-family:&#39;Times New Roman&#39;;font-size:21px\"><span style=\"font-family:仿宋_GB2312\">组织推荐、笔试、面试、体检、考察、确定人选等。</span></span></p><p style=\"text-indent:43px\"><strong><span style=\"font-family: 仿宋_GB2312;font-size: 21px\">报考地州及兵团：</span></strong><span style=\";font-family:仿宋_GB2312;font-size:21px\">克州，阿克苏，喀什，和田、兵团（第一师、第二师、第三师、第十四师、草湖项目区）</span></p><p style=\"text-indent:43px\"><strong><span style=\"font-family: 仿宋_GB2312;font-size: 21px\">联系方式：</span></strong></p><p style=\"text-indent:43px\"><span style=\";font-family:仿宋_GB2312;font-size:21px\"><span style=\"font-family:仿宋_GB2312\">克州：邓老师（</span><span style=\"font-family:仿宋_GB2312\">17612728969，微信号18094991787）</span></span></p><p style=\"text-indent:43px\"><span style=\";font-family:仿宋_GB2312;font-size:21px\"><span style=\"font-family:仿宋_GB2312\">阿克苏：葛老师（</span><span style=\"font-family:仿宋_GB2312\">18199099512 微信同号）</span></span></p><p style=\"text-indent:43px\"><span style=\";font-family:仿宋_GB2312;font-size:21px\"><span style=\"font-family:仿宋_GB2312\">喀什：杨老师（</span><span style=\"font-family:仿宋_GB2312\">18809981720微信同号）</span></span></p><p style=\"text-indent:43px\"><span style=\";font-family:仿宋_GB2312;font-size:21px\"><span style=\"font-family:仿宋_GB2312\">和田：谢老师（</span><span style=\"font-family:仿宋_GB2312\">18719955518微信同号）</span></span></p><p style=\"text-indent:43px\"><span style=\";font-family:仿宋_GB2312;font-size:21px\"><span style=\"font-family:仿宋_GB2312\">兵团（草湖）：郭老师（</span><span style=\"font-family:仿宋_GB2312\">18703560820微信同号）</span></span></p><p style=\"text-indent:43px\"><span style=\";font-family:仿宋_GB2312;font-size:21px\"><span style=\"font-family:仿宋_GB2312\">兵团（第一师）：李老师（</span><span style=\"font-family:仿宋_GB2312\">14719985666微信同号）</span></span></p><p style=\"text-indent:43px\"><span style=\";font-family:仿宋_GB2312;font-size:21px\"><span style=\"font-family:仿宋_GB2312\">兵团（第十四师）：张老师（</span><span style=\"font-family:仿宋_GB2312\">18197710270微信同号）</span></span></p><p><br/></p>",
    "preachPerson": null,
    "state": "1",
    "stateContent": null,
    "hits": 94,
    "positionIds": null,
    "positionNames": null,
    "invalid": 0,
    "pushList": null,
    "pushFlag": null,
    "emailFlag": "1",
    "createBy": 173554,
    "workerState": null,
    "workerStateContent": null,
    "leaderAttend": null,
    "licenseNumber": null,
    "approachedImg": null,
    "carState": null,
    "createTime": "2026-05-15 13:20",
    "updateTime": "2026/05/15 13:20:08",
    "deleted": 0,
    "holdAddress": "文潭楼一楼招聘厅",
    "listPosition": null,
    "oldId": null,
    "attachmentList": [
        {
            "id": 30592,
            "type": 2,
            "businessId": 6453,
            "name": "新疆公务员报名推荐表.doc",
            "ext": null,
            "path": null,
            "url": "https://jyzx.zuel.edu.cn:9000/zuel/preach/2026/05/15/e080f9465aa24ede8633f8c88610a710.doc",
            "size": "41984",
            "createBy": null,
            "createTime": "2026/05/15 13:20:08",
            "updateTime": "2026/05/15 13:20:08",
            "deleted": 0,
            "oldId": null
        }
    ],
    "abilityFlag": null,
    "abilityContent": null,
    "approachedImgPreview": null,
    "dataField": "文潭楼一楼招聘厅, 2026-05-20 14:00:01 - 2026-05-20 15:00:00",
    "headCount": null
}
```

### 字段映射

| API字段          | JobData字段     | 处理方式    |
| -------------- | ------------- | ------- |
| title          | title         | 直接映射    |
| companyName    | company       | 直接映射    |
| area           | location      | 直接映射    |
| salary         | salary        | 直接映射    |
| createTime     | publish\_date | 日期格式化   |
| education      | education     | 直接映射    |
| majors         | description   | 专业要求    |
| nature         | industry      | 直接映射    |
| companyContent | description   | HTML转文本 |

### 爬取策略

1. 分全职(type=1)和实习(type=2)两类爬取
2. 详情页并发获取，并发数 `detail_concurrency=8`
3. 列表API优先取 `createTime`，详情API为空时回退

***

## 公共组件

### 数据库表结构

```sql
CREATE TABLE jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    location TEXT DEFAULT '',
    salary TEXT DEFAULT '面议',
    description TEXT DEFAULT '',
    requirements TEXT DEFAULT '',
    job_type TEXT DEFAULT '实习',
    industry TEXT DEFAULT '',
    education TEXT DEFAULT '',
    experience TEXT DEFAULT '',
    source TEXT DEFAULT '',
    university TEXT DEFAULT '',
    source_url TEXT UNIQUE,
    apply_url TEXT DEFAULT '',
    publish_date TEXT DEFAULT '',
    deadline TEXT DEFAULT '',
    category TEXT DEFAULT '',
    tags TEXT DEFAULT '',
    is_favorite INTEGER DEFAULT 0,
    is_read INTEGER DEFAULT 0,
    content_hash TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 工具函数

| 函数                                 | 说明                  |
| ---------------------------------- | ------------------- |
| `normalize_publish_date(date_str)` | 统一日期格式为 YYYY-MM-DD  |
| `clean_company_name(raw)`          | 清洗公司名后缀（招聘简章、校园招聘等） |
| `truncate_text(text, max_len)`     | 截断文本到指定长度           |
| `extract_salary(low, high, unit)`  | 格式化薪资字符串            |

### 运行命令

```bash
# 运行所有爬虫
python3 run_spiders.py

# 运行指定爬虫
python3 run_spiders.py --sources sufe zuel swufe

# 限制每个源最多爬10条
python3 run_spiders.py --max-items 10

# 显示浏览器窗口
python3 run_spiders.py --no-headless

# 列出所有数据源
python3 run_spiders.py --list-sources
```

***

## 数据源爬取方式总结

| 数据源          | 爬取方式          | 是否可直接调用API | 说明                             |
| ------------ | ------------- | ---------- | ------------------------------ |
| **SmartEdu** | HTTP GET API  | ✅ 是        | 列表API可直接调用，需检测匿名访问限制           |
| **SUFE**     | HTTP POST API | ✅ 是        | 列表和详情API均可直接调用                 |
| **CUFE**     | HTTP POST API | ⚠️ 部分可用    | API可调用但可能需要先访问首页获取Cookie       |
| **DUFE**     | HTTP POST API | ⚠️ 部分可用    | 与CUFE相同，可能需要Cookie             |
| **UIBE**     | 浏览器+加密        | ❌ 否        | 数据加密，需通过浏览器调用window\.decrypt() |
| **SWUFE**    | HTTP HTML     | ✅ 是        | 直接URL遍历，bs4解析HTML              |
| **JXUFE**    | 浏览器           | ❌ 否        | JS动态渲染，需Playwright             |
| **NEU**      | 浏览器           | ❌ 否        | JS动态渲染，需Playwright             |
| **ZUEL**     | HTTP GET API  | ✅ 是        | 列表和详情API均可直接调用                 |

### 推荐爬取方式

**可直接调用API的数据源 (5个)**:

- SmartEdu、SUFE、SWUFE、ZUEL - 使用 `BaseSpider` 或 `BaseAPISpider`
- CUFE/DUFE - 使用 `SamePlatformSpider`，初始化时先访问首页

**需要浏览器的数据源 (4个)**:

- UIBE - 使用 `BaseBrowserSpider`，需处理加密数据
- JXUFE、NEU - 使用 `BaseBrowserSpider`，等待JS渲染

