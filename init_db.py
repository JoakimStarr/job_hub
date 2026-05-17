#!/usr/bin/env python3
"""
初始化数据库并运行爬虫
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src"))

from src.spiders.database import LocalDatabase
from src.spiders.unified_spider import UnifiedSpider
from loguru import logger


async def init_database_and_run_spiders():
    """初始化数据库并运行爬虫"""
    
    # 初始化数据库
    db = LocalDatabase()
    await db.connect()
    logger.success("数据库初始化完成")
    
    # 运行爬虫
    print("\n" + "=" * 80)
    print("开始运行爬虫")
    print("=" * 80)
    
    sources = ['sufe', 'zuel', 'cufe', 'dufe', 'swufe']
    results = {}
    
    for source in sources:
        try:
            logger.info(f"开始爬取 {source}...")
            spider = UnifiedSpider(source)
            jobs = await spider.crawl(max_items=0, headless=True)
            results[source] = jobs
            logger.success(f"{source} 爬取完成: {len(jobs)} 条")
        except Exception as e:
            logger.error(f"{source} 爬取失败: {e}")
            results[source] = []
    
    print("\n" + "=" * 80)
    print("爬虫运行完成")
    print("=" * 80)
    
    for source, jobs in results.items():
        print(f"  {source}: {len(jobs)} 条")
    
    await db.close()
    logger.success("数据库已关闭")


if __name__ == "__main__":
    asyncio.run(init_database_and_run_spiders())
