import asyncio
import json
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set

import aiohttp
from loguru import logger

from .base import BaseSpider, JobData, SpiderStatus
from .constants import SOURCE_NAMES, SPIDERS, BATCH_SIZE, MAX_BROWSER_CONCURRENCY
from .database import LocalDatabase
from .unified_spider import UnifiedSpider, create_spider
from .spider_configs import get_all_spider_names, get_spider_display_name


BROWSER_SPIDERS = {'smartedu', 'uibe', 'jxufe', 'neu'}


class AsyncMultiCrawler:
    BATCH_SIZE = BATCH_SIZE

    def __init__(self, output_dir: str = None, db_path: str = None):
        self.output_dir = Path(output_dir) if output_dir else Path(__file__).parent.parent.parent / "output"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.db = LocalDatabase(db_path)
        self.on_batch_saved: Optional[Callable] = None
        self.on_progress: Optional[Callable] = None
        self.on_source_complete: Optional[Callable] = None
        self._browser_semaphore = asyncio.Semaphore(MAX_BROWSER_CONCURRENCY)
        self._visited_urls: Set[str] = set()
        self._visited_urls_file = self.output_dir / "visited_urls.json"
        self._failed_queue_file = self.output_dir / "failed_queue.json"
        self._source_results: Dict[str, Dict[str, Any]] = {}
        
        self.session = aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(
                limit=100,
                limit_per_host=20,
                ttl_dns_cache=300,
                force_close=False,
                enable_cleanup_closed=True,
            ),
            timeout=aiohttp.ClientTimeout(total=30),
        )
        logger.info(f"已创建共享HTTP连接池 (limit=100, limit_per_host=20)")

    async def _load_visited_urls(self):
        try:
            if self._visited_urls_file.exists():
                data = json.loads(self._visited_urls_file.read_text(encoding="utf-8"))
                self._visited_urls = set(data.get("urls", []))
                logger.info(f"已加载 {len(self._visited_urls)} 条已访问URL")
        except Exception as e:
            logger.warning(f"加载已访问URL失败: {e}")
            self._visited_urls = set()

    async def _save_visited_urls(self):
        try:
            from .base import BaseSpider
            trimmed = BaseSpider.trim_visited_urls(self, self._visited_urls)
            self._visited_urls = trimmed
            data = {"urls": list(self._visited_urls), "updated_at": datetime.now().isoformat()}
            self._visited_urls_file.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception as e:
            logger.warning(f"保存已访问URL失败: {e}")

    async def _save_failed_queue(self, failed_items: List[Dict]):
        if not failed_items:
            return
        try:
            existing = []
            if self._failed_queue_file.exists():
                existing = json.loads(self._failed_queue_file.read_text(encoding="utf-8"))
            existing.extend(failed_items)
            self._failed_queue_file.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception as e:
            logger.warning(f"保存失败队列失败: {e}")

    async def crawl_source(
        self,
        source_key: str,
        headless: bool = True,
        max_items: int = 0,
        stream_mode: bool = False
    ) -> List[JobData]:
        """
        爬取单个数据源
        
        Args:
            source_key: 数据源标识 (如 'sufe', 'zuel')
            headless: 是否无头浏览器模式
            max_items: 最大爬取数量, 0表示不限制
            stream_mode: 是否使用流式模式 (边爬边写，降低内存占用)
            
        Returns:
            List[JobData]: 爬取到的岗位数据列表
            
        注意事项:
            - stream_mode=True 时使用异步生成器，内存占用从O(N)降至O(1)
            - stream_mode=False 时保持原有行为，一次性返回所有数据
            - 浏览器类爬虫自动获取信号量控制并发
        """
        is_browser = source_key in BROWSER_SPIDERS

        async def _run_spider():
            config = {
                "existing_url_lookup": self.db.get_existing_urls,
                "headless": headless,
            }
            spider = create_spider(source_key, config=config, headless=headless, session=self.session)
            try:
                if stream_mode:
                    return await self._crawl_and_save_stream(spider, source_key, max_items)
                else:
                    return await spider.crawl(max_items=max_items)
            except Exception as e:
                logger.error(f"[{source_key}] 爬取异常: {e}")
                return []
            finally:
                await spider.close()

        if is_browser:
            async with self._browser_semaphore:
                logger.info(f"[{source_key}] 获取浏览器信号量，开始爬取")
                return await _run_spider()
        else:
            return await _run_spider()

    async def _crawl_and_save_stream(
        self,
        spider: 'UnifiedSpider',
        source_key: str,
        max_items: int = 0
    ) -> List[JobData]:
        """
        流式爬取并实时保存到数据库
        
        使用异步生成器边爬取边写入数据库，
        避免将所有数据累积在内存中。
        
        Args:
            spider: UnifiedSpider实例
            source_key: 数据源标识
            max_items: 最大数量限制
            
        Returns:
            所有保存的JobData列表 (用于兼容性)
        """
        all_jobs: List[JobData] = []
        batch: List[JobData] = []
        saved_count = 0
        
        async for job in spider.crawl_stream(max_items):
            all_jobs.append(job)
            batch.append(job)
            
            if len(batch) >= self.BATCH_SIZE:
                inserted = await self.db.insert_jobs_batch(batch)
                saved_count += inserted
                
                if self.on_batch_saved:
                    self.on_batch_saved(inserted, SOURCE_NAMES.get(source_key, source_key))
                
                if self.on_progress:
                    self.on_progress(
                        source=source_key,
                        current=saved_count,
                        batch_size=len(batch),
                    )
                
                batch.clear()
        
        # 保存剩余的数据
        if batch:
            inserted = await self.db.insert_jobs_batch(batch)
            saved_count += inserted
            
            if self.on_batch_saved:
                self.on_batch_saved(inserted, SOURCE_NAMES.get(source_key, source_key))
        
        logger.info(
            f"[{source_key}] 流式爬取完成: "
            f"总计 {len(all_jobs)} 条, 保存 {saved_count} 条"
        )
        
        return all_jobs

    async def crawl_all_parallel(
        self,
        sources: Optional[List[str]] = None,
        headless: bool = True,
        max_items: int = 0,
        stream_mode: bool = False
    ) -> Dict[str, List[JobData]]:
        """
        并发爬取多个数据源
        
        Args:
            sources: 要爬取的数据源列表, None表示全部
            headless: 是否无头浏览器模式
            max_items: 每个数据源最大爬取数量
            stream_mode: 是否使用流式模式 (边爬边写)
            
        Returns:
            Dict[source_key, List[JobData]]: 各数据源的爬取结果
            
        性能对比:
            - batch_mode (stream_mode=False): 内存O(N), 适合小规模数据
            - stream_mode (stream_mode=True): 内存O(1), 适合大规模数据
        """
        await self.db.connect()
        await self._load_visited_urls()

        source_keys = sources or get_all_spider_names()
        logger.info(
            f"开始并发爬取 {len(source_keys)} 个数据源: {source_keys} "
            f"{'(流式模式)' if stream_mode else '(批处理模式)'}"
        )

        tasks = {}
        for key in source_keys:
            tasks[key] = asyncio.create_task(
                self.crawl_source(key, headless=headless, max_items=max_items, stream_mode=stream_mode)
            )

        results: Dict[str, List[JobData]] = {}
        for key, task in tasks.items():
            start = time.time()
            try:
                jobs = await task
                elapsed = time.time() - start
                results[key] = jobs
                self._source_results[key] = {
                    "status": "completed",
                    "count": len(jobs),
                    "elapsed": round(elapsed, 1),
                    "mode": "stream" if stream_mode else "batch",
                }
                logger.info(f"[{key}] 爬取完成: {len(jobs)} 条, 耗时 {elapsed:.1f}s")

                # 非流式模式下需要手动分批保存
                if not stream_mode:
                    batch = jobs[: self.BATCH_SIZE]
                    while batch:
                        inserted = await self.db.insert_jobs_batch(batch)
                        if self.on_batch_saved:
                            self.on_batch_saved(inserted, SOURCE_NAMES.get(key, key))
                        jobs = jobs[self.BATCH_SIZE:]
                        batch = jobs[: self.BATCH_SIZE]

                await self.db.log_crawl(
                    source=SOURCE_NAMES.get(key, key),
                    status="completed",
                    jobs_count=len(results[key]),
                    start_time=datetime.now().isoformat(),
                    end_time=datetime.now().isoformat(),
                    duration=elapsed,
                )
            except Exception as e:
                elapsed = time.time() - start
                results[key] = []
                self._source_results[key] = {
                    "status": "error",
                    "count": 0,
                    "elapsed": round(elapsed, 1),
                    "error": str(e)
                }
                logger.error(f"[{key}] 爬取失败: {e}")
                await self.db.log_crawl(
                    source=SOURCE_NAMES.get(key, key), status="error", error_message=str(e),
                    start_time=datetime.now().isoformat(), end_time=datetime.now().isoformat(), duration=elapsed,
                )

            if self.on_source_complete:
                self.on_source_complete(key, self._source_results[key])

        await self._save_visited_urls()
        await self.db.close()
        await self.close()
        return results

    async def close(self):
        """关闭连接池和所有资源"""
        if hasattr(self, 'session') and self.session:
            await self.session.close()
            logger.info("HTTP连接池已关闭")

    def get_summary(self) -> Dict[str, Any]:
        total = sum(r.get("count", 0) for r in self._source_results.values())
        errors = sum(1 for r in self._source_results.values() if r.get("status") == "error")
        return {
            "total_jobs": total,
            "total_sources": len(self._source_results),
            "completed_sources": len(self._source_results) - errors,
            "error_sources": errors,
            "details": self._source_results,
        }


__all__ = ["AsyncMultiCrawler", "SPIDERS", "SOURCE_NAMES"]
