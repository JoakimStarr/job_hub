"""
PluginManager - 插件管理器

管理爬虫插件的注册、执行和生命周期。
支持动态添加/移除/启用/禁用插件。

使用示例:
    from src.spiders.plugins import PluginManager, RateLimitPlugin
    
    manager = PluginManager()
    
    # 注册插件
    manager.register(RateLimitPlugin({'initial_rate': 2.0}))
    
    # 执行生命周期钩子
    await manager.before_crawl(spider)
    await manager.after_crawl(spider, result)
"""

from typing import Any, Dict, List, Optional

from loguru import logger

from .base import CrawlPlugin


class PluginManager:
    """
    插件管理器
    
    管理所有注册的插件，负责:
    - 插件的注册和注销
    - 按优先级排序
    - 生命周期的调度
    - 错误处理和隔离
    
    Attributes:
        plugins: 已注册的插件列表 (按priority排序)
    
    使用示例:
        manager = PluginManager()
        
        # 注册插件
        manager.register(RateLimitPlugin())
        manager.register(MetricsPlugin())
        
        # 动态禁用/启用
        manager.disable('rate_limit')
        manager.enable('rate_limit')
        
        # 获取特定插件
        rate_limiter = manager.get_plugin('rate_limit')
    """
    
    def __init__(self):
        self._plugins: List[CrawlPlugin] = []
        self._plugin_names: Dict[str, CrawlPlugin] = {}
    
    def register(self, plugin: CrawlPlugin) -> 'PluginManager':
        """
        注册插件
        
        Args:
            plugin: 插件实例
            
        Returns:
            self - 支持链式调用
            
        Raises:
            TypeError: 如果不是CrawlPlugin子类
            ValueError: 如果同名插件已存在
        """
        if not isinstance(plugin, CrawlPlugin):
            raise TypeError(
                f"插件必须是CrawlPlugin的子类, "
                f"收到: {type(plugin).__name__}"
            )
        
        if plugin.name in self._plugin_names:
            raise ValueError(f"插件 '{plugin.name}' 已存在")
        
        if not plugin.enabled:
            logger.debug(f"跳过禁用的插件: {plugin.name}")
            return self
        
        self._plugins.append(plugin)
        self._plugin_names[plugin.name] = plugin
        
        # 按优先级排序
        self._plugins.sort(key=lambda p: p.priority)
        
        logger.debug(f"注册插件: {plugin}")
        return self
    
    def unregister(self, name: str) -> bool:
        """
        注销插件
        
        Args:
            name: 插件名称
            
        Returns:
            True如果成功注销
        """
        plugin = self._plugin_names.pop(name, None)
        if not plugin:
            return False
        
        self._plugins.remove(plugin)
        logger.debug(f"注销插件: {name}")
        return True
    
    def get_plugin(self, name: str) -> Optional[CrawlPlugin]:
        """按名称获取插件"""
        return self._plugin_names.get(name)
    
    def enable(self, name: str) -> bool:
        """启用插件"""
        plugin = self._plugin_names.get(name)
        if plugin and not plugin.enabled:
            plugin.enabled = True
            logger.info(f"启用插件: {name}")
            return True
        return False
    
    def disable(self, name: str) -> bool:
        """禁用插件"""
        plugin = self._plugin_names.get(name)
        if plugin and plugin.enabled:
            plugin.enabled = False
            logger.info(f"禁用插件: {name}")
            return True
        return False
    
    @property
    def plugins(self) -> List[CrawlPlugin]:
        """获取启用的插件列表"""
        return [p for p in self._plugins if p.enabled]
    
    async def on_register_all(self, spider) -> None:
        """通知所有插件已注册"""
        for plugin in self.plugins:
            try:
                await plugin.on_register(spider)
            except Exception as e:
                logger.error(f"[{plugin.name}] 注册钩子异常: {e}")
    
    async def on_unregister_all(self, spider) -> None:
        """通知所有插件将注销"""
        for plugin in self.plugins:
            try:
                await plugin.on_unregister(spider)
            except Exception as e:
                logger.error(f"[{plugin.name}] 注销钩子异常: {e}")
    
    async def before_crawl(self, spider) -> None:
        """触发所有插件的 before_crawl 钩子"""
        for plugin in self.plugins:
            try:
                await plugin.before_crawl(spider)
            except Exception as e:
                logger.error(f"[{plugin.name}] before_crawl 异常: {e}")
    
    async def after_crawl(self, spider, result: Any) -> Any:
        """触发所有插件的 after_crawl 钩子"""
        for plugin in self.plugins:
            try:
                result = await plugin.after_crawl(spider, result)
            except Exception as e:
                logger.error(f"[{plugin.name}] after_crawl 异常: {e}")
        return result
    
    async def before_request(
        self,
        spider,
        request_info: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        触发所有插件的 before_request 钩子
        
        Returns:
            可能被修改的request_info
        """
        for plugin in self.plugins:
            try:
                result = await plugin.before_request(spider, request_info)
                if result is not None:
                    request_info = result
            except Exception as e:
                logger.error(f"[{plugin.name}] before_request 异常: {e}")
        return request_info
    
    async def after_response(
        self,
        spider,
        request_info: Dict[str, Any],
        response: Any
    ) -> Any:
        """
        触发所有插件的 after_response 钩子
        
        Returns:
            可能被修改的response
        """
        for plugin in self.plugins:
            try:
                result = await plugin.after_response(spider, request_info, response)
                if result is not None:
                    response = result
            except Exception as e:
                logger.error(f"[{plugin.name}] after_response 异常: {e}")
        return response
    
    async def on_job_extracted(self, spider, job: Any) -> Optional[Any]:
        """
        触发所有插件的 on_job_extracted 钩子
        
        Returns:
            修改后的job，或None表示丢弃
        """
        for plugin in self.plugins:
            try:
                result = await plugin.on_job_extracted(spider, job)
                if result is None:
                    return None
                job = result
            except Exception as e:
                logger.error(f"[{plugin.name}] on_job_extracted 异常: {e}")
        return job
    
    async def on_error(
        self,
        spider,
        error: Exception,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        触发所有插件的 on_error 钩子
        
        Returns:
            True如果任一插件处理了错误
        """
        handled = False
        for plugin in self.plugins:
            try:
                if await plugin.on_error(spider, error, context):
                    handled = True
            except Exception as e:
                logger.error(f"[{plugin.name}] on_error 异常: {e}")
        return handled
    
    def get_stats(self) -> Dict[str, Any]:
        """获取所有插件的统计信息"""
        stats = {}
        for plugin in self.plugins:
            if hasattr(plugin, 'get_stats'):
                try:
                    stats[plugin.name] = plugin.get_stats()
                except Exception:
                    pass
        return stats
    
    def clear(self):
        """清空所有插件"""
        self._plugins.clear()
        self._plugin_names.clear()
    
    def __len__(self) -> int:
        return len(self.plugins)
    
    def __contains__(self, name: str) -> bool:
        return name in self._plugin_names
    
    def __repr__(self) -> str:
        names = [p.name for p in self.plugins]
        return f"<PluginManager(count={len(self.plugins)}, plugins={names})>"
