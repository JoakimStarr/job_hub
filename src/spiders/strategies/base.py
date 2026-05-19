"""
BaseCrawlStrategy - 爬取策略抽象基类

定义所有策略的公共接口和通用功能:
- execute(): 异步生成器接口 (必须实现)
- get_type(): 返回策略类型标识 (必须实现)
- _create_session(): 创建HTTP会话 (可复写)
- _validate_job(): 数据校验 (通用实现)
- _calculate_quality_score(): 质量评分 (通用实现)
- _compute_content_hash(): 内容哈希 (通用实现)
"""

from abc import ABC, abstractmethod
from typing import AsyncIterator, List, Optional, TYPE_CHECKING
import asyncio
import hashlib

from loguru import logger

if TYPE_CHECKING:
    from ..base import JobData
    from ..config import CrawlerConfig


class BaseCrawlStrategy(ABC):
    """
    爬取策略抽象基类
    
    所有具体的爬取策略都必须继承此类并实现 execute() 方法。
    提供通用的数据校验、质量评分、内容哈希等工具方法。
    
    Attributes:
        config: 全局爬虫配置实例
        _count: 已产出JobData计数器
    
    设计原则:
        - 单一职责: 每个策略只负责一种爬取方式
        - 开闭原则: 通过继承扩展新策略，无需修改基类
        - 依赖倒置: 依赖UnifiedSpider提供的上下文，而非具体实现
    """
    
    def __init__(self):
        """
        初始化策略实例
        
        自动加载全局配置并初始化计数器。
        """
        from ..config import get_config
        
        self.config: 'CrawlerConfig' = get_config()
        self._count: int = 0
    
    @abstractmethod
    async def execute(
        self,
        spider,
        max_items: int = 0
    ) -> AsyncIterator['JobData']:
        """
        执行爬取策略，流式产出JobData
        
        Args:
            spider: UnifiedSpider实例(提供session/config/source_key等上下文)
            max_items: 最大产出数量(0表示不限制)
        
        Yields:
            JobData: 解析后的岗位数据
        
        注意:
            - 必须是异步生成器 (async for兼容)
            - 应在每次yield前调用 _validate_job() 校验数据
            - 应在循环中检查 max_items 和 spider._should_stop
            - 应使用 async with semaphore 控制并发
        """
        pass
    
    @abstractmethod
    def get_type(self) -> str:
        """
        返回此策略处理的spider_type字符串
        
        Returns:
            策略类型标识符，如 'api_post', 'api_get', 'html', 'browser_js'
        """
        pass
    
    async def _create_session(self, spider) -> object:
        """
        创建或复用HTTP Session
        
        优先使用外部注入的共享Session，否则创建新的aiohttp ClientSession。
        
        Args:
            spider: UnifiedSpider实例
            
        Returns:
            aiohttp.ClientSession 实例
        """
        if hasattr(spider, 'external_session') and spider.external_session:
            return spider.external_session
        else:
            import aiohttp
            return aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=self.config.request_timeout),
                headers=spider.headers if hasattr(spider, 'headers') else {},
            )
    
    def _validate_job(self, job: 'JobData') -> bool:
        """
        校验岗位数据的完整性和质量
        
        校验规则:
        - title非空且长度 >= min_title_length
        - company非空
        - source_url非空且以http开头
        
        Args:
            job: 待校验的JobData实例
            
        Returns:
            True如果数据有效且应保留，False应丢弃
        """
        if not job or not job.title:
            return False
        
        if len(job.title.strip()) < self.config.min_title_length:
            return False
        
        if not job.company:
            return False
        
        if not job.source_url:
            return False
        
        return True
    
    def _calculate_quality_score(self, job: 'JobData') -> float:
        """
        计算岗位数据的质量评分 (0.0 ~ 1.0)
        
        评分维度及权重:
        - 标题完整性 (30%): 标题越长越可能是真实数据
        - 描述丰富度 (25%): 岗位描述的详细程度
        - 要求详细度 (20%): 任职要求的完整度
        - 薪资信息 (15%): 是否有具体薪资（非"面议"）
        - 其他字段 (10%): 地点/学历/行业的填充情况
        
        Args:
            job: 待评分的JobData实例
            
        Returns:
            四舍五入到3位小数的质量评分
        """
        score = 0.0
        
        # 标题长度 (越长越可能是真实数据)
        title_score = min(len(job.title) / 20, 1.0) * 0.3
        score += title_score
        
        # 描述长度
        desc_len = len(job.description or '')
        desc_score = min(desc_len / 200, 1.0) * 0.25
        score += desc_score
        
        # 要求长度
        req_len = len(job.requirements or '')
        req_score = min(req_len / 150, 1.0) * 0.2
        score += req_score
        
        # 薪资信息
        salary_score = 0.15 if (job.salary and job.salary != '面议') else 0.05
        score += salary_score
        
        # 其他字段
        other_fields = [job.location, job.education, job.industry]
        filled = sum(1 for f in other_fields if f)
        score += (filled / len(other_fields)) * 0.1
        
        return round(score, 3)
    
    def _compute_content_hash(self, job: 'JobData') -> str:
        """
        计算岗位内容的MD5哈希值 (用于去重)
        
        使用关键字段组合计算哈希，确保内容相同但URL不同的数据也能识别为重复。
        
        使用的字段:
        - title: 岗位标题
        - company: 公司名称
        - location: 工作地点
        - salary: 薪资范围
        - education: 学历要求
        - publish_date: 发布日期
        
        Args:
            job: 待计算哈希的JobData实例
            
        Returns:
            32位MD5十六进制字符串
        """
        content = "|".join([
            str(job.title or ''),
            str(job.company or ''),
            str(job.location or ''),
            str(job.salary or ''),
            str(job.education or ''),
            str(job.publish_date or ''),
        ])
        return hashlib.md5(content.encode('utf-8')).hexdigest()
    
    async def _fetch_detail_with_concurrency(
        self,
        session,
        items: List[dict],
        parse_func,
        spider
    ) -> AsyncIterator['JobData']:
        """
        并发获取详情页的通用实现
        
        使用信号量控制并发数，通过asyncio.as_completed实现流式产出，
        无需等待所有任务完成即可开始处理结果。
        
        Args:
            session: aiohttp ClientSession实例
            items: 列表页数据列表 (通常包含详情URL等信息)
            parse_func: 单条解析函数签名为 (session, item, spider) -> JobData
            spider: UnifiedSpider实例 (提供上下文信息)
            
        Yields:
            JobData: 经过校验和评分的有效岗位数据
            
        注意事项:
            - 自动应用 _validate_job() 过滤无效数据
            - 自动计算 quality_score 和 content_hash
            - 尊重 max_items 限制，达到后立即停止
            - 异常捕获不影响其他任务的执行
        """
        semaphore = asyncio.Semaphore(self.config.detail_concurrency)
        jobs_count = 0
        max_items = spider.max_items if hasattr(spider, 'max_items') else 0
        
        async def process_one(item):
            """
            处理单条列表数据的内部协程函数
            
            Args:
                item: 列表页的单条数据字典
                
            Returns:
                成功时返回处理后的JobData，失败或无效返回None
            """
            nonlocal jobs_count
            if max_items and jobs_count >= max_items:
                return None
            try:
                async with semaphore:
                    result = await parse_func(session, item, spider)
                    if result and self._validate_job(result):
                        jobs_count += 1
                        # 动态添加质量评分和内容哈希属性
                        result.quality_score = self._calculate_quality_score(result)
                        result.content_hash = self._compute_content_hash(result)
                        return result
            except Exception as e:
                logger.warning(f"详情获取失败: {e}")
            return None
        
        # 创建所有任务
        tasks = [process_one(item) for item in items]
        
        # 流式获取完成的任务结果
        for coro in asyncio.as_completed(tasks):
            result = await coro
            if result:
                yield result
                self._count += 1
                # 检查是否达到最大数量限制
                if max_items and self._count >= max_items:
                    logger.info(f"已达到最大数量限制: {max_items}")
                    break
    
    def reset_counter(self):
        """重置产出计数器（用于复用策略实例）"""
        self._count = 0
    
    def __repr__(self) -> str:
        """返回策略的可读表示"""
        try:
            type_name = self.get_type()
        except NotImplementedError:
            type_name = "abstract"
        return f"<{self.__class__.__name__}(type={type_name})>"
