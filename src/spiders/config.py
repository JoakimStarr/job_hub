from dataclasses import dataclass, field
from typing import Optional, Dict, Any
import os


@dataclass(frozen=True)
class CrawlerConfig:
    """爬虫系统全局配置（不可变，线程安全）

    所有配置项在此集中管理，消除散落在各文件的魔法数字。
    支持从环境变量覆盖（CRAWLER_前缀）。

    Attributes:
        # === 重试与超时 ===
        max_retry: 最大重试次数
        retry_backoff: 退避基数

        # === HTTP请求 ===
        request_timeout: 单请求超时(秒)
        connection_pool_size: 连接池总大小
        max_connections_per_host: 单主机最大连接
        dns_cache_ttl: DNS缓存TTL(秒)

        # === 并发控制 ===
        detail_concurrency: 详情页并发数
        max_browser_concurrency: 最大浏览器并发数

        # === 批量写入 ===
        batch_size: 数据库批量写入大小
        batch_chunk_size: 分片阈值(>此值自动分片)

        # === URL去重 ===
        visited_urls_limit: 已访问URL上限
        cleanup_percent: 清理比例(%)

        # === 数据质量 ===
        quality_threshold: 质量评分阈值(0~1)
        min_title_length: 标题最小长度
        max_runtime_seconds: 最大运行时间(秒)

        # === 浏览器 ===
        browser_timeout: 页面加载超时(秒)
        headless: 是否无头模式

        # === 增量爬取 ===
        incremental_enabled: 是否启用增量模式
        consecutive_404_limit: 连续404上限

        # === 日志 ===
        log_dir: 日志目录
        log_retention_days: 日志保留天数
        enable_json_log: 是否启用JSON格式日志
    """

    # === 重试与超时 ===
    max_retry: int = 3
    retry_backoff: float = 1.5

    # === HTTP请求 ===
    request_timeout: int = 30
    connection_pool_size: int = 100
    max_connections_per_host: int = 20
    dns_cache_ttl: int = 300

    # === 并发控制 ===
    detail_concurrency: int = 8
    max_browser_concurrency: int = 3

    # === 批量写入 ===
    batch_size: int = 50
    batch_chunk_size: int = 500

    # === URL去重 ===
    visited_urls_limit: int = 50000
    cleanup_percent: int = 30

    # === 数据质量 ===
    quality_threshold: float = 0.3
    min_title_length: int = 2
    max_runtime_seconds: int = 900  # 15分钟

    # === 浏览器 ===
    browser_timeout: int = 60
    headless: bool = True

    # === 增量爬取 ===
    incremental_enabled: bool = True
    consecutive_404_limit: int = 30

    # === 日志 ===
    log_dir: str = "logs"
    log_retention_days: int = 7
    enable_json_log: bool = False

    @classmethod
    def from_env(cls) -> "CrawlerConfig":
        """从环境变量加载配置（CRAWLER_前缀）

        环境变量映射规则:
            CRAWLER_MAX_RETRY -> max_retry (int)
            CRAWLER_BATCH_SIZE -> batch_size (int)
            CRAWLER_HEADLESS -> headless (bool, "true"/"false")
            CRAWLER_LOG_DIR -> log_dir (str)
            ... 以此类推

        Returns:
            CrawlerConfig实例，环境变量未设置则使用默认值
        """
        env_mapping = {
            'max_retry': ('CRAWLER_MAX_RETRY', int),
            'retry_backoff': ('CRAWLER_RETRY_BACKOFF', float),
            'request_timeout': ('CRAWLER_REQUEST_TIMEOUT', int),
            'connection_pool_size': ('CRAWLER_CONNECTION_POOL_SIZE', int),
            'max_connections_per_host': ('CRAWLER_MAX_CONNECTIONS_PER_HOST', int),
            'dns_cache_ttl': ('CRAWLER_DNS_CACHE_TTL', int),
            'detail_concurrency': ('CRAWLER_DETAIL_CONCURRENCY', int),
            'max_browser_concurrency': ('CRAWLER_MAX_BROWSER_CONCURRENCY', int),
            'batch_size': ('CRAWLER_BATCH_SIZE', int),
            'batch_chunk_size': ('CRAWLER_BATCH_CHUNK_SIZE', int),
            'visited_urls_limit': ('CRAWLER_VISITED_URLS_LIMIT', int),
            'cleanup_percent': ('CRAWLER_CLEANUP_PERCENT', int),
            'quality_threshold': ('CRAWLER_QUALITY_THRESHOLD', float),
            'min_title_length': ('CRAWLER_MIN_TITLE_LENGTH', int),
            'max_runtime_seconds': ('CRAWLER_MAX_RUNTIME_SECONDS', int),
            'browser_timeout': ('CRAWLER_BROWSER_TIMEOUT', int),
            'headless': ('CRAWLER_HEADLESS', lambda v: v.lower() == 'true'),
            'incremental_enabled': ('CRAWLER_INCREMENTAL_ENABLED', lambda v: v.lower() == 'true'),
            'consecutive_404_limit': ('CRAWLER_CONSECUTIVE_404_LIMIT', int),
            'log_dir': ('CRAWLER_LOG_DIR', str),
            'log_retention_days': ('CRAWLER_LOG_RETENTION_DAYS', int),
            'enable_json_log': ('CRAWLER_ENABLE_JSON_LOG', lambda v: v.lower() == 'true'),
        }

        kwargs = {}
        for attr_name, (env_var, converter) in env_mapping.items():
            value = os.environ.get(env_var)
            if value is not None:
                try:
                    kwargs[attr_name] = converter(value)
                except (ValueError, TypeError) as e:
                    import warnings
                    warnings.warn(f"环境变量 {env_var}={value!r} 转换失败: {e}")

        return cls(**kwargs)

    def to_dict(self) -> Dict[str, Any]:
        """导出为字典（用于日志输出或序列化）

        Returns:
            包含所有配置项的字典
        """
        import dataclasses
        return dataclasses.asdict(self)


