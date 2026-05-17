import asyncio
import json
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set

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

    async def crawl_source(self, source_key: str, headless: bool = True, max_items: int = 0) -> List[JobData]:
        is_browser = source_key in BROWSER_SPIDERS

        async def _run_spider():
            config = {
                "existing_url_lookup": self.db.get_existing_urls,
                "headless": headless,
            }
            spider = create_spider(source_key, config=config, headless=headless)
            try:
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

    async def crawl_all_parallel(
        self,
        sources: Optional[List[str]] = None,
        headless: bool = True,
        max_items: int = 0,
    ) -> Dict[str, List[JobData]]:
        await self.db.connect()
        await self._load_visited_urls()

        source_keys = sources or get_all_spider_names()
        logger.info(f"开始并发爬取 {len(source_keys)} 个数据源: {source_keys}")

        tasks = {}
        for key in source_keys:
            tasks[key] = asyncio.create_task(self.crawl_source(key, headless=headless, max_items=max_items))

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
                }
                logger.info(f"[{key}] 爬取完成: {len(jobs)} 条, 耗时 {elapsed:.1f}s")

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
                self._source_results[key] = {"status": "error", "count": 0, "elapsed": round(elapsed, 1), "error": str(e)}
                logger.error(f"[{key}] 爬取失败: {e}")
                await self.db.log_crawl(
                    source=SOURCE_NAMES.get(key, key), status="error", error_message=str(e),
                    start_time=datetime.now().isoformat(), end_time=datetime.now().isoformat(), duration=elapsed,
                )

            if self.on_source_complete:
                self.on_source_complete(key, self._source_results[key])

        await self._save_visited_urls()
        await self.db.close()
        return results

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
