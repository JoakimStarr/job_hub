import asyncio
import re
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

from loguru import logger
from playwright.async_api import Page

try:
    from .base import BaseBrowserSpider, JobData, SpiderStatus
    from .utils import normalize_publish_date, extract_salary, clean_company_name, truncate_text
except ImportError:
    from base import BaseBrowserSpider, JobData, SpiderStatus
    from utils import normalize_publish_date, extract_salary, clean_company_name, truncate_text


class JxufeJobSpider(BaseBrowserSpider):
    BASE_URL = "http://career.jxufe.edu.cn"
    NAME = "jxufe_jobs"
    UNIVERSITY_NAME = "江西财经大学现代经济管理学院"
    LOCATION = "南昌"
    LIST_API_URL = "http://career.jxufe.edu.cn/module/getonlines"
    DETAIL_URL = "http://career.jxufe.edu.cn/detail/online?id={recruitment_id}"
    RECRUIT_TYPES = [
        ("正式招聘", "全职"),
        ("实习招聘", "实习"),
    ]
    MAX_CONCURRENT_DETAILS = 3

    def __init__(self, config: Optional[Dict[str, Any]] = None, headless: bool = True):
        merged_config = config or {}
        merged_config["headless"] = headless
        super().__init__(self.NAME, merged_config)
        self._detail_cache: Dict[str, JobData] = {}

    async def crawl(self, keyword: str = "", location: str = "", max_items: int = 0) -> List[JobData]:
        jobs: List[JobData] = []
        page = None
        try:
            if not await self.initialize():
                return jobs
            self.stats.status = SpiderStatus.RUNNING
            self.stats.start_time = datetime.now().isoformat()
            self.start_runtime_timer()
            page = await self.new_page()
            await page.goto(f"{self.BASE_URL}/module/onlines?type=1&menu_id=5538", wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(2)

            for recruit_type, job_type in self.RECRUIT_TYPES:
                if max_items > 0 and len(jobs) >= max_items:
                    break

                current_page = 1
                while True:
                    if max_items > 0 and len(jobs) >= max_items:
                        break
                    logger.info(f"[{self.NAME}] 正在爬取{recruit_type} 第 {current_page} 页")
                    page_items = await self._fetch_list_page(page, current_page, recruit_type)
                    if not page_items:
                        break

                    detail_urls = [
                        self.DETAIL_URL.format(recruitment_id=item.get("recruitment_id", ""))
                        for item in page_items
                        if item.get("recruitment_id")
                    ]
                    existing_urls = await self.get_existing_urls(detail_urls)

                    tasks = []
                    semaphore = asyncio.Semaphore(self.MAX_CONCURRENT_DETAILS)
                    
                    async def fetch_detail_with_limit(item: Dict[str, Any], job_type: str):
                        async with semaphore:
                            recruitment_id = item.get("recruitment_id")
                            if not recruitment_id:
                                return None
                            
                            detail_url = self.DETAIL_URL.format(recruitment_id=recruitment_id)
                            if detail_url in existing_urls:
                                return None
                            
                            if detail_url in self._detail_cache:
                                return self._detail_cache[detail_url]
                            
                            detail_page = None
                            try:
                                detail_page = await self.new_page()
                                job = await self._fetch_detail_job(detail_page, item, job_type)
                                if job:
                                    self._detail_cache[detail_url] = job
                                return job
                            finally:
                                if detail_page:
                                    await detail_page.close()
                    
                    for item in page_items:
                        if max_items > 0 and len(jobs) >= max_items:
                            break
                        tasks.append(fetch_detail_with_limit(item, job_type))
                    
                    if tasks:
                        results = await asyncio.gather(*tasks, return_exceptions=True)
                        for result in results:
                            if isinstance(result, JobData):
                                jobs.append(result)
                                self.stats.items_extracted += 1
                            elif isinstance(result, Exception):
                                logger.warning(f"[{self.NAME}] 并发获取详情失败: {result}")

                    self.stats.pages_crawled += 1
                    current_page += 1

            self.stats.status = SpiderStatus.COMPLETED
            self.stats.end_time = datetime.now().isoformat()
            logger.info(f"[{self.NAME}] 爬取完成: {len(jobs)} 条")
            return jobs
        except Exception as exc:
            logger.error(f"[{self.NAME}] 爬取失败: {exc}")
            self.stats.status = SpiderStatus.ERROR
            return jobs
        finally:
            if page:
                await page.close()
            await self.close()

    async def _parse_list_page(self, page: Page) -> List[JobData]:
        jobs = []
        try:
            links = await page.query_selector_all("a[href*='/detail/online?id=']")
            for link in links:
                href = await link.get_attribute("href") or ""
                if not href.startswith("http"):
                    href = self.BASE_URL + href
                title = (await link.inner_text()).strip()
                if not title:
                    continue
                company = clean_company_name(self._extract_company(title))
                jobs.append(JobData(
                    title=title, company=company, location=self.LOCATION,
                    description="", salary="面议", source=self.UNIVERSITY_NAME,
                    university=self.UNIVERSITY_NAME, source_url=href, apply_url=href,
                ))
        except Exception as exc:
            logger.warning(f"[{self.NAME}] 解析列表失败: {exc}")
        return jobs

    async def _fetch_list_page(self, page: Page, start_page: int, recruit_type: str) -> List[Dict[str, Any]]:
        try:
            params = {
                "start_page": str(start_page),
                "k": "",
                "recruit_type": recruit_type,
                "panel_id": "",
                "professionals": "",
                "work_city": "",
                "company_property": "",
                "company_industry": "",
                "count": "15",
                "start": "1",
                "_": str(int(time.time() * 1000)),
            }

            response = await page.evaluate(
                """async (payload) => {
                    try {
                        const url = new URL(payload.url);
                        Object.entries(payload.params).forEach(([key, value]) => url.searchParams.set(key, value));
                        const res = await fetch(url.toString(), {
                            method: 'GET',
                            credentials: 'include',
                            headers: {
                                'Accept': 'application/json, text/plain, */*',
                                'X-Requested-With': 'XMLHttpRequest',
                                'Referer': payload.referer,
                            },
                        });
                        if (!res.ok) return null;
                        return await res.json();
                    } catch (error) {
                        return {error: error.message};
                    }
                }""",
                {
                    "url": self.LIST_API_URL,
                    "params": params,
                    "referer": f"{self.BASE_URL}/module/onlines?type=1&menu_id=5538",
                },
            )

            if not response or response.get("error"):
                if response and response.get("error"):
                    logger.warning(f"[{self.NAME}] 获取{recruit_type}第 {start_page} 页失败: {response['error']}")
                return []
            if response.get("code") != 1:
                return []
            data = response.get("data") or []
            return data if isinstance(data, list) else []
        except Exception as exc:
            logger.warning(f"[{self.NAME}] 获取{recruit_type}第 {start_page} 页失败: {exc}")
            return []

    async def _fetch_detail_job(self, page: Page, item: Dict[str, Any], job_type: str) -> Optional[JobData]:
        recruitment_id = item.get("recruitment_id")
        if not recruitment_id:
            return None

        detail_url = self.DETAIL_URL.format(recruitment_id=recruitment_id)
        try:
            await page.goto(detail_url, wait_until="domcontentloaded", timeout=15000)
            await asyncio.sleep(0.5)
            return await self._parse_detail_page(item, detail_url, job_type, page)
        except Exception as exc:
            logger.warning(f"[{self.NAME}] 详情页获取失败 {detail_url}: {exc}")
            return None

    def _extract_company(self, title: str) -> str:
        for sep in ["——", "—", "-", "_"]:
            if sep in title:
                parts = title.split(sep)
                if len(parts) >= 2:
                    return parts[0].strip()
        return "未知公司"

    async def _enrich_job_from_page(self, job: JobData, page: Page):
        try:
            details_div = await page.query_selector("div.details-content")
            if details_div:
                text = await details_div.inner_text()
                if text:
                    job.description = truncate_text(text.strip())
                    
                    lines = text.split('\n')
                    for line in lines:
                        line = line.strip()
                        if '薪资' in line or '工资' in line or '待遇' in line:
                            salary_match = re.search(r'(\d+[-~]\d+万?/月|\d+[-~]\d+K|面议)', line)
                            if salary_match:
                                job.salary = salary_match.group(1)
                        elif '学历' in line or '要求' in line:
                            edu_match = re.search(r'(本科|硕士|博士|大专|高中|中专)', line)
                            if edu_match and not job.education:
                                job.education = edu_match.group(1)
                        elif '地点' in line or '工作地' in line:
                            loc_match = re.search(r'([\u4e00-\u9fa5]{2,10})', line)
                            if loc_match and not job.location:
                                job.location = loc_match.group(1)
            
            h1 = await page.query_selector("h1")
            if h1:
                h1_text = await h1.inner_text()
                date_match = re.search(r'(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?)', h1_text)
                if date_match:
                    job.publish_date = normalize_publish_date(date_match.group(1))
        except Exception as e:
            logger.warning(f"[{self.NAME}] 解析详情页失败: {e}")

    async def _parse_detail_page(
        self,
        item: Dict[str, Any],
        detail_url: str,
        job_type: str,
        page: Page,
    ) -> Optional[JobData]:
        try:
            title = item.get("title", "").strip()
            if not title:
                return None

            company = clean_company_name(item.get("company_name", "").strip() or "未知公司")
            location = item.get("work_city", "").strip() or self.LOCATION
            publish_date = normalize_publish_date(item.get("create_time", ""))
            industry = item.get("company_industry", "").strip()
            requirements = item.get("professionals", "").strip()

            try:
                body = await page.locator("body").inner_text(timeout=5000)
            except Exception:
                body = ""

            description = item.get("content", "").strip() or body.strip() or title
            if not description:
                description = title

            return JobData(
                title=title,
                company=company,
                location=location,
                description=truncate_text(description),
                salary="面议",
                requirements=requirements,
                job_type=job_type,
                industry=industry,
                source=self.UNIVERSITY_NAME,
                university=self.UNIVERSITY_NAME,
                source_url=detail_url,
                apply_url=detail_url,
                publish_date=publish_date,
            )
        except Exception as exc:
            logger.warning(f"[{self.NAME}] 解析详情失败: {exc}")
            return None
