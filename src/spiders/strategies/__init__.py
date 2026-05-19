"""
爬虫策略模式 - 将不同类型的爬取逻辑拆分为独立的Strategy类

支持的策略类型:
- api_post: POST JSON API (sufe, cufe, dufe)
- api_get: GET API with params (zuel)
- html: HTTP + BeautifulSoup解析 (swufe)
- browser_*: Playwright浏览器自动化 (uibe, jxufe, neu, smartedu)

使用示例:
    from src.spiders.strategies import get_strategy, STRATEGY_MAP
    
    strategy_cls = STRATEGY_MAP['api_post']
    strategy = strategy_cls()
    
    # 或使用工厂函数
    strategy = get_strategy('api_post')
"""
from .base import BaseCrawlStrategy
from .api_post import ApiPostStrategy
from .api_get import ApiGetStrategy
from .html_strategy import HtmlStrategy
from .browser_strategy import BrowserStrategy

# 策略注册表: spider_type -> Strategy类
STRATEGY_MAP = {
    'api_post': ApiPostStrategy,
    'api_get': ApiGetStrategy,
    'html': HtmlStrategy,
    'browser_js': BrowserStrategy,
    'browser_encrypted': BrowserStrategy,
    'browser_api': BrowserStrategy,
}

# 支持的类型列表（包含所有已注册的策略类型标识）
SUPPORTED_TYPES = list(STRATEGY_MAP.keys())


def get_strategy(spider_type: str) -> BaseCrawlStrategy:
    """
    工厂函数: 根据spider_type获取对应的Strategy实例
    
    Args:
        spider_type: 策略类型标识 (api_post/api_get/html/browser_*)
    
    Returns:
        BaseCrawlStrategy 实例
    
    Raises:
        ValueError: 不支持的spider_type
    """
    if spider_type not in STRATEGY_MAP:
        raise ValueError(
            f"不支持的爬虫类型: {spider_type}. "
            f"支持的类型: {SUPPORTED_TYPES}"
        )
    
    return STRATEGY_MAP[spider_type]()


__all__ = [
    'BaseCrawlStrategy',
    'ApiPostStrategy',
    'ApiGetStrategy',
    'HtmlStrategy',
    'BrowserStrategy',
    'STRATEGY_MAP',
    'SUPPORTED_TYPES',
    'get_strategy',
]
