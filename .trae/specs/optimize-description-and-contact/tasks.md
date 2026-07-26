# Tasks

## Phase 1: 核心改动（必做）

- [x] Task 1: 数据库 schema 迁移
  - [x] SubTask 1.1: 在 `init_database()` 函数（约 1057 行）的 CREATE TABLE 语句中添加 `contact_email TEXT DEFAULT ''`、`contact_phone TEXT DEFAULT ''`、`contact_person TEXT DEFAULT ''` 三列（新库直接创建）
  - [x] SubTask 1.2: 在 CREATE TABLE 之后添加迁移逻辑：用 `PRAGMA table_info(jobs)` 检测列是否存在，不存在则 `ALTER TABLE jobs ADD COLUMN ...`（兼容旧库）
  - [x] SubTask 1.3: 验证：删除 jobs.db 后重新初始化 + 用旧 jobs.db 初始化，两种场景都正常

- [x] Task 2: 模块级 CONTACT_PATTERNS 常量与 _extract_contact_info() 函数
  - [x] SubTask 2.1: 在 `_extract_salary_from_text` 函数（约 2189 行）之前添加模块级常量 `CONTACT_PATTERNS = [...]`，整合 3 处重复的正则（2366/2444/2529 行）
  - [x] SubTask 2.2: 在常量之后添加 `_extract_contact_info(html_content: str) -> Dict[str, Any]` 函数，返回 `{"email": "", "phone": "", "person": "", "info_list": []}`，每类只取第一个匹配
  - [x] SubTask 2.3: 正则覆盖：邮箱 `[\w.+-]+@[\w-]+\.[\w.-]+`、电话 `\d{3,4}[-\s]?\d{7,8}`、手机 `1[3-9]\d{9}`、联系人 `联系人[：:]\s*(\S+)`
  - [x] SubTask 2.4: info_list 格式为 `["联系邮箱：xxx", "联系电话：xxx", "联系人：xxx"]`，供 description 拼接用

- [x] Task 3: insert_job 扩展 3 个新字段
  - [x] SubTask 3.1: 修改 `insert_job`（约 1212 行）的 UPDATE 语句，SET 子句添加 `contact_email=?, contact_phone=?, contact_person=?`，参数从 `job.get("contact_email", "")` 等读取
  - [x] SubTask 3.2: 修改 INSERT 语句，列名和 VALUES 添加 3 个字段，参数同上
  - [x] SubTask 3.3: 验证：构造含 contact_email 的 job dict 调用 insert_job，确认入库

- [x] Task 4: truncate_text 调用点改为读 source_config
  - [x] SubTask 4.1: 在模块级添加常量 `DEFAULT_MAX_DESCRIPTION_LEN = 500`、`UNIVERSITY_MAX_DESCRIPTION_LEN = 1500`
  - [x] SubTask 4.2: 修改 13 处 `truncate_text(...)` 调用（行号：1511/1695/1908/2759/2968/3167/3582/3788/4180/4460/4752/5009），改为 `truncate_text(text, max_len=source_config.get("max_description_len", DEFAULT_MAX_DESCRIPTION_LEN))`
  - [x] SubTask 4.3: 对于无法直接访问 source_config 的调用点（如 _parse_*_detail_page 内部），由调用方（crawl_*）传入 max_len 或在调用 truncate_text 时传入

- [x] Task 5: HTTP_SOURCES 各源添加 max_description_len
  - [x] SubTask 5.1: 高校类源（sufe/zuel/cufe/dufe/swufe/zjgsu/cueb/btbu/neepu/zufe/nau/nufe/tjufe/jxufe/gdufe）添加 `"max_description_len": 1500`
  - [x] SubTask 5.2: 互联网类源（tencent/bytedance/mohrss/yingjiesheng/yunjiuye）添加 `"max_description_len": 800`（略高于默认，因互联网 JD 较长）

## Phase 2: 爬虫重构（中风险）

- [x] Task 6: 抽取 _fetch_detail_and_parse() helper
  - [x] SubTask 6.1: 在 `crawl_neepu` 函数（约 3004 行）之前添加 `_fetch_detail_and_parse(detail_url, item_data, parser_func, source_config, headers=None, job_type="全职") -> Optional[Dict]` 函数
  - [x] SubTask 6.2: 函数封装：fetch_with_retry → parser_func → time.sleep(DETAIL_DELAY) → 异常处理，返回 parsed dict 或 None
  - [x] SubTask 6.3: 修改 crawl_cueb/crawl_neepu/crawl_zjgsu 中的详情页处理循环，改为调用 _fetch_detail_and_parse
  - [x] SubTask 6.4: 验证：crawl_neepu --max-items 3 仍正常入库（与 Phase 1 后行为一致）

