"""
中间件基类 - 定义所有中间件的接口规范

设计模式: 洋葱模型 (Onion Model)
- 中间件按注册顺序执行
- 每个中间件可以在调用 next() 前后添加逻辑
- 支持请求预处理和响应后处理

使用示例:
    class CustomMiddleware(BaseMiddleware):
        async def process(self, context, next):
            # 请求前处理
            context['start_time'] = time.time()
            
            # 调用下一个中间件或处理器
            result = await next(context)
            
            # 响应后处理
            elapsed = time.time() - context['start_time']
            logger.info(f"耗时: {elapsed:.2f}s")
            
            return result
"""

from abc import ABC, abstractmethod
from typing import Any, Awaitable, Callable, Dict, Optional


class BaseMiddleware(ABC):
    """
    中间件抽象基类
    
    所有自定义中间件都必须继承此类并实现 process() 方法。
    
    Attributes:
        name: 中间件名称标识
        priority: 执行优先级 (数字越小越先执行, 默认100)
        enabled: 是否启用 (可通过配置动态控制)
    
    设计原则:
        - 单一职责: 每个中间件只关注一个横切关注点
        - 可组合性: 多个中间件可以自由组合
        - 可插拔: 可以通过配置启用/禁用
    """
    
    name: str = "base_middleware"
    priority: int = 100
    enabled: bool = True
    
    @abstractmethod
    async def process(
        self,
        context: Dict[str, Any],
        next_handler: Callable[[Dict[str, Any]], Awaitable[Any]]
    ) -> Any:
        """
        处理请求/响应的中间件方法
        
        这是洋葱模型的核心方法，每个中间件都会接收:
        - context: 上下文对象，包含请求信息、spider实例等
        - next_handler: 下一个处理函数（可能是下一个中间件或最终处理器）
        
        Args:
            context: 上下文字典，包含:
                - spider: UnifiedSpider实例
                - request: 请求数据 (可选)
                - response: 响应数据 (next之后可用)
                - job: 当前处理的JobData (next之后可用)
                - custom: 自定义数据存储
            next_handler: 异步回调函数，调用它将控制权传递给下一个中间件
        
        Returns:
            处理结果 (通常是JobData或List[JobData])
        
        注意事项:
            - 必须调用 await next(context) 以传递控制权
            - 可以在调用前后添加前置/后置逻辑
            - 可以修改context中的数据
            - 可以抛出异常中断后续处理链
        """
        pass
    
    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}(name={self.name}, priority={self.priority})>"
