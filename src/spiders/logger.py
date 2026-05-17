"""
爬虫日志配置模块
使用loguru实现完整的日志系统
"""

import sys
from pathlib import Path
from loguru import logger


LOG_DIR = Path(__file__).parent.parent.parent / "log"
LOG_DIR.mkdir(parents=True, exist_ok=True)


LOG_FORMAT = (
    "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
    "<level>{level: <8}</level> | "
    "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
    "<level>{message}</level>"
)

SIMPLE_FORMAT = (
    "{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {message}"
)


def setup_logger(log_level: str = "DEBUG", enable_console: bool = True, console_level: str = "WARNING"):
    """
    配置日志系统
    
    Args:
        log_level: 日志级别（DEBUG, INFO, WARNING, ERROR, CRITICAL）
        enable_console: 是否启用控制台输出
        console_level: 控制台日志级别（默认WARNING，不在终端显示INFO日志）
    """
    logger.remove()
    
    if enable_console:
        logger.add(
            sys.stdout,
            format=LOG_FORMAT,
            level=console_level,
            colorize=True,
            enqueue=True,
        )
    
    logger.add(
        LOG_DIR / "spider_{time:YYYY-MM-DD}.log",
        format=SIMPLE_FORMAT,
        level="DEBUG",
        rotation="00:00",
        retention="30 days",
        compression="zip",
        encoding="utf-8",
        enqueue=True,
    )
    
    logger.add(
        LOG_DIR / "error_{time:YYYY-MM-DD}.log",
        format=SIMPLE_FORMAT,
        level="ERROR",
        rotation="00:00",
        retention="90 days",
        compression="zip",
        encoding="utf-8",
        enqueue=True,
        filter=lambda record: record["level"].name == "ERROR",
    )
    
    logger.add(
        LOG_DIR / "debug_{time:YYYY-MM-DD}.log",
        format=LOG_FORMAT,
        level="DEBUG",
        rotation="100 MB",
        retention="7 days",
        compression="zip",
        encoding="utf-8",
        enqueue=True,
        filter=lambda record: record["level"].name == "DEBUG",
    )
    
    logger.info(f"日志系统初始化完成，日志目录: {LOG_DIR}")
    
    return logger


def get_logger(name: str = "spider"):
    """
    获取日志记录器
    
    Args:
        name: 日志记录器名称
    
    Returns:
        logger实例
    """
    return logger.bind(name=name)


class SpiderLogger:
    """爬虫专用日志记录器"""
    
    def __init__(self, source: str):
        """
        初始化爬虫日志记录器
        
        Args:
            source: 数据源名称
        """
        self.source = source
        self.logger = logger.bind(source=source)
    
    def info(self, message: str):
        """记录INFO级别日志"""
        self.logger.info(f"[{self.source}] {message}")
    
    def debug(self, message: str):
        """记录DEBUG级别日志"""
        self.logger.debug(f"[{self.source}] {message}")
    
    def warning(self, message: str):
        """记录WARNING级别日志"""
        self.logger.warning(f"[{self.source}] {message}")
    
    def error(self, message: str):
        """记录ERROR级别日志"""
        self.logger.error(f"[{self.source}] {message}")
    
    def critical(self, message: str):
        """记录CRITICAL级别日志"""
        self.logger.critical(f"[{self.source}] {message}")
    
    def success(self, message: str):
        """记录SUCCESS级别日志"""
        self.logger.success(f"[{self.source}] {message}")
    
    def exception(self, message: str):
        """记录异常日志（包含堆栈跟踪）"""
        self.logger.exception(f"[{self.source}] {message}")
    
    def crawl_start(self, max_items: int = 0):
        """记录爬取开始"""
        self.info(f"开始爬取，最大数量: {max_items if max_items > 0 else '无限制'}")
    
    def crawl_complete(self, count: int, elapsed: float):
        """记录爬取完成"""
        speed = count / elapsed if elapsed > 0 else 0
        self.success(
            f"爬取完成: {count} 条, 耗时 {elapsed:.1f}s, 速度 {speed:.2f} 条/秒"
        )
    
    def crawl_error(self, error: str):
        """记录爬取错误"""
        self.error(f"爬取失败: {error}")
    
    def url_filtered(self, total: int, new: int, skipped: int):
        """记录URL过滤统计"""
        skip_rate = (skipped / total * 100) if total > 0 else 0
        self.info(
            f"URL过滤: 检查 {total} 条, 新增 {new} 条, "
            f"跳过 {skipped} 条 ({skip_rate:.1f}%)"
        )
    
    def data_dedup(self, total: int, unique: int, duplicate: int):
        """记录去重统计"""
        self.info(
            f"去重统计: 总数 {total} 条, 唯一 {unique} 条, 重复 {duplicate} 条"
        )
    
    def request_success(self, url: str, status_code: int):
        """记录请求成功"""
        self.debug(f"请求成功: {url} (HTTP {status_code})")
    
    def request_failed(self, url: str, error: str):
        """记录请求失败"""
        self.warning(f"请求失败: {url} - {error}")
    
    def data_parsed(self, title: str):
        """记录数据解析"""
        self.debug(f"解析数据: {title[:50]}...")
    
    def data_written(self, count: int):
        """记录数据写入"""
        self.debug(f"写入数据库: {count} 条")


setup_logger()
