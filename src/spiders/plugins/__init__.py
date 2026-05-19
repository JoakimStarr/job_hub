"""
插件系统 - 可扩展的爬虫功能增强组件

模块导出:
- CrawlPlugin: 插件基类 (用于自定义插件)
- PluginManager: 插件管理器 (生命周期管理)
- RateLimitPlugin: 自适应限速插件
- ProxyPlugin: IP代理轮换插件
- MetricsPlugin: 性能指标收集插件

快速开始:
    from src.spiders.plugins import (
        PluginManager,
        RateLimitPlugin,
        MetricsPlugin,
    )
    
    # 创建管理器并注册插件
    manager = PluginManager()
    manager.register(RateLimitPlugin({'initial_rate': 2.0}))
    manager.register(MetricsPlugin())
    
    # 在爬虫中使用
    spider.use(manager)

自定义插件示例:
    from src.spiders.plugins import CrawlPlugin
    
    class CustomPlugin(CrawlPlugin):
        name = "custom"
        priority = 50
        
        def __init__(self, config=None):
            super().__init__(config)
            self.job_count = 0
        
        async def on_job_extracted(self, spider, job):
            self.job_count += 1
            print(f"已提取 {self.job_count} 个岗位")
            return job
        
        async def after_crawl(self, spider, result):
            print(f"总共提取了 {self.job_count} 个岗位")
            return result

中间件 vs 插件对比:
┌─────────────┬──────────────────┬──────────────────┐
│ 特性        │ 中间件           │ 插件             │
├─────────────┼──────────────────┼──────────────────┤
│ 模型        │ 洋葱模型         │ 观察者模式       │
│ 控制流      │ 可中断/修改      │ 只监听，不干预   │
│ 适用场景    │ 请求处理、限速   │ 监控、日志、统计 │
│ 必须调用next│ 是               │ 否               │
│ 典型用途    │ 认证、缓存、限速 │ 监控、告警、统计 │
└─────────────┴──────────────────┴──────────────────┘
"""

from .base import CrawlPlugin
from .manager import PluginManager
from .built_in import (
    RateLimitPlugin,
    ProxyPlugin,
    MetricsPlugin,
)

__all__ = [
    'CrawlPlugin',
    'PluginManager',
    'RateLimitPlugin',
    'ProxyPlugin',
    'MetricsPlugin',
]
