"""
HtmlStrategy - HTML解析爬取策略

适用于: swufe (西南财经大学)

特点:
- 使用 HTTP GET 请求获取 HTML 页面
- 使用 BeautifulSoup 解析 DOM
- 通过列表页分页方式发现岗位 (与lite_crawler.py一致)
- 列表页检查发布时间，过期数据自动停止
- 详情页解析提取完整岗位信息

性能优化:
- 及时释放 BeautifulSoup 对象 (del soup)
- 列表页预过滤过期数据，减少无效详情页请求
- 内存友好的流式产出
"""

import re
from datetime import datetime, timedelta
from typing import AsyncIterator, Optional, Dict, Any
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from loguru import logger

from .base import BaseCrawlStrategy
from ..utils import normalize_publish_date, clean_company_name, truncate_text
from ..shared_parsers import parse_swufe_detail, parse_swufe_list_date


class HtmlStrategy(BaseCrawlStrategy):
    """
    HTML 解析爬取策略

    适用于: swufe (西南财经大学)

    特点:
    - 使用 HTTP GET 请求获取 HTML 页面
    - 使用 BeautifulSoup 解析 DOM
    - 通过列表页分页方式发现岗位
    - 列表页检查发布时间，过期数据自动停止
    - 详情页解析提取完整岗位信息

    Attributes:
        config: 全局爬虫配置实例
        _count: 已产出JobData计数器
        _date_filter_months: 日期过滤月数
    """

    def __init__(self):
        """
        初始化HTML解析策略实例
        """
        super().__init__()
        self._date_filter_months: int = 2
        self.logger = logger.bind(strategy="html")

    def get_type(self) -> str:
        """返回策略类型标识"""
        return 'html'

    async def execute(
        self,
        spider,
        max_items: int = 0
    ) -> AsyncIterator['JobData']:
        """
        执行HTML解析爬取策略（支持增量爬取）

        增量爬取流程:
        1. 从数据库加载上次爬取状态（last_page）
        2. 从 last_page 页开始爬取（而非第1页）
        3. 列表页分页循环:
           a. 请求列表页
           b. 解析列表页获取岗位项和发布时间
           c. 如果当前页所有URL都已存在，说明已追上上次进度，继续往后爬新数据
           d. 检查发布时间是否过期，过期则停止
           e. 对每个岗位项获取详情页链接，跳过已存在的URL
           f. 请求详情页并解析为JobData
        4. 爬取完成后保存当前页码到数据库

        Args:
            spider: UnifiedSpider实例(提供session/config/source_key等上下文)
            max_items: 最大产出数量(0表示不限制)

        Yields:
            JobData: 解析后的岗位数据
        """
        self.reset_counter()

        source = getattr(spider, 'source', 'unknown')
        spider_config = getattr(spider, 'spider_config', {})
        base_url = getattr(spider, 'base_url', spider_config.get('base_url', ''))

        list_url_pattern = spider_config.get(
            "list_url_pattern",
            "https://job3.swufe.edu.cn/jobs/jobs_list/page/{page}.htm"
        )

        self._date_filter_months = spider_config.get("date_filter_months", 2)

        # 加载增量爬取状态
        start_page = 1
        db = None
        if hasattr(spider, 'db') and spider.db:
            db = spider.db
            state = await db.load_crawl_state(source)
            start_page = state.get("last_page", 1)
            if start_page > 1:
                self.logger.info(f"[{source}] 增量爬取: 从第 {start_page} 页开始 (上次爬取时间: {state.get('last_crawl_time', '未知')})")

        session = await self._create_session(spider)
        last_completed_page = start_page - 1

        try:
            page = start_page
            while True:
                if max_items > 0 and self._count >= max_items:
                    self.logger.info(f"[{source}] 达到最大数量限制: {max_items}")
                    break

                if hasattr(spider, 'is_time_limit_exceeded') and spider.is_time_limit_exceeded():
                    self.logger.info(f"[{source}] 达到时间限制，停止爬取")
                    break

                list_url = list_url_pattern.format(page=page)

                try:
                    list_result = await self._fetch_page(session, list_url, spider)

                    if list_result is None:
                        self.logger.info(f"[{source}] 第 {page} 页列表获取失败，停止爬取")
                        break

                    html_text = list_result
                    should_stop = False

                    try:
                        soup = BeautifulSoup(html_text, "html.parser")

                        # 查找列表容器
                        list_box = soup.find('div', class_='listb J_allListBox')
                        if not list_box:
                            self.logger.debug(f"[{source}] 第 {page} 页未找到列表容器，爬取结束")
                            del soup
                            break

                        # 获取所有岗位项
                        job_items = list_box.find_all('div', class_='td-j-name')
                        if not job_items:
                            self.logger.debug(f"[{source}] 第 {page} 页无岗位数据，爬取结束")
                            del soup
                            break

                        self.logger.info(f"[{source}] 第 {page} 页: 获取到 {len(job_items)} 条列表项")

                        cutoff_date = datetime.now() - timedelta(days=self._date_filter_months * 30)

                        # 检查当前页是否所有URL都已存在（增量停止条件）
                        page_all_existing = True

                        for item in job_items:
                            if max_items > 0 and self._count >= max_items:
                                break

                            # 使用共用函数检查发布时间
                            publish_date_str, is_expired = parse_swufe_list_date(item, cutoff_date)

                            if is_expired:
                                should_stop = True
                                self.logger.info(f"[{source}] 遇到过期数据 ({publish_date_str})，停止爬取")
                                break

                            # 获取详情页链接
                            a_tag = item.find('a', href=True)
                            if not a_tag:
                                continue

                            detail_path = a_tag.get('href', '')
                            if not detail_path:
                                continue

                            detail_url = urljoin(base_url, detail_path)

                            # 检查URL是否已存在
                            existing_urls = set()
                            if hasattr(spider, 'get_existing_urls'):
                                existing_urls = await spider.get_existing_urls([detail_url])

                            if detail_url in existing_urls:
                                continue

                            page_all_existing = False

                            # 爬取详情页
                            detail_result = await self._fetch_page(session, detail_url, spider)
                            if not detail_result:
                                continue

                            job = self._parse_html_to_job(detail_result, detail_url, spider)

                            if job and self._validate_job(job):
                                job.quality_score = self._calculate_quality_score(job)
                                job.content_hash = self._compute_content_hash(job)

                                self.logger.debug(f"[{source}] 成功解析岗位: {job.title[:30]}...")
                                yield job
                            else:
                                self.logger.debug(f"[{source}] 解析岗位失败或无效: {detail_url}")

                        # 如果当前页所有URL都已存在且不是起始页，说明已追上历史进度
                        # 但仍然继续往后爬，因为可能有新数据
                        del soup

                    except Exception as e:
                        self.logger.warning(f"[{source}] 解析列表页 {page} 失败: {e}")
                        break

                    last_completed_page = page

                    if should_stop:
                        break

                    page += 1

                except Exception as e:
                    self.logger.warning(f"[{source}] 处理列表页 {page} 时出错: {type(e).__name__}: {e}")
                    break

        finally:
            # 保存增量爬取状态
            if db and last_completed_page > 0:
                await db.save_crawl_state(source, last_completed_page, self._count)

            if not (hasattr(spider, 'external_session') and spider.external_session):
                await session.close()

        self.logger.info(f"[{source}] HTML爬取完成，共 {self._count} 条，最后页码: {last_completed_page}")

    async def _fetch_page(
        self,
        session,
        url: str,
        spider
    ) -> Optional[str]:
        """
        获取HTML页面内容

        Args:
            session: aiohttp ClientSession实例
            url: 页面URL
            spider: UnifiedSpider实例

        Returns:
            HTML文本内容，失败返回None
        """
        source = getattr(spider, 'source', 'unknown')

        try:
            async with session.get(url) as resp:
                status_code = resp.status

                if status_code == 404:
                    self.logger.debug(f"[{source}] 页面不存在(404): {url}")
                    return None

                if status_code != 200:
                    self.logger.warning(f"[{source}] HTTP {status_code}: {url}")
                    return None

                html = await resp.text()

                if not html or len(html.strip()) < 100:
                    self.logger.debug(f"[{source}] 页面内容过短或为空: {url}")
                    return None

                return html

        except Exception as e:
            self.logger.warning(f"[{source}] 请求失败: {type(e).__name__}: {e} | URL: {url}")
            return None

    def _parse_html_to_job(
        self,
        html: str,
        url: str,
        spider,
        job_type: str = "实习"
    ) -> Optional['JobData']:
        """
        使用共用解析函数解析详情页HTML为JobData

        解析逻辑委托给 shared_parsers.parse_swufe_detail，
        确保主爬虫和lite_crawler的字段匹配规则一致。

        Args:
            html: HTML文本内容
            url: 页面URL
            spider: UnifiedSpider实例 (提供source/location等上下文)
            job_type: 岗位类型 (实习/全职)

        Returns:
            JobData对象或None (如果页面无效或解析失败)
        """
        source = getattr(spider, 'source', 'unknown')
        university = getattr(spider, 'university', '')
        location = getattr(spider, 'location', '')

        result = parse_swufe_detail(html, url, source, university, location)

        if not result:
            return None

        from ..base import JobData

        return JobData(
            title=result["title"],
            company=result["company"],
            location=result["location"],
            description=result["description"],
            salary=result["salary"],
            requirements=result["requirements"],
            job_type=job_type,
            industry=result["industry"],
            education=result["education"],
            experience=result.get("experience", ""),
            contact=result.get("contact", ""),
            source=result["source"],
            university=result["university"],
            source_url=result["source_url"],
            apply_url=result["apply_url"],
            publish_date=result.get("publish_date", ""),
            tags=result.get("tags", ""),
        )

    def _extract_field(
        self,
        soup: BeautifulSoup,
        selector: str,
        default: str = ''
    ) -> str:
        """
        安全提取字段值

        Args:
            soup: BeautifulSoup对象
            selector: CSS选择器
            default: 默认值 (当元素不存在或提取失败时返回)

        Returns:
            提取到的文本内容或默认值
        """
        try:
            element = soup.select_one(selector)
            if element:
                text = element.get_text(strip=True)
                return text if text else default
            return default
        except Exception:
            return default

    @staticmethod
    def _clean_text(text: str) -> str:
        """
        清理文本: 去除多余空白、换行符

        Args:
            text: 原始文本

        Returns:
            清理后的文本
        """
        if not text:
            return ""
        return re.sub(r'\s+', ' ', text).strip()

    def get_stats(self) -> Dict[str, Any]:
        """
        获取策略运行统计信息

        Returns:
            包含统计信息的字典
        """
        return {
            'type': self.get_type(),
            'count': self._count,
        }

    def __repr__(self) -> str:
        """返回策略的可读表示"""
        return f"<HtmlStrategy(type=html, count={self._count})>"


