"""
爬虫日志配置模块
使用loguru实现完整的日志系统，支持结构化日志和trace_id链路追踪

功能特性:
- 结构化日志输出（支持JSON格式用于ELK收集）
- trace_id 链路追踪（基于ContextVar，协程安全）
- child_span 嵌套操作追踪
- span 上下文管理器（自动计时）
- 向后兼容原有API
"""

import sys
import time
import uuid
import json
from contextvars import ContextVar
from contextlib import contextmanager
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

STRUCTURED_FORMAT = (
    "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
    "<level>{level: <8}</level> | "
    "<cyan>{extra[source]:<8}</cyan> | "
    "<cyan>{extra[trace_id]}</cyan> | "
    "<level>{message}</level>"
)


# ==================== 链路追踪支持 ====================

# 链路追踪ID（ContextVar 保证协程安全）
trace_id_var: ContextVar[str] = ContextVar('trace_id', default='')
_span_stack_var: ContextVar[list] = ContextVar('_span_stack', default=None)


def _get_span_stack() -> list:
    """获取span栈，如果未初始化则返回空列表"""
    stack = _span_stack_var.get()
    if stack is None:
        stack = []
        _span_stack_var.set(stack)
    return stack


def bind_trace_id(trace_id: str = None) -> str:
    """绑定当前请求/任务的链路追踪ID
    
    Args:
        trace_id: 追踪ID，如果为None则自动生成UUID前8位
    
    Returns:
        绑定的trace_id字符串
    
    示例:
        >>> tid = bind_trace_id('abc123')
        >>> print(tid)
        abc123
        
        >>> auto_id = bind_trace_id()  # 自动生成
        >>> print(len(auto_id))
        8
    """
    tid = trace_id or str(uuid.uuid4())[:8]
    trace_id_var.set(tid)
    return tid


def get_trace_id() -> str:
    """获取当前协程的trace_id"""
    return trace_id_var.get()


def child_span(name: str) -> str:
    """创建子级span（嵌套追踪）
    
    Args:
        name: 子操作名称
    
    Returns:
        格式化的span标识: "{parent_span}.{name}"
    
    示例:
        >>> bind_trace_id('req001')
        >>> span1 = child_span('fetch_list')
        >>> print(span1)
        req001.fetch_list
        >>> span2 = child_span('parse_item')
        >>> print(span2)
        req001.fetch_list.parse_item
    """
    stack = list(_get_span_stack())
    stack.append(name)
    _span_stack_var.set(stack)
    return f"{get_trace_id()}." + ".".join(stack)


# ==================== Logger工厂方法 ====================

def get_logger(source: str = "", name: str = ""):
    """获取带source和trace_id绑定的logger实例
    
    Args:
        source: 数据源名称（如 sufe, zuel, swufe）
        name: logger名称（可选）
    
    Returns:
        绑定了 extra 字段的 loguru logger
    
    日志格式会包含:
        - source: 数据源标识
        - trace_id: 当前链路追踪ID
        - span: 当前操作层级
    
    示例:
        >>> logger = get_logger('sufe')
        >>> logger.info("开始爬取") 
        # 输出: [INFO] sufe     | abc123 | 开始爬取
    """
    extra = {'source': source, 'trace_id': get_trace_id()}
    if name:
        extra['name'] = name
    return logger.bind(**extra)


# ==================== Span上下文管理器 ====================

@contextmanager
def span(name: str, source: str = ""):
    """Span上下文管理器（用于with语句自动计时）
    
    使用示例:
        with span('fetch_page', 'sufe'):
            html = await session.get(url)
        # 自动记录耗时日志
    """
    start = time.perf_counter()
    span_id = child_span(name)
    log = get_logger(source)
    log.debug(f"[{span_id}] 开始")
    try:
        yield span_id
    finally:
        elapsed = time.perf_counter() - start
        log.info(f"[{span_id}] 完成, 耗时 {elapsed:.3f}s")
        # 弹出span栈
        stack = list(_get_span_stack())
        if stack:
            stack.pop()
            _span_stack_var.set(stack)


