"""
统一爬虫 - 轻量级调度器
根据spider_type委托给对应的Strategy执行爬取逻辑

架构: 策略模式 + 异步生成器
- UnifiedSpider (调度器, < 200行) - 负责策略选择和生命周期管理
- BaseCrawlStrategy (抽象基类) - 定义策略接口
- ApiPostStrategy/ApiGetStrategy/HtmlStrategy/BrowserStrategy - 具体实现
"""

import random
from datetime import datetime
from typing import Any, AsyncIterator, Dict, List, Optional

import aiohttp
from loguru import logger

from .base import BaseSpider, JobData, SpiderStatus
from .spider_configs import get_spider_config
from .strategies import get_strategy


class UnifiedSpider(BaseSpider):
    """统一爬虫调度器 - 根据配置动态选择策略执行爬取"""

    def __init__(self, source: str, config: Optional[Dict[str, Any]] = None, headless: bool = True, session=None):
        self.source = source
        self.spider_config = get_spider_config(source)
        
        merged_config = dict(config or {})
        merged_config["headless"] = headless
        super().__init__(self.spider_config["name"], merged_config)
        
        self.base_url = self.spider_config["base_url"]
        self.university = self.spider_config["university"]
        self.location = self.spider_config["location"]
        self.spider_type = self.spider_config["spider_type"]
        
        self.external_session = session
        
        self.detail_concurrency = int(self.config.get("detail_concurrency", 
                                      self.spider_config.get("detail_concurrency", 8)))
        
        if self.spider_type == "api_post":
            self.max_pages = int(self.config.get("max_pages", 
                               self.spider_config.get("max_pages", 80)))
        elif self.spider_type == "api_get":
            self.max_pages = int(self.config.get("max_pages_per_category", 
                               self.spider_config.get("max_pages_per_category", 80)))
        elif self.spider_type == "html":
            self.max_pages = int(self.config.get("max_pages", 
                               self.spider_config.get("max_pages", 100)))
        else:
            self.max_pages = int(self.config.get("max_pages", 50))
        
        self._strategy = get_strategy(self.spider_type)
        logger.debug(f"[{self.source}] 初始化策略: {self._strategy.get_type()}")

    @property
    def strategy(self) -> 'BaseCrawlStrategy':
        return self._strategy

    async def initialize(self) -> bool:
        try:
            self.stats.status = SpiderStatus.INITIALIZING
            
            headers = {
                "User-Agent": random.choice(self.DEFAULT_USER_AGENTS),
                **self.spider_config.get("headers", {}),
            }
            
            if "Origin" not in headers and self.spider_type in ["api_post", "api_get"]:
                headers["Origin"] = self.base_url
            
            if self.external_session:
                logger.debug(f"{self.source}: 复用共享HTTP Session")
                self.session = self.external_session
                self.session.headers.update(headers)
            else:
                logger.debug(f"{self.source}: 创建独立HTTP Session")
                self.session = aiohttp.ClientSession(
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=20),
                    cookie_jar=aiohttp.CookieJar(unsafe=True),
                )
            
            if self.spider_type == "api_post" and self.source in ["cufe", "dufe"]:
                try:
                    async with self.session.get(self.base_url, allow_redirects=True) as resp:
                        logger.info(f"[{self.source}] 初始页面访问: HTTP {resp.status}")
                except Exception as e:
                    logger.warning(f"[{self.source}] 初始页面访问失败: {e}")
            
            self.stats.status = SpiderStatus.IDLE
            return True
        except Exception as exc:
            self.log_error("初始化失败", exc)
            self.stats.status = SpiderStatus.ERROR
            return False

    async def crawl_stream(self, max_items: int = 0) -> AsyncIterator[JobData]:
        """
        异步生成器接口 - 流式产出JobData
        
        Args:
            max_items: 最大爬取数量, 0表示不限制
            
        Yields:
            JobData: 爬取到的岗位数据
        """
        if not await self.initialize():
            return
        
        self.stats.status = SpiderStatus.RUNNING
        self.stats.start_time = datetime.now().isoformat()
        self.start_runtime_timer()
        
        try:
            count = 0
            async for job in self._strategy.execute(self, max_items):
                yield job
                count += 1
                self.stats.items_extracted += 1
                
                if max_items > 0 and count >= max_items:
                    break
                    
                if self.is_time_limit_exceeded():
                    logger.info(f"[{self.source}] 达到运行时间限制")
                    break
        except Exception as exc:
            logger.error(f"[{self.source}] 爬取失败: {exc}")
            self.stats.status = SpiderStatus.ERROR
        finally:
            self.stats.end_time = datetime.now().isoformat()
            if self.stats.status == SpiderStatus.RUNNING:
                self.stats.status = SpiderStatus.COMPLETED
            
            dedup_stats = await self._get_dedup_stats()
            logger.info(
                f"[{self.source}] 爬取完成: {self.stats.items_extracted} 条, "
                f"去重统计: 总数 {dedup_stats.get('total_count', 0)} 条, "
                f"唯一 {dedup_stats.get('unique_count', 0)} 条"
            )
            await self.close()

    async def crawl(self, keyword: str = "", location: str = "", max_items: int = 0) -> List[JobData]:
        """
        向后兼容接口 - 返回List[JobData]
        
        内部调用 crawl_stream() 并收集结果
        """
        jobs = [job async for job in self.crawl_stream(max_items)]
        return jobs

    async def _get_dedup_stats(self) -> Dict[str, Any]:
        """获取去重统计信息"""
        if hasattr(self, 'db') and self.db:
            return await self.db.get_dedup_stats(self.source)
        return {}

    def use(self, middleware_or_plugin: Any) -> 'UnifiedSpider':
        """
        注册中间件或插件 (预留接口)
        
        Args:
            middleware_or_plugin: 中间件或插件实例
            
        Returns:
            self - 支持链式调用
        """
        if not hasattr(self, '_middlewares'):
            self._middlewares = []
        if not hasattr(self, '_plugins'):
            self._plugins = []
            
        from .middleware.base import BaseMiddleware
        from .plugins.base import CrawlPlugin
        
        if isinstance(middleware_or_plugin, BaseMiddleware):
            self._middlewares.append(middleware_or_plugin)
            logger.debug(f"[{self.source}] 注册中间件: {type(middleware_or_plugin).__name__}")
        elif isinstance(middleware_or_plugin, CrawlPlugin):
            self._plugins.append(middleware_or_plugin)
            logger.debug(f"[{self.source}] 注册插件: {type(middleware_or_plugin).__name__}")
        else:
            logger.warning(f"[{self.source}] 未知的组件类型: {type(middleware_or_plugin)}")
        
        return self


def create_spider(source: str, config: Optional[Dict[str, Any]] = None, headless: bool = True, session=None) -> UnifiedSpider:
    """创建统一爬虫实例"""
    return UnifiedSpider(source, config, headless, session)
