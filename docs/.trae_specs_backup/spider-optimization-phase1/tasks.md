# Tasks - 爬虫系统优化 Phase 1: 基础优化

## Task 1: 数据库批量写入优化 ⭐⭐⭐ (最高优先级)
- [ ] 1.1 重构 database.py 的 insert_jobs_batch() 方法
  - [ ] 构造单条多行 INSERT SQL语句（参数占位符动态生成）
  - [ ] 实现 ON CONFLICT(source_url) DO UPDATE SET ... 语义
  - [ ] 添加自动分片逻辑（>500条时分批执行）
  - [ ] 保持事务原子性（单个分片内BEGIN/COMMIT）
  - [ ] 编写性能基准测试（对比优化前后写入速度）

## Task 2: WAL模式 + 连接池复用 ⭐⭐⭐
- [ ] 2.1 在 database.py connect()中启用WAL模式
  - [ ] PRAGMA journal_mode=WAL
  - [ ] PRAGMA synchronous=NORMAL
  - [ ] 验证WAL模式生效
- [ ] 2.2 在 crawler.py 中实现连接池复用
  - [ ] __init__中创建共享的aiohttp.ClientSession
  - [ ] 配置TCPConnector(limit=100, limit_per_host=20, ttl_dns_cache=300)
  - [ ] 将session传递给UnifiedSpider（替代每个spider独立创建session）
  - [ ] 实现close()方法释放资源
  - [ ] 更新create_spider()接口支持注入外部session

## Task 3: 统一错误处理装饰器 ⭐⭐
- [ ] 3.1 创建 spiders/decorators.py
  - [ ] 实现 @retry(max_retries, backoff_base, exceptions, on_retry)装饰器
  - [ ] 实现 @measure_time 装饰器
  - [ ] 实现 @catch_and_log(default_return, reraise) 装饰器
  - [ ] 编写装饰器的单元测试
- [ ] 3.2 在关键方法上应用装饰器
  - [ ] unified_spider.py的网络请求方法添加@retry和@measure_time
  - [ ] database.py的数据库操作添加@catch_and_log
  - [ ] crawler.py的任务调度添加@measure_time

## Task 4: 配置中心化 ⭐⭐
- [ ] 4.1 创建 spiders/config.py
  - [ ] 定义CrawlerConfig dataclass (frozen=True)
  - [ ] 包含所有配置项（重试/超时/并发/去重/WAL/日志等）
  - [ ] 实现 from_env() 类方法（支持CRAWLER_前缀的环境变量）
  - [ ] 实现 get_config() 全局单例
  - [ ] 实现 reset_config() 测试辅助方法
  - [ ] 实现 to_dict() 导出方法
- [ ] 4.2 替换分散的常量定义
  - [ ] constants.py 引用 config.get_config()
  - [ ] database.py 使用 config.batch_size 等
  - [ ] crawler.py 使用 config.max_browser_concurrency 等
  - [ ] unified_spider.py 使用 config.detail_concurrency 等
  - [ ] 删除或标记为deprecated的旧常量

## Task 5: 日志增强 ⭐⭐
- [ ] 5.1 升级 spiders/logger.py
  - [ ] 添加 trace_id_var ContextVar
  - [ ] 实现 bind_trace_id(trace_id) 函数
  - [ ] 实现 child_span(name) 嵌套追踪
  - [ ] 实现 get_logger(source) 工厂方法
  - [ ] 配置控制台输出格式（含source和trace_id）
  - [ ] 配置文件输出（按天轮转，压缩gz）
  - [ ] 可选：JSON格式输出用于日志收集系统
- [ ] 5.2 在核心模块中使用结构化日志
  - [ ] crawler.py: 每个源启动时 bind_trace_id
  - [ ] unified_spider.py: 使用 get_logger(self.source_key)
  - [ ] database.py: 操作日志包含 trace_id

## Task 6: 死代码清理与依赖管理 ⭐
- [ ] 6.1 归档过时的scripts脚本
  - [ ] 移动 clean_locations.js 到 trash/scripts_clean_locations.js
  - [ ] 移动 clean_locations.ts 到 trash/scripts_clean_locations.ts
  - [ ] 移动 clean_locations_v2.js 到 trash/scripts_clean_locations_v2.js
  - [ ] 更新 README.md 或相关文档说明归档原因
- [ ] 6.2 创建 requirements.txt
  - [ ] 扫描所有 import 语句收集依赖
  - [ ] 列出: aiosqlite, loguru, aiohttp, beautifulsoup4, playwright (可选)
  - [ ] 指定版本号或最小版本约束
  - [ ] 添加注释说明每个依赖的用途
- [ ] 6.3 清理未使用的import和变量
  - [ ] 检查各模块的 unused imports
  - [ ] 移除注释掉的死代码块

## Task 7: 集成测试与基准测试 ⭐⭐
- [ ] 7.1 运行现有爬虫验证功能回归
  - [ ] 运行 python3 run_spiders.py --sources sufe --max-items 10
  - [ ] 验证数据正常入库
  - [ ] 检查日志输出是否正确（含trace_id）
- [ ] 7.2 性能基准测试
  - [ ] 对比优化前后1000条数据的写入耗时
  - [ ] 记录内存占用峰值
  - [ ] 输出性能报告
- [ ] 7.3 代码质量检查
  - [ ] 运行 flake8/pylint 检查代码规范
  - [ ] 确保类型注解完整
  - [ ] 确保无新的语法错误

## Task Dependencies
- [Task 1] 和 [Task 2] 可并行执行（独立模块）
- [Task 3] 依赖 [Task 1] 完成（在database.py应用装饰器）
- [Task 4] 可独立执行，但[Task 2,3,5]完成后需引用config
- [Task 5] 可独立执行，但建议在[Task 2]后集成（logger在crawler中使用）
- [Task 6] 可随时执行（清理工作）
- [Task 7] 必须最后执行（验收测试）

## 执行顺序建议
```
Week 1:
  Day 1-2: [Task 1] 数据库批量写入优化 ← 核心性能
  Day 3:   [Task 2] WAL + 连接池复用     ← 并行于Task 1
  Day 4:   [Task 4] 配置中心化         ← 基础设施
  Day 5:   [Task 3] 错误处理装饰器      ← 代码质量

Week 2:
  Day 1-2: [Task 5] 日志增强           ← 可观测性
  Day 3:   [Task 6] 死代码清理         ← 代码整洁
  Day 4-5: [Task 7] 集成测试与验收     ← 质量保障
```
