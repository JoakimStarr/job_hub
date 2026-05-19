"""
中间件系统 - 提供开箱即用的中间件组件

模块导出:
- BaseMiddleware: 中间件基类 (用于自定义中间件)
- MiddlewarePipeline: 中间件管道 (洋葱模型)
- LoggerMiddleware: 日志记录中间件
- RateLimitMiddleware: 限速中间件 (令牌桶算法)
- ErrorHandlerMiddleware: 错误处理中间件
- CacheMiddleware: 缓存中间件 (可选)

快速开始:
    from src.spiders.middleware import (
        MiddlewarePipeline,
        LoggerMiddleware,
        RateLimitMiddleware,
    )
    
    # 创建管道
    pipeline = MiddlewarePipeline()
    pipeline.use(LoggerMiddleware())
    pipeline.use(RateLimitMiddleware(rate=2.0))
    
    # 在爬虫中使用
    spider.use(pipeline)

自定义中间件示例:
    from src.spiders.middleware import BaseMiddleware
    
    class CustomMiddleware(BaseMiddleware):
        name = "custom"
        priority = 50
        
        async def process(self, context, next):
            # 前置逻辑
            print("Before crawl")
            
            # 调用下一个
            result = await next(context)
            
            # 后置逻辑
            print("After crawl")
            
            return result
"""

from .base import BaseMiddleware
from .pipeline import MiddlewarePipeline
from .built_in import (
    LoggerMiddleware,
    RateLimitMiddleware,
    ErrorHandlerMiddleware,
    CacheMiddleware,
)

__all__ = [
    'BaseMiddleware',
    'MiddlewarePipeline',
    'LoggerMiddleware',
    'RateLimitMiddleware',
    'ErrorHandlerMiddleware',
    'CacheMiddleware',
]
