"""
ApiGetStrategy - GET API 爬取策略

适用于: zuel (中南财经政法大学)

特点:
- 使用 HTTP GET 请求，参数在 URL query string 中传递
- 支持按类别分页 (category/api_type 参数)
- 分页参数: page (页码), limit (每页数量)
- 响应格式: {code: 0, data: [...], count: N}
- 需要二次请求详情 API 获取完整数据
"""

import asyncio
from typing import Any, AsyncIterator, Dict, List, Optional

from loguru import logger

from .base import BaseCrawlStrategy
from ..utils import (
    gather_limited,
    html_to_text,
    normalize_publish_date,
    truncate_text,
)


class ApiGetStrategy(BaseCrawlStrategy):
    """
    GET API 爬取策略
    
    适用于: zuel (中南财经政法大学)
    
    特点:
    - 使用 HTTP GET 请求，参数在URL中传递
    - 支持按类别分页 (category参数)
    - 分页参数: page (从1开始), limit
    - 响应格式: {code: 0, data: [...], count: N}
    - 详情通过单独的 GET 请求获取
    """

    def get_type(self) -> str:
        return 'api_get'

    async def execute(
        self,
        spider: 'UnifiedSpider',
        max_items: int = 0
    ) -> AsyncIterator['JobData']:
        """
        执行GET API爬取策略
        
        流程:
        1. 创建Session
        2. 检查是否配置了 categories (zuel按学院/类别分类)
        3. 遍历每个category:
           a. 构造带参数的GET URL (?page=1&limit=20&type=xxx)
           b. 循环分页直到返回空列表或达到max_pages
           c. 解析每页响应提取 data 数组
           d. 对每行数据调用 _parse_item()
           e. 如需详情则并发获取
           f. 校验、评分、哈希后 yield
        4. 检查 max_items 和 should_stop
        """
        from ..base import JobData

        session = await self._create_session(spider)
        close_session = not (hasattr(spider, 'external_session') and spider.external_session)

        try:
            categories = spider.spider_config.get("categories", [])
            if not categories:
                logger.warning(f"[{spider.source}] 未配置 categories，跳过 api_get 策略")
                return

            for cat_config in categories:
                if self._should_stop(spider):
                    break

                async for job in self._crawl_category(session, cat_config, spider, max_items):
                    if job:
                        yield job
                        self._count += 1
                        if max_items > 0 and self._count >= max_items:
                            logger.info(f"[{spider.source}] 已达到最大数量限制: {max_items}")
                            return
        finally:
            if close_session:
                await session.close()

    async def _crawl_category(
        self,
        session,
        cat_config: Dict[str, Any],
        spider: 'UnifiedSpider',
        max_items: int = 0
    ) -> AsyncIterator['JobData']:
        """
        爬取单个类别的所有分页数据
        
        Args:
            session: aiohttp ClientSession 实例
            cat_config: 类别配置字典，包含 api_type, job_type, label 等
            spider: UnifiedSpider 实例
            max_items: 最大产出数量
            
        Yields:
            JobData: 解析后的岗位数据
        """
        from ..base import JobData

        api_type = cat_config.get("api_type", "")
        list_api = spider.spider_config.get("list_api", "")
        page_size = spider.spider_config.get("page_size", 10)
        max_pages = getattr(spider, 'max_pages', 80)

        for page_num in range(1, max_pages + 1):
            if self._should_stop(spider):
                break
            if max_items > 0 and self._count >= max_items:
                break

            payload = await self._fetch_list_page(session, list_api, api_type, page_num, page_size, spider)
            if not payload or payload.get("code") != 0:
                break

            items = payload.get("data") or []
            if not items:
                break

            base_url = spider.base_url
            detail_urls = [
                f"{base_url}/home/career/internship?id={item.get('id')}"
                for item in items if item.get('id')
            ]

            existing_urls = set()
            if hasattr(spider, 'get_existing_urls'):
                existing_urls = await spider.get_existing_urls(detail_urls)

            candidates = []
            for item in items:
                detail_url = f"{base_url}/home/career/internship?id={item.get('id')}"
                if detail_url and detail_url not in existing_urls:
                    item["_job_type"] = cat_config.get("job_type", "全职")
                    candidates.append(item)

            if not candidates:
                continue

            async for job in self._fetch_details_concurrent(session, candidates, spider):
                if job:
                    yield job

    async def _fetch_list_page(
        self,
        session,
        list_url: str,
        api_type: str,
        page_num: int,
        page_size: int,
        spider: 'UnifiedSpider'
    ) -> Optional[Dict]:
        """
        获取列表页数据
        
        Args:
            session: aiohttp ClientSession
            list_url: 列表API地址
            api_type: 分类类型参数
            page_num: 页码(从1开始)
            page_size: 每页条数
            spider: UnifiedSpider实例
            
        Returns:
            JSON响应字典或None
        """
        params = {
            "type": api_type,
            "page": page_num,
            "limit": page_size,
            "total": 0,
        }

        try:
            async with session.get(list_url, params=params) as resp:
                if resp.status == 200:
                    return await resp.json()
                else:
                    logger.warning(
                        f"[{spider.source}] 列表API返回HTTP {resp.status}: "
                        f"{list_url}?type={api_type}&page={page_num}"
                    )
        except Exception as e:
            logger.warning(
                f"[{spider.source}] 获取列表失败 "
                f"(type={api_type}, page={page_num}): {e}"
            )

        return None

    async def _fetch_detail(self, session, item: Dict, spider: 'UnifiedSpider') -> Optional['JobData']:
        """
        获取单条岗位详情
        
        Args:
            session: aiohttp ClientSession
            item: 列表项字典(需包含 id 字段)
            spider: UnifiedSpider实例
            
        Returns:
            JobData 或 None
        """
        from ..base import JobData

        job_id = item.get("id")
        if not job_id:
            logger.warning(f"[{spider.source}] 列表项缺少id字段")
            return None

        detail_api = spider.spider_config.get("detail_api", "")
        detail_url = f"{detail_api}?id={job_id}"

        try:
            async with session.get(detail_url) as resp:
                if resp.status != 200:
                    logger.warning(
                        f"[{spider.source}] 详情API返回HTTP {resp.status}: {detail_url}"
                    )
                    return None

                data = await resp.json()
                if data.get("code") != 0:
                    logger.warning(
                        f"[{spider.source}] 详情API返回code={data.get('code')}: "
                        f"{data.get('msg', '未知错误')}"
                    )
                    return None

                detail = data.get("data")
                if not detail:
                    logger.warning(f"[{spider.source}] 详情API返回数据为空")
                    return None

                job = self._parse_zuel_job(detail, item, spider)
                if job and self._validate_job(job):
                    job.quality_score = self._calculate_quality_score(job)
                    job.content_hash = self._compute_content_hash(job)
                    return job
                return None
        except Exception as e:
            logger.warning(
                f"[{spider.source}] 获取详情失败: {type(e).__name__}: "
                f"{str(e) or '未知错误'} | URL: {detail_url}"
            )
            return None

    async def _fetch_details_concurrent(
        self,
        session,
        items: List[Dict],
        spider: 'UnifiedSpider'
    ) -> AsyncIterator['JobData']:
        """
        并发获取多个岗位详情
        
        使用 gather_limited 控制并发数。
        
        Args:
            session: aiohttp ClientSession
            items: 列表项字典列表
            spider: UnifiedSpider实例
            
        Yields:
            JobData: 经过校验和评分的有效岗位数据
        """
        concurrency = spider.detail_concurrency if hasattr(spider, 'detail_concurrency') else 8

        results = await gather_limited(
            items,
            lambda item: self._fetch_detail(session, item, spider),
            concurrency=concurrency
        )

        for job in results:
            if job:
                yield job

    def _parse_zuel_job(
        self,
        detail: Dict,
        list_item: Dict,
        spider: 'UnifiedSpider'
    ) -> Optional['JobData']:
        """
        解析ZUEL岗位数据

        字段匹配规则（与lite_crawler.py保持一致）:
        - title: 格式为 "岗位名 | 公司名"（jobName | companyName）
        - company: companyName，备选 title
        - location: 优先 area，备选 workCity
        - salary: salary
        - description: zpgw(岗位职责) + xcfl(薪酬福利)
        - requirements: zpdxjtj(招聘对象及条件)
        - contact: recruitContact + recruitMobile + lxfs(邮箱)
        - education: education
        - industry: nature
        - publish_date: createTime
        - deadline: validTime

        Args:
            detail: 详情API返回的数据字典
            list_item: 列表项数据(包含 _job_type 等附加信息)
            spider: UnifiedSpider实例(提供 source/university/location 等上下文)

        Returns:
            JobData 实例或 None(解析失败时)
        """
        from ..base import JobData

        try:
            # 公司名: companyName，备选 title
            company_name = detail.get("companyName") or detail.get("title", "")

            # 岗位名称: jobName
            position_name = detail.get("jobName", "")

            # title格式: 岗位 | 公司
            title = f"{position_name} | {company_name}" if position_name and company_name else (position_name or company_name)

            if not title:
                return None

            # location: 优先 area，备选 workCity
            location = detail.get("area", "") or detail.get("workCity", spider.location if hasattr(spider, 'location') else "")

            salary = detail.get("salary", "面议")
            education = detail.get("education", "")

            # requirements: zpdxjtj(招聘对象及条件)
            requirements = detail.get("zpdxjtj", "")
            industry = detail.get("nature", "")

            # description: zpgw(岗位职责) + xcfl(薪酬福利)
            description_parts = []
            zpgw = detail.get("zpgw", "")
            if zpgw:
                description_parts.append(f"【岗位职责】{zpgw}")
            xcfl = detail.get("xcfl", "")
            if xcfl:
                description_parts.append(f"【薪酬福利】{xcfl}")
            description = "\n\n".join(description_parts)

            # contact: recruitContact + recruitMobile + lxfs(邮箱)
            contact_parts = []
            recruit_contact = detail.get("recruitContact", "")
            recruit_mobile = detail.get("recruitMobile", "")
            lxfs = detail.get("lxfs", "")
            if recruit_contact:
                contact_parts.append(f"联系人: {recruit_contact}")
            if recruit_mobile:
                contact_parts.append(f"电话: {recruit_mobile}")
            if lxfs:
                contact_parts.append(f"邮箱: {lxfs}")
            contact = " | ".join(contact_parts)

            publish_date = normalize_publish_date(detail.get("createTime", ""))
            deadline = normalize_publish_date(detail.get("validTime", ""))

            job_type = list_item.get("_job_type", "全职")
            job_id = detail.get("id", "")
            view_url = f"{spider.base_url}/home/career/internship?id={job_id}"

            return JobData(
                title=title,
                company=company_name,
                location=location or (spider.location if hasattr(spider, 'location') else ""),
                description=truncate_text(description) or title,
                salary=salary,
                requirements=requirements,
                job_type=job_type,
                industry=industry,
                education=education,
                experience="",
                contact=contact,
                source=spider.source,
                university=spider.university if hasattr(spider, 'university') else "",
                source_url=view_url,
                apply_url=view_url,
                publish_date=publish_date,
                deadline=deadline,
            )
        except Exception as e:
            logger.warning(f"[spider.source] 解析岗位失败: {e}")
            return None

    def _build_query_params(
        self,
        page_no: int,
        category: Optional[str] = None,
        **extra
    ) -> Dict[str, Any]:
        """
        构造GET请求查询参数
        
        Args:
            page_no: 页码(从1开始)
            category: 可选的分类参数
            **extra: 其他额外参数
            
        Returns:
            查询参数字典
        """
        params = {
            "page": page_no,
            "limit": self.config.batch_size,
        }
        if category:
            params["type"] = category
        params.update(extra)
        return params

    def _parse_list_response(self, response_json: Dict) -> List[Dict]:
        """
        从JSON响应提取数据列表
        
        Args:
            response_json: 列表API的完整JSON响应
            
        Returns:
            数据项列表
        """
        return response_json.get("data", [])

    @staticmethod
    def _should_stop(spider) -> bool:
        """检查是否应停止爬取（超时或外部停止信号）"""
        if hasattr(spider, 'is_time_limit_exceeded') and spider.is_time_limit_exceeded():
            return True
        if hasattr(spider, '_should_stop') and spider._should_stop():
            return True
        return False
