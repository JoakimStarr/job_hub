#!/usr/bin/env python3
"""
轻量化单线程爬虫
专为低内存服务器设计（< 2GB 内存）

特性:
- 单线程执行，无并发
- 只支持 HTTP 爬虫（sufe, zuel, cufe, dufe, swufe）
- 逐条写入数据库，不缓存数据
- 失败重试 5 次（指数退避）
- 完善的日志管理系统
- 内存占用极小（< 50MB）
- 支持定时爬取

用法:
  python lite_crawler.py                    # 运行所有爬虫
  python lite_crawler.py --sources sufe zuel # 运行指定爬虫
  python lite_crawler.py --list-sources      # 列出所有数据源
  python lite_crawler.py --max-items 100     # 每个源最多爬100条
  python lite_crawler.py --schedule hourly   # 每小时定时爬取
  python lite_crawler.py --schedule daily    # 每天凌晨2点爬取
  python lite_crawler.py --schedule "0 2 * * *" # 使用cron表达式
  python lite_crawler.py --log-level DEBUG   # 设置日志级别
  python lite_crawler.py --log-file crawler.log # 指定日志文件
"""

import argparse
import logging
import re
import signal
import sqlite3
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterator, Optional
from urllib.parse import urljoin, urlparse, parse_qs

import requests

sys.path.insert(0, str(Path(__file__).parent / "src" / "spiders"))
from spider_configs import get_lite_http_sources

DB_PATH = Path(__file__).parent / "data" / "jobs.db"
LOG_DIR = Path(__file__).parent / "logs"
MAX_RETRIES = 5
RETRY_DELAY_BASE = 2
SCHEDULE_INTERVALS = {
    "hourly": 3600,
    "daily": 86400,
    "weekly": 604800,
}
BATCH_COMMIT_SIZE = 50
URL_CACHE_MAX_SIZE = 100000
REQUEST_TIMEOUT = 30
DETAIL_DELAY = 0.5
MAX_PAGES = 20
OVERWRITE_MODE = False

HTTP_SOURCES = get_lite_http_sources()

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
]
DEFAULT_HEADERS = {
    "Accept": "application/json, text/html, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
}

import random as _random

_db_conn = None
_url_cache = set()
_url_cache_dirty = False


class Database:
    """数据库连接复用（单例）"""
    
    _instance = None
    _conn = None
    
    def __class_getitem__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    @property
    def conn(self):
        if self._conn is None:
            self._conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
            self._conn.execute("PRAGMA journal_mode=WAL")
            self._conn.execute("PRAGMA synchronous=NORMAL")
            self._conn.execute("PRAGMA cache_size=-10000")
        return self._conn
    
    def execute(self, sql, params=()):
        return self.conn.execute(sql, params)
    
    def executemany(self, sql, params_list):
        return self.conn.executemany(sql, params_list)
    
    def commit(self):
        self.conn.commit()
    
    def close(self):
        if self._conn:
            self._conn.close()
            self._conn = None

db = Database()

_pending_commits = 0


def _batch_commit():
    """批量提交：累积到阈值时提交"""
    global _pending_commits
    _pending_commits += 1
    if _pending_commits >= BATCH_COMMIT_SIZE:
        db.commit()
        _pending_commits = 0
        logger.debug(f"批量提交 {BATCH_COMMIT_SIZE} 条记录")


def _flush_pending_commits():
    """刷新所有待提交的记录"""
    global _pending_commits
    if _pending_commits > 0:
        db.commit()
        _pending_commits = 0


def incremental_crawl(func):
    """
    增量爬取装饰器：统一处理状态加载/保存
    
    被装饰的函数需要接受 (source_config, max_items) 参数，
    并返回 Iterator[Dict]。
    
    装饰器会自动:
    1. 加载增量状态 (load_crawl_state)
    2. 将 start_page 传递给被装饰函数
    3. 在函数结束后保存状态 (save_crawl_state)
    """
    import json as json_mod
    from functools import wraps
    
    @wraps(func)
    def wrapper(source_config: Dict, max_items: int = 0, **kwargs):
        source = kwargs.get('source') or source_config.get('source', func.__name__.replace('crawl_', ''))
        source_name = source_config.get('name', source)
        
        state = load_crawl_state(source)
        state_extra = json_mod.loads(state.get('extra', '{}'))
        start_page = state_extra.get('page', 1)
        
        if start_page > 1:
            logger.info(f"增量爬取: 从第 {start_page} 页开始 (上次爬取时间: {state.get('last_crawl_time', '未知')})")
        
        crawl_logger.log_source_start(source, source_name)
        
        last_completed_page = start_page - 1
        count = 0
        
        try:
            for job in func(source_config, max_items, start_page=start_page, **kwargs):
                yield job
                count += 1
                last_completed_page = kwargs.get('_current_page', last_completed_page)
        finally:
            if last_completed_page > 0:
                state_extra['page'] = last_completed_page + 1
                save_crawl_state(source, last_completed_page, count, extra=json_mod.dumps(state_extra))
            
            crawl_logger.log_source_end(source, source_name, count)
    
    return wrapper


def _get_random_headers():
    """获取随机请求头"""
    headers = dict(DEFAULT_HEADERS)
    headers["User-Agent"] = _random.choice(USER_AGENTS)
    return headers


def preload_existing_urls():
    """预加载所有已存在的URL到内存集合（批量查重基础）"""
    global _url_cache
    try:
        row = db.execute("SELECT source_url FROM jobs").fetchall()
        _url_cache = {r[0] for r in row}
        logger.debug(f"预加载 {len(_url_cache)} 条已存在URL到内存")
        
        if len(_url_cache) > URL_CACHE_MAX_SIZE:
            logger.warning(f"URL缓存超过阈值 ({URL_CACHE_MAX_SIZE})，建议清理旧数据")
    except Exception as e:
        logger.warning(f"预加载URL失败: {e}")
        _url_cache = set()


def url_exists(url: str) -> bool:
    """检查 URL 是否已存在（内存查询，O(1)）"""
    return url in _url_cache


def mark_url_exists(urls):
    """批量标记URL为已存在"""
    global _url_cache, _url_cache_dirty
    _url_cache.update(urls)
    _url_cache_dirty = True
    
    if len(_url_cache) > URL_CACHE_MAX_SIZE:
        logger.warning(f"URL缓存达到 {len(_url_cache)}，超过阈值 {URL_CACHE_MAX_SIZE}")


def flush_url_cache_if_dirty():
    """如果缓存脏了，重新从DB加载（保证一致性）"""
    global _url_cache_dirty
    if _url_cache_dirty:
        preload_existing_urls()
        _url_cache_dirty = False


def trim_url_cache():
    """清理URL缓存，移除最旧的记录"""
    global _url_cache
    if len(_url_cache) > URL_CACHE_MAX_SIZE:
        excess = len(_url_cache) - URL_CACHE_MAX_SIZE
        _url_cache = set(list(_url_cache)[excess:])
        logger.info(f"URL缓存已清理，移除 {excess} 条旧记录")