## Phase 3: 代码质量小优化（低风险）

- [x] Task 7: 详情页解析函数统一调用 _extract_contact_info()
  - [x] SubTask 7.1: 修改 `_parse_cueb_detail_page`（约 2366 行）：删除内联 `contact_patterns`，改为 `contact_data = _extract_contact_info(html_content); contact_info = contact_data["info_list"]`
  - [x] SubTask 7.2: 修改 `_parse_neepu_detail_page`（约 2529 行）：同上
  - [x] SubTask 7.3: 修改 `_parse_zjgsu_detail_page`（约 2444 行）：同上
  - [x] SubTask 7.4: 各解析函数返回值添加 `contact_email`/`contact_phone`/`contact_person` 字段，供 crawl_* 入库用

- [x] Task 8: crawl_* 函数将联系方式写入 job dict
  - [x] SubTask 8.1: 修改 crawl_cueb/crawl_neepu/crawl_zjgsu 构造 job dict 时，从 parsed 添加 `contact_email`/`contact_phone`/`contact_person`
  - [x] SubTask 8.2: 其他爬虫（crawl_sufe/crawl_zuel 等）若已提取邮箱/电话，也写入对应字段（如 crawl_91job 第 2716 行的 contact_email）

- [x] Task 9: _extract_email_from_text / _extract_phone_from_text 对齐 CONTACT_PATTERNS
  - [x] SubTask 9.1: 修改 `_extract_email_from_text`（约 3284 行）和 `_extract_phone_from_text`（约 3290 行）内部实现，复用 CONTACT_PATTERNS 中的正则，消除重复
  - [x] SubTask 9.2: 保持函数签名不变（向后兼容）

## Phase 4: 验证与发布

- [x] Task 10: 端到端验证
  - [x] SubTask 10.1: 运行 `python3 lite_crawler.py --list-sources`，确认所有源正常列出
  - [x] SubTask 10.2: 删除 jobs.db 中 neepu 记录后，运行 `python3 lite_crawler.py --sources neepu --max-items 3`，确认入库 3 条
  - [x] SubTask 10.3: 用 sqlite3 检查新记录的 contact_email/contact_phone/contact_person 字段有值
  - [x] SubTask 10.4: 检查 description 长度 > 500（确认 1500 截断生效）—— 实测 1503 字符（1500+3"..."）
  - [x] SubTask 10.5: 运行 `python3 lite_crawler.py --sources cufe --max-items 1`，确认 CUEB 未受影响（爬虫正常，0 条因过期过滤）
  - [x] SubTask 10.6: 用旧 jobs.db（无新列）启动，确认 ALTER TABLE 迁移成功

- [x] Task 11: 版本号升级与 Git 提交
  - [x] SubTask 11.1: package.json 与 package-lock.json 版本号 8.50.0 → 8.51.0（minor +1）
  - [x] SubTask 11.2: Git 提交，commit message: `v8.51.0 优化描述截断与联系方式独立列存储`

# Task Dependencies
- [Task 2] 无依赖（可先做）
- [Task 1] 无依赖（可先做）
- [Task 3] depends on [Task 1]（需先有新列才能写入）
- [Task 4] depends on [Task 5]（需先有配置才能读取）—— 也可同时做，默认值兜底
- [Task 5] 无依赖
- [Task 6] depends on [Task 4]（truncate 改造完成后再重构）
- [Task 7] depends on [Task 2]（需先有 _extract_contact_info）
- [Task 8] depends on [Task 3, Task 7]（需 insert_job 支持 + 解析函数返回新字段）
- [Task 9] depends on [Task 2]
- [Task 10] depends on [所有前置 Task]
- [Task 11] depends on [Task 10]

# 并行机会
- Phase 1 中 Task 1/2/5 可并行
- Phase 3 中 Task 7/8/9 部分可并行（同文件需串行 Edit）
- Phase 2 Task 6 与 Phase 3 Task 7/8 有交叉，建议串行

# 风险与回滚
- **Task 1 风险**：ALTER TABLE 在 SQLite 中是安全的（不锁表），但需用 PRAGMA 检测列存在性避免重复添加
- **Task 4 风险**：13 处调用点修改面广，需逐个确认 source_config 可访问；对于 _parse_*_detail_page 内部不访问 source_config 的情况，由调用方传入 max_len
- **Task 6 风险**：重构 crawl_cueb/crawl_neepu/crawl_zjgsu 可能引入回归，必须用 `--max-items 3` 端到端验证
- **回滚**：所有改动通过 Git 可回滚；数据库迁移不可逆（新增列不会删除），但向后兼容（旧代码忽略新列）
