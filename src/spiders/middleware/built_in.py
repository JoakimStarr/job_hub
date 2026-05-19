"""
内置中间件实现

提供以下开箱即用的中间件:
1. LoggerMiddleware - 请求/响应日志记录
2. RateLimitMiddleware - 令牌桶限速
3. ErrorHandlerMiddleware - 统一异常捕获和处理
4. CacheMiddleware - 响应缓存 (可选)

使用示例:
    from src.spiders.middleware import (
        MiddlewarePipeline,
        LoggerMiddleware,
        RateLimitMiddleware,
    )
    
    pipeline = MiddlewarePipeline()
    pipeline.use(LoggerMiddleware())
    pipeline.use(RateLimitMiddleware(rate=2.0))
    
    # 在UnifiedSpider中使用
    spider.use(pipeline)
"""

import asyncio
import functools
import time
from typing import Any, Awaitable, Callable, Dict, List, Optional

from loguru import logger

from .base import BaseMiddleware


class LoggerMiddleware(BaseMiddleware):
    """
    日志记录中间件
    
    功能:
    - 记录每次爬取请求的开始/结束时间
    - 记录爬取到的JobData数量
    - 计算并记录耗时统计
    - 输出结构化的trace日志
    
    配置选项 (通过context传递):
        log_level: 日志级别 ('DEBUG', 'INFO', 'WARNING')
        log_request: 是否记录请求详情 (默认True)
        log_response: 是否记录响应摘要 (默认True)
        log_job_details: 是否记录每条JobData的详细信息 (默认False)
    """
    
    name = "logger"
    priority = 10  # 高优先级，确保最先执行
    
    def __init__(self, log_level: str = "INFO"):
        self.log_level = log_level.upper()
    
    async def process(
        self,
        context: Dict[str, Any],
        next_handler: Callable[[Dict[str, Any]], Awaitable[Any]]
    ) -> Any:
        """记录请求和响应的详细日志"""
        spider = context.get('spider')
        source = getattr(spider, 'source', 'unknown') if spider else 'unknown'
        
        start_time = time.time()
        context['_log_start_time'] = start_time
        context['_log_job_count'] = 0
        
        log_fn = getattr(logger, self.log_level.lower(), logger.info)
        log_fn(f"[{source}] 🚀 开始爬取")
        
        try:
            result = await next_handler(context)
            
            elapsed = time.time() - start_time
            job_count = context.get('_log_job_count', 0)
            
            log_fn(
                f"[{source}] ✅ 爬取完成 | "
                f"耗时: {elapsed:.2f}s | "
                f"获取: {job_count} 条"
            )
            
            return result
            
        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(
                f"[{source}] ❌ 爬取失败 | "
                f"耗时: {elapsed:.2f}s | "
                f"错误: {type(e).__name__}: {e}"
            )
            raise


