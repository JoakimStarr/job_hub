"""
UIBE 浏览器爬虫（Playwright）
目标：访问 https://career.uibe.edu.cn/front/channel.jspa?channelId=764&parentId=625
1) 抓取页面上的岗位链接
2) 访问详情页获取完整信息
3) 处理分页

实现基于 BaseBrowserSpider，返回 JobData 列表
"""

import asyncio
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from loguru import logger
from playwright.async_api import Page

try:
    from .base import BaseBrowserSpider, JobData, SpiderStatus
    from .utils import normalize_publish_date, clean_company_name, truncate_text
except ImportError:
    from base import BaseBrowserSpider, JobData, SpiderStatus
    from utils import normalize_publish_date, clean_company_name, truncate_text


class UibeJobSpider(BaseBrowserSpider):
    """UIBE 浏览器爬虫：使用 Playwright 解析页面链接"""
    
    NAME = "uibe_jobs"
    UNIVERSITY_NAME = "对外经济贸易大学"
    LOCATION = "北京"
    BASE_URL = "https://career.uibe.edu.cn"
    START_URL = "https://career.uibe.edu.cn/front/channel.jspa?channelId=764&parentId=625"
    MAX_CONCURRENT_DETAILS = 3
    
    def __init__(self, config: Optional[Dict[str, Any]] = None, headless: bool = True):
        merged_config = config or {}
        merged_config["headless"] = headless
        super().__init__(self.NAME, merged_config)
        self._detail_cache: Dict[str, JobData] = {}
    
    async def crawl(self, keyword: str = "", location: str = "", max_items: int = 0) -> List[JobData]:
        """启动爬取，返回 JobData 列表"""
        jobs: List[JobData] = []
        page = None
        
        try:
            if not await self.initialize():
                return jobs
            
            self.stats.status = SpiderStatus.RUNNING
            self.stats.start_time = datetime.now().isoformat()
            self.start_runtime_timer()
            
            page = await self.new_page()
            await page.goto(self.START_URL, wait_until="domcontentloaded", timeout=15000)
            await asyncio.sleep(1.5)
            
            current_page = 1
            while True:
                if self.is_time_limit_exceeded():
                    break
                if max_items > 0 and len(jobs) >= max_items:
                    break
                
                logger.info(f"[{self.NAME}] 正在爬取第 {current_page} 页")
                
                page_jobs = await self._parse_list_page(page)
                if not page_jobs:
                    logger.warning(f"[{self.NAME}] 第 {current_page} 页无数据")
                    break
                
                detail_urls = [j.source_url for j in page_jobs if j.source_url]
                existing_urls = await self.get_existing_urls(detail_urls)
                
                tasks = []
                semaphore = asyncio.Semaphore(self.MAX_CONCURRENT_DETAILS)
                
                async def enrich_job_with_limit(job: JobData):
                    async with semaphore:
                        if job.source_url and job.source_url in existing_urls:
                            return None
                        
                        if job.source_url and job.source_url in self._detail_cache:
                            return self._detail_cache[job.source_url]
                        
                        if job.source_url:
                            try:
                                detail_page = await self.new_page()
                                try:
                                    await detail_page.goto(job.source_url, wait_until="domcontentloaded", timeout=15000)
                                    await asyncio.sleep(0.5)
                                    await self._enrich_job_from_page(job, detail_page)
                                    self._detail_cache[job.source_url] = job
                                    return job
                                finally:
                                    await detail_page.close()
                            except Exception as e:
                                logger.warning(f"[{self.NAME}] 详情页获取失败: {type(e).__name__}: {str(e) or '未知错误'} | URL: {job.source_url}")
                                return None
                        return job
                
                for job in page_jobs:
                    if max_items > 0 and len(jobs) >= max_items:
                        break
                    tasks.append(enrich_job_with_limit(job))
                
                if tasks:
                    results = await asyncio.gather(*tasks, return_exceptions=True)
                    for result in results:
                        if isinstance(result, JobData):
                            jobs.append(result)
                            self.mark_url_seen(result.source_url)
                            self.stats.items_extracted += 1
                        elif isinstance(result, Exception):
                            logger.warning(f"[{self.NAME}] 并发获取详情失败: {result}")
                
                self.stats.pages_crawled += 1
                
                if max_items > 0 and len(jobs) >= max_items:
                    break
                
                next_page = current_page + 1
                next_link = page.locator(f'.pagination a[data-page="{next_page}"]:not(.page-top)').first
                if await next_link.count() == 0:
                    logger.info(f"[{self.NAME}] 已到最后一页")
                    break
                
                try:
                    await next_link.click()
                    await asyncio.sleep(2)
                    current_page = next_page
                except Exception as e:
                    logger.warning(f"[{self.NAME}] 翻页到第 {next_page} 页失败: {e}")
                    break
            
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
        """解析列表页面的岗位链接"""
        jobs: List[JobData] = []
        try:
            links = await page.query_selector_all("a[href*='/front/zpxx.jspa?tid=']")
            seen_urls = set()
            
            for link in links:
                href = await link.get_attribute("href") or ""
                if not href:
                    continue
                
                if not href.startswith("http"):
                    href = self.BASE_URL + href
                
                if href in seen_urls:
                    continue
                
                title = (await link.inner_text()).strip()
                if not title:
                    continue
                
                seen_urls.add(href)
                
                jobs.append(JobData(
                    title=title,
                    company="未知公司",
                    location=self.LOCATION,
                    description=truncate_text(title),
                    salary="面议",
                    job_type="全职",
                    source="uibe",
                    university=self.UNIVERSITY_NAME,
                    source_url=href,
                    apply_url=href,
                ))
        except Exception as e:
            logger.warning(f"[{self.NAME}] 解析列表失败: {e}")
        
        return jobs
    
    async def _enrich_job_from_page(self, job: JobData, page: Page):
        """从详情页补充岗位信息"""
        text_content = ""
        try:
            content_div = await page.query_selector("div.details-content")
            if not content_div:
                content_div = await page.query_selector("div.main")
            
            if content_div:
                text = (await content_div.inner_text()).strip()
                if text:
                    text_content = text
                    job.description = truncate_text(text)
                    
                    lines = text.split('\n')
                    for line in lines:
                        line = line.strip()
                        if '薪资' in line or '工资' in line or '待遇' in line or '薪酬' in line:
                            salary_match = re.search(r'(\d+[-~]\d+万?/月|\d+[-~]\d+K|\d+[-~]\d+元|面议)', line)
                            if salary_match:
                                job.salary = salary_match.group(1)
                        elif '学历' in line or '要求' in line:
                            edu_match = re.search(r'(本科|硕士|博士|大专|高中|中专)', line)
                            if edu_match and not job.education:
                                job.education = edu_match.group(1)
                        elif '地点' in line or '工作地' in line or '地点：' in line:
                            loc_match = re.search(r'([\u4e00-\u9fa5]{2,10})', line)
                            if loc_match and not job.location:
                                job.location = loc_match.group(1)
                        elif '公司' in line or '企业' in line or '单位' in line:
                            company_match = re.search(r'[:：]\s*([^\n]+)', line)
                            if company_match:
                                job.company = clean_company_name(company_match.group(1).strip())
            
            title_el = await page.query_selector("h1")
            if title_el:
                real_title = (await title_el.inner_text()).strip()
                if real_title:
                    job.title = real_title
            
            date_match = re.search(r'(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?)', text_content)
            if date_match:
                job.publish_date = normalize_publish_date(date_match.group(1))
        except Exception as e:
            logger.warning(f"[{self.NAME}] 解析详情页失败: {e}")


def create_uibe_spider(config: dict = None, headless: bool = True) -> UibeJobSpider:
    """创建UIBE爬虫实例"""
    return UibeJobSpider(config=config, headless=headless)
