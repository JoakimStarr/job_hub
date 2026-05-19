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
from .browser_strategy import BrowserStrategy

# 以下策略类的导入将在对应实现文件创建后启用
# from .api_post import ApiPostStrategy
from .api_get import ApiGetStrategy
# from .html_strategy import HtmlStrategy

# 策略注册表: spider_type -> Strategy类
STRATEGY_MAP = {
    'api_post': None,       # 将替换为 ApiPostStrategy
    'api_get': ApiGetStrategy,   # GET API (zuel)
    'html': None,           # 将替换为 HtmlStrategy
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
        ValueError: 不支持的spider_type或策略尚未实现
    """
    if spider_type not in STRATEGY_MAP:
        raise ValueError(
            f"不支持的爬虫类型: {spider_type}. "
            f"支持的类型: {SUPPORTED_TYPES}"
        )
    
    strategy_cls = STRATEGY_MAP[spider_type]
    if strategy_cls is None:
        raise NotImplementedError(
            f"策略 '{spider_type}' 已注册但尚未实现。"
            f"请等待对应的策略实现文件创建完成。"
        )
    
    return strategy_cls()


__all__ = [
    'BaseCrawlStrategy',
    # 'ApiPostStrategy',     # 待实现
    'ApiGetStrategy',      # GET API (zuel)
    # 'HtmlStrategy',        # 待实现
    'BrowserStrategy',
    'STRATEGY_MAP',
    'SUPPORTED_TYPES',
    'get_strategy',
]
