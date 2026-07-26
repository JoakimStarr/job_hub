# 新增东北电力大学（NEEPU）数据源 Spec

## Why
为扩展高校招聘信息覆盖范围，新增东北电力大学就业网（`jy.neepu.edu.cn`）作为 lite_crawler 的数据源。该校就业网提供在线招聘信息列表 API 和详情页，可通过纯 HTTP 方式爬取，无需浏览器渲染。

## What Changes
- 在 `lite_crawler.py` 的 `HTTP_SOURCES` 中添加 `neepu` 配置（GET API 类型）
- 新增 `crawl_neepu()` 函数：参照 `crawl_cueb` 模式，列表 API + 详情页抓取
- 新增 `_parse_neepu_detail_page()` 解析函数：用 XPath 提取 `div.mian-inner` 内容，并用正则提取联系方式
- 在 `crawl_source()` 中添加 `elif source == "neepu":` 分派分支
- 更新文件头部注释（第 8 行）中的数据源列表，加入 neepu
- 更新 `package.json` 与 `package-lock.json` 版本号（minor 升级，新增功能）

## Impact
- Affected specs: 无（新独立数据源，不修改其他爬虫逻辑）
- Affected code:
  - `lite_crawler.py`（新增配置 + 爬虫函数 + 解析函数 + 分派分支 + 头注释）
  - `package.json` / `package-lock.json`（版本号统一升级）
- 数据库 schema：无变更（沿用现有 `jobs` 表结构）

## ADDED Requirements

### Requirement: NEEPU 数据源配置
系统 SHALL 在 `HTTP_SOURCES` 字典中维护 `neepu` 配置项，包含：
- `name`: "东北电力大学"
- `base_url`: "https://jy.neepu.edu.cn"
- `list_api`: "https://jy.neepu.edu.cn/module/getonlines"
- `detail_url_pattern`: "https://jy.neepu.edu.cn/detail/online?id={recruitment_id}&menu_id=36793"
- `page_size`: 15（与 API `count` 参数一致）
- `max_pages`: 20（与全局 `MAX_PAGES = 20` 一致，用户明确要求"最长 20 页每次爬取"）
- `menu_id`: "36793"（用户明确要求"menu_id=36793 不动"）
- `location`: "吉林"（东北电力大学位于吉林市）

#### Scenario: 配置正确加载
- **WHEN** 运行 `python lite_crawler.py --list-sources`
- **THEN** 输出中包含 `neepu` 项及其名称 "东北电力大学"

### Requirement: NEEPU 列表 API 增量爬取
系统 SHALL 通过 GET 请求 `https://jy.neepu.edu.cn/module/getonlines` 获取招聘列表，分页参数为 `start_page`（从 1 开始），每页 `count=15` 条。

#### Scenario: 正常分页爬取
- **WHEN** 调用 `crawl_neepu()` 且未达到 `max_items` 与 `MAX_PAGES`
- **THEN** 系统按 `start_page=1,2,3,...` 顺序请求列表 API
- **AND** 从响应 JSON 的 `data` 数组中提取每条记录的 `recruitment_id`
- **AND** 用 `recruitment_id` 构造详情页 URL：`https://jy.neepu.edu.cn/detail/online?id={recruitment_id}&menu_id=36793`

#### Scenario: 增量去重停止
- **WHEN** 某一页所有详情页 URL 都已存在于数据库（`url_exists()` 返回 True）
- **THEN** 停止爬取该板块，记录日志 "第 N 页所有 URL 已存在，停止爬取"

#### Scenario: 达到最大页数
- **WHEN** 已爬取页数达到 `MAX_PAGES = 20`
- **THEN** 停止爬取，记录日志

### Requirement: NEEPU 详情页解析
系统 SHALL 通过 `fetch_with_retry()` 获取详情页 HTML，并用 XPath 提取 `div.mian-inner` 节点的文本内容作为岗位描述主体。

#### Scenario: 成功解析详情页
- **WHEN** 详情页 HTTP 200 返回且包含 `div.mian-inner` 节点
- **THEN** 提取该节点文本作为 `description`
- **AND** 用正则从详情页 HTML 中提取邮箱、电话、联系人等联系方式
- **AND** 拼接为完整描述：`【信息】浏览量等 + 【联系方式】+ 【岗位要求】+ 主体描述`（联系方式前置以避免被 truncate_text 截断丢失）

#### Scenario: 详情页获取失败
- **WHEN** 详情页请求失败或解析异常
- **THEN** 跳过该条记录，记录错误日志，继续下一条

### Requirement: 联系方式正则提取
系统 SHALL 复用现有 `_extract_email_from_text` 与 `_extract_phone_from_text` 函数，并参照 `_parse_cueb_detail_page` 的 `contact_patterns` 列表，从 NEEPU 详情页 HTML 中提取：
- 邮箱（`[\w.+-]+@[\w-]+\.[\w.-]+`）
- 电话（`(\d{3,4}[-\s]?\d{7,8})` 或 `(1[3-9]\d{9})`）
- 联系人（`联系人[：:]\s*(\S+)`）

#### Scenario: 提取到联系方式
- **WHEN** 详情页 HTML 中匹配到邮箱或电话
- **THEN** 将其加入 `contact_info` 列表，格式为 "联系邮箱：xxx" / "联系电话：xxx"
- **AND** 在描述中追加 `【联系方式】` 段落（位于【信息】之后，避免被 truncate_text 截断丢失）

