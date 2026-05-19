import functools
import asyncio
import time
import traceback
from typing import Callable, Any, Optional, Tuple, Type, Union

from loguru import logger


def retry(
    max_retries: int = 3,
    backoff_base: float = 1.5,
    exceptions: tuple = (Exception,),
    on_retry: Optional[Callable[[int, Exception, float], None]] = None,
):
    """
    指数退避重试装饰器
    
    Args:
        max_retries: 最大重试次数（默认3次）
        backoff_base: 退避基数（默认1.5倍）
        exceptions: 需要重试的异常类型元组
        on_retry: 重试时的回调函数 (attempt, error, wait_time) -> None
    
    使用示例:
        @retry(max_retries=3, backoff_base=2.0, exceptions=(aiohttp.ClientError, asyncio.TimeoutError))
        async def fetch_url(url):
            async with session.get(url) as resp:
                return await resp.json()
        
        @retry(max_retries=2)
        def sync_fetch(url):
            return requests.get(url).json()
    """

    def decorator(func: Callable) -> Callable:

        if asyncio.iscoroutinefunction(func):

            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs) -> Any:
                last_error: Optional[Exception] = None
                for attempt in range(1, max_retries + 1):
                    try:
                        return await func(*args, **kwargs)
                    except exceptions as e:
                        last_error = e
                        wait_time = backoff_base ** attempt
                        logger.warning(
                            f"[retry] {func.__name__} 第 {attempt}/{max_retries} 次尝试失败: "
                            f"{type(e).__name__}: {e}, 等待 {wait_time:.2f}s 后重试"
                        )
                        if on_retry is not None:
                            on_retry(attempt, e, wait_time)
                        if attempt < max_retries:
                            await asyncio.sleep(wait_time)
                raise last_error

            return async_wrapper
        else:

            @functools.wraps(func)
            def sync_wrapper(*args, **kwargs) -> Any:
                last_error: Optional[Exception] = None
                for attempt in range(1, max_retries + 1):
                    try:
                        return func(*args, **kwargs)
                    except exceptions as e:
                        last_error = e
                        wait_time = backoff_base ** attempt
                        logger.warning(
                            f"[retry] {func.__name__} 第 {attempt}/{max_retries} 次尝试失败: "
                            f"{type(e).__name__}: {e}, 等待 {wait_time:.2f}s 后重试"
                        )
                        if on_retry is not None:
                            on_retry(attempt, e, wait_time)
                        if attempt < max_retries:
                            time.sleep(wait_time)
                raise last_error

            return sync_wrapper

    return decorator


def measure_time(func=None, *, log_level: str = "debug"):
    """
    函数耗时测量装饰器
    
    Args:
        func: 被装饰的函数（支持 @measure_time 和 @measure_time() 两种用法）
        log_level: 日志级别 (debug/info/warning)
    
    使用示例:
        @measure_time
        async def crawl_source(source):
            ...
            
        @measure_time(log_level="info")
        def process_batch(jobs):
            ...
    """

    def decorator(fn: Callable) -> Callable:
        log_fn = getattr(logger, log_level.lower(), logger.debug)

        if asyncio.iscoroutinefunction(fn):

            @functools.wraps(fn)
            async def async_wrapper(*args, **kwargs) -> Any:
                start = time.perf_counter()
                try:
                    result = await fn(*args, **kwargs)
                    elapsed = time.perf_counter() - start
                    log_fn(f"{fn.__name__} completed in {elapsed:.3f}s")
                    return result
                except Exception:
                    elapsed = time.perf_counter() - start
                    log_fn(f"{fn.__name__} failed after {elapsed:.3f}s")
                    raise

            return async_wrapper
        else:

            @functools.wraps(fn)
            def sync_wrapper(*args, **kwargs) -> Any:
                start = time.perf_counter()
                try:
                    result = fn(*args, **kwargs)
                    elapsed = time.perf_counter() - start
                    log_fn(f"{fn.__name__} completed in {elapsed:.3f}s")
                    return result
                except Exception:
                    elapsed = time.perf_counter() - start
                    log_fn(f"{fn.__name__} failed after {elapsed:.3f}s")
                    raise

            return sync_wrapper

    if func is not None:
        return decorator(func)
    return decorator


def catch_and_log(
    default_return: Any = None,
    reraise: bool = False,
    exceptions: tuple = (Exception,),
    log_level: str = "error",
):
    """
    统一异常捕获和日志记录装饰器
    
    Args:
        default_return: 异常发生时返回的默认值
        reraise: 是否在记录日志后重新抛出异常
        exceptions: 要捕获的异常类型
        log_level: 日志级别
    
    使用示例:
        @catch_and_log(default_return=[], reraise=False)
        async def parse_job_list(html):
            # 解析逻辑...
            return jobs
            
        @catch_and_log(reraise=True)  # 只记录日志，仍然抛出
        def save_to_db(data):
            ...
    """

    def decorator(func: Callable) -> Callable:
        log_fn = getattr(logger, log_level.lower(), logger.error)

        if asyncio.iscoroutinefunction(func):

            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs) -> Any:
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    tb = traceback.format_exc()
                    log_fn(
                        f"[catch_and_log] {func.__name__} 异常: "
                        f"{type(e).__name__}: {e}\n"
                        f"位置: {func.__code__.co_filename}:{func.__code__.co_firstlineno}\n"
                        f"堆栈:\n{tb}"
                    )
                    if reraise:
                        raise
                    return default_return

            return async_wrapper
        else:

            @functools.wraps(func)
            def sync_wrapper(*args, **kwargs) -> Any:
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    tb = traceback.format_exc()
                    log_fn(
                        f"[catch_and_log] {func.__name__} 异常: "
                        f"{type(e).__name__}: {e}\n"
                        f"位置: {func.__code__.co_filename}:{func.__code__.co_firstlineno}\n"
                        f"堆栈:\n{tb}"
                    )
                    if reraise:
                        raise
                    return default_return

            return sync_wrapper

    return decorator


if __name__ == "__main__":
    async def run_tests():
        call_count = [0]

        @retry(max_retries=3, backoff_base=0.1)
        async def flaky_function():
            call_count[0] += 1
            if call_count[0] < 3:
                raise ValueError("模拟失败")
            return "成功!"

        result = await flaky_function()
        print(f"✅ retry测试通过: {result} (尝试了{call_count[0]}次)")

        @measure_time(log_level="info")
        async def slow_function():
            await asyncio.sleep(0.1)
            return "完成"

        result = await slow_function()
        print(f"✅ measure_time测试通过: {result}")

        @catch_and_log(default_return="兜底值", reraise=False)
        async def failing_function():
            raise RuntimeError("预期错误")

        result = await failing_function()
        print(f"✅ catch_and_log测试通过: {result}")

    asyncio.run(run_tests())