class ColoredFormatter(logging.Formatter):
    """彩色日志格式化器"""
    
    COLORS = {
        'DEBUG': '\033[36m',     # 青色
        'INFO': '\033[32m',      # 绿色
        'WARNING': '\033[33m',   # 黄色
        'ERROR': '\033[31m',     # 红色
        'CRITICAL': '\033[35m',  # 紫色
    }
    RESET = '\033[0m'
    
    def format(self, record):
        if hasattr(record, 'color') and record.color:
            color = self.COLORS.get(record.levelname, self.RESET)
            record.levelname = f"{color}{record.levelname}{self.RESET}"
        return super().format(record)


class CrawlLogger:
    """爬虫日志管理器"""
    
    _instance = None
    _logger = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._logger is not None:
            return
        
        self._logger = logging.getLogger('lite_crawler')
        self._logger.setLevel(logging.DEBUG)
        self._setup_handlers()
        
        self.stats = {
            'start_time': None,
            'total_jobs': 0,
            'success_count': 0,
            'error_count': 0,
            'duplicate_count': 0,
            'retry_count': 0,
            'source_stats': {},
        }
    
    def _setup_handlers(self):
        """设置日志处理器"""
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)
        
        console_format = ColoredFormatter(
            '%(asctime)s | %(levelname)-8s | %(message)s',
            datefmt='%H:%M:%S'
        )
        console_handler.setFormatter(console_format)
        console_handler.addFilter(lambda r: setattr(r, 'color', True) or True)
        
        self._logger.addHandler(console_handler)
        
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        
        log_file = LOG_DIR / f"crawler_{datetime.now().strftime('%Y%m%d')}.log"
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setLevel(logging.DEBUG)
        
        file_format = logging.Formatter(
            '%(asctime)s | %(levelname)-8s | %(name)s | %(funcName)s:%(lineno)d | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        file_handler.setFormatter(file_format)
        
        self._logger.addHandler(file_handler)
    
    @property
    def logger(self):
        return self._logger
    
    def set_level(self, level_name: str):
        """设置日志级别"""
        level = getattr(logging, level_name.upper(), logging.INFO)
        self._logger.setLevel(level)
        for handler in self._logger.handlers:
            if isinstance(handler, logging.StreamHandler) and handler.stream == sys.stdout:
                handler.setLevel(level)
        self._logger.info(f"日志级别设置为: {level_name.upper()}")
    
    def start_session(self):
        """开始新的爬取会话"""
        self.stats['start_time'] = datetime.now()
        self.stats['total_jobs'] = 0
        self.stats['success_count'] = 0
        self.stats['error_count'] = 0
        self.stats['duplicate_count'] = 0
        self.stats['retry_count'] = 0
        self.stats['source_stats'] = {}
        
        self._logger.info("=" * 70)
        self._logger.info("轻量化单线程爬虫启动")
        self._logger.info(f"启动时间: {self.stats['start_time'].strftime('%Y-%m-%d %H:%M:%S')}")
        self._logger.info(f"Python版本: {sys.version.split()[0]}")
        self._logger.info(f"工作目录: {Path.cwd()}")
        self._logger.info(f"数据库路径: {DB_PATH}")
        self._logger.info("=" * 70)
    
    def end_session(self):
        """结束爬取会话"""
        if not self.stats['start_time']:
            return
        
        elapsed = (datetime.now() - self.stats['start_time']).total_seconds()
        
        self._logger.info("=" * 70)
        self._logger.info("爬取会话结束")
        self._logger.info(f"总耗时: {elapsed:.2f}秒")
        self._logger.info(f"总岗位数: {self.stats['total_jobs']}")
        self._logger.info(f"成功插入: {self.stats['success_count']}")
        self._logger.info(f"重复跳过: {self.stats['duplicate_count']}")
        self._logger.info(f"错误次数: {self.stats['error_count']}")
        self._logger.info(f"重试次数: {self.stats['retry_count']}")
        
        if self.stats['source_stats']:
            self._logger.info("-" * 70)
            self._logger.info("各数据源统计:")
            for source, stats in self.stats['source_stats'].items():
                self._logger.info(
                    f"  [{source:>10}] 获取:{stats.get('fetched', 0):4d} | "
                    f"成功:{stats.get('success', 0):4d} | "
                    f"重复:{stats.get('duplicate', 0):4d} | "
                    f"错误:{stats.get('error', 0):4d}"
                )
        
        self._logger.info("=" * 70)
    
    def log_source_start(self, source: str, source_name: str):
        """记录数据源开始爬取"""
        if source not in self.stats['source_stats']:
            self.stats['source_stats'][source] = {
                'fetched': 0,
                'success': 0,
                'duplicate': 0,
                'error': 0,
                'start_time': datetime.now(),
            }
        
        self._logger.info("-" * 70)
        self._logger.info(f"▶ 开始爬取 [{source_name}] (source: {source})")
    
    def log_source_end(self, source: str, source_name: str, count: int):
        """记录数据源爬取完成"""
        stats = self.stats['source_stats'].get(source, {})
        elapsed = (datetime.now() - stats.get('start_time', datetime.now())).total_seconds()
        
        self._logger.info(
            f"✓ [{source_name}] 完成: {count} 条 | "
            f"获取:{stats.get('fetched', 0)} | "
            f"耗时:{elapsed:.1f}s"
        )
    
    def log_job_fetched(self, source: str, title: str, company: str):
        """记录岗位获取"""
        self.stats['total_jobs'] += 1
        if source in self.stats['source_stats']:
            self.stats['source_stats'][source]['fetched'] += 1
        
        self._logger.debug(f"获取岗位: [{title}] @ {company}")
    
    def log_job_success(self, source: str, job_id: int = None):
        """记录岗位成功插入"""
        self.stats['success_count'] += 1
        if source in self.stats['source_stats']:
            self.stats['source_stats'][source]['success'] += 1
        
        msg = f"成功插入岗位"
        if job_id:
            msg += f" (ID: {job_id})"
        self._logger.debug(msg)
    
    def log_job_duplicate(self, source: str, title: str):
        """记录重复岗位"""
        self.stats['duplicate_count'] += 1
        if source in self.stats['source_stats']:
            self.stats['source_stats'][source]['duplicate'] += 1
        
        self._logger.debug(f"重复跳过: [{title}]")
    
    def log_error(self, source: str, error: Exception, context: str = ""):
        """记录错误"""
        self.stats['error_count'] += 1
        if source in self.stats['source_stats']:
            self.stats['source_stats'][source]['error'] += 1
        
        error_msg = f"[{source}] 错误: {type(error).__name__}: {str(error)}"
        if context:
            error_msg += f" | 上下文: {context}"
        self._logger.error(error_msg)
    
    def log_retry(self, source: str, url: str, attempt: int, max_retries: int):
        """记录重试"""
        self.stats['retry_count'] += 1
        
        self._logger.warning(
            f"[{source}] 重试请求 ({attempt}/{max_retries}): {url[:80]}..."
        )
    
    def log_request(self, method: str, url: str, status_code: int = None, elapsed: float = None):
        """记录HTTP请求"""
        msg = f"{method} {url[:80]}"
        if status_code:
            msg += f" → {status_code}"
        if elapsed:
            msg += f" ({elapsed:.2f}s)"
        self._logger.debug(msg)
    
    def log_database_operation(self, operation: str, table: str, success: bool, affected: int = 0):
        """记录数据库操作"""
        status = "✓" if success else "✗"
        msg = f"{status} 数据库{operation}: {table}"
        if affected > 0:
            msg += f" (影响{affected}行)"
        self._logger.debug(msg)


crawl_logger = CrawlLogger()
logger = crawl_logger.logger


def get_nested_value(data: Dict, key: str) -> Any:
    """获取嵌套字典的值"""
    keys = key.split(".")
    value = data
    for k in keys:
        if isinstance(value, dict):
            value = value.get(k)
        else:
            return None
    return value


def normalize_date(date_str: str) -> str:
    """标准化日期格式"""
    if not date_str:
        return ""
    
    date_str = str(date_str).strip()
    
    if re.match(r"^\d{13}$", date_str):
        ts = int(date_str) / 1000
        return datetime.fromtimestamp(ts).strftime("%Y-%m-%d")
    
    if re.match(r"^\d{10}$", date_str):
        ts = int(date_str)
        return datetime.fromtimestamp(ts).strftime("%Y-%m-%d")
    
    formats = [
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d %H:%M",
        "%Y/%m/%d",
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(date_str[:19], fmt).strftime("%Y-%m-%d")
        except (ValueError, TypeError):
            continue
    
    return ""


def clean_text(text: str) -> str:
    """清理文本"""
    if not text:
        return ""
    return re.sub(r"\s+", " ", str(text)).strip()


def truncate_text(text: str, max_len: int = 500) -> str:
    """截断文本"""
    if not text:
        return ""
    text = clean_text(text)
    return text[:max_len] + "..." if len(text) > max_len else text


def init_database():
    """初始化数据库 - 与主爬虫 database.py 保持一致的表结构"""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    db.execute("""
        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            company TEXT NOT NULL DEFAULT '',
            location TEXT DEFAULT '',
            salary TEXT DEFAULT '面议',
            description TEXT DEFAULT '',
            requirements TEXT DEFAULT '',
            job_type TEXT DEFAULT '实习',
            industry TEXT DEFAULT '',
            education TEXT DEFAULT '',
            experience TEXT DEFAULT '',
            contact TEXT DEFAULT '',
            source TEXT DEFAULT '',
            university TEXT DEFAULT '',
            source_url TEXT UNIQUE,
            apply_url TEXT DEFAULT '',
            publish_date TEXT DEFAULT '',
            deadline TEXT DEFAULT '',
            category TEXT DEFAULT '',
            tags TEXT DEFAULT '',
            is_favorite INTEGER DEFAULT 0,
            is_read INTEGER DEFAULT 0,
            content_hash TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    db.execute("CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source)")
    db.execute("CREATE INDEX IF NOT EXISTS idx_jobs_source_url ON jobs(source_url)")
    db.execute("CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company)")
    db.execute("CREATE INDEX IF NOT EXISTS idx_jobs_publish_date ON jobs(publish_date)")
    
    db.execute("""
        CREATE TABLE IF NOT EXISTS crawl_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT NOT NULL,
            status TEXT NOT NULL,
            jobs_count INTEGER DEFAULT 0,
            error_message TEXT,
            start_time TIMESTAMP,
            end_time TIMESTAMP,
            duration REAL DEFAULT 0
        )
    """)
    
    db.execute("""
        CREATE TABLE IF NOT EXISTS crawler_status (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            is_running INTEGER DEFAULT 0,
            status TEXT DEFAULT 'idle',
            current_source TEXT,
            total_sources INTEGER DEFAULT 0,
            completed_sources INTEGER DEFAULT 0,
            total_jobs INTEGER DEFAULT 0,
            start_time TIMESTAMP,
            last_update TIMESTAMP,
            pid INTEGER
        )
    """)
    
    db.execute("""
        INSERT OR IGNORE INTO crawler_status (id, is_running, status)
        VALUES (1, 0, 'idle')
    """)

    # 增量爬取状态表
    db.execute("""
        CREATE TABLE IF NOT EXISTS crawl_state (
            source TEXT PRIMARY KEY,
            last_page INTEGER DEFAULT 1,
            last_crawl_time TIMESTAMP,
            last_job_count INTEGER DEFAULT 0,
            extra TEXT DEFAULT '{}'
        )
    """)

    db.commit()

    preload_existing_urls()
    crawl_logger.log_database_operation("初始化", "jobs/crawl_logs/crawler_status/crawl_state", True)
    logger.info("✓ 数据库初始化完成（与主爬虫表结构一致）")


def is_within_date_range(publish_date: str, months: int = 2) -> bool:
    """
    检查发布日期是否在指定月数范围内
    
    Args:
        publish_date: 发布日期字符串 (格式: YYYY-MM-DD)
        months: 允许的月数范围 (默认2个月)
    
    Returns:
        bool: 是否在允许的时间范围内
    """
    if not publish_date:
        logger.debug(f"无发布日期，默认通过筛选")
        return True
    
    try:
        from datetime import datetime, timedelta
        
        pub_date = normalize_date(publish_date)
        if not pub_date:
            return True
        
        parsed_date = datetime.strptime(pub_date, "%Y-%m-%d").date()
        cutoff_date = (datetime.now() - timedelta(days=months * 30)).date()
        
        is_valid = parsed_date >= cutoff_date
        
        if not is_valid:
            days_old = (datetime.now().date() - parsed_date).days
            logger.debug(
                f"日期超出范围: {publish_date} ({days_old}天前, "
                f"限制{months*30}天内)"
            )
        
        return is_valid
        
    except Exception as e:
        logger.warning(f"日期解析失败: {publish_date} - {e}")
        return True  # 解析失败时默认通过


def save_crawl_state(source: str, last_page: int, last_job_count: int = 0, extra: str = '{}'):
    """保存增量爬取状态"""
    from datetime import datetime
    now = datetime.now().isoformat()
    db.execute('''
        INSERT INTO crawl_state (source, last_page, last_crawl_time, last_job_count, extra)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(source) DO UPDATE SET
            last_page = excluded.last_page,
            last_crawl_time = excluded.last_crawl_time,
            last_job_count = excluded.last_job_count,
            extra = excluded.extra
    ''', (source, last_page, now, last_job_count, extra))
    db.commit()
    logger.debug(f"增量状态已保存: [{source}] last_page={last_page}, count={last_job_count}")


def load_crawl_state(source: str) -> Dict:
    """加载增量爬取状态"""
    row = db.execute(
        "SELECT last_page, last_crawl_time, last_job_count, extra FROM crawl_state WHERE source = ?",
        (source,)
    ).fetchone()
    if row:
        return {"last_page": row[0], "last_crawl_time": row[1], "last_job_count": row[2], "extra": row[3]}
    return {"last_page": 1, "last_crawl_time": None, "last_job_count": 0, "extra": "{}"}


def insert_job(job: Dict, date_filter_months: int = 2) -> bool:
    """插入岗位数据，基于 source_url 去重（与主爬虫一致），并按时间筛选"""
    
    source = job.get("source", "unknown")
    title = job.get("title", "")
    source_url = job.get("source_url", "")
    publish_date = job.get("publish_date", "")
    
    if not source_url:
        logger.debug(f"岗位缺少 source_url，跳过: {title}")
        return False
    
    if not is_within_date_range(publish_date, date_filter_months):
        crawl_logger.log_job_duplicate(source, f"{title} [过期:{publish_date}]")
        return False
    
    if not OVERWRITE_MODE and url_exists(source_url):
        crawl_logger.log_job_duplicate(source, title)
        return False
    
    try:
        crawl_logger.log_job_fetched(source, title, job.get("company", ""))
        
        if OVERWRITE_MODE and url_exists(source_url):
            db.execute("""
                UPDATE jobs SET
                    title = ?, company = ?, location = ?, salary = ?, education = ?,
                    requirements = ?, description = ?, contact = ?, publish_date = ?,
                    deadline = ?, industry = ?, job_type = ?, experience = ?, tags = ?,
                    source = ?, university = ?, apply_url = ?, updated_at = CURRENT_TIMESTAMP
                WHERE source_url = ?
            """, (
                job.get("title", ""),
                job.get("company", ""),
                job.get("location", ""),
                job.get("salary", "面议"),
                job.get("education", ""),
                job.get("requirements", ""),
                job.get("description", ""),
                job.get("contact", ""),
                job.get("publish_date", ""),
                job.get("deadline", ""),
                job.get("industry", ""),
                job.get("job_type", "全职"),
                job.get("experience", ""),
                job.get("tags", ""),
                job.get("source", ""),
                job.get("university", ""),
                job.get("apply_url", ""),
                source_url,
            ))
            
            cursor = db.execute("SELECT id FROM jobs WHERE source_url = ?", (source_url,))
            row = cursor.fetchone()
            job_id = row[0] if row else 0
            
            _batch_commit()
            crawl_logger.log_job_success(source, job_id)
            logger.info(f"[{source}] 覆盖更新: {title} (id={job_id})")
            return True
        else:
            db.execute("""
                INSERT INTO jobs 
                (title, company, location, salary, education, requirements, description, 
                 contact, publish_date, deadline, industry, job_type, experience, tags,
                 source, university, source_url, apply_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                job.get("title", ""),
                job.get("company", ""),
                job.get("location", ""),
                job.get("salary", "面议"),
                job.get("education", ""),
                job.get("requirements", ""),
                job.get("description", ""),
                job.get("contact", ""),
                job.get("publish_date", ""),
                job.get("deadline", ""),
                job.get("industry", ""),
                job.get("job_type", "全职"),
                job.get("experience", ""),
                job.get("tags", ""),
                job.get("source", ""),
                job.get("university", ""),
                source_url,
                job.get("apply_url", ""),
            ))
            
            cursor = db.execute("SELECT last_insert_rowid()")
            job_id = cursor.fetchone()[0]
            
            mark_url_exists([source_url])
            _batch_commit()
            
            crawl_logger.log_job_success(source, job_id)
            return True
        
    except sqlite3.IntegrityError:
        crawl_logger.log_job_duplicate(source, title)
        return False
    except Exception as e:
        crawl_logger.log_error(source, e, f"插入岗位: {title}")
        return False


def fetch_with_retry(url: str, method: str = "GET", **kwargs) -> Optional[requests.Response]:
    """带重试的 HTTP 请求（含随机UA和反爬措施）"""
    start_time = time.time()
    headers = _get_random_headers()
    kwargs.setdefault("headers", {})
    kwargs["headers"].update(headers)
    
    delay_range = (1.0, 3.0)
    
    for attempt in range(MAX_RETRIES):
        try:
            if method.upper() == "GET":
                response = requests.get(url, timeout=30, **kwargs)
            else:
                response = requests.post(url, timeout=30, **kwargs)
            
            elapsed = time.time() - start_time
            crawl_logger.log_request(method, url, response.status_code, elapsed)
            
            if response.status_code == 200:
                return response
            
            if response.status_code == 403:
                logger.warning(f"被反爬拦截 (403): {url[:60]}，等待后重试...")
            
            logger.warning(f"HTTP {response.status_code}: {url[:60]}")
            
            if attempt < MAX_RETRIES - 1:
                crawl_logger.log_retry("http", url, attempt + 1, MAX_RETRIES)
                delay = RETRY_DELAY_BASE ** attempt + _random.uniform(*delay_range)
                logger.debug(f"等待 {delay:.1f}s 后重试...")
                time.sleep(delay)
                
        except requests.exceptions.RequestException as e:
            if attempt < MAX_RETRIES - 1:
                crawl_logger.log_retry("http", url, attempt + 1, MAX_RETRIES)
                delay = RETRY_DELAY_BASE ** attempt + _random.uniform(*delay_range)
                logger.debug(f"请求异常，等待 {delay:.1f}s 后重试: {type(e).__name__}")
                time.sleep(delay)
            else:
                logger.error(f"请求最终失败: {url[:60]} | {type(e).__name__}: {e}")
    
    return None


def crawl_sufe(source_config: Dict, max_items: int = 0) -> Iterator[Dict]:
    """爬取 SUFE（基于URL去重的增量爬取）
    
    增量策略：
    - 不记录页码，通过 URL 去重判断是否需要继续
    - 每页检查所有 URL 是否已存在，全部存在则停止爬取
    - 最多爬取 MAX_PAGES 页
    """
    source = "sufe"
    source_name = source_config["name"]
    base_url = source_config["base_url"]
    list_url = urljoin(base_url, source_config["list_url"])

    crawl_logger.log_source_start(source, source_name)

    page = 1
    count = 0

    try:
        while page <= MAX_PAGES:
            if max_items > 0 and count >= max_items:
                logger.info(f"达到最大数量限制 ({max_items})，停止爬取")
                break

            data = {"pageNo": str(page), "pageSize": "10"}
            response = fetch_with_retry(list_url, method="POST", data=data)

            if not response:
                logger.warning(f"第 {page} 页列表获取失败，停止爬取")
                break

            try:
                result = response.json()
                if result.get("code") != 200:
                    crawl_logger.log_error(source, Exception(f"API返回code={result.get('code')}"), f"列表页 {page}")
                    break

                items = result.get("data", {}).get("list", [])
                if not items:
                    logger.debug(f"第 {page} 页无数据，爬取结束")
                    break

                logger.info(f"第 {page} 页: 获取到 {len(items)} 条列表项")

                # 检查当前页所有 URL 是否都已存在（覆盖模式下跳过此检查）
                if not OVERWRITE_MODE:
                    page_urls = [urljoin(base_url, f"/career/zpxx/view/zpxx/{item.get('zpxxid')}") 
                                for item in items if item.get('zpxxid')]
                    existing_count = sum(1 for url in page_urls if url_exists(url))
                    
                    if existing_count == len(page_urls) and len(page_urls) > 0:
                        logger.info(f"第 {page} 页所有 URL 已存在 ({existing_count}/{len(page_urls)})，停止爬取")
                        break

                page_has_new_data = False

                for item in items:
                    if max_items > 0 and count >= max_items:
                        break

                    item_id = item.get("zpxxid")
                    if not item_id:
                        continue

                    view_url = urljoin(base_url, f"/career/zpxx/view/zpxx/{item_id}")

                    if not OVERWRITE_MODE and url_exists(view_url):
                        continue

                    page_has_new_data = True
                    detail_api_url = urljoin(base_url, source_config["detail_url"].format(item_id=item_id))

                    detail_response = fetch_with_retry(detail_api_url, method="POST")
                    if not detail_response:
                        continue

                    try:
                        detail_data = detail_response.json().get("data", {})

                        zwxx_list = detail_data.get("zwxxList", [])
                        if not zwxx_list:
                            zwxx_list = [detail_data]

                        for zwxx in zwxx_list:
                            if max_items > 0 and count >= max_items:
                                break

                            title = zwxx.get("zwmc") or detail_data.get("zpzt", "")
                            company = detail_data.get("dwmc", "")
                            location = zwxx.get("gzszxmc") or zwxx.get("gzszssmc") or detail_data.get("szxmc", "")
                            salary = zwxx.get("yxmc") or detail_data.get("yxmc", "面议")
                            education = zwxx.get("xlyqmc") or detail_data.get("xlyqmc", "")
                            description = zwxx.get("zwms") or detail_data.get("dwjs", "")
                            requirements = zwxx.get("zyyqmc", "")
                            industry = zwxx.get("hyyjmc") or detail_data.get("hyyjmc", "")
                            job_type = zwxx.get("gzlxmc") or detail_data.get("gzlxmc", "全职")
                            recruit_count = zwxx.get("xqrs", "")
                            if recruit_count and recruit_count != "0":
                                description = f"【招聘人数】{recruit_count}人\n\n{description}"

                            job = {
                                "title": title,
                                "company": company,
                                "location": location,
                                "salary": salary,
                                "education": education,
                                "requirements": requirements,
                                "description": truncate_text(description),
                                "publish_date": detail_data.get("fbrq", ""),
                                "deadline": detail_data.get("zpjzrq", ""),
                                "industry": industry,
                                "job_type": job_type,
                                "source": source,
                                "university": source_name,
                                "source_url": view_url,
                                "apply_url": view_url,
                            }

                            yield job
                            count += 1

                            if count % 20 == 0:
                                logger.info(f"  已完成: {count} 条")

                    except Exception as e:
                        crawl_logger.log_error(source, e, f"解析详情页: {detail_api_url}")
                        continue

                page += 1

            except Exception as e:
                crawl_logger.log_error(source, e, f"解析列表页: {page}")
                break
    except KeyboardInterrupt:
        logger.warning("用户中断爬取")
    except Exception as e:
        crawl_logger.log_error(source, e, "爬取过程异常")
    finally:
        save_crawl_state(source, 0, count, extra='{}')

    crawl_logger.log_source_end(source, source_name, count)


def crawl_zuel(source_config: Dict, max_items: int = 0) -> Iterator[Dict]:
    """爬取 ZUEL - 中南财经政法大学（基于URL去重的增量爬取）
    
    增量策略：
    - 不记录页码，通过 URL 去重判断是否需要继续
    - 每页检查所有 URL 是否已存在，全部存在则停止爬取
    - 最多爬取 MAX_PAGES 页
    """
    source = "zuel"
    source_name = source_config["name"]
    base_url = source_config["base_url"]

    crawl_logger.log_source_start(source, source_name)

    page = 1
    count = 0

    try:
        while page <= MAX_PAGES:
            if max_items > 0 and count >= max_items:
                logger.info(f"达到最大数量限制 ({max_items})，停止爬取")
                break

            list_url = source_config["list_url"].format(page=page, limit=10)
            full_url = urljoin(base_url, list_url)

            response = fetch_with_retry(full_url)
            if not response:
                logger.warning(f"第 {page} 页列表获取失败，停止爬取")
                break

            try:
                result = response.json()
                if result.get("code") != 0:
                    crawl_logger.log_error(source, Exception(f"API返回code={result.get('code')}"), f"列表页 {page}")
                    break

                items = result.get("data", [])
                if not items:
                    logger.debug(f"第 {page} 页无数据，爬取结束")
                    break

                logger.info(f"第 {page} 页: 获取到 {len(items)} 条列表项")

                # 检查当前页所有 URL 是否都已存在（覆盖模式下跳过此检查）
                if not OVERWRITE_MODE:
                    page_urls = [f"https://jyzx.zuel.edu.cn/home/career/internship?id={item.get('id')}" 
                                for item in items if item.get('id')]
                    existing_count = sum(1 for url in page_urls if url_exists(url))
                    
                    if existing_count == len(page_urls) and len(page_urls) > 0:
                        logger.info(f"第 {page} 页所有 URL 已存在 ({existing_count}/{len(page_urls)})，停止爬取")
                        break

                for item in items:
                    if max_items > 0 and count >= max_items:
                        break

                    item_id = item.get("id")
                    if not item_id:
                        continue

                    view_url = f"https://jyzx.zuel.edu.cn/home/career/internship?id={item_id}"

                    if not OVERWRITE_MODE and url_exists(view_url):
                        continue

                    detail_url = source_config["detail_url"].format(id=item_id)
                    full_detail_url = urljoin(base_url, detail_url)

                    detail_response = fetch_with_retry(full_detail_url)
                    if not detail_response:
                        continue

                    try:
                        detail_data = detail_response.json().get("data", {})

                        company_name = detail_data.get("companyName") or detail_data.get("title", "")
                        position_name = detail_data.get("jobName", "")
                        title = f"{position_name} | {company_name}" if position_name and company_name else (position_name or company_name)

                        description_parts = []
                        zpgw = detail_data.get("zpgw", "")
                        if zpgw:
                            description_parts.append(f"【岗位职责】{zpgw}")
                        xcfl = detail_data.get("xcfl", "")
                        if xcfl:
                            description_parts.append(f"【薪酬福利】{xcfl}")
                        description = "\n\n".join(description_parts)

                        requirements = detail_data.get("zpdxjtj", "")

                        contact_parts = []
                        recruit_contact = detail_data.get("recruitContact", "")
                        recruit_mobile = detail_data.get("recruitMobile", "")
                        lxfs = detail_data.get("lxfs", "")
                        if recruit_contact:
                            contact_parts.append(f"联系人: {recruit_contact}")
                        if recruit_mobile:
                            contact_parts.append(f"电话: {recruit_mobile}")
                        if lxfs:
                            contact_parts.append(f"邮箱: {lxfs}")
                        contact = " | ".join(contact_parts)

                        location = detail_data.get("area", "") or detail_data.get("workCity", "")

                        job = {
                            "title": title,
                            "company": company_name,
                            "location": location,
                            "salary": detail_data.get("salary", "面议"),
                            "education": detail_data.get("education", ""),
                            "requirements": requirements,
                            "description": truncate_text(description),
                            "contact": contact,
                            "publish_date": normalize_date(detail_data.get("createTime", "")),
                            "source": source,
                            "university": source_name,
                            "source_url": view_url,
                            "apply_url": view_url,
                        }

                        yield job
                        count += 1

                        if count % 20 == 0:
                            logger.info(f"  已完成: {count} 条")

                    except Exception as e:
                        crawl_logger.log_error(source, e, f"解析详情页: {full_detail_url}")
                        continue

                page += 1

            except Exception as e:
                crawl_logger.log_error(source, e, f"解析列表页: {page}")
                break
    except KeyboardInterrupt:
        logger.warning("用户中断爬取")
    except Exception as e:
        crawl_logger.log_error(source, e, "爬取过程异常")
    finally:
        save_crawl_state(source, 0, count, extra='{}')

    crawl_logger.log_source_end(source, source_name, count)


def crawl_platform(source: str, source_config: Dict, max_items: int = 0) -> Iterator[Dict]:
    """爬取平台类数据源（CUFE/DUFE，基于URL去重的增量爬取）
    
    增量策略：
    - 不记录页码，通过 URL 去重判断是否需要继续
    - 每页检查所有 URL 是否已存在，全部存在则停止爬取
    - 最多爬取 MAX_PAGES 页
    """
    source_name = source_config["name"]
    base_url = source_config["base_url"]

    crawl_logger.log_source_start(source, source_name)

    page = 1
    count = 0

    try:
        while page <= MAX_PAGES:
            if max_items > 0 and count >= max_items:
                logger.info(f"达到最大数量限制 ({max_items})，停止爬取")
                break

            data = {"pageNo": str(page), "positionType": "1"}
            response = fetch_with_retry(urljoin(base_url, source_config["list_url"]), method="POST", data=data)

            if not response:
                logger.warning(f"第 {page} 页列表获取失败，停止爬取")
                break

            try:
                result = response.json()
                if result.get("state") != 1:
                    crawl_logger.log_error(source, Exception(f"API返回state={result.get('state')}"), f"列表页 {page}")
                    break

                items = result.get("object", {}).get("list", [])
                if not items:
                    logger.debug(f"第 {page} 页无数据，爬取结束")
                    break

                logger.info(f"第 {page} 页: 获取到 {len(items)} 条列表项")

                # 检查当前页所有 URL 是否都已存在（覆盖模式下跳过此检查）
                if not OVERWRITE_MODE:
                    page_urls = [urljoin(base_url, item.get("url", "")) for item in items if item.get("url")]
                    existing_count = sum(1 for url in page_urls if url_exists(url))
                    
                    if existing_count == len(page_urls) and len(page_urls) > 0:
                        logger.info(f"第 {page} 页所有 URL 已存在 ({existing_count}/{len(page_urls)})，停止爬取")
                        break

                for item in items:
                    if max_items > 0 and count >= max_items:
                        break

                    url_path = item.get("url", "")
                    if not url_path:
                        continue

                    full_url = urljoin(base_url, url_path)

                    if not OVERWRITE_MODE and url_exists(full_url):
                        continue

                    parsed = urlparse(url_path)
                    query_params = parse_qs(parsed.query)
                    recruitment_id = query_params.get("recruitmentId", [None])[0]

                    if not recruitment_id:
                        continue

                    detail_url = urljoin(base_url, source_config["detail_url"])
                    detail_data = {"recruitmentId": recruitment_id}

                    detail_response = fetch_with_retry(detail_url, method="POST", data=detail_data)
                    if not detail_response:
                        continue

                    try:
                        detail_result = detail_response.json()
                        if detail_result.get("state") != 1:
                            continue

                        obj = detail_result.get("object", {})
                        detail = obj.get("recruitmentinfo", {})
                        corp_info = obj.get("corporationinfo", {}) or detail.get("corporationinfo", {})

                        company = corp_info.get("name", "")
                        position_list = detail.get("recruitmentPositionList", [])
                        position_info = position_list[0] if position_list else {}

                        raw_title = detail.get("title", "")
                        title = f"{raw_title} | {company}" if raw_title and company else (raw_title or company)

                        location = position_info.get("cityName", "")
                        deadline = detail.get("endTime", "")

                        label_value = detail.get("labelValue", [])
                        tags = ", ".join(label_value) if isinstance(label_value, list) else str(label_value)

                        publish_date = detail.get("startTime", "")
                        if publish_date and len(publish_date) > 10:
                            publish_date = publish_date[:10]

                        description = position_info.get("positionDescription", "")
                        placeholder_texts = ['详见招聘简章', '详见公告', '详见附件', '请查看详情']

                        if not description or any(p in description for p in placeholder_texts):
                            description = detail.get("shortContent", "") or detail.get("content", "")
                            if description:
                                description = re.sub(r'<[^>]+>', '', description)
                                description = description.replace('\r\n', '\n').replace('\r', '\n').strip()

                        education = position_info.get("studentType", "")
                        requirements = position_info.get("majorName", "")

                        contact = ""
                        email = detail.get("resumeReceiveEmail", "")
                        if email:
                            contact = f"邮箱: {email}"

                        industry = corp_info.get("corporationNatureValue", "")

                        salary = "面议"
                        content = detail.get("content", "") or detail.get("shortContent", "")
                        salary_patterns = [
                            r'(\d+\s*[Kk千]\s*[-~～]\s*\d+\s*[Kk千])',
                            r'(\d+\s*万\s*[-~～]\s*\d+\s*万)',
                            r'(\d{3,4}\s*[-~～]\s*\d{3,4}\s*元?\s*/\s*(月|年|天))',
                            r'(\d+\s*[-~～]\s*\d+\s*元?\s*/\s*(月|年|天))',
                        ]
                        for pattern in salary_patterns:
                            salary_match = re.search(pattern, content)
                            if salary_match:
                                salary = salary_match.group()
                                break

                        job = {
                            "title": title,
                            "company": company,
                            "location": location,
                            "salary": salary,
                            "education": education,
                            "requirements": requirements,
                            "description": truncate_text(description),
                            "contact": contact,
                            "industry": industry,
                            "tags": tags,
                            "deadline": deadline,
                            "publish_date": publish_date,
                            "source": source,
                            "university": source_name,
                            "source_url": full_url,
                            "apply_url": full_url,
                        }

                        yield job
                        count += 1

                        if count % 20 == 0:
                            logger.info(f"  已完成: {count} 条")

                    except Exception as e:
                        crawl_logger.log_error(source, e, f"解析详情页: {url_path}")
                        continue

                page += 1

            except Exception as e:
                crawl_logger.log_error(source, e, f"解析列表页: {page}")
                break
    except KeyboardInterrupt:
        logger.warning("用户中断爬取")
    except Exception as e:
        crawl_logger.log_error(source, e, "爬取过程异常")
    finally:
        save_crawl_state(source, 0, count, extra='{}')

    crawl_logger.log_source_end(source, source_name, count)


def crawl_swufe(source_config: Dict, max_items: int = 0, date_filter_months: int = 2) -> Iterator[Dict]:
    """爬取 SWUFE - 西南财经大学（基于URL去重的增量爬取）
    
    增量策略：
    - 不记录页码，通过 URL 去重判断是否需要继续
    - 每页检查所有 URL 是否已存在，全部存在则停止爬取
    - 最多爬取 MAX_PAGES 页
    - 检查发布时间，过期数据停止爬取
    """
    from bs4 import BeautifulSoup
    from datetime import datetime, timedelta
    from src.spiders.shared_parsers import parse_swufe_detail, parse_swufe_list_date
    
    source = "swufe"
    source_name = source_config["name"]
    base_url = source_config["base_url"]
    
    crawl_logger.log_source_start(source, source_name)
    
    page = 1
    count = 0
    cutoff_date = datetime.now() - timedelta(days=date_filter_months * 30)
    
    try:
        while page <= MAX_PAGES:
            if max_items > 0 and count >= max_items:
                logger.info(f"达到最大数量限制 ({max_items})，停止爬取")
                break
            
            list_url = f"https://job3.swufe.edu.cn/jobs/jobs_list/page/{page}.htm"
            
            response = fetch_with_retry(list_url)
            if not response:
                logger.warning(f"第 {page} 页列表获取失败，停止爬取")
                break
            
            try:
                soup = BeautifulSoup(response.text, 'html.parser')
                
                list_box = soup.find('div', class_='listb J_allListBox')
                if not list_box:
                    logger.debug(f"第 {page} 页未找到列表容器，爬取结束")
                    break
                
                job_items = list_box.find_all('div', class_='td-j-name')
                if not job_items:
                    logger.debug(f"第 {page} 页无岗位数据，爬取结束")
                    break
                
                logger.info(f"第 {page} 页: 获取到 {len(job_items)} 条列表项")
                
                # 检查当前页所有 URL 是否都已存在（覆盖模式下跳过此检查）
                if not OVERWRITE_MODE:
                    page_urls = []
                    for item in job_items:
                        a_tag = item.find('a', href=True)
                        if a_tag:
                            detail_path = a_tag.get('href', '')
                            if detail_path:
                                page_urls.append(urljoin(base_url, detail_path))
                    
                    existing_count = sum(1 for url in page_urls if url_exists(url))
                    
                    if existing_count == len(page_urls) and len(page_urls) > 0:
                        logger.info(f"第 {page} 页所有 URL 已存在 ({existing_count}/{len(page_urls)})，停止爬取")
                        break
                
                should_stop = False
                
                for item in job_items:
                    publish_date_str, is_expired = parse_swufe_list_date(item, cutoff_date)
                    
                    if is_expired:
                        logger.info(f"遇到过期数据 ({publish_date_str})，停止爬取")
                        should_stop = True
                        break
                    
                    if max_items > 0 and count >= max_items:
                        break
                    
                    a_tag = item.find('a', href=True)
                    if not a_tag:
                        continue
                    
                    detail_path = a_tag.get('href', '')
                    if not detail_path:
                        continue
                    
                    detail_url = urljoin(base_url, detail_path)
                    
                    if not OVERWRITE_MODE and url_exists(detail_url):
                        continue
                    
                    detail_response = fetch_with_retry(detail_url)
                    if not detail_response:
                        continue
                    
                    try:
                        job = parse_swufe_detail(
                            detail_response.text,
                            detail_url,
                            source,
                            source_name,
                            source_config.get("location", "成都")
                        )
                        
                        if job:
                            yield job
                            count += 1
                            
                            if count % 20 == 0:
                                logger.info(f"  已完成: {count} 条")
                            
                            time.sleep(DETAIL_DELAY)
                            
                    except Exception as e:
                        crawl_logger.log_error(source, e, f"解析详情页: {detail_url}")
                        continue
                
                if should_stop:
                    break
                
                page += 1
                
            except Exception as e:
                crawl_logger.log_error(source, e, f"解析列表页: {page}")
                break
    except KeyboardInterrupt:
        logger.warning("用户中断爬取")
    except Exception as e:
        crawl_logger.log_error(source, e, "爬取过程异常")
    finally:
        save_crawl_state(source, 0, count, extra='{}')
    
    crawl_logger.log_source_end(source, source_name, count)


_running = True


def set_crawler_status(status: str, current_source: str = None, 
                        total_sources: int = 0, completed_sources: int = 0,
                        total_jobs: int = 0):
    """更新爬虫全局状态"""
    import os
    try:
        now = datetime.now().isoformat()
        db.execute("""
            UPDATE crawler_status SET
                is_running = ?,
                status = ?,
                current_source = ?,
                total_sources = ?,
                completed_sources = ?,
                total_jobs = ?,
                last_update = ?,
                pid = ?
            WHERE id = 1
        """, (
            1 if status == 'running' else 0,
            status,
            current_source,
            total_sources,
            completed_sources,
            total_jobs,
            now,
            os.getpid() if status == 'running' else None
        ))
        db.commit()
        logger.debug(f"爬虫状态更新: {status}" + (f" [{current_source}]" if current_source else ""))
    except Exception as e:
        logger.warning(f"更新爬虫状态失败: {e}")


def get_crawler_status() -> dict:
    """获取爬虫全局状态"""
    try:
        row = db.execute("SELECT * FROM crawler_status WHERE id = 1").fetchone()
        if row:
            columns = [desc[0] for desc in db.execute("PRAGMA table_info(crawler_status)").fetchall()]
            return dict(zip(columns, row))
        return {"is_running": 0, "status": "idle"}
    except Exception as e:
        logger.warning(f"获取爬虫状态失败: {e}")
        return {"is_running": 0, "status": "idle"}


def signal_handler(signum, frame):
    """信号处理函数"""
    global _running
    logger.warning("\n\n收到停止信号，正在优雅退出...")
    _running = False


def parse_cron(cron_expr: str) -> int:
    """
    解析简化的 cron 表达式，返回间隔秒数
    支持格式: "0 2 * * *" (每天凌晨2点)
    """
    parts = cron_expr.split()
    if len(parts) != 5:
        return SCHEDULE_INTERVALS.get(cron_expr, 0)
    
    minute, hour, day, month, weekday = parts
    
    if minute.isdigit() and hour.isdigit() and day == "*" and month == "*" and weekday == "*":
        target_minute = int(minute)
        target_hour = int(hour)
        
        now = datetime.now()
        target_time = now.replace(hour=target_hour, minute=target_minute, second=0, microsecond=0)
        
        if target_time <= now:
            target_time = target_time.replace(day=now.day + 1)
        
        return int((target_time - now).total_seconds())
    
    return 0


def run_scheduled(sources: list, max_items: int, schedule: str):
    """定时运行爬虫"""
    global _running
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    interval = SCHEDULE_INTERVALS.get(schedule, 0)
    if interval == 0:
        interval = parse_cron(schedule)
    
    if interval == 0:
        logger.error(f"无效的定时参数: {schedule}")
        logger.info("  支持的参数: hourly, daily, weekly, 或 cron 表达式 (如 '0 2 * * *')")
        return
    
    crawl_logger.start_session()
    
    logger.info(f"定时爬取已启动")
    logger.info(f"  间隔: {schedule} ({interval}秒)")
    logger.info(f"  数据源: {', '.join(sources)}")
    logger.info(f"  按 Ctrl+C 停止\n")
    
    run_count = 0
    
    while _running:
        run_count += 1
        logger.info(f"\n{'=' * 70}")
        logger.info(f"第 {run_count} 次运行 | {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info('=' * 70)
        
        start_time = time.time()
        total_count = 0
        
        for source in sources:
            if not _running:
                break
            count = crawl_source(source, max_items)
            total_count += count
        
        elapsed = time.time() - start_time
        
        logger.info(f"\n本次完成 | 总岗位数: {total_count} | 耗时: {elapsed:.1f}s")
        
        if _running:
            next_time = datetime.now() + __import__('datetime').timedelta(seconds=interval)
            logger.info(f"\n下次运行时间: {next_time.strftime('%Y-%m-%d %H:%M:%S')}")
            logger.info(f"等待 {interval} 秒...\n")
            
            for _ in range(int(interval)):
                if not _running:
                    break
                time.sleep(1)
    
    logger.info("\n定时爬取已停止")
    crawl_logger.end_session()


def trigger_job_alerts(since_minutes: int = 30):
    """触发职位提醒：检查新增岗位并推送邮件
    
    Args:
        since_minutes: 检查最近N分钟内新增的岗位
    """
    import requests
    
    try:
        logger.info("正在检查职位提醒订阅...")
        
        # 调用API触发职位提醒
        api_url = "http://localhost:3000/api/alerts/trigger"
        
        response = requests.post(
            api_url,
            json={"since_minutes": since_minutes},
            timeout=60
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                alerts_triggered = result.get("alerts_triggered", 0)
                jobs_processed = result.get("jobs_processed", 0)
                logger.info(f"职位提醒处理完成: 检查 {jobs_processed} 个岗位, 触发 {alerts_triggered} 个订阅")
                
                # 打印详细结果
                for r in result.get("results", []):
                    status = "已发送" if r.get("email_sent") else "发送失败"
                    logger.info(f"  订阅 {r.get('alert_id')} ({r.get('email')}): {r.get('matched_count')} 个匹配, 邮件{status}")
            else:
                logger.warning(f"职位提醒API返回错误: {result.get('error', '未知错误')}")
        else:
            logger.warning(f"职位提醒API请求失败: HTTP {response.status_code}")
            
    except requests.exceptions.ConnectionError:
        logger.warning("无法连接到职位提醒API，请确保Web服务正在运行 (http://localhost:3000)")
    except Exception as e:
        logger.warning(f"触发职位提醒失败: {e}")


def crawl_source(source: str, max_items: int = 0, date_filter_months: int = 2) -> int:
    """爬取单个数据源
    
    Args:
        source: 数据源标识
        max_items: 最大爬取数量 (0=不限)
        date_filter_months: 时间筛选月数 (默认2个月)
    """
    if source not in HTTP_SOURCES:
        logger.error(f"未知数据源: {source}")
        return 0
    
    source_config = HTTP_SOURCES[source]
    count = 0
    
    logger.info(f"📅 时间筛选: 只入库最近 {date_filter_months} 个月的数据")
    
    if source == "sufe":
        job_iterator = crawl_sufe(source_config, max_items)
    elif source == "zuel":
        job_iterator = crawl_zuel(source_config, max_items)
    elif source in ("cufe", "dufe"):
        job_iterator = crawl_platform(source, source_config, max_items)
    elif source == "swufe":
        job_iterator = crawl_swufe(source_config, max_items, date_filter_months)
    else:
        return 0
    
    for job in job_iterator:
        if insert_job(job, date_filter_months=date_filter_months):
            count += 1
            if count % 10 == 0:
                logger.debug(f"  已插入: {count} 条")
    
    return count


def main():
    parser = argparse.ArgumentParser(description="轻量化单线程爬虫")
    parser.add_argument("--sources", nargs="*", help="指定数据源")
    parser.add_argument("--list-sources", action="store_true", help="列出所有数据源")
    parser.add_argument("--max-items", type=int, default=0, help="每个数据源最大爬取数量 (0=不限)")
    parser.add_argument("--schedule", type=str, help="定时爬取 (hourly/daily/weekly 或 cron 表达式)")
    parser.add_argument("--log-level", type=str, default="INFO", 
                        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
                        help="日志级别 (默认: INFO)")
    parser.add_argument("--date-filter", type=int, default=2,
                        help="时间筛选月数，只入库最近N个月的数据 (默认: 2个月)")
    parser.add_argument("--reset-incremental", action="store_true",
                        help="清除增量爬取状态，强制从头开始爬取")
    args = parser.parse_args()
    
    crawl_logger.set_level(args.log_level)
    
    if args.list_sources:
        logger.info("\n可用数据源:")
        for key, config in HTTP_SOURCES.items():
            logger.info(f"  {key:12s} - {config['name']}")
        logger.info("")
        return
    
    init_database()

    # 清除增量爬取状态并启用覆盖模式
    if args.reset_incremental:
        global OVERWRITE_MODE
        OVERWRITE_MODE = True
        db.execute("DELETE FROM crawl_state")
        db.commit()
        logger.info("已清除所有增量爬取状态，启用覆盖模式")
        logger.info("已存在的数据将被更新覆盖")

    sources = args.sources or list(HTTP_SOURCES.keys())
    date_filter_months = args.date_filter
    
    if args.schedule:
        run_scheduled(sources, args.max_items, schedule=args.schedule)
        return
    
    crawl_logger.start_session()
    
    set_crawler_status('running', total_sources=len(sources))
    
    logger.info(f"数据源: {', '.join(sources)}")
    if args.max_items > 0:
        logger.info(f"每个源最多: {args.max_items} 条")
    logger.info(f"📅 时间筛选: 只入库最近 {date_filter_months} 个月的数据")
    logger.info("=" * 70 + "\n")
    
    start_time = time.time()
    total_count = 0
    filtered_count = 0
    completed_sources = 0
    
    for source in sources:
        set_crawler_status('running', current_source=source, 
                           total_sources=len(sources), 
                           completed_sources=completed_sources,
                           total_jobs=total_count)
        count = crawl_source(source, args.max_items, date_filter_months=date_filter_months)
        total_count += count
        completed_sources += 1
    
    elapsed = time.time() - start_time
    
    set_crawler_status('completed', total_sources=len(sources), 
                       completed_sources=completed_sources, total_jobs=total_count)
    
    logger.info("\n" + "=" * 70)
    logger.info(f"爬取完成 | 总耗时 {elapsed:.1f}s")
    logger.info(f"成功入库: {total_count} 条 (已过滤过期数据)")
    logger.info("=" * 70 + "\n")
    
    crawl_logger.end_session()
    
    _flush_pending_commits()
    
    # 触发职位提醒
    if total_count > 0:
        trigger_job_alerts()
    
    db.close()
    flush_url_cache_if_dirty()


if __name__ == "__main__":
    main()