### Requirement: 调度分派
系统 SHALL 在 `crawl_source()` 函数中添加 `elif source == "neepu":` 分支，调用 `crawl_neepu(source_config, max_items)`。

#### Scenario: 通过命令行运行
- **WHEN** 执行 `python lite_crawler.py --sources neepu --max-items 5`
- **THEN** 系统正确爬取最多 5 条 NEEPU 岗位并入库
- **AND** 日志中显示 "▶ 爬取东北电力大学" 与 "✅ 完成"

### Requirement: 版本号统一升级
按工作区规则 `版本号.md`，系统 SHALL 在 `package.json` 与 `package-lock.json` 中同步升级版本号（minor 版本 +1，如 v1.x.y → v1.(x+1).0），并以 `package.json` 为准。

#### Scenario: 版本号一致
- **WHEN** 实现完成
- **THEN** `package.json` 的 `version` 字段与 `package-lock.json` 的 `version` 字段完全一致
- **AND** Git 提交信息格式为 `v1.x.0 新增东北电力大学(NEEPU)数据源`

## MODIFIED Requirements

### Requirement: 文件头部注释数据源列表
`lite_crawler.py` 第 8 行注释 SHALL 更新为包含 neepu 的完整数据源列表。

## REMOVED Requirements
无（不删除任何现有功能）

## 技术方案要点

### `crawl_neepu()` 函数签名
```python
def crawl_neepu(source_config: Dict, max_items: int = 0) -> Iterator[Dict]:
    """爬取 NEEPU - 东北电力大学（基于URL去重的增量爬取）
    
    增量策略：
    - GET 请求列表 API，分页参数 start_page（从 1 开始）
    - 每页 count=15 条
    - 用 detail_url_pattern 构造去重 URL
    - 每页检查所有 URL 是否已存在，全部存在则停止
    - 最多爬取 MAX_PAGES=20 页
    """
```

### `_parse_neepu_detail_page()` 函数签名
```python
def _parse_neepu_detail_page(html_content: str, item_data: Dict, job_type: str = "全职") -> Dict:
    """NEEPU 详情页专用解析函数
    
    详情页结构：
    - div.mian-inner - 岗位描述主体（注意拼写为 mian-inner，按用户原话）
    
    解析内容：
    - title: 从 item_data 提取（列表 API 字段）
    - description: div.mian-inner 文本
    - contact_info: 邮箱、电话、联系人（正则提取）
    - salary/education: 从 HTML 中正则匹配
    """
```

### 字段映射（已通过 Task 1 调研确认）
列表 API 返回 JSON：`{"code":1, "msg":"", "data":[{...}]}`，data 数组中每条记录字段如下：

| 目标字段 | 来源 | API/HTML 字段 | 示例 |
| --- | --- | --- | --- |
| title | 列表 API | `title` | "山东泰开电力电子有限公司 2027 届校园招聘简章" |
| company | 列表 API | `company_name` | "山东泰开电力电子有限公司" |
| location | 列表 API | `work_city` | "山东省,泰安市,全国" |
| publish_date | 列表 API | `create_time` | "2026-07-09" |
| job_type | 列表 API | `recruit_type` | "正式招聘" / "实习招聘" |
| education | 列表 API | `is_above_bachelor_degree`/`is_above_master_degree`/`is_above_doctor_degree` | "0"/"1" 标志位 |
| requirements | 列表 API | `professionals` | "机械工程,电气类,..." |
| recruit_count | 列表 API | `recruitment_num` | "0" |
| view_count | 列表 API | `view_count` | "293" |
| preview | 列表 API | `content` | 前 N 字预览 |
| source_url | 构造 URL | detail_url_pattern | `https://jy.neepu.edu.cn/detail/online?id={recruitment_id}&menu_id=36793` |
| description | 详情页 | `div.mian-inner` 文本 | 1682 字符完整内容 |
| contact_info | 详情页 HTML 正则 | 邮箱/电话/联系人 | - |
| source | 常量 | - | "neepu" |
| university | 常量 | - | "东北电力大学" |

**详情页结构确认**：
- `div.mian-inner`（拼写确实为 mian-inner，是网站本身的拼写，按用户原话保留）
- 内含 `div.details-head`（标题+日期+点击数）+ `div.details-content`（正文）
- 整体提取 `div.mian-inner` 即可获得完整描述

**访问确认**：
- 列表 API 与详情页均无需 Referer/Cookie，纯 GET 即可
- 详情页 HTML 约 36KB，`div.mian-inner` 内文本约 1682 字符

## 调研要点（Task 1）
实际访问以下 URL 确认：
1. `https://jy.neepu.edu.cn/module/getonlines?start_page=1&k=&recruit_type=&panel_id=&professionals=&work_city=&company_property=&company_industry=&count=15&start=1&_=1785041618420`
   - 是否需要 Referer/Cookie？
   - 返回 JSON 的实际字段名（`data` 中的对象结构）
2. `https://jy.neepu.edu.cn/detail/online?id={recruitment_id}&menu_id=36793`
   - 是否需要 Referer/Cookie？
   - `div.mian-inner` 是否存在？包含哪些子结构？
   - 列表 API 的字段能否与详情页字段互补？