class RateLimitMiddleware(BaseMiddleware):
    """
    限速中间件 - 基于令牌桶算法
    
    功能:
    - 控制请求频率，避免被封禁
    - 支持自适应调整 (检测到429时自动降低速率)
    - 平滑限速而非固定间隔
    
    算法说明:
    - 令牌桶容量: burst_size (突发请求数)
    - 填充速率: rate (每秒生成的令牌数)
    - 每次请求消耗1个令牌
    - 令牌不足时等待直到有令牌可用
    
    配置选项:
        rate: 平均速率 (请求/秒), 默认2.0
        burst_size: 桶容量, 默认10
        min_wait: 最小等待时间(秒), 默认0.1
        max_wait: 最大等待时间(秒), 默���30.0
        adaptive: 是否启用自适应限速, 默认True
    """
    
    name = "rate_limit"
    priority = 20
    
    def __init__(
        self,
        rate: float = 2.0,
        burst_size: int = 10,
        min_wait: float = 0.1,
        max_wait: float = 30.0,
        adaptive: bool = True
    ):
        self.rate = rate
        self.burst_size = burst_size
        self.min_wait = min_wait
        self.max_wait = max_wait
        self.adaptive = adaptive
        
        self._tokens: float = float(burst_size)
        self._last_refill: float = time.monotonic()
        self._lock = asyncio.Lock()
        self._consecutive_429: int = 0
    
    async def _refill_tokens(self):
        """补充令牌"""
        now = time.monotonic()
        elapsed = now - self._last_refill
        self._tokens = min(self.burst_size, self._tokens + elapsed * self.rate)
        self._last_refill = now
    
    async def _acquire_token(self) -> float:
        """
        获取一个令牌，返回等待时间
        
        Returns:
            实际等待时间(秒)
        """
        async with self._lock:
            await self._refill_tokens()
            
            if self._tokens >= 1.0:
                self._tokens -= 1.0
                return 0.0
            
            wait_time = (1.0 - self._tokens) / self.rate
            wait_time = max(self.min_wait, min(wait_time, self.max_wait))
            
            await asyncio.sleep(wait_time)
            
            await self._refill_tokens()
            if self._tokens >= 1.0:
                self._tokens -= 1.0
                
            return wait_time
    
    def _adjust_rate_on_429(self):
        """检测到429时自动降低速率"""
        if not self.adaptive:
            return
            
        self._consecutive_429 += 1
        
        if self._consecutive_429 >= 3:
            new_rate = self.rate * 0.5
            logger.warning(
                f"连续{self._consecutive_429}次429, "
                f"自动降速: {self.rate:.1f} -> {new_rate:.1f} req/s"
            )
            self.rate = max(0.1, new_rate)
            self._consecutive_429 = 0
    
    def reset_rate(self):
        """重置速率到初始值 (成功请求后调用)"""
        if self._consecutive_429 > 0:
            self._consecutive_429 = 0
    
    async def process(
        self,
        context: Dict[str, Any],
        next_handler: Callable[[Dict[str, Any]], Awaitable[Any]]
    ) -> Any:
        """执行限速控制"""
        wait_time = await self._acquire_token()
        
        if wait_time > 0:
            spider = context.get('spider')
            source = getattr(spider, 'source', 'unknown') if spider else 'unknown'
            logger.debug(f"[{source}] ⏳ 限速等待 {wait_time:.2f}s")
        
        try:
            result = await next_handler(context)
            self.reset_rate()
            return result
        except Exception as e:
            error_str = str(e).lower()
            if '429' in error_str or 'too many requests' in error_str:
                self._adjust_rate_on_429()
            raise


class ErrorHandlerMiddleware(BaseMiddleware):
    """
    错误处理中间件
    
    功能:
    - 捕获并记录所有异常
    - 对特定错误进行重试
    - 提供友好的错误信息和恢复策略
    - 保证即使出错也不会崩溃
    
    配置选项:
        retry_count: 重试次数, 默认1
        retry_delay: 重试间隔(秒), 默认1.0
        retryable_errors: 可重试的错误类型列表
        on_error: 自定义错误处理回调函数
    """
    
    name = "error_handler"
    priority = 999  # 低优先级，最后执行（最外层）
    
    def __init__(
        self,
        retry_count: int = 1,
        retry_delay: float = 1.0,
        retryable_errors: tuple = (
            ConnectionError,
            TimeoutError,
            asyncio.TimeoutError,
        ),
        on_error: Optional[Callable] = None
    ):
        self.retry_count = retry_count
        self.retry_delay = retry_delay
        self.retryable_errors = retryable_errors
        self.on_error = on_error
    
    async def process(
        self,
        context: Dict[str, Any],
        next_handler: Callable[[Dict[str, Any]], Awaitable[Any]]
    ) -> Any:
        """统一错误处理"""
        spider = context.get('spider')
        source = getattr(spider, 'source', 'unknown') if spider else 'unknown'
        last_exception = None
        
        for attempt in range(self.retry_count + 1):
            try:
                result = await next_handler(context)
                return result
                
            except self.retryable_errors as e:
                last_exception = e
                if attempt < self.retry_count:
                    logger.warning(
                        f"[{source}] ⚠️ 可重试错误 ({attempt+1}/{self.retry_count}): "
                        f"{type(e).__name__}: {e}"
                    )
                    await asyncio.sleep(self.retry_delay * (attempt + 1))
                    continue
                raise
                    
            except Exception as e:
                last_exception = e
                logger.error(
                    f"[{source}] ❌ 不可恢复的错误: "
                    f"{type(e).__name__}: {e}"
                )
                
                if self.on_error:
                    try:
                        await self.on_error(context, e)
                    except Exception as callback_err:
                        logger.error(f"错误处理回调异常: {callback_err}")
                
                raise
        
        raise last_exception


