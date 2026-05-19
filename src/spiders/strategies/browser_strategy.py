"""
BrowserStrategy - 浏览器自动化爬取策略

适用于需要浏览器渲染的复杂数据源:
- UIBE (对外经贸大学): browser_js - JS渲染页面，点击加载更多
- JXUFE (江西财经): browser_encrypted - 加密接口需JS解密
- NEU (东北大学): browser_js - 严格反爬检测
- SMARTEDU (国家智慧教育): browser_api - API接口但反爬严格

核心特点:
- 使用 Playwright 控制真实浏览器
- 反检测能力强（可绕过Cloudflare等WAF）
- 资源消耗大（每个实例~100-300MB内存）
- 速度慢（相比纯HTTP请求）

资源管理:
- 通过 semaphore 控制并发浏览器数量（默认3个）
- try-finally 确保浏览器资源正确释放
- 支持外部注入或延迟创建 semaphore

使用示例:
    strategy = BrowserStrategy()
    async for job in strategy.execute(spider, max_items=50):
        print(job.title)
"""

import asyncio
import os
from pathlib import Path
from typing import Any, AsyncIterator, Dict, List, Optional

from loguru import logger

from .base import BaseCrawlStrategy
from ..decorators import catch_and_log, measure_time, retry


class BrowserStrategy(BaseCrawlStrategy):
    """
    浏览器自动化爬取策略
    
    适用于: uibe (对外经贸), jxufe (江西财经), neu (东北大学), smartedu (国家智慧教育)
    
    子类型:
    - browser_js: 需要JS渲染的页面 (uibe, neu)
    - browser_encrypted: 加密接口需浏览器执行JS解密 (jxufe)
    - browser_api: API接口但反爬严格需浏览器伪装 (smartedu)
    
    特点:
    - 使用 Playwright 控制真实浏览器
    - 反检测能力强 (可绕过Cloudflare等WAF)
    - 资源消耗大 (每个实例~100-300MB内存)
    - 速度慢 (相比纯HTTP请求)
    """

    SUB_TYPE_MAP = {
        "browser_js": "js",
        "browser_encrypted": "encrypted",
        "browser_api": "api",
    }

    def __init__(self):
        super().__init__()
        self.browser_semaphore: Optional[asyncio.Semaphore] = None
        self.headless: bool = True
        self._slot_acquired: bool = False

    def get_type(self) -> str:
        return 'browser'

    def _get_logger(self, source_key: str):
        return logger.bind(strategy="browser", source=source_key)

    async def execute(
        self,
        spider: 'UnifiedSpider',
        max_items: int = 0
    ) -> AsyncIterator['JobData']:
        """
        执行浏览器自动化爬取策略
        
        流程:
        1. 检查 Playwright 和浏览器爬虫是否可用
        2. 获取 browser_semaphore 并发槽位
        3. 根据 spider_type 选择子策略并执行
        4. 对每条结果进行校验、评分、哈希
        5. yield 符合条件的 JobData
        6. finally 块中确保释放浏览器槽位
        
        Args:
            spider: UnifiedSpider实例(提供session/config/source_key等上下文)
            max_items: 最大产出数量(0表示不限制)
            
        Yields:
            JobData: 解析后的岗位数据
        """
        source_key = getattr(spider, 'source', 'unknown')
        log = self._get_logger(source_key)

        try:
            available = await self._check_browser_availability(source_key)
            if not available:
                return

            await self._acquire_browser_slot(spider)
            self._slot_acquired = True

            log.info(f"[{source_key}] 启动浏览器爬取策略 (子类型: {spider.spider_type})")

            results = await self._run_browser_crawl(spider, max_items)

            log.info(f"[{source_key}] 浏览器爬取完成，原始结果: {len(results)} 条")

            count = 0
            effective_max = max_items or getattr(spider, 'max_items', 0)

            for raw_data in results:
                if effective_max and count >= effective_max:
                    log.info(f"[{source_key}] 已达到最大数量限制: {effective_max}")
                    break

                if hasattr(spider, '_should_stop') and spider._should_stop:
                    log.info(f"[{source_key}] 收到停止信号")
                    break

                job = self._convert_to_jobdata(raw_data, spider)
                if job and self._validate_job(job):
                    job.quality_score = self._calculate_quality_score(job)
                    job.content_hash = self._compute_content_hash(job)
                    count += 1
                    self._count += 1
                    yield job

        except Exception as e:
            log.error(f"[{source_key}] 浏览器策略执行异常: {type(e).__name__}: {e}")
        finally:
            if self._slot_acquired:
                await self._release_browser_slot(spider)
                self._slot_acquired = False

    @measure_time(log_level="info")
    @retry(max_retries=2, backoff_base=2.0, exceptions=(Exception,))
    @catch_and_log(default_return=[], reraise=False)
    async def _run_browser_crawl(self, spider, max_items: int = 0) -> List[Any]:
        """
        根据子类型选择对应的浏览器爬取方法并执行
        
        Args:
            spider: UnifiedSpider实例
            max_items: 最大爬取数量
            
        Returns:
            原始岗位数据列表
        """
        source_key = getattr(spider, 'source', 'unknown')
        sub_type = self._detect_browser_sub_type(spider)

        from ..browser_wrapper import run_browser_spider

        browser_args = self._setup_browser_args(spider)

        logger.debug(
            f"[{source_key}] 浏览器参数: "
            f"headless={browser_args.get('headless')}, "
            f"max_items={max_items or browser_args.get('max_items', 0)}"
        )

        if sub_type == "js":
            return await self._crawl_with_js_rendering(spider, run_browser_spider, browser_args, max_items)
        elif sub_type == "encrypted":
            return await self._crawl_with_encryption(spider, run_browser_spider, browser_args, max_items)
        elif sub_type == "api":
            return await self._crawl_with_browser_api(spider, run_browser_spider, browser_args, max_items)
        else:
            logger.warning(f"[{source_key}] 未知的浏览器子类型: {sub_type}，使用默认模式")
            return await run_browser_spider(
                source_key=source_key,
                config=spider.config,
                headless=browser_args.get('headless', self.headless),
                max_items=max_items or getattr(spider, 'max_items', 0),
            )

    async def _check_browser_availability(self, source_key: str) -> bool:
        """检查 Playwright 和浏览器爬虫是否可用"""
        try:
            from ..browser_wrapper import is_browser_spider_available, PLAYWRIGHT_AVAILABLE

            if not PLAYWRIGHT_AVAILABLE:
                logger.warning(
                    f"[{source_key}] 浏览器爬虫需要Playwright支持，"
                    f"请安装: pip install playwright && playwright install chromium"
                )
                return False

            if not is_browser_spider_available():
                logger.warning(
                    f"[{source_key}] 浏览器爬虫模块加载失败，请检查爬虫文件是否存在"
                )
                return False

            return True
        except ImportError as e:
            logger.warning(f"[{source_key}] 导入浏览器模块失败: {e}")
            return False

    async def _acquire_browser_slot(self, spider):
        """获取浏览器并发槽位"""
        if self.browser_semaphore is None:
            max_conc = getattr(self.config, 'max_browser_concurrency', 3)
            self.browser_semaphore = asyncio.Semaphore(max_conc)
            logger.debug(f"创建浏览器信号量，最大并发数: {max_conc}")

        source_key = getattr(spider, 'source', 'unknown')
        logger.info(f"[{source_key}] 等待浏览器槽位...")
        await self.browser_semaphore.acquire()
        logger.info(f"[{source_key}] 已获取浏览器槽位 (剩余可用: {self.browser_semaphore._value})")

    async def _release_browser_slot(self, spider):
        """释放浏览器槽位"""
        if self.browser_semaphore is not None:
            self.browser_semaphore.release()
            source_key = getattr(spider, 'source', 'unknown')
            logger.info(f"[{source_key}] 已释放浏览器槽位 (剩余可用: {self.browser_semaphore._value + 1})")

    async def _crawl_with_js_rendering(
        self,
        spider,
        run_browser_fn,
        browser_args: dict,
        max_items: int = 0,
    ) -> List[Any]:
        """
        JS渲染型爬取 (UIBE, NEU)
        
        适用于: 页面内容由JavaScript动态生成
        流程:
          1. 打开目标URL
          2. 等待特定元素加载 (wait_for_selector)
          3. 可能需要点击"加载更多"按钮
          4. 提取页面中的岗位列表DOM
          5. 逐个解析为 JobData
        """
        source_key = getattr(spider, 'source', 'unknown')
        logger.info(f"[{source_key}] 执行JS渲染型爬取...")

        return await run_browser_fn(
            source_key=source_key,
            config=spider.config,
            headless=browser_args.get('headless', self.headless),
            max_items=max_items or getattr(spider, 'max_items', 0),
        )

    async def _crawl_with_encryption(
        self,
        spider,
        run_browser_fn,
        browser_args: dict,
        max_items: int = 0,
    ) -> List[Any]:
        """
        加密接口型爬取 (JXUFE)
        
        适用于: 接口有加密参数需浏览器JS引擎解密
        流程:
          1. 打开目标页面
          2. 注入JS脚本执行解密逻辑
          3. 拦截/提取解密后的API请求或数据
          4. 解析为 JobData
        """
        source_key = getattr(spider, 'source', 'unknown')
        logger.info(f"[{source_key}] 执行加密接口型爬取...")

        return await run_browser_fn(
            source_key=source_key,
            config=spider.config,
            headless=browser_args.get('headless', self.headless),
            max_items=max_items or getattr(spider, 'max_items', 0),
        )

    async def _crawl_with_browser_api(
        self,
        spider,
        run_browser_fn,
        browser_args: dict,
        max_items: int = 0,
    ) -> List[Any]:
        """
        浏览器伪装API型 (SMARTEDU)
        
        适用于: API接口但反爬严格，需真实浏览器指纹
        流程:
          1. 使用浏览器发起API请求 (绕过Bot检测)
          2. 提取响应数据
          3. 解析为 JobData
        """
        source_key = getattr(spider, 'source', 'unknown')
        logger.info(f"[{source_key}] 执行浏览器伪装API型爬取...")

        return await run_browser_fn(
            source_key=source_key,
            config=spider.config,
            headless=browser_args.get('headless', self.headless),
            max_items=max_items or getattr(spider, 'max_items', 0),
        )

    def _detect_browser_sub_type(self, spider) -> str:
        """
        根据配置检测具体的浏览器子类型
        
        Returns:
            'js' / 'encrypted' / 'api'
        """
        spider_type = getattr(spider, 'spider_type', '')
        return self.SUB_TYPE_MAP.get(spider_type, 'js')

    def _setup_browser_args(self, spider) -> dict:
        """
        构造浏览器启动参数
        
        Returns:
            包含以下键的字典:
            - headless: 是否无头模式
            - viewport: 视口大小
            - user_agent: 用户代理
            - proxy: 代理设置 (如有)
            - timeout: 页面加载超时
        """
        args = {
            'headless': self.headless,
            'viewport': {'width': 1920, 'height': 1080},
            'timeout': getattr(self.config, 'browser_timeout', 60),
        }

        headers = getattr(spider, 'spider_config', {}).get('headers', {})
        if 'User-Agent' in headers:
            args['user_agent'] = headers['User-Agent']

        proxy = getattr(spider.config, 'proxy', None) if hasattr(spider, 'config') else None
        if proxy:
            args['proxy'] = proxy

        if hasattr(spider, 'config') and isinstance(spider.config, dict):
            args['headless'] = spider.config.get('headless', self.headless)

        return args

    def _convert_to_jobdata(self, raw_data: Any, spider) -> Optional['JobData']:
        """
        将浏览器爬虫返回的原始数据转换为 JobData
        
        如果原始数据已经是 JobData 实例则直接返回，
        否则尝试从字典数据构造 JobData。
        
        Args:
            raw_data: 原始数据 (JobData / dict / 其他)
            spider: UnifiedSpider实例 (提供上下文信息)
            
        Returns:
            JobData 实例，转换失败返回 None
        """
        from ..base import JobData

        if isinstance(raw_data, JobData):
            return raw_data

        if isinstance(raw_data, dict):
            try:
                source = getattr(spider, 'source', 'unknown')
                university = getattr(spider, 'university', '')
                location = getattr(spider, 'location', '')

                return JobData(
                    title=raw_data.get('title', ''),
                    company=raw_data.get('company', '未知公司'),
                    location=raw_data.get('location', location),
                    description=raw_data.get('description', ''),
                    salary=raw_data.get('salary', '面议'),
                    requirements=raw_data.get('requirements', ''),
                    education=raw_data.get('education', ''),
                    job_type=raw_data.get('job_type', '全职'),
                    industry=raw_data.get('industry', ''),
                    publish_date=raw_data.get('publish_date', ''),
                    deadline=raw_data.get('deadline', ''),
                    tags=raw_data.get('tags', ''),
                    source=source,
                    university=university,
                    source_url=raw_data.get('source_url', ''),
                    apply_url=raw_data.get('apply_url', '') or raw_data.get('source_url', ''),
                )
            except Exception as e:
                logger.warning(f"[{getattr(spider, 'source', '?')}] 转换JobData失败: {e}")
                return None

        logger.warning(
            f"[{getattr(spider, 'source', '?')}] 不支持的原始数据类型: "
            f"{type(raw_data).__name__}"
        )
        return None

    async def _save_error_screenshot(self, page, source_key: str, reason: str = "error"):
        """
        在出错时保存页面截图用于调试
        
        Args:
            page: Playwright Page 实例
            source_key: 数据源标识
            reason: 截图原因
        """
        try:
            log_dir = Path(getattr(self.config, 'log_dir', 'logs'))
            log_dir.mkdir(parents=True, exist_ok=True)
            timestamp = __import__('datetime').datetime.now().strftime('%Y%m%d_%H%M%S')
            screenshot_path = log_dir / f"{source_key}_{reason}_{timestamp}.png"

            if hasattr(page, 'screenshot'):
                await page.screenshot(path=str(screenshot_path), full_page=True)
                logger.info(f"[{source_key}] 错误截图已保存: {screenshot_path}")
        except Exception as e:
            logger.warning(f"[{source_key}] 保存错误截图失败: {e}")

    def set_semaphore(self, semaphore: asyncio.Semaphore):
        """
        外部注入共享的浏览器信号量
        
        用于多个策略实例共享同一个并发限制。
        
        Args:
            semaphore: asyncio.Semaphore 实例
        """
        self.browser_semaphore = semaphore
        logger.debug(f"外部注入浏览器信号量，最大并发: {semaphore._value}")

    def __repr__(self) -> str:
        return (
            f"<BrowserStrategy("
            f"headless={self.headless}, "
            f"semaphore={'set' if self.browser_semaphore else 'none'})>"
        )
