"""
ApiPostStrategy - POST JSON API 爬取策略

适用于: sufe (上海财经大学), cufe (中央财经大学), dufe (东北财经大学)

特点:
- 使用 HTTP POST 请求发送 JSON/form-data
- 支持分板块爬取 (sufe有zpxx/sxzpxx/zpgg等板块)
- 支持按岗位类型分类 (cufe/dufe)
- 分页参数: pageNum/pageNo, pageSize
"""

import asyncio
import random
import time
from typing import Any, AsyncIterator, Dict, List, Optional
from urllib.parse import urljoin

import aiohttp
from loguru import logger

from .base import BaseCrawlStrategy
from ..base import JobData
from ..utils import (
    clean_company_name,
    gather_limited,
    html_to_text,
    normalize_publish_date,
    truncate_text,
)


class ApiPostStrategy(BaseCrawlStrategy):
    """
    POST JSON API 爬取策略
    
    适用于: sufe (上海财经大学), cufe (中央财经大学), dufe (东北财经大学)
    
    特点:
    - 使用 HTTP POST 请求发送 JSON/form-data
    - 支持分板块爬取 (sufe有zpxx/sxzpxx等板块)
    - 支持按岗位类型分类 (cufe/dufe)
    - 分页参数: pageNum, pageSize
    """

    def get_type(self) -> str:
        return 'api_post'

    async def execute(self, spider, max_items: int = 0) -> AsyncIterator[JobData]:
        """
        执行POST API爬取策略
        
        流程:
        1. 创建或复用HTTP Session
        2. 检查是否有 sections 配置 (sufe需要分板块)
        3. 如果有sections: 遍历每个section调用 _crawl_section()
        4. 如果无sections: 调用 _crawl_platform() (cufe/dufe通用)
        5. 对每个section/platform进行分页循环
        6. 并发获取详情页
        7. 解析每条数据为 JobData
        8. 校验、评分、计算哈希后 yield
        9. 检查 max_items 和 spider._should_stop
        
        Args:
            spider: UnifiedSpider实例(提供session/config/source_key等上下文)
            max_items: 最大产出数量(0表示不限制)
            
        Yields:
            JobData: 解析后的岗位数据
        """
        log = logger.bind(source=spider.source)
        log.info(f"[{spider.source}] ApiPostStrategy 开始执行")
        
        session = await self._create_session(spider)
        
        spider_config = spider.spider_config
        sections = spider_config.get("sections", [])
        position_types = spider_config.get("position_types", [])
        
        total_yielded = 0
        
        if sections:
            log.info(f"[{spider.source}] 检测到 {len(sections)} 个板块配置")
            for section_config in sections:
                if spider.is_time_limit_exceeded():
                    log.info(f"[{spider.source}] 运行时间超限，停止爬取")
                    break
                if max_items > 0 and total_yielded >= max_items:
                    break
                    
                async for job in self._crawl_section(session, section_config, spider, max_items, total_yielded):
                    yield job
                    total_yielded += 1
                    if max_items > 0 and total_yielded >= max_items:
                        break
                        
        elif position_types:
            log.info(f"[{spider.source}] 检测到 {len(position_types)} 个岗位类型")
            for pt in position_types:
                if spider.is_time_limit_exceeded():
                    log.info(f"[{spider.source}] 运行时间超限，停止爬取")
                    break
                if max_items > 0 and total_yielded >= max_items:
                    break
                    
                async for job in self._crawl_platform_type(session, pt, spider, max_items, total_yielded):
                    yield job
                    total_yielded += 1
                    if max_items > 0 and total_yielded >= max_items:
                        break
        else:
            log.warning(f"[{spider.source}] 未找到 sections 或 position_types 配置")
        
        log.info(f"[{spider.source}] ApiPostStrategy 执行完成，共产出 {total_yielded} 条数据")

    async def _crawl_section(
        self,
        session,
        section_config: Dict,
        spider,
        max_items: int = 0,
        current_total: int = 0
    ) -> AsyncIterator[JobData]:
        """
        爬取单个板块的所有分页数据 (SUFE专用)
        
        Args:
            session: aiohttp ClientSession实例
            section_config: 板块配置字典，包含section/list_url/detail_url/view_url/referer等字段
            spider: UnifiedSpider实例
            max_items: 最大产出数量限制
            current_total: 当前已产出的总数
            
        Yields:
            JobData: 解析后的岗位数据
        """
        log = logger.bind(source=spider.source)
        section = section_config.get("section", "unknown")
        label = section_config.get("label", section)
        max_pages = getattr(spider, 'max_pages', 80)
        
        log.info(f"[{spider.source}] 开始爬取板块: {label} ({section})")
        
        consecutive_empty = 0
        max_consecutive_empty = 3
        
        for page_num in range(1, max_pages + 1):
            if spider.is_time_limit_exceeded():
                log.debug(f"[{spider.source}] 板块 {section} 运行时间超限")
                break
                
            current_count = current_total + self._count
            if max_items > 0 and current_count >= max_items:
                break
            
            list_data = await self._fetch_sufe_page(session, section_config, page_num, spider)
            if not list_data:
                consecutive_empty += 1
                if consecutive_empty >= max_consecutive_empty:
                    log.debug(f"[{spider.source}] 板块 {section} 连续 {consecutive_empty} 页空响应，停止")
                continue
            consecutive_empty = 0
            
            page_items = list_data.get("list") or []
            if not page_items:
                log.debug(f"[{spider.source}] 板块 {section} 第{page_num}页无数据，停止翻页")
                break
            
            detail_urls = [self._build_sufe_view_url(section_config, item, spider) for item in page_items]
            existing_urls = await spider.get_existing_urls(detail_urls)
            
            candidates = []
            for item in page_items:
                view_url = self._build_sufe_view_url(section_config, item, spider)
                if view_url and view_url not in existing_urls:
                    candidates.append(item)
            
            if not candidates:
                log.debug(f"[{spider.source}] 板块 {section} 第{page_num}页全部已存在({len(page_items)}条)")
                continue
            
            concurrency = 4 if section == "zpgg" else getattr(spider, 'detail_concurrency', 8)
            
            if section == "zpgg":
                page_jobs = await gather_limited(
                    candidates,
                    lambda item: self._fetch_sufe_notice_job(session, item, section_config, spider),
                    concurrency=concurrency
                )
            else:
                page_jobs = await gather_limited(
                    candidates,
                    lambda item: self._fetch_sufe_detail_job(session, item, section_config, spider),
                    concurrency=concurrency
                )
            
            for job in page_jobs:
                if job is None:
                    continue
                if self._validate_job(job):
                    job.quality_score = self._calculate_quality_score(job)
                    job.content_hash = self._compute_content_hash(job)
                    spider.stats.items_extracted += 1
                    yield job
                else:
                    log.debug(f"[{spider.source}] 数据校验未通过: {job.title}")

    async def _crawl_platform_type(
        self,
        session,
        type_config: Dict,
        spider,
        max_items: int = 0,
        current_total: int = 0
    ) -> AsyncIterator[JobData]:
        """
        爬取单个岗位类型的所有数据 (CUFE/DUFE通用)
        
        Args:
            session: aiohttp ClientSession实例
            type_config: 岗位类型配置字典，包含type/label等字段
            spider: UnifiedSpider实例
            max_items: 最大产出数量限制
            current_total: 当前已产出的总数
            
        Yields:
            JobData: 解析后的岗位数据
        """
        log = logger.bind(source=spider.source)
        position_type = type_config.get("type", "")
        label = type_config.get("label", position_type)
        max_pages = getattr(spider, 'max_pages', 80)
        
        log.info(f"[{spider.source}] 开始爬取岗位类型: {label} ({position_type})")
        
        consecutive_empty = 0
        max_consecutive_empty = 3
        
        for page_num in range(1, max_pages + 1):
            if spider.is_time_limit_exceeded():
                log.debug(f"[{spider.source}] 类型 {position_type} 运行时间超限")
                break
                
            current_count = current_total + self._count
            if max_items > 0 and current_count >= max_items:
                break
            
            list_data = await self._fetch_platform_page(session, position_type, page_num, spider)
            if not list_data or list_data.get("state") != 1:
                consecutive_empty += 1
                if consecutive_empty >= max_consecutive_empty:
                    log.debug(f"[{spider.source}] 类型 {position_type} 连续空响应，停止")
                continue
            consecutive_empty = 0
            
            obj = list_data.get("object") or {}
            items = obj.get("list") or []
            
            if not items:
                log.debug(f"[{spider.source}] 类型 {position_type} 第{page_num}页无数据，停止翻页")
                break
            
            page_urls = []
            for item in items:
                url_path = item.get("url", "")
                if url_path:
                    page_urls.append(urljoin(spider.base_url, url_path))
            existing_urls = await spider.get_existing_urls(page_urls)
            
            candidates = []
            for item in items:
                url_path = item.get("url", "")
                full_url = urljoin(spider.base_url, url_path) if url_path else ""
                if full_url and full_url not in existing_urls:
                    candidates.append(item)
            
            if not candidates:
                log.debug(f"[{spider.source}] 类型 {position_type} 第{page_num}页全部已存在({len(items)}条)")
                continue
            
            concurrency = getattr(spider, 'detail_concurrency', 4)
            page_jobs = await gather_limited(
                candidates,
                lambda item: self._fetch_platform_detail(session, item, position_type, spider),
                concurrency=concurrency
            )
            
            for job in page_jobs:
                if job is None:
                    continue
                if self._validate_job(job):
                    job.quality_score = self._calculate_quality_score(job)
                    job.content_hash = self._compute_content_hash(job)
                    spider.stats.items_extracted += 1
                    yield job
                else:
                    log.debug(f"[{spider.source}] 数据校验未通过: {job.title}")

    async def _fetch_sufe_page(
        self,
        session,
        section_config: Dict,
        page_num: int,
        spider
    ) -> Optional[Dict]:
        """
        发送POST请求获取SUFE单页列表数据
        
        Args:
            session: aiohttp ClientSession实例
            section_config: 板块配置字典
            page_num: 页码(从1开始)
            spider: UnifiedSpider实例
            
        Returns:
            列表数据字典(data部分)，失败返回None
        """
        section = section_config.get("section", "unknown")
        list_url = spider.base_url + section_config["list_url"]
        
        try:
            referer = spider.base_url + section_config.get("referer", "")
            if referer:
                session.headers["Referer"] = referer
            
            data = {"pageNum": str(page_num)}
            
            async with session.post(list_url, data=data) as resp:
                if resp.status != 200:
                    logger.warning(f"[{spider.source}] SUFE列表API HTTP {resp.status}: {list_url}")
                    return None
                
                result = await resp.json()
                if result.get("code") != 200:
                    logger.warning(
                        f"[{spider.source}] SUFE列表API code={result.get('code')}: "
                        f"{result.get('msg', '未知错误')}"
                    )
                    return None
                
                return result.get("data")
                
        except asyncio.TimeoutError:
            logger.warning(f"[{spider.source}] SUFE列表请求超时 (section={section}, page={page_num})")
            return None
        except aiohttp.ClientError as e:
            logger.warning(f"[{spider.source}] SUFE列表请求失败 (section={section}, page={page_num}): {e}")
            return None
        except Exception as e:
            logger.warning(f"[{spider.source}] SUFE列表异常 (section={section}, page={page_num}): {e}")
            return None

    async def _fetch_platform_page(
        self,
        session,
        position_type: str,
        page_num: int,
        spider
    ) -> Optional[Dict]:
        """
        发送POST请求获取CUFE/DUFE单页列表数据
        
        Args:
            session: aiohttp ClientSession实例
            position_type: 岗位类型标识
            page_num: 页码(从1开始)
            spider: UnifiedSpider实例
            
        Returns:
            完整的API响应JSON字典，失败返回None
        """
        list_url = spider.base_url + spider.spider_config["list_api_path"]
        
        try:
            data = {
                "pageNo": str(page_num),
                "positionType": position_type,
            }
            
            async with session.post(list_url, data=data) as resp:
                if resp.status != 200:
                    logger.warning(f"[{spider.source}] 平台列表API HTTP {resp.status}: {list_url}")
                    return None
                
                return await resp.json()
                
        except asyncio.TimeoutError:
            logger.warning(f"[{spider.source}] 平台列表请求超时 (type={position_type}, page={page_num})")
            return None
        except aiohttp.ClientError as e:
            logger.warning(f"[{spider.source}] 平台列表请求失败 (type={position_type}, page={page_num}): {e}")
            return None
        except Exception as e:
            logger.warning(f"[{spider.source}] 平台列表异常 (type={position_type}, page={page_num}): {e}")
            return None

    async def _fetch_sufe_detail_job(
        self,
        session,
        item: Dict,
        section_config: Dict,
        spider
    ) -> Optional[JobData]:
        """
        获取并解析SUFE详情页岗位数据
        
        Args:
            session: aiohttp ClientSession实例
            item: 列表项数据字典
            section_config: 板块配置字典
            spider: UnifiedSpider实例
            
        Returns:
            解析后的JobData，失败返回None
        """
        item_id = item.get("zpxxid")
        if not item_id:
            logger.warning(f"[{spider.source}] 列表项缺少zpxxid字段")
            return None
        
        detail_url = spider.base_url + section_config["detail_url"].format(item_id=item_id)
        
        try:
            async with session.post(detail_url) as resp:
                if resp.status != 200:
                    logger.warning(f"[{spider.source}] SUFE详情API HTTP {resp.status}: {detail_url}")
                    return None
                
                data = await resp.json()
                if data.get("code") != 200:
                    logger.warning(
                        f"[{spider.source}] SUFE详情API code={data.get('code')}: "
                        f"{data.get('msg', '未知错误')}"
                    )
                    return None
                
                detail = data.get("data")
                if not detail:
                    logger.warning(f"[{spider.source}] SUFE详情API返回数据为空")
                    return None
                
                return self._parse_sufe_job(detail, item, spider)
                
        except asyncio.TimeoutError:
            logger.warning(f"[{spider.source}] SUFE详情请求超时: {detail_url}")
            return None
        except aiohttp.ClientError as e:
            logger.warning(f"[{spider.source}] SUFE详情请求失败: {e}")
            return None
        except Exception as e:
            logger.warning(
                f"[{spider.source}] SUFE详情解析异常: "
                f"{type(e).__name__}: {str(e) or '未知错误'} | URL: {detail_url}"
            )
            return None

    async def _fetch_sufe_notice_job(
        self,
        session,
        item: Dict,
        section_config: Dict,
        spider
    ) -> Optional[JobData]:
        """
        获取并解析SUFE招聘公告数据
        
        Args:
            session: aiohttp ClientSession实例
            item: 列表项数据字典
            section_config: 板块配置字典
            spider: UnifiedSpider实例
            
        Returns:
            解析后的JobData，失败返回None
        """
        item_id = item.get("zpxxid")
        if not item_id:
            return None
        
        news_type = item.get("xxlb", "zpgg")
        detail_url = spider.base_url + section_config["detail_url"].format(
            news_type=news_type, item_id=item_id
        )
        
        try:
            async with session.post(detail_url) as resp:
                if resp.status != 200:
                    return None
                
                data = await resp.json()
                if data.get("code") != 200:
                    return None
                
                detail = data.get("data")
                if not detail:
                    return None
                
                return self._parse_sufe_notice(detail, item, spider)
                
        except Exception as e:
            logger.warning(f"[{spider.source}] 获取公告详情失败: {e}")
            return None

    async def _fetch_platform_detail(
        self,
        session,
        item: Dict,
        position_type: str,
        spider
    ) -> Optional[JobData]:
        """
        获取并解析CUFE/DUFE平台详情数据
        
        Args:
            session: aiohttp ClientSession实例
            item: 列表项数据字典
            position_type: 岗位类型标识
            spider: UnifiedSpider实例
            
        Returns:
            解析后的JobData，失败返回None
        """
        url_path = item.get("url", "")
        if not url_path:
            logger.warning(f"[{spider.source}] 列表项缺少URL字段")
            return None
        
        try:
            from urllib.parse import urlparse, parse_qs
            parsed = urlparse(url_path)
            query_params = parse_qs(parsed.query)
            recruitment_id = query_params.get("recruitmentId", [None])[0]
            
            if not recruitment_id:
                logger.warning(f"[{spider.source}] URL中缺少recruitmentId参数: {url_path}")
                return None
            
            ts = int(time.time() * 1000)
            detail_url = spider.base_url + spider.spider_config["detail_api_path"]
            
            params = {"ts": ts}
            data = {
                "ts": ts,
                "recruitmentId": recruitment_id,
            }
            
            async with session.post(detail_url, params=params, data=data) as resp:
                if resp.status != 200:
                    logger.warning(f"[{spider.source}] 平台详情API HTTP {resp.status}: {detail_url}")
                    return None
                
                result = await resp.json()
                if result.get("state") != 1:
                    logger.warning(
                        f"[{spider.source}] 平台详情API state={result.get('state')}: "
                        f"{result.get('message', '未知错误')}"
                    )
                    return None
                
                detail = result.get("object", {}).get("recruitmentinfo")
                if not detail:
                    logger.warning(f"[{spider.source}] 平台详情API缺少recruitmentinfo字段")
                    return None
                
                return self._parse_platform_job(detail, item, position_type, spider)
                
        except asyncio.TimeoutError:
            logger.warning(f"[{spider.source}] 平台详情请求超时: {url_path}")
            return None
        except aiohttp.ClientError as e:
            logger.warning(f"[{spider.source}] 平台详情请求失败: {e}")
            return None
        except Exception as e:
            logger.warning(
                f"[{spider.source}] 平台详情解析异常: "
                f"{type(e).__name__}: {str(e) or '未知错误'} | URL: {url_path}"
            )
            return None

    def _build_sufe_view_url(self, section_config: Dict, item: Dict, spider) -> str:
        """
        构建SUFE查看页面URL
        
        Args:
            section_config: 板块配置字典
            item: 列表项数据字典
            spider: UnifiedSpider实例
            
        Returns:
            完整的查看URL字符串，缺少ID时返回空串
        """
        item_id = item.get("zpxxid")
        if not item_id:
            return ""
        
        section = section_config.get("section", "")
        if section == "zpgg":
            news_type = item.get("xxlb", "zpgg")
            return spider.base_url + section_config["view_url"].format(
                news_type=news_type, item_id=item_id
            )
        else:
            return spider.base_url + section_config["view_url"].format(item_id=item_id)

    def _parse_sufe_job(self, detail: Dict, list_item: Dict, spider) -> Optional[JobData]:
        """
        解析SUFE岗位数据为JobData
        
        Args:
            detail: 详情API返回的数据字典
            list_item: 列表项原始数据(用于补充信息)
            spider: UnifiedSpider实例(提供source/location/university等上下文)
            
        Returns:
            解析后的JobData，无效数据返回None
        """
        try:
            title = detail.get("zpzt", "")
            company = detail.get("dwmc", "")
            
            if not title:
                return None
            
            company = clean_company_name(company)
            
            position_list = detail.get("zwxxList", [])
            if position_list:
                pos = position_list[0]
                location = pos.get("gzszxmc", "") or detail.get("szxmc", spider.location)
                salary = pos.get("yxmc", "面议")
                education = pos.get("xlyqmc", "")
                experience = ""
                job_type = pos.get("gzlxmc", "全职")
                description = pos.get("zwms", "")
            else:
                location = detail.get("szxmc", spider.location)
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
            view_url = f"{spider.base_url}/career/zpxx/view/zpxx/{item_id}"
            
            return JobData(
                title=title,
                company=company,
                location=location or spider.location,
                description=truncate_text(description) or title,
                salary=salary,
                requirements=requirements,
                job_type=job_type,
                industry=industry,
                education=education,
                experience=experience,
                source=spider.source,
                university=spider.university,
                source_url=view_url,
                apply_url=view_url,
                publish_date=publish_date,
                deadline=deadline,
            )
        except Exception as e:
            logger.warning(f"[{spider.source}] 解析SUFE岗位失败: {e}")
            return None

    def _parse_sufe_notice(self, detail: Dict, list_item: Dict, spider) -> Optional[JobData]:
        """
        解析SUFE招聘公告为JobData
        
        Args:
            detail: 详情API返回的数据字典
            list_item: 列表项原始数据
            spider: UnifiedSpider实例
            
        Returns:
            解析后的JobData，无效数据返回None
        """
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
            view_url = f"{spider.base_url}/career/news/view/{news_type}/{item_id}"
            
            return JobData(
                title=title,
                company=company,
                location=spider.location,
                description=truncate_text(description) or title,
                salary="面议",
                requirements="",
                job_type="全职",
                industry=detail.get("hyyjmc", ""),
                education="",
                experience="",
                source=spider.source,
                university=spider.university,
                source_url=view_url,
                apply_url=view_url,
                publish_date=publish_date,
                deadline=deadline,
            )
        except Exception as e:
            logger.warning(f"[{spider.source}] 解析SUFE公告失败: {e}")
            return None

    def _parse_platform_job(
        self,
        detail: Dict,
        list_item: Dict,
        position_type: str,
        spider
    ) -> Optional[JobData]:
        """
        解析CUFE/DUFE平台岗位数据为JobData
        
        Args:
            detail: 详情API返回的recruitmentinfo数据字典
            list_item: 列表项原始数据
            position_type: 岗位类型标识
            spider: UnifiedSpider实例
            
        Returns:
            解析后的JobData，无效数据返回None
        """
        try:
            title = detail.get("title", "")
            if not title:
                return None
            
            corp_info = detail.get("corporationinfo", {})
            company = clean_company_name(corp_info.get("name", ""))
            
            position_list = detail.get("recruitmentPositionList", [])
            if position_list:
                pos = position_list[0]
                location = pos.get("cityName", spider.location)
                description = pos.get("positionDescription", "")
            else:
                location = spider.location
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
            view_url = f"{spider.base_url}/f/recruitmentinfo/show?recruitmentId={recruitment_id}"
            apply_url = detail.get("onlineApplicationUrl", "") or view_url
            
            return JobData(
                title=title,
                company=company,
                location=location or spider.location,
                description=truncate_text(full_description) or title,
                salary="面议",
                requirements=detail.get("majorName", ""),
                job_type=job_type,
                industry=corp_info.get("corporationNatureValue", ""),
                education=detail.get("education", ""),
                experience="",
                source=spider.source,
                university=spider.university,
                source_url=view_url,
                apply_url=apply_url,
                publish_date=publish_date,
                deadline=deadline,
            )
        except Exception as e:
            logger.warning(f"[{spider.source}] 解析平台岗位失败: {e}")
            return None

    def _build_request_data(self, page_num: int, **kwargs) -> Dict[str, str]:
        """
        构造POST请求数据 (通用格式)
        
        默认格式: {"pageNum": page_num, "pageSize": pageSize}
        可被子类覆盖以支持特殊格式。
        
        Args:
            page_num: 页码
            **kwargs: 额外参数(如positionType等)
            
        Returns:
            POST请求数据字典
        """
        page_size = kwargs.get("page_size", 10)
        data = {
            "pageNum": str(page_num),
            "pageSize": str(page_size),
        }
        if "position_type" in kwargs:
            data["positionType"] = kwargs["position_type"]
        if "page_no_key" in kwargs:
            data.pop("pageNum", None)
            data[kwargs["page_no_key"]] = str(page_num)
        return data


