"""
MiddlewarePipeline - 洋葱模型中间件管道

实现类似 Koa/Express 的中间件执行模型:
- 按优先级排序
- 支持嵌套执行 (onion model)
- 可动态添加/移除中间件

架构图:
    Request → [MW1 → [MW2 → [MW3 → Handler] ← MW3] ← MW2] ← MW1] → Response
    
使用示例:
    from src.spiders.middleware import MiddlewarePipeline, LoggerMiddleware
    
    pipeline = MiddlewarePipeline()
    pipeline.use(LoggerMiddleware())
    
    # 执行管道
    async def my_handler(context):
        return {"data": "result"}
    
    result = await pipeline.execute(context, my_handler)
"""

import time
from typing import Any, Awaitable, Callable, Dict, List, Optional

from loguru import logger

from .base import BaseMiddleware


class MiddlewarePipeline:
    """
    中间件管道 - 洋葱模型实现
    
    管理中间件的注册、排序和执行。
    中间件按 priority 升序排列，数字越小越先执行。
    
    Attributes:
        middlewares: 已注册的中间件列表 (按priority排序)
    
    使用示例:
        pipeline = MiddlewarePipeline()
        
        # 注册中间件
        pipeline.use(LoggerMiddleware())
        pipeline.use(RateLimitMiddleware(rate=2.0))
        
        # 移除中间件
        pipeline.remove('rate_limit')
        
        # 执行管道
        result = await pipeline.execute(context, handler_func)
    """
    
    def __init__(self):
        self._middlewares: List[BaseMiddleware] = []
        self._stats: Dict[str, Any] = {
            'total_executions': 0,
            'total_time': 0.0,
            'middleware_stats': {},
        }
    
    def use(self, middleware: BaseMiddleware) -> 'MiddlewarePipeline':
        """
        注册中间件
        
        Args:
            middleware: 中间件实例 (必须继承BaseMiddleware)
            
        Returns:
            self - 支持链式调用
            
        Raises:
            TypeError: 如果middleware不是BaseMiddleware的子类
        """
        if not isinstance(middleware, BaseMiddleware):
            raise TypeError(
                f"中间件必须是BaseMiddleware的子类, "
                f"收到: {type(middleware).__name__}"
            )
        
        if not middleware.enabled:
            logger.debug(f"跳过禁用的中间件: {middleware.name}")
            return self
        
        # 检查是否已存在同名中间件
        existing_idx = next(
            (i for i, m in enumerate(self._middlewares) 
             if m.name == middleware.name),
            None
        )
        
        if existing_idx is not None:
            logger.warning(f"替换已存在的中间件: {middleware.name}")
            self._middlewares[existing_idx] = middleware
        else:
            self._middlewares.append(middleware)
        
        # 按priority排序
        self._middlewares.sort(key=lambda m: m.priority)
        
        logger.debug(f"注册中间件: {middleware} (当前共{len(self._middlewares)}个)")
        return self
    
    def remove(self, name: str) -> bool:
        """
        按名称移除中间件
        
        Args:
            name: 要移除的中间件的name属性
            
        Returns:
            True如果成功移除, False如果未找到
        """
        original_len = len(self._middlewares)
        self._middlewares = [
            m for m in self._middlewares 
            if m.name != name
        ]
        removed = len(self._middlewares) < original_len
        
        if removed:
            logger.debug(f"移除中间件: {name}")
        
        return removed
    
    def get_middleware(self, name: str) -> Optional[BaseMiddleware]:
        """按名称获取中间件实例"""
        for m in self._middlewares:
            if m.name == name:
                return m
        return None
    
    @property
    def middlewares(self) -> List[BaseMiddleware]:
        """获取已注册的中间件列表 (只读)"""
        return list(self._middlewares)
    
    async def execute(
        self,
        context: Dict[str, Any],
        handler: Callable[[Dict[str, Any]], Awaitable[Any]]
    ) -> Any:
        """
        执行中间件管道
        
        构建洋葱模型的调用链并执行。
        
        Args:
            context: 上下文字典，包含:
                - spider: UnifiedSpider实例
                - request: 请求数据
                - 其他自定义数据
            handler: 最终处理函数 (异步函数)
            
        Returns:
            处理结果
            
        示例:
            async def final_handler(ctx):
                # 实际的业务逻辑
                return await spider.crawl_stream(ctx.get('max_items', 0))
            
            result = await pipeline.execute({'spider': spider}, final_handler)
        """
        start_time = time.time()
        self._stats['total_executions'] += 1
        
        try:
            if not self._middlewares:
                return await handler(context)
            
            # 构建嵌套调用链
            chain = self._build_chain(handler, 0)
            result = await chain(context)
            
            elapsed = time.time() - start_time
            self._stats['total_time'] += elapsed
            
            return result
            
        except Exception as e:
            logger.error(f"管道执行异常: {e}")
            raise
    
    def _build_chain(
        self,
        handler: Callable,
        index: int
    ) -> Callable:
        """
        递归构建中间件调用链
        
        这是洋葱模型的核心实现。
        每一层包装下一层，形成嵌套结构:
        
        MW1.process(ctx, lambda ctx: MW2.process(ctx, lambda ctx: handler(ctx)))
        
        Args:
            handler: 当前层的下一个处理器
            index: 当前中间件索引
            
        Returns:
            异步处理函数
        """
        if index >= len(self._middlewares):
            return handler
        
        current_mw = self._middlewares[index]
        mw_name = current_mw.name
        mw_start = 0.0
        
        async def next_handler(ctx: Dict[str, Any]) -> Any:
            nonlocal mw_start
            mw_start = time.time()
            
            next_fn = self._build_chain(handler, index + 1)
            return await next_fn(ctx)
        
        async def wrapped_handler(ctx: Dict[str, Any]) -> Any:
            nonlocal mw_start
            mw_start = time.time()
            
            try:
                result = await current_mw.process(ctx, next_handler)
                
                elapsed = time.time() - mw_start
                self._update_middleware_stats(mw_name, elapsed, error=False)
                
                return result
                
            except Exception as e:
                elapsed = time.time() - mw_start
                self._update_middleware_stats(mw_name, elapsed, error=True)
                raise
        
        return wrapped_handler
    
    def _update_middleware_stats(self, name: str, elapsed: float, error: bool):
        """更新单个中间件的统计信息"""
        if name not in self._stats['middleware_stats']:
            self._stats['middleware_stats'][name] = {
                'calls': 0,
                'total_time': 0.0,
                'errors': 0,
            }
        
        stats = self._stats['middleware_stats'][name]
        stats['calls'] += 1
        stats['total_time'] += elapsed
        if error:
            stats['errors'] += 1
    
    def get_stats(self) -> Dict[str, Any]:
        """
        获取管道统计信息
        
        Returns:
            包含以下字段的字典:
            - total_executions: 总执行次数
            - total_time: 总耗时(秒)
            - middleware_count: 中间件数量
            - middleware_stats: 各中间件的详细统计
        """
        result = dict(self._stats)
        result['middleware_count'] = len(self._middlewares)
        
        for name, stats in result['middleware_stats'].items():
            if stats['calls'] > 0:
                stats['avg_time'] = stats['total_time'] / stats['calls']
            else:
                stats['avg_time'] = 0.0
        
        return result
    
    def reset_stats(self):
        """重置统计信息"""
        self._stats = {
            'total_executions': 0,
            'total_time': 0.0,
            'middleware_stats': {},
        }
    
    def clear(self):
        """清空所有中间件"""
        self._middlewares.clear()
        logger.debug("中间件管道已清空")
    
    def __len__(self) -> int:
        return len(self._middlewares)
    
    def __contains__(self, name: str) -> bool:
        return any(m.name == name for m in self._middlewares)
    
    def __repr__(self) -> str:
        mw_names = [m.name for m in self._middlewares]
        return f"<MiddlewarePipeline(count={len(self._middlewares)}, middlewares={mw_names})>"