if __name__ == "__main__":
    import sys
    import asyncio
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).parent.parent.parent))

    from bs4 import BeautifulSoup
    from src.spiders.strategies.html_strategy import HtmlStrategy

    TEST_HTML = """
    <!DOCTYPE html>
    <html>
    <head><title>测试岗位</title></head>
    <body>
        <div class="j-n-txt">Python开发工程师</div>
        <div class="job_date">
            <span class="cutom_font">2024-01-15</span>
        </div>
        <div class="com-name">&gt;科技有限公司</div>
        <div class="job_msg">
            <span>薪酬：15K-25K</span>
            <span>学历：本科</span>
            <span>工作地：成都</span>
        </div>
        <div class="com-class">互联网/电子商务</div>
        <div class="lab">
            <div class="li">Python</div>
            <div class="li">Django</div>
            <div class="li">MySQL</div>
        </div>
        <div class="describe">
            <div class="tit">职位描述</div>
            <div class="txt">
                1. 负责后端业务系统开发和维护
                2. 参与系统架构设计
            </div>
        </div>
        <div class="describe">
            <div class="tit">投递要求</div>
            <div class="req">
                1. 本科及以上学历
                2. 3年以上Python开发经验
            </div>
        </div>
    </body>
    </html>
    """

    async def test_parse():
        """测试HTML解析功能"""
        print("=" * 60)
        print("HtmlStrategy 测试")
        print("=" * 60)

        strategy = HtmlStrategy()
        print(f"\n策略类型: {strategy.get_type()}")
        print(f"策略表示: {strategy}")

        class MockSpider:
            source = "swufe_test"
            location = "成都"
            university = "西南财经大学"

        spider = MockSpider()

        print("\n--- 测试1: 正常HTML解析 ---")
        job = strategy._parse_html_to_job(TEST_HTML, "http://test.com/job/12345", spider, "全职")

        if job:
            print(f"  解析成功!")
            print(f"  标题: {job.title}")
            print(f"  公司: {job.company}")
            print(f"  地点: {job.location}")
            print(f"  薪资: {job.salary}")
            print(f"  学历: {job.education}")
            print(f"  行业: {job.industry}")
            print(f"  标签: {job.tags}")
            print(f"  联系方式: {job.contact}")
            print(f"  发布日期: {job.publish_date}")
            print(f"  描述: {job.description[:80]}...")
            print(f"  要求: {job.requirements[:80] if job.requirements else ''}")
            print(f"  URL: {job.source_url}")

            is_valid = strategy._validate_job(job)
            print(f"  校验结果: {'通过' if is_valid else '失败'}")
        else:
            print("  解析失败")

        print("\n--- 测试2: 无效页面 (no_page_group) ---")
        invalid_html = '<html><body><div class="no_page_group">页面不存在</div></body></html>'
        job_invalid = strategy._parse_html_to_job(invalid_html, "http://test.com/job/99999", spider)
        print(f"  结果: {'正确返回None' if job_invalid is None else '错误，应返回None'}")

        print("\n--- 测试3: 空标题页面 ---")
        empty_title_html = '<html><body><div class="j-n-txt"></div></body></html>'
        job_empty = strategy._parse_html_to_job(empty_title_html, "http://test.com/job/11111", spider)
        print(f"  结果: {'正确返回None' if job_empty is None else '错误，应返回None'}")

        print("\n" + "=" * 60)
        print("测试完成!")
        print("=" * 60)

    asyncio.run(test_parse())
