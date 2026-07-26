## Phase 1: 核心改动
- [x] jobs 表 schema 包含 contact_email、contact_phone、contact_person 三列（新库直接创建，旧库 ALTER TABLE 迁移）
- [x] 用旧 jobs.db（无新列）启动时，init_database 能安全添加 3 列不报错
- [x] 模块级存在 `CONTACT_PATTERNS` 常量，包含邮箱/电话/手机/联系人 4 类正则
- [x] 存在 `_extract_contact_info(html_content)` 函数，返回 `{"email":"","phone":"","person":"","info_list":[]}`
- [x] `_extract_contact_info` 每类只取第一个匹配（无重复）
- [x] `insert_job` 的 UPDATE 语句包含 contact_email、contact_phone、contact_person 三个字段
- [x] `insert_job` 的 INSERT 语句包含 contact_email、contact_phone、contact_person 三个字段
- [x] 模块级存在 `DEFAULT_MAX_DESCRIPTION_LEN = 500` 和 `UNIVERSITY_MAX_DESCRIPTION_LEN = 1500` 常量
- [x] 13 处 `truncate_text(...)` 调用改为从 source_config 读取 max_description_len
- [x] 高校类源配置含 `max_description_len: 1500`
- [x] 互联网类源配置含 `max_description_len: 800`

## Phase 2: 爬虫重构
- [x] 存在 `_fetch_detail_and_parse()` helper 函数，封装 fetch+parse+sleep+异常处理
- [x] crawl_cueb 调用 _fetch_detail_and_parse 处理详情页
- [x] crawl_neepu 调用 _fetch_detail_and_parse 处理详情页
- [x] crawl_zjgsu 调用 _fetch_detail_and_parse 处理详情页
- [x] 重构后 crawl_neepu --max-items 3 仍能正常入库

## Phase 3: 代码质量
- [x] `_parse_cueb_detail_page` 不再内联 `contact_patterns`，改为调用 `_extract_contact_info()`
- [x] `_parse_neepu_detail_page` 不再内联 `contact_patterns`，改为调用 `_extract_contact_info()`
- [x] `_parse_zjgsu_detail_page` 不再内联 `contact_patterns`，改为调用 `_extract_contact_info()`
- [x] 3 个解析函数返回值含 contact_email/contact_phone/contact_person 字段
- [x] crawl_cueb/crawl_neepu/crawl_zjgsu 构造 job dict 时包含 contact_email/contact_phone/contact_person
- [x] `_extract_email_from_text` 内部复用 CONTACT_PATTERNS（无正则重复）
- [x] `_extract_phone_from_text` 内部复用 CONTACT_PATTERNS（无正则重复）

## Phase 4: 端到端验证
- [x] `python3 lite_crawler.py --list-sources` 正常列出所有数据源
- [x] `python3 lite_crawler.py --sources neepu --max-items 3` 成功爬取 3 条
- [x] 新记录的 contact_email 字段有值（如 tkhr@taikaipower.com）
- [x] 新记录的 contact_phone 字段有值（如 18753840669）
- [x] 新记录的 description 长度 > 500（确认 1500 截断生效）—— 实测 1503 字符
- [x] `python3 lite_crawler.py --sources cufe --max-items 1` CUEB 未受影响（爬虫正常，0 条因过期过滤）
- [x] 用旧 jobs.db 启动时 ALTER TABLE 迁移成功，旧数据不丢失
- [x] `package.json` version 为 8.51.0
- [x] `package-lock.json` version 为 8.51.0（两处：顶部和 packages."".version）
- [x] Git 提交信息格式为 `v8.51.0 优化描述截断与联系方式独立列存储`
