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

HTTP_SOURCES = get_lite_http_sources()


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
    """初始化数据库"""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    logger.debug("初始化数据库表结构...")
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            company TEXT,
            location TEXT,
            salary TEXT,
            education TEXT,
            requirements TEXT,
            description TEXT,
            publish_date TEXT,
            source TEXT NOT NULL,
            university TEXT,
            source_url TEXT UNIQUE,
            apply_url TEXT,
            job_type TEXT,
            industry TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_source ON jobs(source)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_source_url ON jobs(source_url)")
    
    conn.commit()
    conn.close()
    
    crawl_logger.log_database_operation("初始化", "jobs", True)
    logger.info("✓ 数据库初始化完成")


def url_exists(url: str) -> bool:
    """检查 URL 是否已存在"""
    try:
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM jobs WHERE source_url = ? LIMIT 1", (url,))
        exists = cursor.fetchone() is not None
        conn.close()
        
        if exists:
            logger.debug(f"URL已存在: {url[:60]}...")
        
        return exists
    except Exception as e:
        logger.error(f"检查URL存在性失败: {e}")
        return False


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


def insert_job(job: Dict, date_filter_months: int = 2) -> bool:
    """插入岗位数据，基于(title,company)去重保留最完整记录，并按时间筛选"""
    
    source = job.get("source", "unknown")
    title = job.get("title", "")
    company = job.get("company", "")
    publish_date = job.get("publish_date", "")
    
    # 时间筛选：只入库最近N个月的数据
    if not is_within_date_range(publish_date, date_filter_months):
        crawl_logger.log_job_duplicate(source, f"{title} [过期:{publish_date}]")
        return False
    
    try:
        crawl_logger.log_job_fetched(source, title, company)
        
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()
        
        existing = cursor.execute(
            "SELECT id, LENGTH(description) as desc_len FROM jobs WHERE title=? AND company=? AND source=?",
            (title, company, source)
        ).fetchone()
        
        new_desc_len = len(job.get("description", ""))
        
        if existing:
            old_id, old_desc_len = existing
            if new_desc_len <= old_desc_len:
                conn.close()
                crawl_logger.log_job_duplicate(source, title)
                return False
            
            logger.info(f"更新更完整记录: [{title}] ({old_desc_len} → {new_desc_len}字符)")
            cursor.execute("DELETE FROM jobs WHERE id=?", (old_id,))
            crawl_logger.log_database_operation("删除重复", "jobs", True, 1)
        
        cursor.execute("""
            INSERT INTO jobs 
            (title, company, location, salary, education, description, 
             publish_date, source, university, source_url, apply_url, job_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            job.get("title", ""),
            job.get("company", ""),
            job.get("location", ""),
            job.get("salary", "面议"),
            job.get("education", ""),
            job.get("description", ""),
            job.get("publish_date", ""),
            job.get("source", ""),
            job.get("university", ""),
            job.get("source_url", ""),
            job.get("apply_url", ""),
            job.get("job_type", "全职"),
        ))
        
        job_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        crawl_logger.log_job_success(source, job_id)
        return True
        
    except sqlite3.IntegrityError as e:
        logger.warning(f"数据唯一约束冲突: {title} @ {company}")
        return False
    except Exception as e:
        crawl_logger.log_error(source, e, f"插入岗位: {title}")
        return False


def fetch_with_retry(url: str, method: str = "GET", **kwargs) -> Optional[requests.Response]:
    """带重试的 HTTP 请求"""
    start_time = time.time()
    
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
            
            logger.warning(f"HTTP {response.status_code}: {url[:60]}")
            
            if attempt < MAX_RETRIES - 1:
                crawl_logger.log_retry("http", url, attempt + 1, MAX_RETRIES)
                delay = RETRY_DELAY_BASE ** attempt
                logger.debug(f"等待 {delay}s 后重试...")
                time.sleep(delay)
                
        except requests.exceptions.RequestException as e:
            if attempt < MAX_RETRIES - 1:
                crawl_logger.log_retry("http", url, attempt + 1, MAX_RETRIES)
                delay = RETRY_DELAY_BASE ** attempt
                logger.debug(f"请求异常，等待 {delay}s 后重试: {type(e).__name__}")
                time.sleep(delay)
            else:
                logger.error(f"请求最终失败: {url[:60]} | {type(e).__name__}: {e}")
    
    return None


def crawl_sufe(source_config: Dict, max_items: int = 0) -> Iterator[Dict]:
    """爬取 SUFE"""
    source = "sufe"
    source_name = source_config["name"]
    base_url = source_config["base_url"]
    list_url = urljoin(base_url, source_config["list_url"])
    field_mapping = source_config["field_mapping"]
    
    crawl_logger.log_source_start(source, source_name)
    
    page = 1
    count = 0
    
    while True:
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
            
            for item in items:
                if max_items > 0 and count >= max_items:
                    break
                
                item_id = item.get("zpxxid")
                if not item_id:
                    logger.debug(f"列表项缺少 zpxxid 字段，跳过")
                    continue
                
                detail_url = urljoin(base_url, source_config["detail_url"].format(item_id=item_id))
                
                if url_exists(detail_url):
                    continue
                
                detail_response = fetch_with_retry(detail_url, method="POST")
                if not detail_response:
                    continue
                
                try:
                    detail_data = detail_response.json().get("data", {})
                    
                    job = {
                        "title": detail_data.get(field_mapping.get("title", "zpzt"), ""),
                        "company": detail_data.get(field_mapping.get("company", "dwmc"), ""),
                        "location": detail_data.get(field_mapping.get("location", "gzdd"), ""),
                        "salary": detail_data.get(field_mapping.get("salary", "xzdy"), "面议"),
                        "education": detail_data.get(field_mapping.get("education", "xlyq"), ""),
                        "description": truncate_text(detail_data.get(field_mapping.get("description", "zwms"), "")),
                        "source": source,
                        "university": source_name,
                        "source_url": detail_url,
                        "apply_url": detail_url,
                    }
                    
                    yield job
                    count += 1
                    
                    if count % 20 == 0:
                        logger.info(f"  已完成: {count} 条")
                        
                except Exception as e:
                    crawl_logger.log_error(source, e, f"解析详情页: {detail_url}")
                    continue
            
            page += 1
            
        except Exception as e:
            crawl_logger.log_error(source, e, f"解析列表页: {page}")
            break
    
    crawl_logger.log_source_end(source, source_name, count)


def crawl_zuel(source_config: Dict, max_items: int = 0) -> Iterator[Dict]:
    """爬取 ZUEL"""
    source = "zuel"
    source_name = source_config["name"]
    base_url = source_config["base_url"]
    field_mapping = source_config["field_mapping"]
    
    crawl_logger.log_source_start(source, source_name)
    
    page = 1
    count = 0
    
    while True:
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
            
            for item in items:
                if max_items > 0 and count >= max_items:
                    break
                
                item_id = item.get("id")
                if not item_id:
                    logger.debug(f"列表项缺少 id 字段，跳过")
                    continue
                
                detail_url = source_config["detail_url"].format(id=item_id)
                full_detail_url = urljoin(base_url, detail_url)
                
                if url_exists(full_detail_url):
                    continue
                
                detail_response = fetch_with_retry(full_detail_url)
                if not detail_response:
                    continue
                
                try:
                    detail_data = detail_response.json().get("data", {})
                    
                    job = {
                        "title": detail_data.get(field_mapping.get("title", "title"), ""),
                        "company": detail_data.get(field_mapping.get("company", "companyName"), ""),
                        "location": detail_data.get(field_mapping.get("location", "workCity"), ""),
                        "salary": detail_data.get(field_mapping.get("salary", "salary"), "面议"),
                        "education": detail_data.get(field_mapping.get("education", "education"), ""),
                        "description": truncate_text(detail_data.get(field_mapping.get("description", "positionDescription"), "")),
                        "publish_date": normalize_date(detail_data.get(field_mapping.get("publish_date", "createTime"), "")),
                        "source": source,
                        "university": source_name,
                        "source_url": full_detail_url,
                        "apply_url": full_detail_url,
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
    
    crawl_logger.log_source_end(source, source_name, count)


def crawl_platform(source: str, source_config: Dict, max_items: int = 0) -> Iterator[Dict]:
    """爬取平台类数据源（CUFE/DUFE）"""
    source_name = source_config["name"]
    base_url = source_config["base_url"]
    field_mapping = source_config["field_mapping"]
    
    crawl_logger.log_source_start(source, source_name)
    
    page = 1
    count = 0
    
    while True:
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
            
            for item in items:
                if max_items > 0 and count >= max_items:
                    break
                
                url_path = item.get("url", "")
                if not url_path:
                    logger.debug(f"列表项缺少 url 字段，跳过")
                    continue
                
                from urllib.parse import parse_qs, urlparse
                parsed = urlparse(url_path)
                query_params = parse_qs(parsed.query)
                recruitment_id = query_params.get("recruitmentId", [None])[0]
                
                if not recruitment_id:
                    logger.debug(f"URL中缺少 recruitmentId 参数: {url_path}")
                    continue
                
                detail_url = urljoin(base_url, source_config["detail_url"])
                detail_data = {"recruitmentId": recruitment_id}
                
                detail_response = fetch_with_retry(detail_url, method="POST", data=detail_data)
                if not detail_response:
                    continue
                
                try:
                    detail_result = detail_response.json()
                    if detail_result.get("state") != 1:
                        logger.debug(f"详情API返回异常 state={detail_result.get('state')}")
                        continue
                    
                    detail = detail_result.get("object", {}).get("recruitmentinfo", {})
                    corp_info = detail_result.get("object", {}).get("corporationinfo", {})
                    
                    company = get_nested_value({"corporationinfo": corp_info}, field_mapping.get("company", "corporationinfo.name"))
                    
                    job = {
                        "title": detail.get(field_mapping.get("title", "title"), ""),
                        "company": company or "",
                        "location": detail.get(field_mapping.get("location", "cityName"), ""),
                        "education": detail.get(field_mapping.get("education", "education"), ""),
                        "description": truncate_text(detail.get(field_mapping.get("description", "majorName"), "")),
                        "source": source,
                        "university": source_name,
                        "source_url": urljoin(base_url, url_path),
                        "apply_url": urljoin(base_url, url_path),
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
    
    crawl_logger.log_source_end(source, source_name, count)


def crawl_swufe(source_config: Dict, max_items: int = 0) -> Iterator[Dict]:
    """爬取 SWUFE"""
    source = "swufe"
    source_name = source_config["name"]
    base_url = source_config["base_url"]
    field_mapping = source_config["field_mapping"]
    
    crawl_logger.log_source_start(source, source_name)
    
    page = 1
    count = 0
    
    while True:
        if max_items > 0 and count >= max_items:
            logger.info(f"达到最大数量限制 ({max_items})，停止爬取")
            break
        
        list_url = source_config["list_url"].format(page=page)
        full_url = urljoin(base_url, list_url)
        
        response = fetch_with_retry(full_url)
        if not response:
            logger.warning(f"第 {page} 页列表获取失败，停止爬取")
            break
        
        try:
            result = response.json()
            items = result.get("list", [])
            
            if not items:
                logger.debug(f"第 {page} 页无数据，爬取结束")
                break
            
            logger.info(f"第 {page} 页: 获取到 {len(items)} 条列表项")
            
            for item in items:
                if max_items > 0 and count >= max_items:
                    break
                
                item_id = item.get("id")
                if not item_id:
                    logger.debug(f"列表项缺少 id 字段，跳过")
                    continue
                
                detail_url = source_config["detail_url"].format(id=item_id)
                full_detail_url = urljoin(base_url, detail_url)
                
                if url_exists(full_detail_url):
                    continue
                
                detail_response = fetch_with_retry(full_detail_url)
                if not detail_response:
                    continue
                
                try:
                    detail_data = detail_response.json()
                    
                    job = {
                        "title": detail_data.get(field_mapping.get("title", "title"), ""),
                        "company": detail_data.get(field_mapping.get("company", "company"), ""),
                        "location": detail_data.get(field_mapping.get("location", "location"), ""),
                        "description": truncate_text(detail_data.get(field_mapping.get("description", "content"), "")),
                        "source": source,
                        "university": source_name,
                        "source_url": full_detail_url,
                        "apply_url": full_detail_url,
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
    
    crawl_logger.log_source_end(source, source_name, count)


_running = True


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
        job_iterator = crawl_swufe(source_config, max_items)
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
    args = parser.parse_args()
    
    crawl_logger.set_level(args.log_level)
    
    if args.list_sources:
        logger.info("\n可用数据源:")
        for key, config in HTTP_SOURCES.items():
            logger.info(f"  {key:12s} - {config['name']}")
        logger.info("")
        return
    
    init_database()
    
    sources = args.sources or list(HTTP_SOURCES.keys())
    date_filter_months = args.date_filter
    
    if args.schedule:
        run_scheduled(sources, args.max_items, schedule=args.schedule)
        return
    
    crawl_logger.start_session()
    
    logger.info(f"数据源: {', '.join(sources)}")
    if args.max_items > 0:
        logger.info(f"每个源最多: {args.max_items} 条")
    logger.info(f"📅 时间筛选: 只入库最近 {date_filter_months} 个月的数据")
    logger.info("=" * 70 + "\n")
    
    start_time = time.time()
    total_count = 0
    filtered_count = 0  # 被时间筛选过滤掉的记录数
    
    for source in sources:
        count = crawl_source(source, args.max_items, date_filter_months=date_filter_months)
        total_count += count
    
    elapsed = time.time() - start_time
    
    logger.info("\n" + "=" * 70)
    logger.info(f"爬取完成 | 总耗时 {elapsed:.1f}s")
    logger.info(f"成功入库: {total_count} 条 (已过滤过期数据)")
    logger.info("=" * 70 + "\n")
    
    crawl_logger.end_session()


if __name__ == "__main__":
    main()
