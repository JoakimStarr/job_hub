import asyncio
import json
import random
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, List, Optional, Set

import aiohttp
from loguru import logger

try:
    from .constants import DEFAULT_USER_AGENTS, MAX_VISITED_URLS, VISITED_URLS_CLEANUP_RATIO
    from .utils import is_current_year_date, normalize_publish_date
except ImportError:
    from constants import DEFAULT_USER_AGENTS, MAX_VISITED_URLS, VISITED_URLS_CLEANUP_RATIO
    from utils import is_current_year_date, normalize_publish_date


class SpiderStatus:
    IDLE = "idle"
    INITIALIZING = "initializing"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    ERROR = "error"


@dataclass
class SpiderStats:
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    pages_crawled: int = 0
    items_extracted: int = 0
    items_valid: int = 0
    errors: int = 0
    retries: int = 0
    status: str = SpiderStatus.IDLE

    def to_dict(self) -> Dict[str, Any]:
        return {
            "start_time": self.start_time,
            "end_time": self.end_time,
            "pages_crawled": self.pages_crawled,
            "items_extracted": self.items_extracted,
            "items_valid": self.items_valid,
            "errors": self.errors,
            "retries": self.retries,
            "status": self.status,
        }

    def reset(self):
        self.start_time = None
        self.end_time = None
        self.pages_crawled = 0
        self.items_extracted = 0
        self.items_valid = 0
        self.errors = 0
        self.retries = 0
        self.status = SpiderStatus.IDLE


@dataclass
class JobData:
    title: str
    company: str
    location: str
    description: str
    salary: str = "面议"
    requirements: str = ""
    job_type: str = "实习"
    industry: str = ""
    education: str = ""
    experience: str = ""
    contact: str = ""
    source: str = ""
    university: str = ""
    source_url: str = ""
    apply_url: str = ""
    publish_date: str = ""
    deadline: str = ""
    category: str = ""
    tags: str = ""
    crawl_time: str = field(default_factory=lambda: datetime.now().isoformat())
    data_quality_score: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "company": self.company,
            "location": self.location,
            "description": self.description,
            "salary": self.salary,
            "requirements": self.requirements,
            "job_type": self.job_type,
            "industry": self.industry,
            "education": self.education,
            "experience": self.experience,
            "contact": self.contact,
            "source": self.source,
            "university": self.university,
            "source_url": self.source_url,
            "apply_url": self.apply_url,
            "publish_date": self.publish_date,
            "deadline": self.deadline,
            "category": self.category,
            "tags": self.tags,
            "crawl_time": self.crawl_time,
            "data_quality_score": self.data_quality_score,
        }

    def calculate_quality_score(self) -> float:
        score = 0.0
        if self.title and len(self.title) >= 3:
            score += 0.2
        if self.company and len(self.company) >= 3 and self.company not in ('未知公司', '公司'):
            score += 0.2
        if self.location and len(self.location) >= 2:
            score += 0.15
        if self.salary and self.salary != "面议":
            score += 0.15
        if self.description and len(self.description) >= 10:
            score += 0.1
        if self.publish_date and len(self.publish_date) >= 8:
            score += 0.1
        if self.source_url and self.source_url.startswith('http'):
            score += 0.1
        self.data_quality_score = round(score, 2)
        return self.data_quality_score