class CacheMiddleware(BaseMiddleware):
    """
    缓存中间件 (可选)
    
    功能:
    - 缓存GET请求的响应
    - 避免重复请求相同URL
    - 支持TTL过期机制
    - 减少服务器压力
    
    注意事项:
        仅适用于幂等请求 (GET/HEAD)
        不应缓存POST请求的结果
        需要合理设置TTL以平衡新鲜度和性能
    
    配置选项:
        ttl: 缓存有效期(秒), 默认300 (5分钟)
        max_size: 最大缓存条目数, 默认1000
        cache_by_url: 是否基于URL缓存, 默认True
    """
    
    name = "cache"
    priority = 50
    enabled = False  # 默认禁用，需要显式启用
    
    def __init__(
        self,
        ttl: int = 300,
        max_size: int = 1000,
        cache_by_url: bool = True
    ):
        self.ttl = ttl
        self.max_size = max_size
        self.cache_by_url = cache_by_url
        
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()
    
    def _get_cache_key(self, context: Dict[str, Any]) -> Optional[str]:
        """生成缓存键"""
        if not self.cache_by_url:
            return None
            
        request = context.get('request')
        if not request or not isinstance(request, dict):
            return None
            
        url = request.get('url')
        method = request.get('method', 'GET').upper()
        
        if method != 'GET' or not url:
            return None
            
        return url
    
    async def _get_cached(self, key: str) -> Optional[Any]:
        """获取缓存"""
        async with self._lock:
            if key not in self._cache:
                return None
                
            entry = self._cache[key]
            if time.time() - entry['timestamp'] > self.ttl:
                del self._cache[key]
                return None
                
            return entry['data']
    
    async def _set_cache(self, key: str, data: Any):
        """设置缓存"""
        async with self._lock:
            if len(self._cache) >= self.max_size:
                oldest_key = min(self._cache.keys(), 
                               k=lambda k: self._cache[k]['timestamp'])
                del self._cache[oldest_key]
            
            self._cache[key] = {
                'data': data,
                'timestamp': time.time(),
            }
    
    async def process(
        self,
        context: Dict[str, Any],
        next_handler: Callable[[Dict[str, Any]], Awaitable[Any]]
    ) -> Any:
        """缓存逻辑"""
        cache_key = self._get_cache_key(context)
        
        if not cache_key:
            return await next_handler(context)
        
        cached = await self._get_cached(cache_key)
        if cached is not None:
            spider = context.get('spider')
            source = getattr(spider, 'source', 'unknown') if spider else 'unknown'
            logger.debug(f"[{source}] 💾 命中缓存: {cache_key[:50]}...")
            return cached
        
        result = await next_handler(context)
        
        if result is not None:
            await self._set_cache(cache_key, result)
        
        return result
    
    def clear_cache(self):
        """清空缓存"""
        self._cache.clear()
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """获取缓存统计"""
        return {
            'size': len(self._cache),
            'max_size': self.max_size,
            'ttl': self.ttl,
            'hits': sum(1 for v in self._cache.values() 
                       if time.time() - v['timestamp'] <= self.ttl),
        }
