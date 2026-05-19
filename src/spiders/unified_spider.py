"""
统一爬虫实现
根据spider_configs.py中的配置，动态处理不同类型的爬虫
"""

import math
import random
import time
from datetime import datetime
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

import aiohttp
from bs4 import BeautifulSoup
from loguru import logger

from .base import BaseSpider, JobData, SpiderStatus
from .spider_configs import get_spider_config
from .utils import (
    clean_company_name,
    gather_limited,
    html_to_text,
    normalize_publish_date,
    safe_get,
    truncate_text,
)


class UnifiedSpider(BaseSpider):
    """统一爬虫类，根据配置动态处理不同数据源"""

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

    async def crawl(self, keyword: str = "", location: str = "", max_items: int = 0) -> List[JobData]:
        jobs: List[JobData] = []
        try:
            if not await self.initialize():
                return jobs
            
            self.stats.status = SpiderStatus.RUNNING
            self.stats.start_time = datetime.now().isoformat()
            self.start_runtime_timer()
            
            if self.spider_type == "api_post":
                jobs = await self._crawl_api_post(max_items)
            elif self.spider_type == "api_get":
                jobs = await self._crawl_api_get(max_items)
            elif self.spider_type == "html":
                jobs = await self._crawl_html(max_items)
            elif self.spider_type in ["browser_api", "browser_encrypted", "browser_js"]:
                jobs = await self._crawl_browser(max_items)
            else:
                logger.error(f"[{self.source}] 未知的爬虫类型: {self.spider_type}")
            
            self.stats.status = SpiderStatus.COMPLETED
            self.stats.end_time = datetime.now().isoformat()
            
            dedup_stats = await self._get_dedup_stats()
            logger.info(
                f"[{self.source}] 爬取完成: {len(jobs)} 条, "
                f"去重统计: 总数 {dedup_stats.get('total_count', 0)} 条, "
                f"唯一 {dedup_stats.get('unique_count', 0)} 条"
            )
            return jobs
        except Exception as exc:
            logger.error(f"[{self.source}] 爬取失败: {exc}")
            self.stats.status = SpiderStatus.ERROR
            return jobs
        finally:
            await self.close()
    
    async def _get_dedup_stats(self) -> Dict[str, Any]:
        """获取去重统计信息"""
        if hasattr(self, 'db') and self.db:
            return await self.db.get_dedup_stats(self.source)
        return {}

    async def _crawl_api_post(self, max_items: int = 0) -> List[JobData]:
        """处理POST API类型的爬虫（SUFE, CUFE, DUFE）"""
        jobs: List[JobData] = []
        
        if self.source == "sufe":
            sections = self.spider_config.get("sections", [])
            for section_config in sections:
                if self.is_time_limit_exceeded():
                    break
                section_jobs = await self._crawl_sufe_section(section_config, max_items, len(jobs))
                jobs.extend(section_jobs)
                if max_items > 0 and len(jobs) >= max_items:
                    break
        else:
            position_types = self.spider_config.get("position_types", [])
            for pt in position_types:
                if self.is_time_limit_exceeded():
                    break
                type_jobs = await self._crawl_platform_type(pt["type"], max_items, len(jobs))
                jobs.extend(type_jobs)
                if max_items > 0 and len(jobs) >= max_items:
                    break
        
        return jobs

    async def _crawl_sufe_section(self, section_config: Dict, max_items: int, current_total: int) -> List[JobData]:
        """爬取SUFE的一个板块"""
        jobs: List[JobData] = []
        section = section_config["section"]
        
        for page_num in range(1, self.max_pages + 1):
            if self.is_time_limit_exceeded():
                break
            if max_items > 0 and (current_total + len(jobs)) >= max_items:
                break
            
            list_data = await self._fetch_sufe_list(section_config, page_num)
            if not list_data:
                break
            
            page_items = list_data.get("list") or []
            if not page_items:
                break
            
            detail_urls = [self._build_sufe_view_url(section_config, item) for item in page_items]
            existing_urls = await self.get_existing_urls(detail_urls)
            
            candidates = []
            for item in page_items:
                view_url = self._build_sufe_view_url(section_config, item)
                if view_url and view_url not in existing_urls:
                    candidates.append(item)
            
            if section == "zpgg":
                page_jobs = await gather_limited(
                    candidates, 
                    lambda item: self._fetch_sufe_notice_job(item, section_config), 
                    concurrency=4
                )
            else:
                page_jobs = await gather_limited(
                    candidates, 
                    lambda item: self._fetch_sufe_detail_job(item, section_config), 
                    concurrency=self.detail_concurrency
                )
            
            for job in page_jobs:
                if job:
                    jobs.append(job)
                    self.stats.items_extracted += 1
        
        return jobs

    async def _fetch_sufe_list(self, section_config: Dict, page_num: int) -> Optional[Dict]:
        """获取SUFE列表页数据"""
        section = section_config["section"]
        list_url = self.base_url + section_config["list_url"]
        
        try:
            referer = self.base_url + section_config["referer"]
            self.session.headers["Referer"] = referer
            
            async with self.session.post(list_url, data={"pageNum": str(page_num)}) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    if data.get("code") == 200:
                        return data.get("data")
        except Exception as e:
            logger.warning(f"[{self.source}] 获取列表失败 (section={section}, page={page_num}): {e}")
        
        return None

    async def _fetch_sufe_detail_job(self, item: Dict, section_config: Dict) -> Optional[JobData]:
        """获取SUFE详情页岗位"""
        item_id = item.get("zpxxid")
        if not item_id:
            logger.warning(f"[{self.source}] 列表项缺少zpxxid字段")
            return None
        
        detail_url = self.base_url + section_config["detail_url"].format(item_id=item_id)
        
        try:
            async with self.session.post(detail_url) as resp:
                if resp.status != 200:
                    logger.warning(f"[{self.source}] 详情API返回HTTP {resp.status}: {detail_url}")
                    return None
                
                data = await resp.json()
                if data.get("code") != 200:
                    logger.warning(f"[{self.source}] 详情API返回code={data.get('code')}: {data.get('msg', '未知错误')}")
                    return None
                
                detail = data.get("data")
                if not detail:
                    logger.warning(f"[{self.source}] 详情API返回数据为空")
                    return None
                
                return self._parse_sufe_job(detail, item)
        except Exception as e:
            logger.warning(f"[{self.source}] 获取详情失败: {type(e).__name__}: {str(e) or '未知错误'} | URL: {detail_url}")
            return None

    async def _fetch_sufe_notice_job(self, item: Dict, section_config: Dict) -> Optional[JobData]:
        """获取SUFE招聘公告岗位"""
        item_id = item.get("zpxxid")
        if not item_id:
            return None
        
        news_type = item.get("xxlb", "zpgg")
        detail_url = self.base_url + section_config["detail_url"].format(
            news_type=news_type, item_id=item_id
        )
        
        try:
            async with self.session.post(detail_url) as resp:
                if resp.status != 200:
                    return None
                
                data = await resp.json()
                if data.get("code") != 200:
                    return None
                
                detail = data.get("data")
                if not detail:
                    return None
                
                return self._parse_sufe_notice(detail, item)
        except Exception as e:
            logger.warning(f"[{self.source}] 获取公告详情失败: {e}")
            return None

    def _parse_sufe_job(self, detail: Dict, list_item: Dict) -> Optional[JobData]:
        """解析SUFE岗位数据"""
        try:
            title = detail.get("zpzt", "")
            company = detail.get("dwmc", "")
            
            if not title:
                return None
            
            company = clean_company_name(company)
            
            position_list = detail.get("zwxxList", [])
            if position_list:
                pos = position_list[0]
                location = pos.get("gzszxmc", "") or detail.get("szxmc", self.location)
                salary = pos.get("yxmc", "面议")
                education = pos.get("xlyqmc", "")
                experience = ""
                job_type = pos.get("gzlxmc", "全职")
                description = pos.get("zwms", "")
            else:
                location = detail.get("szxmc", self.location)
                salary = "面议"
                education = detail.get("xlyqmc", "")
                experience = ""
                job_type = "全职"
                description = ""
            
            company_intro = detail.get("dwjs", "")
            if company_intro:
                description = f"{description}\n\n公司介绍：{company_intro}" if description else company_intro
            
            publish_date = normalize_publish_date(detail.get("fbrq", ""))
            deadline = normalize_publish_date(detail.get("zpjzrq", ""))
            industry = detail.get("hyyjmc", "")
            requirements = detail.get("zyyqmc", "")
            
            item_id = detail.get("zpxxid", "")
            view_url = f"{self.base_url}/career/zpxx/view/zpxx/{item_id}"
            
            return JobData(
                title=title,
                company=company,
                location=location or self.location,
                description=truncate_text(description) or title,
                salary=salary,
                requirements=requirements,
                job_type=job_type,
                industry=industry,
                education=education,
                experience=experience,
                source=self.source,
                university=self.university,
                source_url=view_url,
                apply_url=view_url,
                publish_date=publish_date,
                deadline=deadline,
            )
        except Exception as e:
            logger.warning(f"[{self.source}] 解析岗位失败: {e}")
            return None

    def _parse_sufe_notice(self, detail: Dict, list_item: Dict) -> Optional[JobData]:
        """解析SUFE招聘公告"""
        try:
            title = detail.get("zpzt", "")
            if not title:
                return None
            
            company = clean_company_name(detail.get("dwmc", ""))
            description = html_to_text(detail.get("zwms", "") or detail.get("content", ""))
            
            publish_date = normalize_publish_date(detail.get("fbrq", ""))
            deadline = normalize_publish_date(detail.get("zpjzrq", ""))
            
            item_id = detail.get("zpxxid", "")
            news_type = detail.get("xxlb", "zpgg")
            view_url = f"{self.base_url}/career/news/view/{news_type}/{item_id}"
            
            return JobData(
                title=title,
                company=company,
                location=self.location,
                description=truncate_text(description) or title,
                salary="面议",
                requirements="",
                job_type="全职",
                industry=detail.get("hyyjmc", ""),
                education="",
                experience="",
                source=self.source,
                university=self.university,
                source_url=view_url,
                apply_url=view_url,
                publish_date=publish_date,
                deadline=deadline,
            )
        except Exception as e:
            logger.warning(f"[{self.source}] 解析公告失败: {e}")
            return None

    def _build_sufe_view_url(self, section_config: Dict, item: Dict) -> str:
        """构建SUFE查看URL"""
        item_id = item.get("zpxxid")
        if not item_id:
            return ""
        
        section = section_config["section"]
        if section == "zpgg":
            news_type = item.get("xxlb", "zpgg")
            return self.base_url + section_config["view_url"].format(
                news_type=news_type, item_id=item_id
            )
        else:
            return self.base_url + section_config["view_url"].format(item_id=item_id)

    async def _crawl_platform_type(self, position_type: str, max_items: int, current_total: int) -> List[JobData]:
        """爬取CUFE/DUFE平台的某一类型岗位"""
        jobs: List[JobData] = []
        
        for page_num in range(1, self.max_pages + 1):
            if self.is_time_limit_exceeded():
                break
            if max_items > 0 and (current_total + len(jobs)) >= max_items:
                break
            
            list_data = await self._fetch_platform_list(position_type, page_num)
            if not list_data or list_data.get("state") != 1:
                break
            
            obj = list_data.get("object") or {}
            items = obj.get("list") or []
            
            if not items:
                break
            
            page_urls = []
            for item in items:
                url_path = item.get("url", "")
                if url_path:
                    page_urls.append(urljoin(self.base_url, url_path))
            existing_urls = await self.get_existing_urls(page_urls)
            
            candidates = []
            for item in items:
                url_path = item.get("url", "")
                full_url = urljoin(self.base_url, url_path) if url_path else ""
                if full_url and full_url not in existing_urls:
                    candidates.append(item)
            
            page_jobs = await gather_limited(
                candidates, 
                lambda item: self._fetch_platform_detail(item, position_type), 
                concurrency=self.detail_concurrency
            )
            
            for job in page_jobs:
                if job:
                    jobs.append(job)
                    self.stats.items_extracted += 1
        
        return jobs

    async def _fetch_platform_list(self, position_type: str, page_num: int) -> Optional[Dict]:
        """获取CUFE/DUFE平台列表页"""
        list_url = self.base_url + self.spider_config["list_api_path"]
        
        try:
            data = {
                "pageNo": str(page_num),
                "positionType": position_type,
            }
            
            async with self.session.post(list_url, data=data) as resp:
                if resp.status == 200:
                    return await resp.json()
        except Exception as e:
            logger.warning(f"[{self.source}] 获取列表失败 (type={position_type}, page={page_num}): {e}")
        
        return None

    async def _fetch_platform_detail(self, item: Dict, position_type: str) -> Optional[JobData]:
        """获取CUFE/DUFE平台详情"""
        url_path = item.get("url", "")
        if not url_path:
            logger.warning(f"[{self.source}] 列表项缺少URL字段")
            return None
        
        try:
            from urllib.parse import urlparse, parse_qs
            parsed = urlparse(url_path)
            query_params = parse_qs(parsed.query)
            recruitment_id = query_params.get("recruitmentId", [None])[0]
            
            if not recruitment_id:
                logger.warning(f"[{self.source}] URL中缺少recruitmentId参数: {url_path}")
                return None
            
            ts = int(time.time() * 1000)
            detail_url = self.base_url + self.spider_config["detail_api_path"]
            
            params = {"ts": ts}
            data = {
                "ts": ts,
                "recruitmentId": recruitment_id,
            }
            
            async with self.session.post(detail_url, params=params, data=data) as resp:
                if resp.status != 200:
                    logger.warning(f"[{self.source}] 详情API返回HTTP {resp.status}: {detail_url}")
                    return None
                
                result = await resp.json()
                if result.get("state") != 1:
                    logger.warning(f"[{self.source}] 详情API返回state={result.get('state')}: {result.get('message', '未知错误')}")
                    return None
                
                detail = result.get("object", {}).get("recruitmentinfo")
                if not detail:
                    logger.warning(f"[{self.source}] 详情API返回数据中缺少recruitmentinfo字段")
                    return None
                
                return self._parse_platform_job(detail, item, position_type)
        except Exception as e:
            logger.warning(f"[{self.source}] 获取详情失败: {type(e).__name__}: {str(e) or '未知错误'} | URL: {url_path}")
            return None

    def _parse_platform_job(self, detail: Dict, list_item: Dict, position_type: str) -> Optional[JobData]:
        """解析CUFE/DUFE平台岗位"""
        try:
            title = detail.get("title", "")
            if not title:
                return None
            
            corp_info = detail.get("corporationinfo", {})
            company = clean_company_name(corp_info.get("name", ""))
            
            position_list = detail.get("recruitmentPositionList", [])
            if position_list:
                pos = position_list[0]
                location = pos.get("cityName", self.location)
                description = pos.get("positionDescription", "")
            else:
                location = self.location
                description = ""
            
            content = html_to_text(detail.get("content", ""))
            company_intro = corp_info.get("introduction", "")
            
            full_description = description
            if content:
                full_description = f"{full_description}\n\n{content}" if full_description else content
            if company_intro:
                full_description = f"{full_description}\n\n公司介绍：{company_intro}" if full_description else company_intro
            
            publish_date = normalize_publish_date(detail.get("startTime", ""))
            deadline = normalize_publish_date(detail.get("endTime", ""))
            
            position_type_value = detail.get("positionTypeValue", "")
            job_type = "全职" if "招聘" in position_type_value else "实习"
            
            recruitment_id = detail.get("id", "")
            view_url = f"{self.base_url}/f/recruitmentinfo/show?recruitmentId={recruitment_id}"
            apply_url = detail.get("onlineApplicationUrl", "") or view_url
            
            return JobData(
                title=title,
                company=company,
                location=location or self.location,
                description=truncate_text(full_description) or title,
                salary="面议",
                requirements=detail.get("majorName", ""),
                job_type=job_type,
                industry=corp_info.get("corporationNatureValue", ""),
                education=detail.get("education", ""),
                experience="",
                source=self.source,
                university=self.university,
                source_url=view_url,
                apply_url=apply_url,
                publish_date=publish_date,
                deadline=deadline,
            )
        except Exception as e:
            logger.warning(f"[{self.source}] 解析岗位失败: {e}")
            return None

    async def _crawl_api_get(self, max_items: int = 0) -> List[JobData]:
        """处理GET API类型的爬虫（ZUEL）"""
        jobs: List[JobData] = []
        
        categories = self.spider_config.get("categories", [])
        for cat_config in categories:
            if self.is_time_limit_exceeded():
                break
            cat_jobs = await self._crawl_zuel_category(cat_config, max_items, len(jobs))
            jobs.extend(cat_jobs)
            if max_items > 0 and len(jobs) >= max_items:
                break
        
        return jobs

    async def _crawl_zuel_category(self, cat_config: Dict, max_items: int, current_total: int) -> List[JobData]:
        """爬取ZUEL的一个类别"""
        jobs: List[JobData] = []
        api_type = cat_config["api_type"]
        
        for page_num in range(1, self.max_pages + 1):
            if self.is_time_limit_exceeded():
                break
            if max_items > 0 and (current_total + len(jobs)) >= max_items:
                break
            
            payload = await self._fetch_zuel_list(api_type, page_num)
            if not payload or payload.get("code") != 0:
                break
            
            items = payload.get("data") or []
            count = int(payload.get("count") or 0)
            
            if not items:
                break
            
            page_urls = [f"{self.base_url}/home/career/internship?id={item.get('id')}" 
                        for item in items if item.get("id")]
            existing_urls = await self.get_existing_urls(page_urls)
            
            candidates = []
            for item in items:
                detail_url = f"{self.base_url}/home/career/internship?id={item.get('id')}"
                if detail_url not in existing_urls:
                    item["_job_type"] = cat_config["job_type"]
                    candidates.append(item)
            
            page_jobs = await gather_limited(
                candidates, 
                self._fetch_zuel_detail, 
                concurrency=self.detail_concurrency
            )
            
            for job in page_jobs:
                if job:
                    jobs.append(job)
                    self.stats.items_extracted += 1
        
        return jobs

    async def _fetch_zuel_list(self, api_type: str, page_num: int) -> Optional[Dict]:
        """获取ZUEL列表页"""
        list_url = self.spider_config["list_api"]
        
        try:
            params = {
                "type": api_type,
                "page": page_num,
                "limit": self.spider_config.get("page_size", 10),
                "total": 0,
            }
            
            async with self.session.get(list_url, params=params) as resp:
                if resp.status == 200:
                    return await resp.json()
        except Exception as e:
            logger.warning(f"[{self.source}] 获取列表失败 (type={api_type}, page={page_num}): {e}")
        
        return None

    async def _fetch_zuel_detail(self, item: Dict) -> Optional[JobData]:
        """获取ZUEL详情"""
        job_id = item.get("id")
        if not job_id:
            logger.warning(f"[{self.source}] 列表项缺少id字段")
            return None
        
        detail_url = f"{self.spider_config['detail_api']}?id={job_id}"
        
        try:
            async with self.session.get(detail_url) as resp:
                if resp.status != 200:
                    logger.warning(f"[{self.source}] 详情API返回HTTP {resp.status}: {detail_url}")
                    return None
                
                data = await resp.json()
                if data.get("code") != 0:
                    logger.warning(f"[{self.source}] 详情API返回code={data.get('code')}: {data.get('msg', '未知错误')}")
                    return None
                
                detail = data.get("data")
                if not detail:
                    logger.warning(f"[{self.source}] 详情API返回数据为空")
                    return None
                
                return self._parse_zuel_job(detail, item)
        except Exception as e:
            logger.warning(f"[{self.source}] 获取详情失败: {type(e).__name__}: {str(e) or '未知错误'} | URL: {detail_url}")
            return None

    def _parse_zuel_job(self, detail: Dict, list_item: Dict) -> Optional[JobData]:
        """解析ZUEL岗位"""
        try:
            title = detail.get("title", "")
            if not title:
                return None
            
            company = detail.get("companyName", "")
            location = detail.get("area", self.location)
            salary = detail.get("salary", "面议")
            education = detail.get("education", "")
            requirements = detail.get("majors", "")
            industry = detail.get("nature", "")
            
            description_parts = []
            if detail.get("companyContent"):
                description_parts.append(html_to_text(detail["companyContent"]))
            if detail.get("dwjj"):
                description_parts.append(detail["dwjj"])
            if detail.get("zpgw"):
                description_parts.append(detail["zpgw"])
            
            description = "\n\n".join(description_parts)
            
            publish_date = normalize_publish_date(detail.get("createTime", ""))
            deadline = normalize_publish_date(detail.get("validTime", ""))
            
            job_type = list_item.get("_job_type", "全职")
            job_id = detail.get("id", "")
            view_url = f"{self.base_url}/home/career/internship?id={job_id}"
            
            return JobData(
                title=title,
                company=company,
                location=location or self.location,
                description=truncate_text(description) or title,
                salary=salary,
                requirements=requirements,
                job_type=job_type,
                industry=industry,
                education=education,
                experience="",
                source=self.source,
                university=self.university,
                source_url=view_url,
                apply_url=view_url,
                publish_date=publish_date,
                deadline=deadline,
            )
        except Exception as e:
            logger.warning(f"[{self.source}] 解析岗位失败: {e}")
            return None

    async def _crawl_html(self, max_items: int = 0) -> List[JobData]:
        """处理HTML类型的爬虫（SWUFE）"""
        jobs: List[JobData] = []
        
        if self.source != "swufe":
            logger.warning(f"[{self.source}] HTML爬虫未实现")
            return jobs
        
        url_patterns = self.spider_config.get("url_patterns", {})
        
        for pattern_key, pattern_config in url_patterns.items():
            if self.is_time_limit_exceeded():
                break
            if max_items > 0 and len(jobs) >= max_items:
                break
            
            pattern_jobs = await self._crawl_swufe_pattern(pattern_config, max_items, len(jobs))
            jobs = self._dedup_jobs(jobs, pattern_jobs)
        
        return jobs

    def _dedup_jobs(self, existing: List[JobData], new: List[JobData]) -> List[JobData]:
        """基于(title,company)去重，保留信息更完整的记录"""
        seen = {(j.title, j.company): j for j in existing}
        result = list(existing)
        skipped = 0
        for job in new:
            key = (job.title, job.company)
            if key in seen:
                old = seen[key]
                old_score = self._job_completeness(old)
                new_score = self._job_completeness(job)
                if new_score > old_score:
                    result.remove(old)
                    result.append(job)
                    seen[key] = job
                else:
                    skipped += 1
            else:
                result.append(job)
                seen[key] = job
        if skipped > 0:
            logger.info(f"[{self.source}] 跨模式去重: 跳过 {skipped} 条重复")
        return result

    @staticmethod
    def _job_completeness(job: JobData) -> int:
        """计算岗位信息完整度评分"""
        score = 0
        if job.description and len(job.description) > 50:
            score += len(job.description)
        if job.salary and job.salary != '面议':
            score += 100
        if job.location and job.location != '':
            score += 50
        if job.education and job.education != '' and job.education != '不限':
            score += 30
        if job.source_url and job.source_url and 'example.com' not in job.source_url:
            score += 20
        return score

    async def _crawl_swufe_pattern(self, pattern_config: Dict, max_items: int, current_total: int) -> List[JobData]:
        """爬取SWUFE的一个URL模式"""
        jobs: List[JobData] = []
        pattern = pattern_config["pattern"]
        start_id = pattern_config["start_id"]
        job_type = pattern_config["job_type"]
        
        consecutive_404 = 0
        current_id = start_id
        
        while consecutive_404 < 30:
            if self.is_time_limit_exceeded():
                break
            if max_items > 0 and (current_total + len(jobs)) >= max_items:
                break
            
            url = pattern.format(id=current_id)
            
            existing_urls = await self.get_existing_urls([url])
            if url not in existing_urls:
                job = await self._fetch_swufe_detail(url, job_type)
                if job:
                    jobs.append(job)
                    self.stats.items_extracted += 1
                    consecutive_404 = 0
                else:
                    consecutive_404 += 1
            else:
                consecutive_404 += 1
            
            current_id += 1
        
        return jobs

    async def _fetch_swufe_detail(self, url: str, job_type: str) -> Optional[JobData]:
        """获取SWUFE详情页"""
        try:
            async with self.session.get(url) as resp:
                if resp.status != 200:
                    logger.warning(f"[{self.source}] 详情页返回HTTP {resp.status}: {url}")
                    return None
                
                html = await resp.text()
                soup = BeautifulSoup(html, "html.parser")
                
                if soup.find("div", class_="no_page_group"):
                    logger.debug(f"[{self.source}] 页面不存在: {url}")
                    return None
                
                return self._parse_swufe_job(soup, url, job_type)
        except Exception as e:
            logger.warning(f"[{self.source}] 获取详情失败: {type(e).__name__}: {str(e) or '未知错误'} | URL: {url}")
            return None

    def _parse_swufe_job(self, soup: BeautifulSoup, url: str, job_type: str) -> Optional[JobData]:
        """解析SWUFE岗位"""
        try:
            title_el = soup.select_one("div.j-n-txt")
            title = title_el.get_text(strip=True) if title_el else ""
            
            if not title:
                return None
            
            date_el = soup.select_one("div.job_date span.cutom_font")
            date_raw = date_el.get_text(strip=True) if date_el else ""
            publish_date = normalize_publish_date(date_raw) if date_raw else ""
            
            company_el = soup.select_one("div.com-name")
            company_raw = company_el.get_text(strip=True) if company_el else ""
            company = clean_company_name(company_raw.lstrip(">").strip()) if company_raw else "未知公司"
            
            salary = ""
            experience = ""
            
            job_money_el = soup.select_one("span.job_money")
            if job_money_el:
                money_text = job_money_el.get_text(strip=True)
                label_div = job_money_el.find("div", class_="txt2")
                label = label_div.get_text(strip=True) if label_div else ""
                value = money_text.replace(label, "").strip() if label else money_text
                
                if label.startswith("招聘对象"):
                    experience = value
                else:
                    salary = value
            
            if not salary:
                for span in soup.select("div.job_msg span"):
                    label_div = span.find("div", class_="txt2")
                    if label_div and "薪酬" in label_div.get_text():
                        full_text = span.get_text(strip=True)
                        salary = full_text.replace(label_div.get_text(strip=True), "").strip()
                        break
            
            salary = salary if salary and salary not in ("应届生", "社会人员", "不限") else "面议"
            
            location = ""
            location_el = soup.select_one("span.job_position")
            if location_el:
                location = location_el.get("title", "") or location_el.get_text(strip=True)
            
            education = ""
            edu_el = soup.select_one("span.job_academic")
            if edu_el:
                edu_text = edu_el.get_text(strip=True)
                education = edu_text.replace("学历：", "").strip()
            
            industry = ""
            industry_el = soup.select_one("div.com-class")
            if industry_el:
                industry = industry_el.get_text(strip=True)
            
            tags = []
            for tag_el in soup.select("div.lab div.li"):
                tag_text = tag_el.get_text(strip=True)
                if tag_text:
                    tags.append(tag_text)
            tags_str = ",".join(tags) if tags else ""
            
            description = ""
            desc_el = soup.select_one("div.describe div.txt")
            if desc_el:
                description = desc_el.get_text(strip=True)
            
            return JobData(
                title=title,
                company=company,
                location=location or self.location,
                description=truncate_text(description) or title,
                salary=salary,
                requirements="",
                job_type=job_type,
                industry=industry,
                education=education,
                experience=experience,
                source=self.source,
                university=self.university,
                source_url=url,
                apply_url=url,
                publish_date=publish_date,
                tags=tags_str,
            )
        except Exception as e:
            logger.warning(f"[{self.source}] 解析岗位失败: {e}")
            return None

    async def _crawl_browser(self, max_items: int = 0) -> List[JobData]:
        """处理浏览器类型的爬虫（SmartEdu, UIBE, JXUFE, NEU）"""
        try:
            from .browser_wrapper import run_browser_spider, is_browser_spider_available
            
            if not is_browser_spider_available():
                logger.warning(
                    f"[{self.source}] 浏览器爬虫需要Playwright支持，"
                    f"请安装: pip install playwright && playwright install chromium"
                )
                return []
            
            jobs = await run_browser_spider(
                self.source, 
                max_items=max_items, 
                headless=self.config.get("headless", True)
            )
            
            return jobs
        except Exception as e:
            logger.error(f"[{self.source}] 浏览器爬虫执行失败: {e}")
            return []


def create_spider(source: str, config: Optional[Dict[str, Any]] = None, headless: bool = True, session=None) -> UnifiedSpider:
    """创建统一爬虫实例"""
    return UnifiedSpider(source, config, headless, session)