class BaseSpider(ABC):
    DEFAULT_USER_AGENTS = DEFAULT_USER_AGENTS

    def __init__(self, name: str, config: Optional[Dict[str, Any]] = None):
        self.name = name
        self.config = config or {}
        self.stats = SpiderStats()
        self.session: Optional[aiohttp.ClientSession] = None
        self._seen_urls: Set[str] = set()
        self._seen_items: Set[str] = set()
        self.max_runtime_seconds: int = int(self.config.get("max_runtime_seconds", 900))
        self._crawl_started_monotonic: Optional[float] = None
        self.replace_existing: bool = bool(self.config.get("replace_existing", False))
        self.incremental_stop_on_existing_page: bool = bool(
            self.config.get("incremental_stop_on_existing_page", not self.replace_existing)
        )
        self._existing_url_lookup: Optional[Callable[[List[str]], Awaitable[Set[str]]]] = self.config.get(
            "existing_url_lookup"
        )
        self.incremental_mode: str = str(self.config.get("incremental_mode", "conservative") or "conservative")
        self.failed_urls: Set[str] = set()
        self._cookie_jar: Optional[aiohttp.CookieJar] = None

    def start_runtime_timer(self) -> None:
        self._crawl_started_monotonic = time.monotonic()

    def is_time_limit_exceeded(self) -> bool:
        if self.max_runtime_seconds <= 0 or self._crawl_started_monotonic is None:
            return False
        return (time.monotonic() - self._crawl_started_monotonic) >= self.max_runtime_seconds

    @abstractmethod
    async def initialize(self) -> bool:
        pass

    @abstractmethod
    async def crawl(self, keyword: str = "", location: str = "", max_items: int = 20) -> List[JobData]:
        pass

    async def parse(self, html: str, url: str) -> List[Dict[str, Any]]:
        return []

    async def extract_data(self, raw_data: Dict[str, Any]) -> Optional[JobData]:
        return None

    async def validate_data(self, job_data: JobData) -> bool:
        if not job_data:
            return False
        if not job_data.title or len(job_data.title) < 2:
            return False
        if not job_data.company:
            return False
        return True

    async def request_with_retry(
        self,
        url: str,
        method: str = "GET",
        headers: Optional[Dict[str, str]] = None,
        data: Optional[Any] = None,
        max_retries: int = 3,
        timeout: int = 30,
        allow_redirects: bool = True,
        **kwargs,
    ) -> Optional[str]:
        if not self.session:
            logger.error(f"[{self.name}] HTTP会话未初始化")
            return None

        default_headers = {
            "User-Agent": random.choice(DEFAULT_USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Referer": url.split('?')[0] if url else "",
        }
        if headers:
            default_headers.update(headers)

        for attempt in range(max_retries):
            try:
                async with self.session.request(
                    method=method,
                    url=url,
                    headers=default_headers,
                    data=data,
                    timeout=aiohttp.ClientTimeout(total=timeout),
                    allow_redirects=allow_redirects,
                    **kwargs,
                ) as response:
                    if response.status == 200:
                        self.stats.pages_crawled += 1
                        return await response.text()
                    elif response.status in (301, 302, 303, 307, 308):
                        redirect_url = response.headers.get('Location', '')
                        if redirect_url and attempt < max_retries - 1:
                            logger.info(f"[{self.name}] 跟随重定向: {redirect_url}")
                            default_headers["Referer"] = url
                            url = redirect_url
                            await asyncio.sleep(0.5)
                            continue
                        logger.warning(f"[{self.name}] 重定向次数超限: {url}")
                    elif response.status in (429, 503, 502):
                        wait = min(2 ** attempt, 10)
                        logger.warning(f"[{self.name}] 请求受限({response.status})，等待{wait}秒...")
                        await asyncio.sleep(wait)
                    else:
                        logger.warning(f"[{self.name}] HTTP {response.status}: {url}")
            except asyncio.TimeoutError:
                logger.warning(f"[{self.name}] 请求超时({attempt + 1}/{max_retries}): {url}")
            except aiohttp.ClientError as e:
                logger.warning(f"[{self.name}] 请求错误({attempt + 1}/{max_retries}): {e}")
            except Exception as e:
                logger.error(f"[{self.name}] 未知错误: {e}")

            self.stats.retries += 1
            if attempt < max_retries - 1:
                await asyncio.sleep(random.uniform(1, 3))

        self.stats.errors += 1
        if url:
            self.failed_urls.add(url)
        return None

    async def request_json_with_retry(
        self,
        url: str,
        method: str = "GET",
        headers: Optional[Dict[str, str]] = None,
        data: Optional[Any] = None,
        max_retries: int = 3,
        timeout: int = 30,
        **kwargs,
    ) -> Optional[Dict[str, Any]]:
        json_headers = {"Accept": "application/json, text/plain, */*"}
        if headers:
            json_headers.update(headers)
        text = await self.request_with_retry(url, method, json_headers, data, max_retries, timeout, **kwargs)
        if not text:
            return None
        try:
            return json.loads(text)
        except (json.JSONDecodeError, TypeError) as e:
            logger.warning(f"[{self.name}] JSON解析失败: {url} - {e}")
            return None

    async def random_delay(self, min_sec: float = 0.5, max_sec: float = 2.0) -> None:
        await asyncio.sleep(random.uniform(min_sec, max_sec))

    def log_error(self, message: str, exception: Optional[Exception] = None) -> None:
        self.stats.errors += 1
        if exception:
            logger.error(f"[{self.name}] {message}: {exception}")
        else:
            logger.error(f"[{self.name}] {message}")

    def is_duplicate_url(self, url: str) -> bool:
        return url in self._seen_urls

    def mark_url_seen(self, url: str) -> None:
        self._seen_urls.add(url)

    def is_duplicate_item(self, item_key: str) -> bool:
        return item_key in self._seen_items

    def mark_item_seen(self, item_key: str) -> None:
        self._seen_items.add(item_key)

    def is_current_year_job(self, publish_date: str) -> bool:
        if not publish_date:
            return False
        return is_current_year_date(str(publish_date))

    async def get_existing_urls(self, urls: List[str]) -> Set[str]:
        normalized_urls = [url.strip() for url in urls if url and url.strip()]
        if self.replace_existing or not normalized_urls:
            return set()
        known_urls = {url for url in normalized_urls if url in self._seen_urls}
        pending_urls = [url for url in normalized_urls if url not in known_urls]
        if pending_urls and self._existing_url_lookup:
            try:
                known_urls.update(await self._existing_url_lookup(pending_urls))
            except Exception as exc:
                logger.warning(f"[{self.name}] 增量存在性检查失败: {exc}")
        return known_urls

    def should_stop_after_existing_page(self, existing_count: int, current_page_new_count: int = 0) -> bool:
        if self.replace_existing or not self.incremental_stop_on_existing_page:
            return False
        if self.incremental_mode == "strict":
            return existing_count >= 3 and current_page_new_count <= max(1, existing_count // 2)
        return existing_count > 0

    def get_stats(self) -> Dict[str, Any]:
        return self.stats.to_dict()

    def reset_stats(self) -> None:
        self.stats.reset()
        self._seen_urls.clear()
        self._seen_items.clear()

    def trim_visited_urls(self, visited: set) -> set:
        if len(visited) > MAX_VISITED_URLS:
            trim_count = int(len(visited) * VISITED_URLS_CLEANUP_RATIO)
            trimmed = list(visited)
            visited = set(trimmed[trim_count:])
            logger.info(f"[{self.name}] visited_urls 清理 {trim_count} 条，剩余 {len(visited)} 条")
        return visited

    async def close(self) -> None:
        """
        关闭HTTP会话
        
        注意: 只关闭spider自身创建的Session，
        不关闭通过 external_session 注入的共享Session
        """
        # 检查是否拥有此Session（非外部注入）
        owns_session = not hasattr(self, 'external_session') or not self.external_session
        
        if self.session and owns_session:
            try:
                await self.session.close()
                logger.debug(f"[{self.name}] HTTP会话已关闭 (自有)")
            except Exception as e:
                logger.warning(f"[{self.name}] 关闭Session时出错: {e}")
            finally:
                self.session = None
        elif self.session and not owns_session:
            logger.debug(f"[{self.name}] 保留共享HTTP会话")

    async def __aenter__(self):
        await self.initialize()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()


class BaseAPISpider(BaseSpider):
    def __init__(self, name: str, base_url: str, config: Optional[Dict[str, Any]] = None):
        super().__init__(name, config)
        self.base_url = base_url.rstrip("/")

    async def initialize(self) -> bool:
        try:
            self.stats.status = SpiderStatus.INITIALIZING
            self._cookie_jar = aiohttp.CookieJar(unsafe=True)
            self.session = aiohttp.ClientSession(cookie_jar=self._cookie_jar)
            self.stats.status = SpiderStatus.IDLE
            logger.info(f"[{self.name}] API爬虫初始化完成")
            return True
        except Exception as e:
            self.log_error("初始化失败", e)
            self.stats.status = SpiderStatus.ERROR
            return False


class BaseBrowserSpider(BaseSpider):
    def __init__(self, name: str, config: Optional[Dict[str, Any]] = None):
        super().__init__(name, config)
        self.browser = None
        self.context = None
        self.headless = self.config.get("headless", True)
        self.viewport = self.config.get("viewport", {"width": 1920, "height": 1080})
        self._playwright = None

    async def initialize(self) -> bool:
        try:
            self.stats.status = SpiderStatus.INITIALIZING
            from playwright.async_api import async_playwright

            self._playwright = await async_playwright().start()
            browser_path = self._find_system_browser()
            launch_args = {
                "headless": self.headless,
                "args": [
                    "--disable-blink-features=AutomationControlled",
                    "--disable-web-security",
                    "--disable-dev-shm-usage",
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-gpu",
                    "--window-size=1920,1080",
                    "--no-first-run",
                    "--mute-audio",
                ],
            }
            if browser_path:
                launch_args["executable_path"] = browser_path

            self.browser = await self._playwright.chromium.launch(**launch_args)
            user_agent = random.choice(DEFAULT_USER_AGENTS)
            self.context = await self.browser.new_context(
                viewport=self.viewport,
                user_agent=user_agent,
                locale="zh-CN",
                timezone_id="Asia/Shanghai",
                color_scheme="light",
            )
            await self.context.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                window.chrome = { runtime: {} };
            """)

            self.session = aiohttp.ClientSession()
            self.stats.status = SpiderStatus.IDLE
            logger.info(f"[{self.name}] 浏览器爬虫初始化完成")
            return True
        except Exception as e:
            self.log_error("浏览器初始化失败", e)
            self.stats.status = SpiderStatus.ERROR
            return False

    def _find_system_browser(self) -> Optional[str]:
        import os
        import platform
        system = platform.system()
        paths = []
        if system == "Linux":
            paths = [
                "/usr/bin/google-chrome",
                "/usr/bin/google-chrome-stable",
                "/usr/bin/chromium",
                "/usr/bin/chromium-browser",
                "/usr/bin/microsoft-edge",
            ]
        elif system == "Darwin":
            paths = [
                "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            ]
        elif system == "Windows":
            pf = os.environ.get("ProgramFiles", "C:\\Program Files")
            paths = [
                os.path.join(pf, "Google", "Chrome", "Application", "chrome.exe"),
                os.path.join(pf, "Microsoft", "Edge", "Application", "msedge.exe"),
            ]
        for p in paths:
            if os.path.exists(p):
                return p
        return None

    async def new_page(self):
        if not self.context:
            raise RuntimeError("浏览器上下文未初始化")
        return await self.context.new_page()

    async def close(self) -> None:
        if self.context:
            try:
                await self.context.close()
            except Exception:
                pass
            self.context = None
        if self.browser:
            try:
                await self.browser.close()
            except Exception:
                pass
            self.browser = None
        if self._playwright:
            try:
                await self._playwright.stop()
            except Exception:
                pass
            self._playwright = None
        await super().close()
