#!/usr/bin/env python3
"""
SUFE数据源端到端测试脚本
测试目标:
1. 运行时错误捕获
2. ApiPostStrategy策略模式验证
3. 异步生成器crawl_stream()测试
4. 中间件/插件集成检查
5. 数据库写入验证
6. 性能指标记录
7. 代码质量问题识别

max_items=3 进行小规模测试
"""

import asyncio
import os
import sys
import time
import tracemalloc
from datetime import datetime
from pathlib import Path

# 添加src目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "src"))

from loguru import logger
from spiders.crawler import AsyncMultiCrawler, SPIDERS, SOURCE_NAMES
from spiders.unified_spider import UnifiedSpider, create_spider
from spiders.database import LocalDatabase


# 配置日志输出到文件
log_file = Path(__file__).parent / "logs" / f"sufe_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
log_file.parent.mkdir(exist_ok=True)

logger.remove()
logger.add(sys.stdout, level="DEBUG", format="{time:HH:mm:ss} | {level:<8} | {message}")
logger.add(str(log_file), level="DEBUG", rotation="10 MB", encoding="utf-8",
           format="{time:YYYY-MM-DD HH:mm:ss} | {level:<8} | {name}:{function}:{line} | {message}")


class SufeTestAnalyzer:
    """SUFE数据源测试分析器"""

    def __init__(self):
        self.errors = []
        self.warnings = []
        self.performance_metrics = {}
        self.data_quality_issues = []
        self.strategy_execution_log = []
        self.db_write_results = []

    def record_error(self, severity: str, message: str, location: str = ""):
        """记录错误信息"""
        error_record = {
            "timestamp": datetime.now().isoformat(),
            "severity": severity,
            "message": message,
            "location": location,
        }
        self.errors.append(error_record)
        logger.error(f"[{severity}] {location}: {message}" if location else f"[{severity}] {message}")

    def record_warning(self, category: str, message: str):
        """记录警告信息"""
        warning_record = {
            "timestamp": datetime.now().isoformat(),
            "category": category,
            "message": message,
        }
        self.warnings.append(warning_record)
        logger.warning(f"[{category}] {message}")

    def record_performance(self, metric_name: str, value: float, unit: str = "s"):
        """记录性能指标"""
        self.performance_metrics[metric_name] = {"value": value, "unit": unit}
        logger.info(f"性能指标: {metric_name} = {value}{unit}")

    async def test_sufe_crawler(self, max_items: int = 3):
        """
        执行完整的端到端测试

        Args:
            max_items: 最大爬取数量
        """
        logger.info("=" * 80)
        logger.info("开始 SUFE 数据源端到端测试")
        logger.info(f"测试参数: max_items={max_items}")
        logger.info(f"数据库路径: {Path(__file__).parent / 'data' / 'jobs.db'}")
        logger.info("=" * 80)

        # 启动内存跟踪
        tracemalloc.start()

        start_time = time.time()
        mem_before = tracemalloc.get_traced_memory()[0] / (1024 * 1024)  # MB

        try:
            # 测试1: 创建爬虫实例并验证配置
            logger.info("\n" + "=" * 80)
            logger.info("测试1: 爬虫实例创建与配置验证")
            logger.info("=" * 80)

            await self._test_spider_creation(max_items)

            # 测试2: 运行完整爬取流程（使用crawl_stream异步生成器）
            logger.info("\n" + "=" * 80)
            logger.info("测试2: 完整爬取流程 (crawl_stream 异步生成器)")
            logger.info("=" * 80)

            jobs, crawl_results = await self._test_crawl_stream(max_items)

            # 测试3: 验证数据质量
            logger.info("\n" + "=" * 80)
            logger.info("测试3: 数据质量验证")
            logger.info("=" * 80)

            await self._validate_data_quality(jobs)

            # 测试4: 数据库写入验证
            logger.info("\n" + "=" * 80)
            logger.info("测试4: 数据库写入验证")
            logger.info("=" * 80)

            await self._verify_database_writes(jobs)

            # 测试5: 中间件/插件集成检查
            logger.info("\n" + "=" * 80)
            logger.info("测试5: 中间件/插件集成检查")
            logger.info("=" * 80)

            await self._check_middleware_plugins()

        except Exception as e:
            self.record_error("CRITICAL", f"测试执行异常: {str(e)}", "test_runner")
            logger.exception("测试执行过程中发生未捕获的异常")
        finally:
            # 记录最终性能指标
            end_time = time.time()
            total_elapsed = end_time - start_time
            mem_after = tracemalloc.get_traced_memory()[1] / (1024 * 1024)  # MB
            mem_peak = tracemalloc.get_traced_memory()[1] / (1024 * 1024)  # MB

            self.record_performance("总耗时", total_elapsed, "s")
            self.record_performance("初始内存", mem_before, "MB")
            self.record_performance("峰值内存", mem_peak, "MB")
            self.record_performance("内存增长", mem_peak - mem_before, "MB")

            tracemalloc.stop()

            # 生成测试报告
            logger.info("\n" + "=" * 80)
            logger.info("测试完成 - 生成分析报告")
            logger.info("=" * 80)

            self._generate_report(jobs if 'jobs' in locals() else [])

    async def _test_spider_creation(self, max_items: int):
        """测试1: 爬虫实例创建与配置验证"""
        try:
            # 验证sufe是否在可用数据源中
            if "sufe" not in SPIDERS:
                self.record_error("CRITICAL", "sufe不在可用数据源列表中", "config_check")
                return False

            logger.info(f"[PASS] sufe数据源已注册: {SOURCE_NAMES.get('sufe', 'Unknown')}")

            # 创建UnifiedSpider实例
            config = {
                "existing_url_lookup": lambda urls: set(),  # 测试用空查询
                "headless": True,
            }

            spider = create_spider("sufe", config=config, headless=True)

            # 验证关键属性
            checks = [
                ("source", spider.source, "sufe"),
                ("base_url", spider.base_url, "https://career.sufe.edu.cn"),
                ("university", spider.university, "上海财经大学"),
                ("spider_type", spider.spider_type, "api_post"),
                ("strategy_type", spider.strategy.get_type(), "api_post"),
            ]

            all_passed = True
            for attr_name, actual, expected in checks:
                if actual == expected:
                    logger.info(f"[PASS] {attr_name} = {actual}")
                else:
                    self.record_error("MAJOR", f"{attr_name} 期望={expected}, 实际={actual}", "spider_config")
                    all_passed = False

            # 验证sections配置
            sections = spider.spider_config.get("sections", [])
            logger.info(f"[INFO] 发现 {len(sections)} 个板块配置:")
            for i, section in enumerate(sections, 1):
                logger.info(f"  板块{i}: {section.get('label', section.get('section', 'unknown'))}")

            if len(sections) < 2:
                self.record_warning("CONFIG", "板块配置数量不足，可能影响爬取覆盖范围")

            await spider.close()
            return all_passed

        except Exception as e:
            self.record_error("CRITICAL", f"爬虫创建失败: {str(e)}", "test_spider_creation")
            return False

    async def _test_crawl_stream(self, max_items: int):
        """测试2: 使用crawl_stream进行完整爬取"""
        jobs = []
        crawl_start = time.time()

        try:
            # 创建AsyncMultiCrawler实例
            db_path = Path(__file__).parent / "data" / "jobs.db"
            crawler = AsyncMultiCrawler(db_path=str(db_path))

            # 设置回调函数以监控进度
            batch_saved_count = []
            source_complete_results = []

            crawler.on_batch_saved = lambda count, name: batch_saved_count.append((count, name))
            crawler.on_source_complete = lambda key, result: source_complete_results.append((key, result))

            logger.info("[INFO] 开始调用 crawl_source(sufe, stream_mode=False)...")

            # 调用爬取（使用非流式模式以便收集所有结果）
            result_jobs = await crawler.crawl_source(
                "sufe",
                headless=True,
                max_items=max_items,
                stream_mode=False  # 先用非流式模式测试基本功能
            )

            crawl_end = time.time()
            crawl_elapsed = crawl_end - crawl_start

            self.record_performance("爬取耗时", crawl_elapsed, "s")
            logger.info(f"[INFO] 爬取完成，获得 {len(result_jobs)} 条数据")

            jobs.extend(result_jobs)

            # 再次使用流式模式测试
            logger.info("[INFO] 开始测试流式模式 crawl_stream...")
            stream_start = time.time()

            stream_jobs = await crawler.crawl_source(
                "sufe",
                headless=True,
                max_items=max_items,
                stream_mode=True  # 流式模式
            )

            stream_end = time.time()
            stream_elapsed = stream_end - stream_start

            self.record_performance("流式模式耗时", stream_elapsed, "s")
            logger.info(f"[INFO] 流式模式完成，获得 {len(stream_jobs)} 条数据")

            # 关闭crawler
            await crawler.close()

            return jobs, {
                "batch_mode": {"jobs": result_jobs, "elapsed": crawl_elapsed},
                "stream_mode": {"jobs": stream_jobs, "elapsed": stream_elapsed},
                "batch_saved": batch_saved_count,
                "source_complete": source_complete_results,
            }

        except Exception as e:
            self.record_error("CRITICAL", f"爬取流程失败: {str(e)}", "_test_crawl_stream")
            logger.exception("爬取流程详细错误信息:")
            return [], {}

    async def _validate_data_quality(self, jobs: list):
        """测试3: 验证数据质量"""
        if not jobs:
            self.record_warning("DATA_QUALITY", "没有获取到任何数据，无法进行质量验证")
            return

        logger.info(f"[INFO] 开始验证 {len(jobs)} 条数据的质量...")

        required_fields = ["title", "company", "source_url"]
        recommended_fields = ["location", "salary", "description", "publish_date"]

        quality_scores = []

        for i, job in enumerate(jobs, 1):
            job_score = 100
            issues = []

            # 检查必填字段
            for field in required_fields:
                value = getattr(job, field, None)
                if not value or str(value).strip() == "":
                    job_score -= 20
                    issues.append(f"缺少必填字段: {field}")
                    self.record_warning("DATA_QUALITY", f"Job #{i} 缺少 {field}")

            # 检查推荐字段
            for field in recommended_fields:
                value = getattr(job, field, None)
                if not value or str(value).strip() == "":
                    job_score -= 5
                    issues.append(f"缺少推荐字段: {field}")

            # 检查URL格式
            if hasattr(job, 'source_url') and job.source_url:
                if not job.source_url.startswith('http'):
                    job_score -= 10
                    issues.append(f"URL格式无效: {job.source_url}")

            # 检查文本长度合理性
            if hasattr(job, 'title') and job.title:
                if len(job.title) > 200:
                    job_score -= 5
                    issues.append(f"标题过长 ({len(job.title)} 字符)")

            if hasattr(job, 'description') and job.description:
                if len(job.description) > 5000:
                    job_score -= 5
                    issues.append(f"描述过长 ({len(job.description)} 字符)")

            quality_scores.append({
                "job_index": i,
                "score": job_score,
                "issues": issues,
                "title": getattr(job, 'title', 'N/A'),
            })

            if issues:
                logger.warning(f"[DATA_QUALITY] Job #{i} '{getattr(job, 'title', 'N/A')}': {len(issues)} 个问题")
                for issue in issues[:3]:  # 只显示前3个问题
                    logger.warning(f"  - {issue}")

        avg_score = sum(q["score"] for q in quality_scores) / len(quality_scores) if quality_scores else 0
        self.record_performance("平均数据质量分", avg_score, "分")

        pass_count = sum(1 for q in quality_scores if q["score"] >= 80)
        logger.info(f"[SUMMARY] 数据质量评分: 平均 {avg_score:.1f}/100, 优秀率 {pass_count}/{len(quality_scores)}")

    async def _verify_database_writes(self, jobs: list):
        """测试4: 验证数据库写入"""
        try:
            db_path = Path(__file__).parent / "data" / "jobs.db"

            if not db_path.exists():
                self.record_error("CRITICAL", "数据库文件不存在", "_verify_database_writes")
                return

            db = LocalDatabase(str(db_path))
            await db.connect()

            # 查询sufe数据源的记录数
            count = await db.get_job_count()
            logger.info(f"[DB] 数据库总记录数: {count}")

            sufe_jobs = await db.get_jobs_by_source("sufe")
            logger.info(f"[DB] sufe数据源记录数: {len(sufe_jobs)}")

            if jobs and sufe_jobs:
                # 验证最新插入的数据
                latest_db_job = sufe_jobs[0] if sufe_jobs else None
                latest_test_job = jobs[-1] if jobs else None

                if latest_test_job and latest_db_job:
                    match_checks = [
                        ("标题匹配", getattr(latest_test_job, 'title', ''), latest_db_job.get('title', '')),
                        ("公司匹配", getattr(latest_test_job, 'company', ''), latest_db_job.get('company', '')),
                        ("来源匹配", getattr(latest_test_job, 'source', ''), latest_db_job.get('source', '')),
                    ]

                    for check_name, test_val, db_val in match_checks:
                        if test_val == db_val:
                            logger.info(f"[PASS] {check_name}: {test_val}")
                        else:
                            self.record_warning("DB_INTEGRITY", f"{check_name} 不一致: 测试={test_val}, DB={db_val}")

            # 检查去重机制
            dedup_stats = await db.get_dedup_stats("sufe")
            logger.info(f"[DB] 去重统计: 总数={dedup_stats['total_count']}, 唯一={dedup_stats['unique_count']}, 重复={dedup_stats['duplicate_count']}")

            if dedup_stats["duplicate_count"] > 0:
                self.record_warning("DEDUP", f"发现 {dedup_stats['duplicate_count']} 条重复记录")

            await db.close()

        except Exception as e:
            self.record_error("MAJOR", f"数据库验证失败: {str(e)}", "_verify_database_writes")
            logger.exception("数据库验证详细错误:")

    async def _check_middleware_plugins(self):
        """测试5: 中间件/插件集成检查"""
        try:
            config = {"headless": True}
            spider = create_spider("sufe", config=config, headless=True)

            # 测试中间件注册接口
            from spiders.middleware.base import BaseMiddleware
            from spiders.plugins.base import CrawlPlugin

            class TestMiddleware(BaseMiddleware):
                name = "test_middleware"

                async def process_request(self, request):
                    logger.info("[MIDDLEWARE] process_request called")
                    return request

                async def response(self, response):
                    logger.info("[MIDDLEWARE] response called")
                    return response

            class TestPlugin(CrawlPlugin):
                name = "test_plugin"

                async def before_crawl(self, spider):
                    logger.info("[PLUGIN] before_crawl called")

                async def after_crawl(self, spider, results):
                    logger.info("[PLUGIN] after_crawl called")
                    return results

            # 注册中间件和插件
            spider.use(TestMiddleware())
            spider.use(TestPlugin())

            logger.info(f"[PASS] 成功注册中间件: TestMiddleware")
            logger.info(f"[PASS] 成功注册插件: TestPlugin")

            # 验证注册状态
            if hasattr(spider, '_middlewares'):
                logger.info(f"[INFO] 已注册中间件数量: {len(spider._middlewares)}")
            else:
                self.record_warning("MIDDLEWARE", "中间件列表属性不存在")

            if hasattr(spider, '_plugins'):
                logger.info(f"[INFO] 已注册插件数量: {len(spider._plugins)}")
            else:
                self.record_warning("PLUGIN", "插件列表属性不存在")

            # 注意: 当前中间件/插件可能未被实际调用（预留接口）
            self.record_warning("INTEGRATION", "中间件/插件为预留接口，可能未在策略执行中被实际调用")

            await spider.close()

        except ImportError as e:
            self.record_warning("DEPENDENCY", f"中间件/插件模块导入失败: {e}")
        except Exception as e:
            self.record_error("MINOR", f"中间件/插件集成检查失败: {e}", "_check_middleware_plugins")

    def _generate_report(self, jobs: list):
        """生成详细的分析报告"""
        report_lines = [
            "\n" + "=" * 80,
            "SUFE 数据源端到端测试报告",
            "=" * 80,
            f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"测试数据量: {len(jobs)} 条",
            "",
            "-" * 80,
            "1. 性能指标汇总",
            "-" * 80,
        ]

        for metric_name, metric_data in self.performance_metrics.items():
            report_lines.append(f"  • {metric_name}: {metric_data['value']:.2f} {metric_data['unit']}")

        report_lines.extend([
            "",
            "-" * 80,
            "2. 问题清单 (按严重程度排序)",
            "-" * 80,
        ])

        # 按严重程度分组统计
        severity_order = ["CRITICAL", "MAJOR", "MINOR"]
        severity_counts = {"CRITICAL": 0, "MAJOR": 0, "MINOR": 0}

        for error in sorted(self.errors, key=lambda x: severity_order.index(x["severity"]) if x["severity"] in severity_order else 99):
            severity_counts[error["severity"]] += 1
            report_lines.append(f"\n  [{error['severity']}] {error['message']}")
            if error.get("location"):
                report_lines.append(f"      位置: {error['location']}")

        report_lines.extend([
            "",
            f"  统计: Critical={severity_counts['CRITICAL']}, Major={severity_counts['MAJOR']}, Minor={severity_counts['MINOR']}",
            "",
            "-" * 80,
            "3. 警告信息",
            "-" * 80,
        ])

        for warning in self.warnings:
            report_lines.append(f"  ⚠ [{warning['category']}] {warning['message']}")

        report_lines.extend([
            "",
            "-" * 80,
            "4. 代码质量评估",
            "-" * 80,
        ])

        # 基于发现的问题给出整体评估
        total_issues = len(self.errors) + len(self.warnings)
        if severity_counts["CRITICAL"] > 0:
            grade = "F - 存在严重问题，需要立即修复"
        elif severity_counts["MAJOR"] > 3:
            grade = "D - 存在较多主要问题，建议优先修复"
        elif severity_counts["MAJOR"] > 0:
            grade = "C - 功能基本正常，但存在问题需要优化"
        elif total_issues > 5:
            grade = "B - 整体良好，有小幅优化空间"
        else:
            grade = "A - 优秀，代码质量和运行状况良好"

        report_lines.append(f"  综合评级: {grade}")
        report_lines.append(f"  总问题数: {total_issues}")
        report_lines.append(f"  日志文件: {log_file}")

        report_lines.extend([
            "",
            "=" * 80,
            "报告结束",
            "=" * 80,
        ])

        # 输出报告
        full_report = "\n".join(report_lines)
        print(full_report)

        # 保存报告到文件
        report_file = Path(__file__).parent / "logs" / f"sufe_test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        with open(report_file, "w", encoding="utf-8") as f:
            f.write(full_report)
        logger.info(f"[REPORT] 报告已保存至: {report_file}")


async def main():
    """主测试入口"""
    analyzer = SufeTestAnalyzer()
    await analyzer.test_sufe_crawler(max_items=3)


if __name__ == "__main__":
    asyncio.run(main())
