# Tasks

- [x] Task 1: 调研 NEEPU 就业网 API 与详情页结构
  - [x] SubTask 1.1: 用 `curl` 或 Python 实际访问列表 API `https://jy.neepu.edu.cn/module/getonlines?start_page=1&k=&recruit_type=&panel_id=&professionals=&work_city=&company_property=&company_industry=&count=15&start=1&_=1785041618420`，确认是否需要 Referer/Cookie，并记录返回 JSON 的完整字段结构
  - [x] SubTask 1.2: 取一个真实的 `recruitment_id`，访问详情页 `https://jy.neepu.edu.cn/detail/online?id={recruitment_id}&menu_id=36793`，确认 `div.mian-inner` 节点存在并记录其 HTML 子结构
  - [x] SubTask 1.3: 在 spec.md 的"字段映射建议"中回填实际字段名，确认菜单 ID `menu_id=36793` 固定不变

- [x] Task 2: 在 `HTTP_SOURCES` 中添加 neepu 配置
  - [x] SubTask 2.1: 在 `lite_crawler.py` 第 525 行（`HTTP_SOURCES["btbu"]`）之后添加 `HTTP_SOURCES["neepu"] = {...}` 配置块，包含 name/base_url/list_api/detail_url_pattern/page_size/max_pages/menu_id/location
  - [x] SubTask 2.2: 配置参照 spec.md "NEEPU 数据源配置" 要求，所有字段从 Task 1 调研结果中获取

- [x] Task 3: 编写 `_parse_neepu_detail_page()` 解析函数
  - [x] SubTask 3.1: 在 `_parse_cueb_detail_page` 函数（约 2467 行）之后添加 `_parse_neepu_detail_page(html_content, item_data, job_type="全职")` 函数
  - [x] SubTask 3.2: 使用 BeautifulSoup 的 `soup.select_one('div.mian-inner')` 提取主体描述（注意拼写为 mian-inner）
  - [x] SubTask 3.3: 复用 `_extract_email_from_text`、`_extract_phone_from_text`，并参照 CUEB 的 `contact_patterns` 列表，从 HTML 中正则提取邮箱/电话/联系人
  - [x] SubTask 3.4: 用 `re.search(r'(本科|硕士|博士|大专|不限)', ...)` 提取学历；用 `_extract_salary_from_text()` 提取薪资
  - [x] SubTask 3.5: 返回字典 `{title, description, requirement, salary, education, job_type, contact_info}`，异常时返回安全默认值（参照 CUEB 模式）

- [x] Task 4: 编写 `crawl_neepu()` 爬虫函数
  - [x] SubTask 4.1: 在 `crawl_cueb` 函数（约 2900 行）之后添加 `crawl_neepu(source_config, max_items=0)` 函数
  - [x] SubTask 4.2: 实现 GET 列表 API 分页循环（`start_page=1..MAX_PAGES`），每页 `count=15` 条
  - [x] SubTask 4.3: URL 去重检查（参照 CUEB 模式）：每页先收集所有详情页 URL，调用 `url_exists()` 判断，全部存在则停止
  - [x] SubTask 4.4: 对每条记录调用 `fetch_with_retry(detail_url)` 获取详情页，再调用 `_parse_neepu_detail_page()` 解析
  - [x] SubTask 4.5: 构造 `job` 字典（参照 CUEB 字段：title/company/location/salary/education/description/publish_date/job_type/source/university/source_url/apply_url）
  - [x] SubTask 4.6: `time.sleep(DETAIL_DELAY)` 控制请求间隔，`crawl_logger.log_source_start/end` 记录日志，`save_crawl_state()` 保存状态
  - [x] SubTask 4.7: 异常处理：KeyboardInterrupt/Exception/finally 三段式，与 CUEB 一致

- [x] Task 5: 在 `crawl_source()` 中添加 neepu 分派分支
  - [x] SubTask 5.1: 在 `lite_crawler.py` 第 5705 行（`elif source == "cueb":`）之后添加 `elif source == "neepu":` 分支，调用 `crawl_neepu(source_config, max_items)`

- [x] Task 6: 更新文件头部注释
  - [x] SubTask 6.1: 修改 `lite_crawler.py` 第 8 行注释 `- 只支持 HTTP 爬虫（sufe, zuel, cufe, dufe, swufe）` 为包含 neepu 的完整数据源列表

- [x] Task 7: 升级版本号
  - [x] SubTask 7.1: 查看 `package.json` 当前 version 字段，minor 版本 +1（如 v1.x.y → v1.(x+1).0）—— 8.49.0 → 8.50.0
  - [x] SubTask 7.2: 同步更新 `package.json` 与 `package-lock.json` 中的 version 字段，保持完全一致
  - [x] SubTask 7.3: 确认 `package-lock.json` 中 `packages."".version` 也同步更新

- [x] Task 8: 验证与测试
  - [x] SubTask 8.1: 运行 `python lite_crawler.py --list-sources`，确认 neepu 出现在数据源列表中
  - [x] 8.2: 运行 `python lite_crawler.py --sources neepu --max-items 3`，确认成功爬取并入库 3 条记录
  - [x] SubTask 8.3: 检查入库记录的 `description` 字段包含 `div.mian-inner` 提取的内容
  - [x] SubTask 8.4: 检查入库记录的 `description` 字段包含 `【联系方式】` 段落（若详情页有联系方式）—— 已通过将联系方式前置到【信息】之后避免被 truncate_text 截断
  - [x] SubTask 8.5: 确认其他数据源（如 sufe/cufe）未受影响，运行 `python lite_crawler.py --list-sources` 正常列出全部 19 个数据源
  - [x] SubTask 8.6: 提交 Git，commit message 格式：`v8.50.0 新增东北电力大学(NEEPU)数据源`

# Task Dependencies
- [Task 2] depends on [Task 1]（配置字段名需调研确认）
- [Task 3] depends on [Task 1]（解析结构需调研确认）
- [Task 4] depends on [Task 2, Task 3]（爬虫函数依赖配置与解析函数）
- [Task 5] depends on [Task 4]（分派需调用已实现的爬虫函数）
- [Task 6] 可与 [Task 4, 5] 并行
- [Task 7] 可与 [Task 4, 5, 6] 并行
- [Task 8] depends on [Task 5, 6, 7]（最终验证）

# 调研要点
- NEEPU 列表 API 可能无需任何 Cookie 即可访问（参照 CUEB 模式）
- 详情页 `div.mian-inner` 的实际拼写需用 curl/requests 实际请求确认（用户原话为 "mian-inner"，可能是网站本身的拼写错误，需保留原拼写）
- 联系方式提取复用现有 `_extract_email_from_text` 与 `_extract_phone_from_text`，避免重复造轮子
- 整体实现严格参照 `crawl_cueb` 模式，保持代码风格一致