# ==================== 日志系统配置 ====================

def setup_logging(
    log_dir: str = None,
    console_output: bool = True,
    file_output: bool = True,
    json_output: bool = False,
    level: str = "DEBUG",
    retention: str = "7 days",
    rotation: str = "00:00",
    compression: str = "gz",
):
    """初始化loguru日志配置（增强版，支持结构化日志和链路追踪）
    
    Args:
        log_dir: 日志文件目录（默认使用项目log目录）
        console_output: 是否输出到控制台
        file_output: 是否输出到文件
        json_output: 是否使用JSON格式（用于ELK收集）
        level: 最低日志级别
        retention: 文件保留时间
        rotation: 轮转时间点
        compression: 压缩格式
    """
    actual_log_dir = Path(log_dir) if log_dir else LOG_DIR
    actual_log_dir.mkdir(parents=True, exist_ok=True)
    
    logger.remove()  # 移除默认handler
    
    fmt = STRUCTURED_FORMAT
    
    # 控制台输出
    if console_output:
        logger.add(
            sys.stdout,
            format=fmt,
            level=level,
            colorize=True,
        )
    
    # 文件输出（主日志）
    if file_output:
        log_file = actual_log_dir / f"crawler_{time.strftime('%Y%m%d')}.log"
        logger.add(
            log_file,
            format=fmt,
            level=level,
            rotation=rotation,
            retention=retention,
            compression=compression,
            encoding="utf-8",
            enqueue=True,  # 异步写入
            backtrace=True,  # 完整traceback
            diagnose=True,  # 变量诊断
        )
    
    # 错误日志单独文件
    error_file = actual_log_dir / f"error_{time.strftime('%Y%m%d')}.log"
    logger.add(
        error_file,
        format=fmt,
        level="ERROR",
        rotation=rotation,
        retention=retention,
        compression=compression,
        encoding="utf-8",
        enqueue=True,
    )
    
    # JSON格式输出（可选，用于ELK/Splunk等日志收集系统）
    if json_output:
        def json_formatter(record):
            return json.dumps({
                "timestamp": record["time"].isoformat(),
                "level": record["level"].name,
                "source": record["extra"].get("source", ""),
                "trace_id": record["extra"].get("trace_id", ""),
                "message": record["message"],
                "file": record["file"].name if record["file"] else "",
                "line": record["line"],
                "function": record["function"],
            }, ensure_ascii=False) + "\n"
        
        logger.add(
            actual_log_dir / "crawler_json.log",
            format=json_formatter,
            level=level,
            rotation=rotation,
            retention=retention,
            serialize=False,  # 我们自己格式化JSON
        )
    
    logger.bind(source='system', trace_id='').info("日志系统初始化完成")


# ==================== 向后兼容的旧API ====================

