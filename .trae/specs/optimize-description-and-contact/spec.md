# 描述截断与联系方式优化 Spec

## Why
当前 `truncate_text(text, max_len=500)` 对所有数据源统一截断到 500 字，导致高校类爬虫（如 NEEPU 详情页 8461 字）的关键信息丢失。同时联系方式散落在 description 文本中，无法直接查询/过滤。本 spec 通过可配置截断长度 + 联系方式独立列 + 正则统一维护，提升数据完整性与可查询性。

## What Changes
- **数据库 schema**：jobs 表新增 `contact_email`、`contact_phone`、`contact_person` 三列（向后兼容，ALTER TABLE）
- **截断策略**：`HTTP_SOURCES` 各源新增 `max_description_len` 字段（默认 500，高校类 1500）；`truncate_text` 调用点改为传入 source_config 中的值
- **联系方式正则统一**：将 3 处重复的 `contact_patterns` 列表抽到模块级常量 `CONTACT_PATTERNS`，新增 `_extract_contact_info(html_content)` 统一入口函数
- **insert_job 扩展**：UPDATE/INSERT 语句同步处理 3 个新字段
- **爬虫重构**：抽取 `_fetch_detail_and_parse()` 通用 helper，供 crawl_cueb/crawl_neepu/crawl_zjgsu 复用（减少约 60 行重复代码）
- **代码质量小优化**：`_extract_email_from_text`/`_extract_phone_from_text` 与新 `CONTACT_PATTERNS` 对齐，消除历史冗余
- **版本号**：minor +1（8.50.0 → 8.51.0）

## Impact
- Affected specs: `add-neepu-source`（NEEPU 的 description 拼接顺序保持，但 truncate 长度从 500 → 1500）
- Affected code:
  - `lite_crawler.py`（数据库 schema、insert_job、truncate_text 调用、contact_patterns、3 个爬虫函数、helper 抽取）
  - `package.json` / `package-lock.json`（版本号同步）
- **向后兼容**：ALTER TABLE ADD COLUMN 默认值为 ''，旧数据不受影响；前端无需改动（新字段为可选展示）

## ADDED Requirements

### Requirement: 可配置的描述截断长度
系统 SHALL 在 `HTTP_SOURCES` 各源配置中支持 `max_description_len` 字段（int，默认 500），用于控制该源 description 字段的最大长度。

#### Scenario: 高校源使用 1500 字
- **WHEN** 爬取 neepu/cueb/zjgsu 等高校源且 source_config 含 `max_description_len: 1500`
- **THEN** `truncate_text(full_description, max_len=1500)` 截断到 1500 字
- **AND** 【信息】+【联系方式】+【岗位要求】+主体描述 仍按既定顺序拼接

#### Scenario: 默认 500 字
- **WHEN** source_config 未指定 `max_description_len`
- **THEN** 使用默认值 500（与现状一致，向后兼容）

### Requirement: 联系方式独立列存储
系统 SHALL 在 jobs 表中新增 3 列：`contact_email`、`contact_phone`、`contact_person`（均为 TEXT，默认 ''），并通过 `ALTER TABLE ADD COLUMN` 安全迁移。

#### Scenario: 新数据写入独立列
- **WHEN** 爬虫提取到邮箱 `tkhr@taikaipower.com` 和电话 `18753840669`
- **THEN** `insert_job` 将其分别写入 `contact_email` 和 `contact_phone` 列
- **AND** description 中仍保留【联系方式】段（兼容现有展示）

#### Scenario: 旧数据迁移
- **WHEN** 数据库已存在且无 contact_email 列
- **THEN** `init_database` 执行 `ALTER TABLE jobs ADD COLUMN contact_email TEXT DEFAULT ''`（SQLite 安全添加，不丢数据）
- **AND** 旧记录的 contact_email/phone/person 为空字符串

### Requirement: 联系方式正则统一维护
系统 SHALL 在模块级定义 `CONTACT_PATTERNS` 常量（list of (pattern, label)），并新增 `_extract_contact_info(html_content: str) -> Dict[str, str]` 函数，返回 `{"email": "", "phone": "", "person": "", "info_list": []}`。

