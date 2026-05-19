"""
CrawlPlugin - 爬虫插件抽象基类

设计模式: 观察者模式 + 钩子机制

与中间件的区别:
- 中间件: 洋葱模型，控制请求流程，必须调用next()
- 插件: 事件驱动，监听特定事件，不控制流程

插件生命周期:
    before_crawl → [before_request → after_request] × N → after_crawl
    
使用示例:
    class CustomPlugin(CrawlPlugin):
        name = "custom"
        
        async def before_crawl(self, spider):
            logger.info("准备开始爬取")
        
        async def after_response(self, spider, response):
            logger.info(f"收到响应: {len(response)} bytes")
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional


class CrawlPlugin(ABC):
    """
    爬虫插件抽象基类
    
    所有自定义插件都必须继承此类。
    插件可以监听爬虫生命周期的各个阶段并执行自定义逻辑。
    
    Attributes:
        name: 插件名称标识 (唯一)
        enabled: 是否启用 (可通过配置动态控制)
        priority: 执行优先级 (数字越小越先执行)
    
    设计原则:
        - 单一职责: 每个插件只关注一个功能点
        - 可插拔: 可以动态启用/禁用
        - 无侵入性: 不影响核心爬取逻辑
        - 可组合: 多个插件可以同时工作
    
    与中间件的对比:
        ┌─────────────┬──────────────────┬──────────────────┐
        │ 特性        │ 中间件           │ 插件             │
        ├─────────────┼──────────────────┼──────────────────┤
        │ 模型        │ 洋葱模型         │ 观察者模式       │
        │ 控制流      │ 可中断/修改      │ 只监听，不干预   │
        │ 适用场景    │ 请求处理、限速   │ 监控、日志、统计 │
        │ 必须调用next│ 是               │ 否               │
        └─────────────┴──────────────────┴──────────────────┘
    """
    
    name: str = "base_plugin"
    enabled: bool = True
    priority: int = 100
    
    @abstractmethod
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        初始化插件
        
        Args:
            config: 插件配置字典 (从spider.config.plugins[name]传入)
        """
        self.config = config or {}
    
    async def on_register(self, spider) -> None:
        """
        插件注册时调用 (可选实现)
        
        可以在这里进行初始化工作:
        - 建立数据库连接
        - 加载配置文件
        - 初始化计数器等
        
        Args:
            spider: UnifiedSpider实例
        """
        pass
    
    async def on_unregister(self, spider) -> None:
        """
        插件注销时调用 (可选实现)
        
        用于清理资源:
        - 关闭连接
        - 保存状态
        - 释放资源
        
        Args:
            spider: UnifiedSpider实例
        """
        pass
    
    async def before_crawl(self, spider) -> None:
        """
        整个爬取开始前调用
        
        适用于:
        - 初始化全局状态
        - 准备共享资源
        - 记录开始时间
        
        Args:
            spider: UnifiedSpider实例
        """
        pass
    
    async def after_crawl(self, spider, result: Any) -> Any:
        """
        整个爬取结束后调用
        
        适用于:
        - 清理全局状态
        - 输出汇总报告
        - 释放共享资源
        
        Args:
            spider: UnifiedSpider实例
            result: 爬取结果 (List[JobData]或生成器)
            
        Returns:
            可以返回修改后的result，或直接返回原result
        """
        return result
    
    async def before_request(
        self,
        spider,
        request_info: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        每次HTTP请求前调用
        
        适用于:
        - 添加/修改请求头
        - 注入认证信息
        - 记录请求日志
        - 代理选择
        
        Args:
            spider: UnifiedSpider实例
            request_info: 请求信息字典，包含:
                - url: 请求URL
                - method: HTTP方法
                - headers: 请求头
                - data: 请求数据
                
        Returns:
            修改后的request_info，或None表示不做修改
        """
        return None
    
    async def after_response(
        self,
        spider,
        request_info: Dict[str, Any],
        response: Any
    ) -> Optional[Any]:
        """
        每次HTTP响应后调用
        
        适用于:
        - 记录响应信息
        - 缓存响应数据
        - 错误检测和告警
        - 性能监控
        
        Args:
            spider: UnifiedSpider实例
            request_info: 请求信息
            response: 响应对象或数据
            
        Returns:
            修改后的response，或None表示不做修改
        """
        return None
    
    async def on_job_extracted(
        self,
        spider,
        job: Any
    ) -> Optional[Any]:
        """
        每提取到一个JobData后调用
        
        适用于:
        - 数据清洗和增强
        - 字段补全
        - 实时推送通知
        - 质量检查
        
        Args:
            spider: UnifiedSpider实例
            job: JobData实例
            
        Returns:
            修改后的job，或None表示丢弃该job
        """
        return None
    
    async def on_error(
        self,
        spider,
        error: Exception,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        发生错误时调用
        
        适用于:
        - 错误日志记录
        - 告警通知
        - 自动恢复策略
        
        Args:
            spider: UnifiedSpider实例
            error: 异常对象
            context: 错误上下文
            
        Returns:
            True表示错误已处理，False继续传播
        """
        return False
    
    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}(name={self.name}, enabled={self.enabled})>"