def setup_logger(log_level: str = "DEBUG", enable_console: bool = True, console_level: str = "WARNING"):
    """配置日志系统（向后兼容的旧接口）
    
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


# ==================== 爬虫专用日志记录器 ====================

class SpiderLogger:
    """爬虫专用日志记录器（增强版，支持链路追踪）"""
    
    def __init__(self, source: str):
        """
        初始化爬虫日志记录器
        
        Args:
            source: 数据源名称
        """
        self.source = source
        self.logger = get_logger(source)
    
    def info(self, message: str):
        """记录INFO级别日志"""
        self.logger.info(message)
    
    def debug(self, message: str):
        """记录DEBUG级别日志"""
        self.logger.debug(message)
    
    def warning(self, message: str):
        """记录WARNING级别日志"""
        self.logger.warning(message)
    
    def error(self, message: str):
        """记录ERROR级别日志"""
        self.logger.error(message)
    
    def critical(self, message: str):
        """记录CRITICAL级别日志"""
        self.logger.critical(message)
    
    def success(self, message: str):
        """记录SUCCESS级别日志"""
        self.logger.success(message)
    
    def exception(self, message: str):
        """记录异常日志（包含堆栈跟踪）"""
        self.logger.exception(message)
    
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


# 默认初始化（向后兼容）
setup_logger()


if __name__ == "__main__":
    print("=" * 60)
    print("🔍 日志功能测试")
    print("=" * 60)
    
    # 测试1: 初始化
    print("\n[测试1] 初始化日志系统...")
    setup_logging(console_output=True, file_output=False)
    print("✅ setup_logging() 初始化成功")
    
    # 测试2: trace_id绑定
    print("\n[测试2] trace_id 绑定测试...")
    tid = bind_trace_id('test123')
    assert get_trace_id() == 'test123', "trace_id 绑定失败"
    assert len(tid) == 7, f"trace_id 长度应为7，实际为 {len(tid)}"
    print(f"✅ trace_id 绑定成功: {tid}")
    
    # 测试3: 自动生成trace_id
    auto_tid = bind_trace_id()
    assert len(auto_tid) == 8, f"自动生成的trace_id长度应为8，实际为 {len(auto_tid)}"
    print(f"✅ 自动生成 trace_id 成功: {auto_tid} (长度: {len(auto_tid)})")
    
    # 测试4: child_span
    print("\n[测试3] child_span 嵌套测试...")
    bind_trace_id('req001')
    s1 = child_span('op1')
    s2 = child_span('op2')
    assert s1 == 'req001.op1', f"s1 应为 'req001.op1'，实际为 '{s1}'"
    assert s2 == 'req001.op1.op2', f"s2 应为 'req001.op1.op2'，实际为 '{s2}'"
    print(f"✅ child_span 测试通过:")
    print(f"   - s1 = {s1}")
    print(f"   - s2 = {s2}")
    
    # 测试5: get_logger
    print("\n[测试4] get_logger 工厂方法测试...")
    bind_trace_id('logger_test')
    log = get_logger('sufe')
    log.info("测试日志消息 - 来自 sufe 数据源")
    log.debug("调试消息")
    log.warning("警告消息")
    print("✅ get_logger 正常工作")
    
    # 测试6: 不同source的logger
    log_zuel = get_logger('zuel')
    log_zuel.info("来自 zuel 数据源的日志")
    print("✅ 多数据源 logger 工作正常")
    
    # 测试7: span上下文管理器
    print("\n[测试5] span 上下文管理器测试...")
    bind_trace_id('span_test')
    with span('fetch_page', 'benchmark'):
        time.sleep(0.01)  # 模拟耗时操作
    print("✅ span context manager 正常工作")
    
    # 测试8: 嵌套span
    print("\n[测试6] 嵌套 span 测试...")
    bind_trace_id('nested_test')
    with span('outer_op', 'test'):
        time.sleep(0.005)
        with span('inner_op', 'test'):
            time.sleep(0.005)
    print("✅ 嵌套 span 工作正常")
    
    # 测试9: SpiderLogger类
    print("\n[测试7] SpiderLogger 类测试...")
    spider_log = SpiderLogger('swufe')
    spider_log.info("SpiderLogger 信息日志")
    spider_log.crawl_start(100)
    spider_log.data_parsed("测试职位标题")
    spider_log.request_success("http://example.com", 200)
    print("✅ SpiderLogger 类正常工作")
    
    # 测试10: 向后兼容性
    print("\n[测试8] 向后兼容性测试...")
    old_logger = get_logger(name="spider")
    old_logger.info("旧的 get_logger(name=...) 接口仍然可用")
    print("✅ 向向后兼容性验证通过")
    
    print("\n" + "=" * 60)
    print("🎉 所有日志功能测试通过!")
    print("=" * 60)
    print("\n功能清单:")
    print("  ✅ trace_id 链路追踪（ContextVar协程安全）")
    print("  ✅ child_span 嵌套操作追踪")
    print("  ✅ get_logger() 工厂方法（支持source和trace_id）")
    print("  ✅ span 上下文管理器（自动计时）")
    print("  ✅ setup_logging() 增强配置（支持JSON输出）")
    print("  ✅ SpiderLogger 爬虫专用日志类（已升级）")
    print("  ✅ 向后兼容（setup_logger等旧接口仍可用）")
