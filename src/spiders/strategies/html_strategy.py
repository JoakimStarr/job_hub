"""
HtmlStrategy - HTML解析爬取策略

适用于: swufe (西南财经大学)

特点:
- 使用 HTTP GET 请求获取 HTML 页面
- 使用 BeautifulSoup 解析 DOM
- 通过 ID 枚举方式发现新岗位 (start_id递增)
- 连续404检测机制判断数据边界

性能优化:
- 及时释放 BeautifulSoup 对象 (del soup)
- 支持配置连续404阈值
- 内存友好的流式产出
"""

import re
from typing import AsyncIterator, Optional, Dict, Any

from bs4 import BeautifulSoup
from loguru import logger

from .base import BaseCrawlStrategy
from ..utils import normalize_publish_date, clean_company_name, truncate_text


class HtmlStrategy(BaseCrawlStrategy):
    """
    HTML 解析爬取策略
    
    适用于: swufe (西南财经大学)
    
    特点:
    - 使用 HTTP GET 请求获取 HTML 页面
    - 使用 BeautifulSoup 解析 DOM
    - 通过 ID 枚举方式发现新岗位 (start_id递增)
    - 连续404检测机制判断数据边界
    
    Attributes:
        config: 全局爬虫配置实例
        _count: 已产出JobData计数器
        _consecutive_404: 连续404计数器
        _last_successful_id: 最后一个成功的job_id (用于增量爬取)
    """
    
    def __init__(self):
        """
        初始化HTML解析策略实例
        
        设置默认的连续404阈值和计数器。
        """
        super().__init__()
        self._consecutive_404: int = 0
        self._last_successful_id: int = 0
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
        执行HTML解析爬取策略
        
        流程:
        1. 创建Session
        2. 获取起始ID (从config或上次保存的位置)
        3. ID枚举循环:
           a. 构造URL: {base_url}/job/{job_id} 或类似模式
           b. 发送GET请求获取HTML
           c. 检查状态码:
              - 200: 解析HTML提取数据
              - 404: 连续404计数+1，超过阈值则停止
              - 其他: 记录警告继续
           d. 使用 BeautifulSoup 解析:
              - 提取标题、公司、地点、描述等
              - 清理HTML标签得到纯文本
           e. 构造 JobData 对象
           f. 校验、评分、哈希后 yield
        4. 检查 max_items 和 should_stop
        5. 返回最后一个成功ID (供增量爬取)
        
        Args:
            spider: UnifiedSpider实例(提供session/config/source_key等上下文)
            max_items: 最大产出数量(0表示不限制)
            
        Yields:
            JobData: 解析后的岗位数据
        """
        self.reset_counter()
        self._consecutive_404 = 0
        self._last_successful_id = 0
        
        source = getattr(spider, 'source', 'unknown')
        spider_config = getattr(spider, 'spider_config', {})
        
        url_patterns = spider_config.get("url_patterns", {})
        
        if not url_patterns:
            self.logger.warning(f"[{source}] 未找到url_patterns配置")
            return
        
        session = await self._create_session(spider)
        try:
            for pattern_key, pattern_config in url_patterns.items():
                if self._check_should_stop(self._consecutive_404, self.config.consecutive_404_limit if hasattr(self.config, 'consecutive_404_limit') else 30):
                    break
                
                async for job in self._crawl_pattern(session, pattern_config, spider, max_items):
                    yield job
                    
                    if max_items > 0 and self._count >= max_items:
                        self.logger.info(f"[{source}] 达到最大数量限制: {max_items}")
                        break
                
                if hasattr(spider, '_should_stop') and spider._should_stop:
                    break
        finally:
            if not (hasattr(spider, 'external_session') and spider.external_session):
                await session.close()
        
        if self._last_successful_id > 0:
            self.logger.info(f"[{source}] HTML爬取完成，最后成功ID: {self._last_successful_id}")
    
    async def _crawl_pattern(
        self,
        session,
        pattern_config: Dict[str, Any],
        spider,
        max_items: int = 0
    ) -> AsyncIterator['JobData']:
        """
        爬取单个URL模式
        
        Args:
            session: aiohttp ClientSession实例
            pattern_config: URL模式配置 (包含pattern, start_id, job_type等)
            spider: UnifiedSpider实例
            max_items: 最大产出数量
            
        Yields:
            JobData: 解析后的岗位数据
        """
        source = getattr(spider, 'source', 'unknown')
        pattern = pattern_config.get("pattern", "")
        start_id = pattern_config.get("start_id", 1)
        job_type = pattern_config.get("job_type", "实习")
        consecutive_404_limit = pattern_config.get("consecutive_404_limit", 
                                                   self.config.consecutive_404_limit if hasattr(self.config, 'consecutive_404_limit') else 30)
        
        current_id = start_id
        local_404_count = 0
        current_total = 0
        
        while local_404_count < consecutive_404_limit:
            if hasattr(spider, 'is_time_limit_exceeded') and spider.is_time_limit_exceeded():
                self.logger.info(f"[{source}] 达到时间限制，停止爬取")
                break
            
            if max_items > 0 and (current_total + self._count) >= max_items:
                break
            
            url = pattern.format(id=current_id)
            
            try:
                existing_urls = set()
                if hasattr(spider, 'get_existing_urls'):
                    existing_urls = await spider.get_existing_urls([url])
                
                if url in existing_urls:
                    local_404_count += 1
                    current_id += 1
                    continue
                
                result = await self._fetch_job_page(session, url, spider)
                
                if result is None:
                    local_404_count += 1
                    self._consecutive_404 += 1
                else:
                    status_code, html_text = result
                    
                    if status_code == 200 and html_text:
                        job = self._parse_html_to_job(html_text, url, spider, job_type)
                        
                        if job and self._validate_job(job):
                            job.quality_score = self._calculate_quality_score(job)
                            job.content_hash = self._compute_content_hash(job)
                            
                            self._last_successful_id = current_id
                            local_404_count = 0
                            self._consecutive_404 = 0
                            current_total += 1
                            
                            self.logger.debug(f"[{source}] 成功解析岗位 ID={current_id}: {job.title[:30]}...")
                            yield job
                        else:
                            local_404_count += 1
                            self._consecutive_404 += 1
                    else:
                        local_404_count += 1
                        self._consecutive_404 += 1
                        
            except Exception as e:
                self.logger.warning(f"[{source}] 处理ID={current_id}时出错: {type(e).__name__}: {str(e) or '未知错误'}")
                local_404_count += 1
                self._consecutive_404 += 1
            
            current_id += 1
        
        if local_404_count >= consecutive_404_limit:
            self.logger.info(f"[{source}] 连续{consecutive_404_limit}次404，停止当前模式爬取")
    
    async def _fetch_job_page(
        self,
        session,
        job_id_or_url,
        spider
    ) -> Optional[tuple]:
        """
        获取单个岗位的HTML页面
        
        Args:
            session: aiohttp ClientSession实例
            job_id_or_url: job_id数字或完整URL
            spider: UnifiedSpider实例
            
        Returns:
            元组 (status_code, html_text) 或 None (如果请求失败)
        """
        source = getattr(spider, 'source', 'unknown')
        url = job_id_or_url if isinstance(job_id_or_url, str) and job_id_or_url.startswith('http') else str(job_id_or_url)
        
        try:
            async with session.get(url) as resp:
                status_code = resp.status
                
                if status_code == 404:
                    self.logger.debug(f"[{source}] 页面不存在(404): {url}")
                    return (status_code, None)
                
                if status_code != 200:
                    self.logger.warning(f"[{source}] HTTP {status_code}: {url}")
                    return (status_code, None)
                
                html = await resp.text()
                
                if not html or len(html.strip()) < 100:
                    self.logger.debug(f"[{source}] 页面内容过短或为空: {url}")
                    return (200, None)
                
                return (200, html)
                
        except Exception as e:
            self.logger.warning(f"[{source}] 请求失败: {type(e).__name__}: {str(e) or '未知错误'} | URL: {url}")
            return None
    
    def _parse_html_to_job(
        self,
        html: str,
        url: str,
        spider,
        job_type: str = "实习"
    ) -> Optional['JobData']:
        """
        使用BeautifulSoup解析HTML为JobData
        
        针对SWUFE网站的特定DOM结构进行解析。
        
        Args:
            html: HTML文本内容
            url: 页面URL
            spider: UnifiedSpider实例 (提供source/location等上下文)
            job_type: 岗位类型 (实习/全职)
            
        Returns:
            JobData对象或None (如果页面无效或解析失败)
        """
        source = getattr(spider, 'source', 'unknown')
        
        try:
            soup = BeautifulSoup(html, "lxml")
            
            no_page = soup.find("div", class_="no_page_group")
            if no_page:
                self.logger.debug(f"[{source}] 检测到'页面不存在'标记: {url}")
                del soup
                return None
            
            title_el = soup.select_one("div.j-n-txt")
            title = title_el.get_text(strip=True) if title_el else ""
            
            if not title:
                del soup
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
            
            del soup
            
            from ..base import JobData
            
            return JobData(
                title=title,
                company=company,
                location=location or getattr(spider, 'location', ''),
                description=truncate_text(description) or title,
                salary=salary,
                requirements="",
                job_type=job_type,
                industry=industry,
                education=education,
                experience=experience,
                source=source,
                university=getattr(spider, 'university', ''),
                source_url=url,
                apply_url=url,
                publish_date=publish_date,
                tags=tags_str,
            )
            
        except Exception as e:
            self.logger.warning(f"[{source}] 解析岗位失败: {e}")
            return None
    
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
    
    @staticmethod
    def _check_should_stop(consecutive_404: int, max_consecutive: int) -> bool:
        """
        检查是否应停止爬取 (连续404过多)
        
        Args:
            consecutive_404: 当前连续404计数
            max_consecutive: 最大允许连续404次数
            
        Returns:
            True如果应停止爬取，False否则
        """
        return consecutive_404 >= max_consecutive
    
    def get_last_successful_id(self) -> int:
        """
        获取最后一个成功解析的job_id
        
        用于增量爬取，下次可以从该ID之后开始。
        
        Returns:
            最后一个成功的job_id，如果没有成功记录则返回0
        """
        return self._last_successful_id
    
    def get_stats(self) -> Dict[str, Any]:
        """
        获取策略运行统计信息
        
        Returns:
            包含统计信息的字典
        """
        return {
            'type': self.get_type(),
            'count': self._count,
            'consecutive_404': self._consecutive_404,
            'last_successful_id': self._last_successful_id,
        }
    
    def __repr__(self) -> str:
        """返回策略的可读表示"""
        return f"<HtmlStrategy(type=html, count={self._count}, last_id={self._last_successful_id})>"


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
        <span class="job_money">
            <div class="txt2">薪酬</div>
            15K-25K
        </span>
        <span class="job_position" title="成都">成都</span>
        <span class="job_academic">学历：本科</span>
        <div class="com-class">互联网/电子商务</div>
        <div class="lab">
            <div class="li">Python</div>
            <div class="li">Django</div>
            <div class="li">MySQL</div>
        </div>
        <div class="describe">
            <div class="txt">
                岗位职责：
                1. 负责后端业务系统开发和维护
                2. 参与系统架构设计
                3. 编写技术文档
                
                任职要求：
                1. 本科及以上学历，计算机相关专业
                2. 3年以上Python开发经验
                3. 熟悉Django/Flask框架
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
            print(f"✓ 解析成功!")
            print(f"  标题: {job.title}")
            print(f"  公司: {job.company}")
            print(f"  地点: {job.location}")
            print(f"  薪资: {job.salary}")
            print(f"  学历: {job.education}")
            print(f"  行业: {job.industry}")
            print(f"  标签: {job.tags}")
            print(f"  发布日期: {job.publish_date}")
            print(f"  描述长度: {len(job.description)}字符")
            print(f"  URL: {job.source_url}")
            
            is_valid = strategy._validate_job(job)
            print(f"  校验结果: {'通过 ✓' if is_valid else '失败 ✗'}")
            
            quality_score = strategy._calculate_quality_score(job)
            content_hash = strategy._compute_content_hash(job)
            print(f"  质量评分: {quality_score}")
            print(f"  内容哈希: {content_hash[:16]}...")
        else:
            print("✗ 解析失败")
        
        print("\n--- 测试2: 无效页面 (no_page_group) ---")
        invalid_html = '<html><body><div class="no_page_group">页面不存在</div></body></html>'
        job_invalid = strategy._parse_html_to_job(invalid_html, "http://test.com/job/99999", spider)
        print(f"结果: {'正确返回None ✓' if job_invalid is None else '错误，应返回None ✗'}")
        
        print("\n--- 测试3: 空标题页面 ---")
        empty_title_html = '<html><body><div class="j-n-txt"></div></body></html>'
        job_empty = strategy._parse_html_to_job(empty_title_html, "http://test.com/job/11111", spider)
        print(f"结果: {'正确返回None ✓' if job_empty is None else '错误，应返回None ✗'}")
        
        print("\n--- 测试4: 文本清理 ---")
        test_texts = [
            ("  多余  空白  ", "多余 空白"),
            ("换行\n符\t测试", "换行 符 测试"),
            ("", ""),
            (None, ""),
        ]
        for raw, expected in test_texts:
            cleaned = strategy._clean_text(raw)
            status = "✓" if cleaned == expected else "✗"
            print(f"  {status} '{raw}' -> '{cleaned}' (期望: '{expected}')")
        
        print("\n--- 测试5: 字段安全提取 ---")
        soup = BeautifulSoup(TEST_HTML, "lxml")
        
        tests = [
            ("div.j-n-txt", "Python开发工程师"),
            ("div.nonexistent", ""),
            ("span.fake-selector", ""),
        ]
        for selector, expected in tests:
            result = strategy._extract_field(soup, selector)
            status = "✓" if result == expected else "✗"
            print(f"  {status} {selector} -> '{result}' (期望: '{expected}')")
        del soup
        
        print("\n--- 测试6: 终止条件检查 ---")
        stop_tests = [
            (29, 30, False),
            (30, 30, True),
            (31, 30, True),
            (0, 30, False),
            (5, 10, False),
        ]
        for count, limit, expected in stop_tests:
            result = strategy._check_should_stop(count, limit)
            status = "✓" if result == expected else "✗"
            print(f"  {status} consecutive_404={count}, limit={limit} -> should_stop={result}")
        
        print("\n--- 测试7: 统计信息 ---")
        stats = strategy.get_stats()
        print(f"  统计信息: {stats}")
        
        print("\n" + "=" * 60)
        print("测试完成!")
        print("=" * 60)
    
    asyncio.run(test_parse())