#### Scenario: 统一调用
- **WHEN** CUEB/NEEPU/zjgsu 详情页解析函数需要提取联系方式
- **THEN** 调用 `_extract_contact_info(html_content)` 而非各自定义 `contact_patterns` 列表
- **AND** 返回的 `info_list` 用于 description 拼接，`email`/`phone`/`person` 用于独立列入库

#### Scenario: 提取规则
- **AND** 正则模式覆盖：邮箱 `[\w.+-]+@[\w-]+\.[\w.-]+`、电话 `\d{3,4}[-\s]?\d{7,8}`、手机 `1[3-9]\d{9}`、联系人 `联系人[：:]\s*(\S+)`
- **AND** 每个类别只取第一个匹配（避免重复）

## MODIFIED Requirements

### Requirement: insert_job 函数
`insert_job` SHALL 在 UPDATE 和 INSERT 语句中处理 `contact_email`、`contact_phone`、`contact_person` 三个新字段，从 job dict 的对应 key 读取（缺失时为 ''）。

#### Scenario: INSERT 新记录
- **WHEN** 调用 `insert_job(job)` 且 job 含 `contact_email="a@b.com"`
- **THEN** INSERT 语句包含 contact_email 列
- **AND** 值为 "a@b.com"

#### Scenario: UPDATE 覆盖记录
- **WHEN** OVERWRITE_MODE 且 url 已存在
- **THEN** UPDATE 语句 SET contact_email=?, contact_phone=?, contact_person=?

### Requirement: truncate_text 调用点
所有 13 处 `truncate_text(...)` 调用 SHALL 改为 `truncate_text(text, max_len=source_config.get("max_description_len", 500))`，从 source_config 读取长度。

#### Scenario: 高校爬虫调用
- **WHEN** crawl_neepu 调用 truncate_text
- **THEN** max_len 来自 `source_config.get("max_description_len", 500)`（NEEPU 配置为 1500）

### Requirement: HTTP_SOURCES 配置
所有高校类源（sufe/zuel/cufe/dufe/swufe/zjgsu/cueb/btbu/neepu/zufe/nau/nufe/tjufe/jxufe/gdufe）SHALL 在配置中添加 `max_description_len: 1500`；互联网类源（tencent/bytedance/mohrss/yingjiesheng/yunjiuye）保持默认 500 或显式设为 800。

## REMOVED Requirements
无（不删除现有功能，仅重构内部实现）

## 技术方案

### Phase 1: 核心改动（必做）
1. 数据库迁移：`init_database` 中检测并 ALTER TABLE 添加 3 列
2. 模块级常量：`CONTACT_PATTERNS = [...]` + `_extract_contact_info()` 函数
3. `insert_job` 扩展：UPDATE/INSERT 添加 3 字段
4. `truncate_text` 调用点：13 处改为读 source_config
5. HTTP_SOURCES 各源添加 `max_description_len`

### Phase 2: 爬虫重构（中风险）
抽取 `_fetch_detail_and_parse(detail_url, item_data, parser_func, source_config, headers=None) -> Optional[Dict]` helper，封装"获取详情页+解析+构造job字典+sleep"逻辑，供 crawl_cueb/crawl_neepu/crawl_zjgsu 复用。

**注意**：3 个爬虫的字段映射差异较大，helper 只封装公共部分（fetch+sleep+异常处理），字段映射仍由各爬虫自行处理。

### Phase 3: 代码质量小优化（低风险）
- 删除 `_parse_cueb_detail_page`/`_parse_neepu_detail_page`/`_parse_zjgsu_detail_page` 中的内联 `contact_patterns`，统一调用 `_extract_contact_info()`
- `_extract_email_from_text`/`_extract_phone_from_text` 内部改为调用 `CONTACT_PATTERNS`，消除正则重复
- 添加模块级常量 `DEFAULT_MAX_DESCRIPTION_LEN = 500`、`UNIVERSITY_MAX_DESCRIPTION_LEN = 1500`

## 不在本次范围
- 不重构 crawl_sufe/crawl_zuel 等非"列表+详情页"模式的爬虫
- 不修改前端展示逻辑（新字段为可选展示，前端可后续迭代）
- 不修改 API 接口（新字段通过现有 /api/jobs 自动返回）
- 不做全文代码格式化或重命名（避免巨大 diff）