if __name__ == "__main__":
    import unittest
    
    class TestApiPostStrategy(unittest.TestCase):
        """ApiPostStrategy 单元测试"""
        
        def setUp(self):
            self.strategy = ApiPostStrategy()
        
        def test_get_type(self):
            """测试策略类型标识"""
            self.assertEqual(self.strategy.get_type(), 'api_post')
        
        def test_build_request_data_default(self):
            """测试默认请求数据构建"""
            data = self.strategy._build_request_data(3)
            self.assertIn("pageNum", data)
            self.assertEqual(data["pageNum"], "3")
            self.assertIn("pageSize", data)
        
        def test_build_request_data_with_position_type(self):
            """测试带岗位类型的请求数据构建"""
            data = self.strategy._build_request_data(2, position_type="1", page_size=20)
            self.assertEqual(data["pageNum"], "2")
            self.assertEqual(data["pageSize"], "20")
            self.assertEqual(data["positionType"], "1")
        
        def test_parse_sufe_job_valid(self):
            """测试有效SUFE岗位数据解析"""
            class MockSpider:
                source = "sufe"
                location = "上海"
                university = "上海财经大学"
                base_url = "https://career.sufe.edu.cn"
            
            mock_spider = MockSpider()
            detail = {
                "zpzt": "Java开发工程师",
                "dwmc": "某某科技有限公司",
                "fbrq": "2025-01-15",
                "zpjzrq": "2025-03-15",
                "hyyjmc": "互联网",
                "zyyqmc": "本科及以上",
                "xlyqmc": "本科",
                "zpxxid": "12345",
                "szxmc": "上海",
                "zwxxList": [{
                    "gzszxmc": "浦东新区",
                    "yxmc": "15K-25K",
                    "gzlxmc": "全职",
                    "zwms": "负责后端开发工作",
                }],
                "dwjs": "一家专注于金融科技的公司",
            }
            list_item = {}
            
            job = self.strategy._parse_sufe_job(detail, list_item, mock_spider)
            
            self.assertIsNotNone(job)
            self.assertEqual(job.title, "Java开发工程师")
            self.assertEqual(job.source, "sufe")
            self.assertEqual(job.university, "上海财经大学")
            self.assertEqual(job.salary, "15K-25K")
            self.assertEqual(job.education, "本科")
        
        def test_parse_sufe_job_missing_title(self):
            """测试缺失标题时返回None"""
            class MockSpider:
                source = "sufe"
                location = "上海"
                university = "上海财经大学"
                base_url = "https://career.sufe.edu.cn"
            
            detail = {"zpzt": "", "dwmc": "某公司"}
            job = self.strategy._parse_sufe_job(detail, {}, MockSpider())
            self.assertIsNone(job)
        
        def test_parse_sufe_notice_valid(self):
            """测试有效SUFE公告数据解析"""
            class MockSpider:
                source = "sufe"
                location = "上海"
                university = "上海财经大学"
                base_url = "https://career.sufe.edu.cn"
            
            mock_spider = MockSpider()
            detail = {
                "zpzt": "2025春季校园招聘公告",
                "dwmc": "某某银行",
                "zwms": "<p>面向2025届毕业生</p>",
                "fbrq": "2025-01-10",
                "zpjzrq": "2025-04-30",
                "hyyjmc": "金融",
                "xxlb": "zpgg",
                "zpxxid": "99999",
            }
            
            job = self.strategy._parse_sufe_notice(detail, {}, mock_spider)
            
            self.assertIsNotNone(job)
            self.assertEqual(job.title, "2025春季校园招聘公告")
            self.assertIn("面向2025届毕业生", job.description)
            self.assertEqual(job.job_type, "全职")
        
        def test_parse_platform_job_valid(self):
            """测试有效CUFE/DUFE平台岗位数据解析"""
            class MockSpider:
                source = "cufe"
                location = "北京"
                university = "中央财经大学"
                base_url = "http://scc.cufe.edu.cn"
            
            mock_spider = MockSpider()
            detail = {
                "title": "数据分析实习生",
                "startTime": "2025-02-01",
                "endTime": "2025-05-31",
                "education": "本科",
                "majorName": "统计学/数学",
                "content": "<p>负责数据处理</p>",
                "positionTypeValue": "实习招聘",
                "id": "88888",
                "onlineApplicationUrl": "",
                "corporationinfo": {
                    "name": "某某数据有限公司",
                    "introduction": "专业数据分析服务提供商",
                    "corporationNatureValue": "民营企业",
                },
                "recruitmentPositionList": [
                    {"cityName": "北京", "positionDescription": "使用Python进行数据分析"}
                ],
            }
            
            job = self.strategy._parse_platform_job(detail, {}, "2", mock_spider)
            
            self.assertIsNotNone(job)
            self.assertEqual(job.title, "数据分析实习生")
            self.assertEqual(job.source, "cufe")
            self.assertEqual(job.university, "中央财经大学")
            self.assertEqual(job.job_type, "实习")
            self.assertEqual(job.education, "本科")
        
        def test_build_sufe_view_url_normal(self):
            """测试正常SUFE查看URL构建"""
            class MockSpider:
                base_url = "https://career.sufe.edu.cn"
            
            section_config = {
                "section": "zpxx",
                "view_url": "/career/zpxx/view/zpxx/{item_id}",
            }
            item = {"zpxxid": "12345"}
            
            url = self.strategy._build_sufe_view_url(section_config, item, MockSpider())
            self.assertIn("12345", url)
            self.assertTrue(url.startswith("https://"))
        
        def test_build_sufe_view_url_missing_id(self):
            """测试缺少ID时返回空串"""
            class MockSpider:
                base_url = "https://career.sufe.edu.cn"
            
            url = self.strategy._build_sufe_view_url({}, {}, MockSpider())
            self.assertEqual(url, "")
        
        def test_validate_job_valid(self):
            """测试有效岗位校验"""
            job = JobData(
                title="开发工程师",
                company="某科技公司",
                location="北京",
                description="负责开发",
                source_url="https://example.com/job/1",
            )
            self.assertTrue(self.strategy._validate_job(job))
        
        def test_validate_job_invalid_title(self):
            """测试无效标题校验"""
            job = JobData(
                title="",
                company="某科技公司",
                location="北京",
                description="负责开发",
                source_url="https://example.com/job/1",
            )
            self.assertFalse(self.strategy._validate_job(job))
    
    unittest.main(verbosity=2)
