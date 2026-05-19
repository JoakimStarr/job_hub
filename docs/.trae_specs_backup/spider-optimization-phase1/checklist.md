# Checklist - 爬虫系统优化 Phase 1 验收标准

## 功能完整性

- [ ] 数据库批量写入功能正常（insert_jobs_batch处理50条batch）
- [ ] ON CONFLICT UPDATE语义正确（重复URL更新而非跳过）
- [ ] 大batch自动分片（>500条时不报错）
- [ ] WAL模式已启用（可通过PRAGMA查询确认）
- [ ] aiohttp连接池已配置（limit=100, limit_per_host=20）
- [ ] 共享Session在AsyncMultiCrawler级别创建
- [ ] @retry装饰器按预期重试（模拟失败场景验证）
- [ ] @measure_time装饰器记录耗时到日志
- [ ] @catch_and_log捕获异常不崩溃
- [ ] CrawlerConfig dataclass包含所有必要配置项
- [ ] from_env() 正确读取环境变量
- [ ] 日志输出包含 source 和 trace_id 字段
- [ ] trace_id在一次爬取任务中保持一致
- [ ] 过时脚本已移至trash/目录
- [ ] requirements.txt 已创建且依赖完整

## 性能指标

- [ ] **写入吞吐量**: 1000条数据写入时间 < 2秒（目标：从15秒优化到<2秒）
- [ ] **写入速度提升**: ≥ 5倍（相对于优化前的逐条INSERT）
- [ ] **内存占用**: 峰值内存不显著增加（或降低）
- [ ] **并发稳定性**: 多源并发写入无 "database is locked" 错误
- [ ] **连接复用**: TCP握手次数明显减少（通过日志验证）

## 代码质量

- [ ] Python代码通过 flake8/pylint 检查（0 error, warning < 10）
- [ ] 类型注解覆盖率 > 90%（关键函数有完整类型提示）
- [ ] 无未使用的 import 语句
- [ ] 无硬编码魔法数字（全部来自 config.get_config()）
- [ ] 新增代码有完整的 docstring
- [ ] 装饰器使用一致（网络请求必用@retry，操作函数必用@measure_time）

## 兼容性与回归

- [ ] 现有 run_spiders.py 命令正常运行
- [ ] 所有9个数据源可正常爬取（至少测试 sufe 和 zuel）
- [ ] 数据库表结构未变更（向后兼容）
- [ ] UnifiedSpider.crawl() 接口签名未改变
- [ ] 爬取结果数据质量无明显下降（字段完整、格式正确）
- [ ] visited_urls.json 正确保存和加载
- [ ] crawl_logs 表正常记录日志

## 文档与配置

- [ ] requirements.txt 包含所有Python依赖及版本
- [ ] config.py 有清晰的 docstring 说明每个配置项用途
- [ ] decorators.py 有使用示例
- [ ] logger.py 有格式示例
- [ ] README.md 或 CHANGELOG.md 记录本次优化变更
- [ ] trash/ 目录下的文件有说明 README（为何归档）

## 测试覆盖

- [ ] 核心函数有基础测试（insert_jobs_batch, CrawlerConfig, 装饰器）
- [ ] 关键路径的手工测试通过（实际运行爬虫）
- [ ] 性能基准测试有记录（写入耗时、内存占用）
- [ ] 错误场景测试通过（网络超时、数据格式异常）
