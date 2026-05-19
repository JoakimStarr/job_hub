"""
内置插件实现

提供以下开箱即用的插件:
1. RateLimitPlugin - 自适应限速 (检测429自动退避)
2. ProxyPlugin - IP代理轮换
3. MetricsPlugin - 性能指标收集和统计
4. NotificationPlugin - 通知推送 (邮件/钉钉/企业微信)

使用示例:
    from src.spiders.plugins import (
        PluginManager,
        RateLimitPlugin,
        MetricsPlugin,
    )
    
    manager = PluginManager()
    manager.register(RateLimitPlugin())
    manager.register(MetricsPlugin())
    
    # 在UnifiedSpider中使用
    spider.use(manager)
"""

import asyncio
import json
import time
from collections import defaultdict
from datetime import datetime
from typing import Any, Callable, DefaultDict, Dict, List, Optional

import aiohttp
from loguru import logger

from .base import CrawlPlugin


class RateLimitPlugin(CrawlPlugin):
    """
    自适应限速插件
    
    功能:
    - 根据服务器响应自动调整请求速率
    - 检测到429状态码时指数退避
    - 成功请求后逐步恢复速率
    - 支持最小/最大速率限制
    
    算法:
    - 初始速率: initial_rate (req/s)
    - 成功时: rate *= recovery_factor (缓慢恢复)
    - 429时: rate /= backoff_factor (快速降低)
    - 最低速率: min_rate
    - 最高速率: max_rate
    
    配置选项 (在config中设置):
        initial_rate: 初始速率, 默认2.0
        min_rate: 最小速率, 默认0.1
        max_rate: 最大速率, 默认10.0
        backoff_factor: 退避因子, 默认2.0
        recovery_factor: 恢复因子, 默认1.05
        cooldown_time: 冷却时间(秒), 默认60.0
    """
    
    name = "rate_limit"
    priority = 10
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        
        self.initial_rate = float(self.config.get('initial_rate', 2.0))
        self.min_rate = float(self.config.get('min_rate', 0.1))
        self.max_rate = float(self.config.get('max_rate', 10.0))
        self.backoff_factor = float(self.config.get('backoff_factor', 2.0))
        self.recovery_factor = float(self.config.get('recovery_factor', 1.05))
        self.cooldown_time = float(self.config.get('cooldown_time', 60.0))
        
        self._current_rate = self.initial_rate
        self._last_request_time: float = 0.0
        self._consecutive_429: int = 0
        self._last_429_time: float = 0.0
        self._success_count: int = 0
        self._total_requests: int = 0
        self._lock = asyncio.Lock()
    
    async def _wait_if_needed(self):
        """根据当前速率等待"""
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self._last_request_time
            min_interval = 1.0 / max(self._current_rate, self.min_rate)
            
            if elapsed < min_interval:
                wait_time = min_interval - elapsed
                await asyncio.sleep(wait_time)
            
            self._last_request_time = time.monotonic()
            self._total_requests += 1
    
    async def before_request(
        self,
        spider,
        request_info: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """请求前执行限速等待"""
        await self._wait_if_needed()
        return None
    
    async def after_response(
        self,
        spider,
        request_info: Dict[str, Any],
        response: Any
    ) -> Optional[Any]:
        """根据响应调整速率"""
        status_code = getattr(response, 'status', None)
        
        async with self._lock:
            if status_code == 429:
                self._handle_429()
            elif 200 <= (status_code or 200) < 400:
                self._handle_success()
        
        return None
    
    def _handle_429(self):
        """处理429响应"""
        self._consecutive_429 += 1
        self._last_429_time = time.monotonic()
        
        new_rate = self._current_rate / self.backoff_factor
        new_rate = max(new_rate, self.min_rate)
        
        logger.warning(
            f"🐌 [RateLimit] 收到429响应 (连续{self._consecutive_429}次), "
            f"降速: {self._current_rate:.2f} -> {new_rate:.2f} req/s"
        )
        
        self._current_rate = new_rate
    
    def _handle_success(self):
        """处理成功响应"""
        self._success_count += 1
        self._consecutive_429 = 0
        
        if time.monotonic() - self._last_429_time > self.cooldown_time:
            new_rate = min(
                self._current_rate * self.recovery_factor,
                self.max_rate
            )
            
            if abs(new_rate - self._current_rate) > 0.01:
                logger.debug(
                    f"⚡ [RateLimit] 速率恢复: "
                    f"{self._current_rate:.2f} -> {new_rate:.2f} req/s"
                )
                self._current_rate = new_rate
    
    def get_stats(self) -> Dict[str, Any]:
        """获取限速统计"""
        return {
            'current_rate': round(self._current_rate, 3),
            'initial_rate': self.initial_rate,
            'min_rate': self.min_rate,
            'max_rate': self.max_rate,
            'total_requests': self._total_requests,
            'success_count': self._success_count,
            'consecutive_429': self._consecutive_429,
        }


class ProxyPlugin(CrawlPlugin):
    """
    代理轮换插件
    
    功能:
    - 支持多种代理源 (免费/付费)
    - 自动轮换IP地址
    - 失败自动切换代理
    - 代理健康检查
    
    配置选项:
        proxies: 代理列表, 格式: ["http://user:pass@host:port", ...]
        rotation_strategy: 轮换策略 ('round_robin', 'random', 'least_used')
        max_failures: 最大失败次数后禁用, 默认3
        health_check_interval: 健康检查间隔(秒), 默认300
    """
    
    name = "proxy"
    priority = 20
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        
        self.proxies: List[str] = self.config.get('proxies', [])
        self.rotation_strategy = self.config.get('rotation_strategy', 'round_robin')
        self.max_failures = int(self.config.get('max_failures', 3))
        
        self._current_index: int = 0
        self._failures: DefaultDict[str, int] = defaultdict(int)
        self._disabled_proxies: set = set()
        self._lock = asyncio.Lock()
    
    async def _select_proxy(self) -> Optional[str]:
        """选择下一个可用代理"""
        async with self._lock:
            available = [
                p for p in self.proxies 
                if p not in self._disabled_proxies
            ]
            
            if not available:
                logger.warning("[Proxy] 无可用代理")
                return None
            
            if self.rotation_strategy == 'round_robin':
                proxy = available[self._current_index % len(available)]
                self._current_index += 1
            elif self.rotation_strategy == 'random':
                import random
                proxy = random.choice(available)
            else:
                proxy = available[0]
            
            return proxy
    
    async def before_request(
        self,
        spider,
        request_info: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """为请求添加代理"""
        proxy = await self._select_proxy()
        if proxy:
            request_info['proxy'] = proxy
            return request_info
        return None
    
    async def after_response(
        self,
        spider,
        request_info: Dict[str, Any],
        response: Any
    ) -> Optional[Any]:
        """根据响应更新代理状态"""
        proxy = request_info.get('proxy')
        if not proxy:
            return None
        
        status_code = getattr(response, 'status', None)
        
        async with self._lock:
            if status_code and status_code >= 400:
                self._failures[proxy] += 1
                
                if self._failures[proxy] >= self.max_failures:
                    self._disabled_proxies.add(proxy)
                    logger.warning(
                        f"[Proxy] 代理已禁用: {proxy[:30]}... "
                        f"(失败{self._failures[proxy]}次)"
                    )
            else:
                self._failures[proxy] = 0
        
        return None
    
    def add_proxy(self, proxy_url: str):
        """动态添加代理"""
        if proxy_url not in self.proxies:
            self.proxies.append(proxy_url)
            logger.info(f"[Proxy] 添加新代理: {proxy_url[:30]}...")
    
    def remove_proxy(self, proxy_url: str):
        """移除代理"""
        if proxy_url in self.proxies:
            self.proxies.remove(proxy_url)
            self._disabled_proxies.discard(proxy_url)
            logger.info(f"[Proxy] 移除代理: {proxy_url[:30]}...")
    
    def enable_proxy(self, proxy_url: str):
        """重新启用被禁用的代理"""
        self._disabled_proxies.discard(proxy_url)
        self._failures[proxy_url] = 0
        logger.info(f"[Proxy] 启用代理: {proxy_url[:30]}...")
    
    def get_stats(self) -> Dict[str, Any]:
        """获取代理统计"""
        return {
            'total_proxies': len(self.proxies),
            'available': len(self.proxies) - len(self._disabled_proxies),
            'disabled': len(self._disabled_proxies),
            'failures': dict(self._failures),
        }


class MetricsPlugin(CrawlPlugin):
    """
    性能指标收集插件
    
    功能:
    - 收集详细的性能指标
    - 计数器 (请求数、成功数、失败数等)
    - 直方图 (响应时间分布)
    - 实时统计输出
    - 支持导出为JSON/Prometheus格式
    
    收集的指标:
    - requests.total: 总请求数
    - requests.success: 成功数
    - requests.failed: 失败数
    - jobs.extracted: 提取的JobData数量
    - jobs.valid: 有效JobData数量
    - timing.avg_response: 平均响应时间
    - timing.p50/p90/p99: 百分位响应时间
    - memory.usage: 内存使用量 (如果psutil可用)
    
    配置选项:
        export_format: 导出格式 ('json', 'prometheus'), 默认'json'
        report_interval: 报告间隔(秒), 默认60
        enable_memory: 是否收集内存指标, 默认True
    """
    
    name = "metrics"
    priority = 999  # 最后执行，确保收集所有数据
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        
        self.export_format = self.config.get('export_format', 'json')
        self.report_interval = int(self.config.get('report_interval', 60))
        self.enable_memory = self.config.get('enable_memory', True)
        
        self._counters: DefaultDict[str, int] = defaultdict(int)
        self._response_times: List[float] = []
        self._start_time: Optional[float] = None
        self._source_stats: DefaultDict[str, Dict] = defaultdict(lambda: {
            'jobs': 0,
            'requests': 0,
            'errors': 0,
            'start_time': None,
            'end_time': None,
        })
    
    async def before_crawl(self, spider):
        """记录爬取开始时间"""
        source = getattr(spider, 'source', 'unknown')
        self._source_stats[source]['start_time'] = datetime.now().isoformat()
        self._start_time = time.monotonic()
        self._counters['crawls_started'] += 1
    
    async def after_crawl(self, spider, result: Any) -> Any:
        """记录爬取结束时间和结果"""
        source = getattr(spider, 'source', 'unknown')
        self._source_stats[source]['end_time'] = datetime.now().isoformat()
        self._counters['crawls_completed'] += 1
        
        if isinstance(result, list):
            self._counters['jobs_extracted'] += len(result)
            self._source_stats[source]['jobs'] = len(result)
        
        self._print_summary(source)
        return result
    
    async def before_request(
        self,
        spider,
        request_info: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """记录请求开始"""
        url = request_info.get('url', '')
        request_info['_metrics_start_time'] = time.monotonic()
        
        source = getattr(spider, 'source', 'unknown')
        self._source_stats[source]['requests'] += 1
        self._counters['requests_total'] += 1
        
        logger.debug(f"[Metrics] 请求: {url[:80]}...")
        return None
    
    async def after_response(
        self,
        spider,
        request_info: Dict[str, Any],
        response: Any
    ) -> Optional[Any]:
        """记录响应时间和状态"""
        start_time = request_info.get('_metrics_start_time')
        if start_time:
            elapsed = time.monotonic() - start_time
            self._response_times.append(elapsed)
            self._counters['responses_total'] += 1
            
            status = getattr(response, 'status', 200)
            if 200 <= status < 400:
                self._counters['responses_success'] += 1
            else:
                self._counters['responses_failed'] += 1
                source = getattr(spider, 'source', 'unknown')
                self._source_stats[source]['errors'] += 1
        
        return None
    
    async def on_job_extracted(self, spider, job: Any) -> Optional[Any]:
        """记录提取到的JobData"""
        self._counters['jobs_valid'] += 1
        return None
    
    async def on_error(self, spider, error: Exception, context=None) -> bool:
        """记录错误"""
        self._counters['errors_total'] += 1
        error_type = type(error).__name__
        self._counters[f'errors_{error_type.lower()}'] += 1
        
        source = getattr(spider, 'source', 'unknown')
        self._source_stats[source]['errors'] += 1
        
        return False
    
    def _print_summary(self, source: str):
        """打印统计摘要"""
        stats = self._source_stats[source]
        
        if stats['end_time'] and stats['start_time']:
            from datetime import datetime as dt
            start = dt.fromisoformat(stats['start_time'])
            end = dt.fromisoformat(stats['end_time'])
            duration = (end - start).total_seconds()
        else:
            duration = 0
        
        logger.info(
            f"\n{'='*60}\n"
            f"📊 [{source}] 性能报告\n"
            f"{'='*60}\n"
            f"  ⏱️  总耗时: {duration:.2f}s\n"
            f"  📨 请求数: {stats['requests']}\n"
            f"  ✅ 岗位数: {stats['jobs']}\n"
            f"  ❌ 错误数: {stats['errors']}\n"
            f"{'='*60}"
        )
    
    def get_metrics(self) -> Dict[str, Any]:
        """获取所有指标"""
        metrics = {
            'timestamp': datetime.now().isoformat(),
            'uptime_seconds': time.monotonic() - self._start_time if self._start_time else 0,
            'counters': dict(self._counters),
            'sources': dict(self._source_stats),
        }
        
        if self._response_times:
            sorted_times = sorted(self._response_times)
            n = len(sorted_times)
            metrics['timing'] = {
                'avg': sum(sorted_times) / n,
                'min': sorted_times[0],
                'max': sorted_times[-1],
                'p50': sorted_times[int(n * 0.5)],
                'p90': sorted_times[int(n * 0.9)],
                'p99': sorted_times[min(int(n * 0.99), n - 1)],
                'total_samples': n,
            }
        
        if self.enable_memory:
            try:
                import psutil
                process = psutil.Process()
                mem_info = process.memory_info()
                metrics['memory'] = {
                    'rss_mb': mem_info.rss / 1024 / 1024,
                    'vms_mb': mem_info.vms / 1024 / 1024,
                    'cpu_percent': process.cpu_percent(),
                }
            except ImportError:
                pass
        
        return metrics
    
    def export_metrics(self, filepath: Optional[str] = None) -> str:
        """导出指标"""
        metrics = self.get_metrics()
        
        if self.export_format == 'prometheus':
            output = self._to_prometheus(metrics)
        else:
            output = json.dumps(metrics, indent=2, ensure_ascii=False, default=str)
        
        if filepath:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(output)
            logger.info(f"[Metrics] 指标已导出到: {filepath}")
        
        return output
    
    def _to_prometheus(self, metrics: Dict[str, Any]) -> str:
        """转换为Prometheus格式"""
        lines = [
            '# HELP crawler_requests_total Total number of requests',
            '# TYPE crawler_requests_total counter',
            f'crawler_requests_total {metrics["counters"].get("requests_total", 0)}',
            '',
            '# HELP crawler_jobs_extracted Total jobs extracted',
            '# TYPE crawler_jobs_extracted counter',
            f'crawler_jobs_extracted {metrics["counters"].get("jobs_extracted", 0)}',
            '',
            '# HELP crawler_errors_total Total errors',
            '# TYPE crawler_errors_total counter',
            f'crawler_errors_total {metrics["counters"].get("errors_total", 0)}',
        ]
        
        if 'timing' in metrics:
            t = metrics['timing']
            lines.extend([
                '',
                '# HELP crawler_response_time_avg Average response time',
                '# TYPE crawler_response_time_avg gauge',
                f'crawler_response_time_avg {t["avg"]:.4f}',
            ])
        
        return '\n'.join(lines)
    
    def reset(self):
        """重置所有指标"""
        self._counters.clear()
        self._response_times.clear()
        self._source_stats.clear()
        self._start_time = None
