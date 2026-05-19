"""
统一爬虫 - 轻量级调度器
根据spider_type委托给对应的Strategy执行爬取逻辑

架构: 策略模式 + 异步生成器 + 中间件管道 + 插件系统
- UnifiedSpider (调度器, < 200行) - 负责策略选择和生命周期管理
- BaseCrawlStrategy (抽象基类) - 定义策略接口
- ApiPostStrategy/ApiGetStrategy/HtmlStrategy/BrowserStrategy - 具体实现
- MiddlewarePipeline (洋葱模型) - 中间件执行管道
- PluginManager (观察者模式) - 插件生命周期管理
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
        
        # 初始化中间件管道和插件管理器
        from .middleware.pipeline import MiddlewarePipeline
        from .plugins.manager import PluginManager
        
        self._middleware_pipeline = MiddlewarePipeline()
        self._plugin_manager = PluginManager()
        
        # 默认启用LoggerMiddleware（如果可用）
        try:
            from .middleware.built_in import LoggerMiddleware
            self.use(LoggerMiddleware())
        except Exception:
            pass
        
        logger.debug(f"[{self.source}] 初始化策略: {self._strategy.get_type()}")

    @property
    def strategy(self) -> 'BaseCrawlStrategy':
        return self._strategy
    
    @property
    def middleware_pipeline(self) -> 'MiddlewarePipeline':
        return self._middleware_pipeline
    
    @property
    def plugin_manager(self) -> 'PluginManager':
        return self._plugin_manager

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
            
            # 触发插件的 on_register 钩子
            await self._plugin_manager.on_register_all(self)
            
            self.stats.status = SpiderStatus.IDLE
            return True
        except Exception as exc:
            self.log_error("初始化失败", exc)
            self.stats.status = SpiderStatus.ERROR
            return False

    async def crawl_stream(self, max_items: int = 0) -> AsyncIterator[JobData]:
        """
        异步生成器接口 - 流式产出JobData
        
        执行流程:
        1. 初始化Session和插件
        2. 触发 before_crawl 插件钩子
        3. 通过中间件管道执行策略
        4. 触发 after_crawl 插件钩子
        5. 清理资源
        
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
        
        # 触发插件 before_crawl 钩子
        await self._plugin_manager.before_crawl(self)
        
        try:
            # 定义最终的策略执行handler
            async def execute_strategy(context: Dict[str, Any]):
                """内部函数：实际执行策略并产出JobData"""
                count = 0
                results = []
                
                async for job in self._strategy.execute(self, max_items):
                    # 触发插件 on_job_extracted 钩子
                    processed_job = await self._plugin_manager.on_job_extracted(self, job)
                    if processed_job is None:
                        continue
                    
                    results.append(processed_job)
                    count += 1
                    self.stats.items_extracted += 1
                    
                    if max_items > 0 and count >= max_items:
                        break
                        
                    if self.is_time_limit_exceeded():
                        logger.info(f"[{self.source}] 达到运行时间限制")
                        break
                
                return results
            
            # 构建上下文对象
            context = {
                'spider': self,
                'source': self.source,
                'max_items': max_items,
                'start_time': self.stats.start_time,
            }
            
            # 通过中间件管道执行（如果没有注册中间件则直接执行）
            if len(self._middleware_pipeline) > 0:
                jobs = await self._middleware_pipeline.execute(context, execute_strategy)
            else:
                jobs = await execute_strategy(context)
            
            # 产出所有结果
            for job in (jobs or []):
                yield job
                
        except Exception as exc:
            logger.error(f"[{self.source}] 爬取失败: {exc}")
            self.stats.status = SpiderStatus.ERROR
            
            # 触发插件 on_error 钩子
            await self._plugin_manager.on_error(self, exc, context={'phase': 'crawl'})
            
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
            
            # 触发插件 after_crawl 钩子
            await self._plugin_manager.after_crawl(self, [])
            
            # 只关闭自己创建的Session，不关闭外部注入的共享Session
            if not getattr(self, 'external_session', None):
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
        注册中间件或插件
        
        支持链式调用:
            spider.use(LoggerMiddleware()) \\
                  .use(RateLimitPlugin()) \\
                  .use(MetricsPlugin())
        
        Args:
            middleware_or_plugin: 中间件(BaseMiddleware)或插件(CrawlPlugin)实例
            
        Returns:
            self - 支持链式调用
        """
        from .middleware.base import BaseMiddleware
        from .plugins.base import CrawlPlugin
        
        if isinstance(middleware_or_plugin, BaseMiddleware):
            self._middleware_pipeline.use(middleware_or_plugin)
            logger.debug(f"[{self.source}] 注册中间件: {type(middleware_or_plugin).__name__}")
        elif isinstance(middleware_or_plugin, CrawlPlugin):
            self._plugin_manager.register(middleware_or_plugin)
            logger.debug(f"[{self.source}] 注册插件: {type(middleware_or_plugin).__name__}")
        else:
            logger.warning(f"[{self.source}] 未知的组件类型: {type(middleware_or_plugin).__name__}")
        
        return self


def create_spider(source: str, config: Optional[Dict[str, Any]] = None, headless: bool = True, session=None) -> UnifiedSpider:
    """创建统一爬虫实例"""
    return UnifiedSpider(source, config, headless, session)
