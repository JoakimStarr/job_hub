#!/usr/bin/env python3
"""FinIntern Hub 爬虫系统运行入口

用法:
  python run_spiders.py                          # 运行所有爬虫
  python run_spiders.py --sources sufe zuel      # 运行指定爬虫
  python run_spiders.py --list-sources           # 列出所有数据源
  python run_spiders.py --no-headless            # 显示浏览器窗口
  python run_spiders.py --max-items 10           # 每个源最多爬10条
  python run_spiders.py --db-path ./data/jobs.db # 指定数据库路径
"""

import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "src"))

from spiders.crawler import AsyncMultiCrawler, SPIDERS, SOURCE_NAMES
from spiders.spider_configs import SPIDER_CONFIGS


def main():
    parser = argparse.ArgumentParser(description="FinIntern Hub 爬虫系统")
    parser.add_argument("--sources", nargs="*", help="指定数据源 (如: smartedu sufe zuel)")
    parser.add_argument("--list-sources", action="store_true", help="列出所有可用数据源")
    parser.add_argument("--headless", action="store_true", default=True, help="无头模式运行浏览器 (默认)")
    parser.add_argument("--no-headless", dest="no_headless", action="store_true", help="显示浏览器窗口")
    parser.add_argument("--max-items", type=int, default=0, help="每个数据源最大爬取数量 (0=不限)")
    parser.add_argument("--output", type=str, default=None, help="输出目录")
    parser.add_argument("--db-path", type=str, default=None, help="数据库文件路径")
    args = parser.parse_args()

    if args.list_sources:
        print("\n可用数据源:")
        for key, name in SOURCE_NAMES.items():
            config = SPIDER_CONFIGS.get(key, {})
            spider_type = config.get("spider_type", "")
            browser_tag = " [浏览器]" if spider_type.startswith("browser") else " [HTTP]"
            print(f"  {key:12s} - {name}{browser_tag}")
        print()
        return

    headless = not args.no_headless
    sources = args.sources

    if sources:
        invalid = [s for s in sources if s not in SPIDERS]
        if invalid:
            print(f"错误: 未知数据源: {', '.join(invalid)}")
            print(f"可用: {', '.join(SPIDERS.keys())}")
            sys.exit(1)

    from loguru import logger
    from datetime import datetime

    logger.info(f"爬虫系统启动 | headless={headless} | sources={sources or '全部'} | max_items={args.max_items}")

    default_db = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "jobs.db")
    db_path = args.db_path or default_db
    crawler = AsyncMultiCrawler(output_dir=args.output, db_path=db_path)

    def show_progress(key: str, result: dict):
        status = result.get('status', 'unknown')
        count = result.get('count', 0)
        elapsed = result.get('elapsed', 0)
        name = SOURCE_NAMES.get(key, key)
        
        if status == 'completed':
            print(f"  ✓ [{name}] 完成: {count} 条 | {elapsed}s")
        else:
            error = result.get('error', '未知错误')[:40]
            print(f"  ✗ [{name}] 失败: {error}")

    crawler.on_batch_saved = lambda count, name: print(f"  → 已保存 {count} 条 [{name}]")
    crawler.on_source_complete = show_progress

    start_time = datetime.now()
    results = asyncio.run(crawler.crawl_all_parallel(sources=sources, headless=headless, max_items=args.max_items))
    elapsed = (datetime.now() - start_time).total_seconds()

    summary = crawler.get_summary()
    print("\n" + "=" * 60)
    print(f"爬取完成 | 总耗时 {elapsed:.1f}s")
    print(f"  总岗位数: {summary['total_jobs']}")
    print(f"  完成源: {summary['completed_sources']}/{summary['total_sources']}")
    print(f"  失败源: {summary['error_sources']}")
    print("-" * 60)
    for key, detail in summary["details"].items():
        status_icon = "✓" if detail.get("status") == "completed" else "✗"
        name = SOURCE_NAMES.get(key, key)
        err = f" | 错误: {detail.get('error', '')[:40]}" if detail.get("error") else ""
        print(f"  {status_icon} {name:20s} | {detail.get('count', 0):4d} 条 | {detail.get('elapsed', 0):5.1f}s{err}")
    print("=" * 60)


if __name__ == "__main__":
    main()