# 全局单例实例
_config_instance: Optional[CrawlerConfig] = None


def get_config() -> CrawlerConfig:
    """获取全局配置单例（首次调用自动初始化）

    Returns:
        CrawlerConfig全局唯一实例
    """
    global _config_instance
    if _config_instance is None:
        _config_instance = CrawlerConfig.from_env()
    return _config_instance


def reset_config(config: Optional[CrawlerConfig] = None) -> None:
    """重置全局配置（主要用于测试）

    Args:
        config: 新的配置实例，None则恢复默认值
    """
    global _config_instance
    _config_instance = config or CrawlerConfig.from_env()


if __name__ == "__main__":
    print("=" * 60)
    print("爬虫配置系统测试")
    print("=" * 60)

    # 测试默认配置
    config = CrawlerConfig()
    print(f"\n✅ 默认配置创建成功:")
    print(f"   batch_size: {config.batch_size}")
    print(f"   max_retry: {config.max_retry}")
    print(f"   request_timeout: {config.request_timeout}")
    print(f"   headless: {config.headless}")
    print(f"   detail_concurrency: {config.detail_concurrency}")

    # 测试环境变量覆盖
    os.environ['CRAWLER_BATCH_SIZE'] = '100'
    os.environ['CRAWLER_MAX_RETRY'] = '5'
    os.environ['CRAWLER_HEADLESS'] = 'false'
    config_env = CrawlerConfig.from_env()
    assert config_env.batch_size == 100
    assert config_env.max_retry == 5
    assert config_env.headless is False
    print(f"\n✅ 环境变量覆盖成功:")
    print(f"   batch_size: {config_env.batch_size}")
    print(f"   max_retry: {config_env.max_retry}")
    print(f"   headless: {config_env.headless}")

    # 测试单例
    reset_config(config_env)
    assert get_config() is config_env
    print(f"\n✅ 全局单例正常工作")

    # 测试导出字典
    d = config.to_dict()
    assert isinstance(d, dict)
    assert len(d) > 20
    print(f"\n✅ to_dict() 导出成功 ({len(d)} 个配置项)")

    # 测试不可变性
    try:
        config.batch_size = 999
        print(f"\n❌ frozen=True 未生效")
    except AttributeError:
        print(f"\n✅ frozen=True 生效，配置不可变")

    # 清理环境变量
    del os.environ['CRAWLER_BATCH_SIZE']
    del os.environ['CRAWLER_MAX_RETRY']
    del os.environ['CRAWLER_HEADLESS']

    print("\n" + "=" * 60)
    print("所有测试通过！✅")
    print("=" * 60)
