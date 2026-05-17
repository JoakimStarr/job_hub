import argparse
import asyncio
import sys
from datetime import datetime
from pathlib import Path

from loguru import logger

from .crawler import AsyncMultiCrawler
from .spider_configs import get_all_spider_names, get_spider_display_name
from .constants import SOURCE_NAMES


BROWSER_SOURCES = {'uibe', 'jxufe'}
HTTP_SOURCES = {'sufe', 'zuel', 'cufe', 'dufe', 'swufe'}


def interactive_select():
    """交互式选择爬虫"""
    print("\n" + "=" * 80)
    print("FinIntern Hub 爬虫系统")
    print("=" * 80)
    
    print("\n请选择要运行的爬虫：")
    print("  1. HTTP爬虫（推荐，速度快）")
    print("     - sufe: 上海财经大学")
    print("     - zuel: 中南财经政法大学")
    print("     - cufe: 中央财经大学")
    print("     - dufe: 东北财经大学")
    print("     - swufe: 西南财经大学")
    
    print("\n  2. 浏览器爬虫（需要Playwright，速度慢）")
    print("     - smartedu: 国家大学生就业服务平台")
    print("     - uibe: 对外经济贸易大学")
    print("     - jxufe: 江西财经大学现代经济管理学院")
    print("     - neu: 东北大学")
    
    print("\n  3. 运行所有爬虫")
    print("  4. 自定义选择")
    print("  0. 退出")
    
    choice = input("\n请输入选项 (0-4): ").strip()
    
    if choice == "0":
        print("退出程序")
        sys.exit(0)
    elif choice == "1":
        return list(HTTP_SOURCES)
    elif choice == "2":
        print("\n注意：浏览器爬虫需要安装Playwright")
        print("安装命令：pip install playwright && playwright install chromium")
        confirm = input("是否继续？(y/n): ").strip().lower()
        if confirm != 'y':
            print("取消运行")
            sys.exit(0)
        return list(BROWSER_SOURCES)
    elif choice == "3":
        return None  # 运行所有爬虫
    elif choice == "4":
        all_sources = get_all_spider_names()
        print("\n可用爬虫：")
        for i, source in enumerate(all_sources, 1):
            name = get_spider_display_name(source)
            tag = " [浏览器]" if source in BROWSER_SOURCES else " [HTTP]"
            print(f"  {i}. {source:12s} - {name}{tag}")
        
        selected = input("\n请输入要运行的爬虫编号（用逗号分隔，如：1,2,3）: ").strip()
        if not selected:
            print("未选择任何爬虫")
            sys.exit(0)
        
        try:
            indices = [int(x.strip()) for x in selected.split(',')]
            sources_list = list(all_sources)
            selected_sources = [sources_list[i-1] for i in indices if 1 <= i <= len(sources_list)]
            
            if not selected_sources:
                print("无效的选择")
                sys.exit(1)
            
            return selected_sources
        except (ValueError, IndexError):
            print("输入格式错误")
            sys.exit(1)
    else:
        print("无效的选项")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="FinIntern Hub 爬虫系统")
    parser.add_argument("--sources", nargs="*", help="指定数据源 (如: smartedu sufe zuel)")
    parser.add_argument("--list-sources", action="store_true", help="列出所有可用数据源")
    parser.add_argument("--headless", action="store_true", default=True, help="无头模式运行浏览器 (默认)")
    parser.add_argument("--no-headless", dest="no_headless", action="store_true", help="显示浏览器窗口")
    parser.add_argument("--max-items", type=int, default=0, help="每个数据源最大爬取数量 (0=不限)")
    parser.add_argument("--output", type=str, default=None, help="输出目录")
    parser.add_argument("--db-path", type=str, default=None, help="数据库文件路径")
    parser.add_argument("--interactive", "-i", action="store_true", help="交互式选择爬虫")
    args = parser.parse_args()

    if args.list_sources:
        print("\n可用数据源:")
        all_sources = get_all_spider_names()
        
        for key in all_sources:
            name = get_spider_display_name(key)
            browser_tag = " [浏览器]" if key in BROWSER_SOURCES else " [HTTP]"
            print(f"  {key:12s} - {name}{browser_tag}")
        print()
        return

    headless = not args.no_headless
    sources = args.sources
    
    # 如果指定了交互式模式或没有指定sources，则进入交互式选择
    if args.interactive or not sources:
        sources = interactive_select()

    if sources:
        all_sources = get_all_spider_names()
        invalid = [s for s in sources if s not in all_sources]
        if invalid:
            print(f"错误: 未知数据源: {', '.join(invalid)}")
            print(f"可用: {', '.join(all_sources)}")
            sys.exit(1)

    logger.info(f"爬虫系统启动 | headless={headless} | sources={sources or '全部'} | max_items={args.max_items}")

    crawler = AsyncMultiCrawler(output_dir=args.output, db_path=args.db_path)

    crawler.on_batch_saved = lambda count, name: logger.info(f"  → 已保存 {count} 条 [{name}]")
    crawler.on_source_complete = lambda key, result: logger.info(
        f"  ✓ [{key}] {result.get('status')} | {result.get('count', 0)} 条 | {result.get('elapsed', 0)}s"
    )

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
        name = get_spider_display_name(key)
        print(f"  {status_icon} {name:20s} | {detail.get('count', 0):4d} 条 | {detail.get('elapsed', 0):5.1f}s")
    print("=" * 60)


if __name__ == "__main__":
    main()
