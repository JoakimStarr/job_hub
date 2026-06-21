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
import os
import re
import signal
import sqlite3
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterator, Optional
from urllib.parse import urljoin, urlparse, parse_qs

# 加载 .env 环境变量文件
def load_env():
    """从 .env 文件加载环境变量"""
    env_path = Path(__file__).parent / '.env'
    if env_path.exists():
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip()
                    # 移除引号
                    if (value.startswith('"') and value.endswith('"')) or \
                       (value.startswith("'") and value.endswith("'")):
                        value = value[1:-1]
                    # 只设置未定义的环境变量（不覆盖系统环境变量）
                    if key not in os.environ:
                        os.environ[key] = value

load_env()

import requests

# ============================================================
# 爬虫配置（内联自 spider_configs.py，使本文件可独立运行）
# ============================================================

SPIDER_CONFIGS = {
    "sufe": {
        "name": "sufe_jobs",
        "university": "上海财经大学",
        "base_url": "https://career.sufe.edu.cn",
        "location": "上海",
        "spider_type": "api_post",
        "page_size": 10,
        "max_pages_per_section": 5,
        "detail_concurrency": 8,
        "sections": [
            {
                "section": "zpxx",
                "label": "招聘信息",
                "list_url": "/career//zpxx/search/zpxx",
                "detail_url": "/career//zpxx/data/zpxx/{item_id}",
                "view_url": "/career/zpxx/view/zpxx/{item_id}",
                "referer": "/career/zpxx/zpxx",
            },
            {
                "section": "sxzpxx",
                "label": "实习信息",
                "list_url": "/career//zpxx/search/sxzpxx",
                "detail_url": "/career//zpxx/data/sxzpxx/{item_id}",
                "view_url": "/career/zpxx/view/sxzpxx/{item_id}",
                "referer": "/career/zpxx/sxzpxx",
            },
            {
                "section": "zpgg",
                "label": "招聘公告",
                "list_url": "/career//news/search/zpgg",
                "detail_url": "/career//news/data/{news_type}/{item_id}",
                "view_url": "/career/news/view/{news_type}/{item_id}",
                "referer": "/career/news/zpgg",
            },
        ],
        "headers": {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
        },
        "field_mapping": {
            "title": ["zwmc", "zpzt"],
            "company": "dwmc",
            "location": ["gzszxmc", "gzszssmc", "szxmc"],
            "salary": "yxmc",
            "publish_date": "fbrq",
            "deadline": "zpjzrq",
            "industry": "hyyjmc",
            "education": "xlyqmc",
            "requirements": "zyyqmc",
            "description": ["zwms", "dwjs"],
            "job_type": "gzlxmc",
            "recruit_count": "xqrs",
        },
    },
    "zuel": {
        "name": "zuel_jobs",
        "university": "中南财经政法大学",
        "base_url": "https://jyzx.zuel.edu.cn",
        "location": "武汉",
        "spider_type": "api_get",
        "list_api": "https://jyzx.zuel.edu.cn/api/publicly/recruit/list",
        "detail_api": "https://jyzx.zuel.edu.cn/api/publicly/recruit/get",
        "page_size": 10,
        "max_pages_per_category": 80,
        "detail_concurrency": 8,
        "categories": [
            {"label": "全职", "api_type": "1", "job_type": "全职"},
            {"label": "实习", "api_type": "2", "job_type": "实习"},
        ],
        "headers": {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        },
        "field_mapping": {
            "title": "jobName",
            "company": "companyName",
            "location": ["area", "workCity"],
            "salary": "salary",
            "publish_date": "createTime",
            "education": "education",
            "requirements": "zpdxjtj",
            "industry": "nature",
            "description": ["zpgw", "xcfl"],
            "contact": ["recruitContact", "recruitMobile", "lxfs"],
        },
    },
    "cufe": {
        "name": "cufe_jobs",
        "university": "中央财经大学",
        "base_url": "http://scc.cufe.edu.cn",
        "location": "北京",
        "spider_type": "api_post",
        "list_api_path": "/f/recruitmentinfo/ajax_frontRecruitinfo",
        "detail_api_path": "/f/recruitmentinfo/ajax_show",
        "page_size": 10,
        "max_pages": 80,
        "detail_concurrency": 4,
        "position_types": [
            {"label": "全职", "type": "1"},
            {"label": "实习", "type": "2"},
        ],
        "headers": {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
        },
        "field_mapping": {
            "title": "title",
            "company": "corporationinfo.name",
            "location": "recruitmentPositionList[0].cityName",
            "publish_date": "startTime",
            "deadline": "endTime",
            "education": "recruitmentPositionList[0].studentType",
            "requirements": "recruitmentPositionList[0].majorName",
            "industry": "corporationinfo.corporationNatureValue",
            "description": ["positionDescription", "shortContent", "content"],
            "job_type": "positionTypeValue",
            "apply_url": "onlineApplicationUrl",
            "contact": "resumeReceiveEmail",
            "tags": "labelValue",
        },
    },
    "dufe": {
        "name": "dufe_jobs",
        "university": "东北财经大学",
        "base_url": "https://career.dufe.edu.cn",
        "location": "大连",
        "spider_type": "api_post",
        "list_api_path": "/f/recruitmentinfo/ajax_frontRecruitinfo",
        "detail_api_path": "/f/recruitmentinfo/ajax_show",
        "page_size": 10,
        "max_pages": 80,
        "detail_concurrency": 4,
        "position_types": [
            {"label": "全职", "type": "1"},
            {"label": "实习", "type": "2"},
        ],
        "headers": {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
        },
        "field_mapping": "same_as_cufe",
    },
    "swufe": {
        "name": "swufe_jobs",
        "university": "西南财经大学",
        "base_url": "https://job3.swufe.edu.cn",
        "location": "成都",
        "spider_type": "html",
        "page_size": 10,
        "max_pages": 100,
        "detail_concurrency": 8,
        "date_filter_months": 2,
        "list_url_pattern": "https://job3.swufe.edu.cn/jobs/jobs_list/page/{page}.htm",
        "headers": {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        },
        "selectors": {
            "list_container": "div.listb.J_allListBox",
            "list_items": "div.td-j-name",
            "list_item_row": "div.yli",
            "list_detail": "div.detail",
            "publish_time_label": "div.txt2",
            "title": "div.j-n-txt",
            "publish_date": "div.job_date span.cutom_font",
            "salary": "div.job_msg span",
            "location": "div.job_msg span",
            "education": "div.job_msg span",
            "company": "div.com-name",
            "industry": "div.com-class",
            "com_num": "div.com-num",
            "tags": "div.lab div.li",
            "description": "div.describe div.txt",
            "requirements": "div.describe",
            "not_found": "div.no_page_group",
        },
    },
    "zjgsu": {
        "name": "zjgsu_jobs",
        "university": "浙江工商大学",
        "base_url": "https://jyw.zjgsu.edu.cn",
        "location": "杭州",
        "spider_type": "api_post",
        "page_size": 10,
        "max_pages_per_section": 50,
        "detail_concurrency": 4,
        "sections": [
            {
                "section": "zpxx",
                "label": "招聘信息",
                "list_url": "/career/zpxx/search/zpxx",
                "view_url": "/career/zpxx/view/zpxx/{item_id}",
                "referer": "/career/zpxx/zpxx",
                "job_type": "全职",
            },
            {
                "section": "sxzpxx",
                "label": "实习信息",
                "list_url": "/career/zpxx/search/sxzpxx",
                "view_url": "/career/zpxx/view/sxzpxx/{item_id}",
                "referer": "/career/zpxx/sxzpxx",
                "job_type": "实习",
            },
        ],
        "headers": {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
        },
        "field_mapping": {
            "title": "zpzt",
            "company": "dwmc",
            "location": ["szxmc", "szsmc"],
            "industry": "hyyjmc",
            "company_type": "xzyjmc",
            "company_size": "rsgmmc",
            "publish_date": "fbrq",
            "deadline": "zpjzrq",
            "recruit_count": "xqrs",
            "contact_email": "jltdyx",
            "views": "djs",
        },
    },
    "cueb": {
        "name": "cueb_jobs",
        "university": "首都经济贸易大学",
        "base_url": "https://jy.cueb.edu.cn",
        "location": "北京",
        "spider_type": "api_post",
        "list_api": "https://jy.cueb.edu.cn/front/zp_query/zpxxQuery.do",
        "detail_url_pattern": "https://jy.cueb.edu.cn/front/zpxx.jspa?tid={tid}",
        "page_size": 10,
        "max_pages": 50,
        "detail_concurrency": 4,
        "position_types": [
            {"label": "全职", "type": "1", "job_type": "全职"},
            {"label": "实习", "type": "2", "job_type": "实习"},
        ],
        "headers": {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": "https://jy.cueb.edu.cn/front/channel.jspa?channelId=764&parentId=625",
        },
        "field_mapping": {
            "title": "title",
            "company": "dwmc",
            "location": "dwszddm",
            "publish_date": "createTime",
            "views": "click",
        },
    },
    "zufe": {
        "name": "zufe_jobs",
        "university": "浙江财经大学",
        "base_url": "https://zccareer.zufe.edu.cn",
        "location": "杭州",
        "spider_type": "html",
        "page_size": 20,
        "max_pages": 50,
        "detail_concurrency": 1,
        "date_filter_months": 2,
        "campus_list_url": "https://zccareer.zufe.edu.cn/campus/index/do1/zccareer.zufe.edu.cn/domain/zufe/city",
        "job_fulltime_list_url": "https://zccareer.zufe.edu.cn/job/search/d_category%5B0%5D/0/d_category%5B1%5D/100",
        "job_intern_list_url": "https://zccareer.zufe.edu.cn/job/search/d_category%5B0%5D/0/d_category%5B1%5D/101/d_category%5B2%5D/102",
        "headers": {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        },
    },
}


def get_spider_config(source: str) -> Dict[str, Any]:
    """获取指定数据源的爬虫配置"""
    if source not in SPIDER_CONFIGS:
        raise ValueError(f"未知的爬虫数据源: {source}")
    return SPIDER_CONFIGS[source]


def get_lite_http_sources():
    """
    从 SPIDER_CONFIGS 提取 HTTP 类型数据源的简化配置，供 lite_crawler 使用。
    """
    lite_sources = {}

    for key, config in SPIDER_CONFIGS.items():
        spider_type = config.get("spider_type", "")

        if spider_type == "api_post":
            sections = config.get("sections")
            if sections:
                detail_url = sections[0].get("detail_url") or sections[0].get("view_url", "")
                lite_sources[key] = {
                    "name": config["university"],
                    "base_url": config["base_url"],
                    "list_url": sections[0]["list_url"],
                    "detail_url": detail_url,
                    "field_mapping": {k: (v[0] if isinstance(v, list) else v)
                                      for k, v in config.get("field_mapping", {}).items()},
                }
            else:
                fm = config.get("field_mapping", {})
                if fm == "same_as_cufe":
                    fm = SPIDER_CONFIGS["cufe"]["field_mapping"]
                list_url = config.get("list_api_path") or config.get("list_api", "")
                detail_url = config.get("detail_api_path") or config.get("detail_url_pattern", "")
                lite_sources[key] = {
                    "name": config["university"],
                    "base_url": config["base_url"],
                    "list_url": list_url,
                    "detail_url": detail_url,
                    "field_mapping": {k: (v[0] if isinstance(v, list) else v)
                                      for k, v in fm.items()},
                }

        elif spider_type == "api_get":
            list_api = config.get("list_api", "")
            detail_api = config.get("detail_api", "")
            if detail_api:
                detail_url = detail_api.replace(config["base_url"], "") + "?id={id}"
            else:
                detail_url = ""
            lite_sources[key] = {
                "name": config["university"],
                "base_url": config["base_url"],
                "list_url": list_api,
                "detail_url": detail_url,
                "field_mapping": {k: (v[0] if isinstance(v, list) else v)
                                  for k, v in config.get("field_mapping", {}).items()},
            }

    lite_sources["swufe"] = {
        "name": "西南财经大学",
        "base_url": "https://job3.swufe.edu.cn",
        "list_url_pattern": "https://job3.swufe.edu.cn/jobs/jobs_list/page/{page}.htm",
        "field_mapping": {
            "title": "position_name",
            "company": "company",
            "location": "location",
            "salary": "salary",
            "education": "education",
            "description": "description",
            "requirements": "requirements",
            "contact": "contact",
            "industry": "industry",
            "publish_date": "publish_date",
        },
    }

    lite_sources["zufe"] = {
        "name": "浙江财经大学",
        "base_url": "https://zccareer.zufe.edu.cn",
        "campus_list_url": "https://zccareer.zufe.edu.cn/campus/index/do1/zccareer.zufe.edu.cn/domain/zufe/city",
        "job_fulltime_list_url": "https://zccareer.zufe.edu.cn/job/search/d_category%5B0%5D/0/d_category%5B1%5D/100",
        "job_intern_list_url": "https://zccareer.zufe.edu.cn/job/search/d_category%5B0%5D/0/d_category%5B1%5D/101/d_category%5B2%5D/102",
        "field_mapping": {},
    }

    # 云就业平台 (bysjy.com.cn / bibibi.net) 通用配置
    for yj_key, yj_config in {
        "tjufe": {
            "name": "天津财经大学",
            "base_url": "https://tjufe.bysjy.com.cn",
            "location": "天津",
        },
        "gdufe": {
            "name": "广东财经大学",
            "base_url": "http://gdcj.bibibi.net",
            "location": "广州",
        },
        "jxufe": {
            "name": "江西财经大学",
            "base_url": "http://career.jxufe.edu.cn",
            "location": "南昌",
        },
    }.items():
        lite_sources[yj_key] = {
            "name": yj_config["name"],
            "base_url": yj_config["base_url"],
            "location": yj_config["location"],
            "spider_type": "yunjiuye",
            "field_mapping": {},
        }

    return lite_sources

# ============================================================
# 常量与全局变量
# ============================================================

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

# 大哥手动添加的新源
HTTP_SOURCES["zjgsu"] = {
    "name": "浙江工商大学",
    "base_url": "https://jyw.zjgsu.edu.cn",
}
HTTP_SOURCES["cueb"] = {
    "name": "首都经济贸易大学",
    "base_url": "https://jy.cueb.edu.cn",
}
HTTP_SOURCES["bytedance"] = {
    "name": "字节跳动",
    "base_url": "https://jobs.bytedance.com",
    "source_id": "bytedance",
}
HTTP_SOURCES["nau"] = {
    "name": "南京审计大学",
    "base_url": "https://www.91job.org.cn",
    "source_id": "nau",
    "location": "南京",
    "xxdm": "11287",
    "lmid": "C42AEC7BB04636C5E0559D15282125C4",
    "list_api": "https://www.91job.org.cn/web/wsjysc/lbxq/getZpgwPageList",
    "referer": "https://nau.91job.org.cn/",
}
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
    - 支持招聘信息和实习信息两个板块
    """
    source = "sufe"
    source_name = source_config["name"]
    base_url = source_config["base_url"]

    crawl_logger.log_source_start(source, source_name)

    count = 0

    sections = [
        {
            "list_url": source_config["list_url"],
            "detail_url": source_config["detail_url"],
            "view_url_template": "/career/zpxx/view/zpxx/{item_id}",
            "job_type": None,  # 使用API返回值
            "label": "招聘信息",
        },
        {
            "list_url": "/career//zpxx/search/sxzpxx",
            "detail_url": "/career//zpxx/data/sxzpxx/{item_id}",
            "view_url_template": "/career/zpxx/view/sxzpxx/{item_id}",
            "job_type": "实习",
            "label": "实习信息",
        },
    ]

    try:
        for section in sections:
            if max_items > 0 and count >= max_items:
                break

            list_url = urljoin(base_url, section["list_url"])

            # 实习板块先探测第一页是否有数据
            if section["job_type"] == "实习":
                probe_data = {"pageNo": "1", "pageSize": "10"}
                probe_resp = fetch_with_retry(list_url, method="POST", data=probe_data)
                if not probe_resp:
                    logger.info(f"[{section['label']}] 探测失败，跳过")
                    continue
                try:
                    probe_result = probe_resp.json()
                    if probe_result.get("code") != 200:
                        logger.info(f"[{section['label']}] API异常，跳过")
                        continue
                    probe_items = probe_result.get("data", {}).get("list", [])
                    if not probe_items:
                        logger.info(f"[{section['label']}] 无数据，跳过")
                        continue
                except Exception:
                    logger.info(f"[{section['label']}] 探测异常，跳过")
                    continue

            logger.info(f"▶ 爬取板块: {section['label']}")
            page = 1

            while page <= MAX_PAGES:
                if max_items > 0 and count >= max_items:
                    logger.info(f"达到最大数量限制 ({max_items})，停止爬取")
                    break

                data = {"pageNo": str(page), "pageSize": "10"}
                response = fetch_with_retry(list_url, method="POST", data=data)

                if not response:
                    logger.warning(f"[{section['label']}] 第 {page} 页列表获取失败，停止爬取")
                    break

                try:
                    result = response.json()
                    if result.get("code") != 200:
                        crawl_logger.log_error(source, Exception(f"API返回code={result.get('code')}"), f"{section['label']} 列表页 {page}")
                        break

                    items = result.get("data", {}).get("list", [])
                    if not items:
                        logger.debug(f"[{section['label']}] 第 {page} 页无数据，爬取结束")
                        break

                    logger.info(f"[{section['label']}] 第 {page} 页: 获取到 {len(items)} 条列表项")

                    # 检查当前页所有 URL 是否都已存在（覆盖模式下跳过此检查）
                    if not OVERWRITE_MODE:
                        page_urls = [urljoin(base_url, section["view_url_template"].format(item_id=item.get('zpxxid')))
                                    for item in items if item.get('zpxxid')]
                        existing_count = sum(1 for url in page_urls if url_exists(url))

                        if existing_count == len(page_urls) and len(page_urls) > 0:
                            logger.info(f"[{section['label']}] 第 {page} 页所有 URL 已存在 ({existing_count}/{len(page_urls)})，停止爬取")
                            break

                    for item in items:
                        if max_items > 0 and count >= max_items:
                            break

                        item_id = item.get("zpxxid")
                        if not item_id:
                            continue

                        view_url = urljoin(base_url, section["view_url_template"].format(item_id=item_id))

                        if not OVERWRITE_MODE and url_exists(view_url):
                            continue

                        detail_api_url = urljoin(base_url, section["detail_url"].format(item_id=item_id))

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
                                job_type = section["job_type"] or zwxx.get("gzlxmc") or detail_data.get("gzlxmc", "全职")
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
    - 支持全职和实习两种岗位类型
    """
    source = "zuel"
    source_name = source_config["name"]
    base_url = source_config["base_url"]

    crawl_logger.log_source_start(source, source_name)

    count = 0

    categories = [
        {"api_type": "1", "job_type": None, "label": "全职岗位"},  # 使用API返回值
        {"api_type": "2", "job_type": "实习", "label": "实习岗位"},
    ]

    try:
        for category in categories:
            if max_items > 0 and count >= max_items:
                break

            # 实习板块先探测第一页是否有数据
            if category["job_type"] == "实习":
                probe_url = source_config["list_url"].format(page=1, limit=10, type=category["api_type"])
                probe_full_url = urljoin(base_url, probe_url)
                probe_resp = fetch_with_retry(probe_full_url)
                if not probe_resp:
                    logger.info(f"[{category['label']}] 探测失败，跳过")
                    continue
                try:
                    probe_result = probe_resp.json()
                    if probe_result.get("code") != 0:
                        logger.info(f"[{category['label']}] API异常，跳过")
                        continue
                    probe_items = probe_result.get("data", [])
                    if not probe_items:
                        logger.info(f"[{category['label']}] 无数据，跳过")
                        continue
                except Exception:
                    logger.info(f"[{category['label']}] 探测异常，跳过")
                    continue

            logger.info(f"▶ 爬取类型: {category['label']}")
            page = 1

            while page <= MAX_PAGES:
                if max_items > 0 and count >= max_items:
                    logger.info(f"达到最大数量限制 ({max_items})，停止爬取")
                    break

                list_url = source_config["list_url"].format(page=page, limit=10, type=category["api_type"])
                full_url = urljoin(base_url, list_url)

                response = fetch_with_retry(full_url)
                if not response:
                    logger.warning(f"[{category['label']}] 第 {page} 页列表获取失败，停止爬取")
                    break

                try:
                    result = response.json()
                    if result.get("code") != 0:
                        crawl_logger.log_error(source, Exception(f"API返回code={result.get('code')}"), f"{category['label']} 列表页 {page}")
                        break

                    items = result.get("data", [])
                    if not items:
                        logger.debug(f"[{category['label']}] 第 {page} 页无数据，爬取结束")
                        break

                    logger.info(f"[{category['label']}] 第 {page} 页: 获取到 {len(items)} 条列表项")

                    # 检查当前页所有 URL 是否都已存在（覆盖模式下跳过此检查）
                    if not OVERWRITE_MODE:
                        page_urls = [f"https://jyzx.zuel.edu.cn/home/career/internship?id={item.get('id')}"
                                    for item in items if item.get('id')]
                        existing_count = sum(1 for url in page_urls if url_exists(url))

                        if existing_count == len(page_urls) and len(page_urls) > 0:
                            logger.info(f"[{category['label']}] 第 {page} 页所有 URL 已存在 ({existing_count}/{len(page_urls)})，停止爬取")
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
                            title = position_name or company_name

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

                            job_type = category["job_type"] or detail_data.get("jobType", "全职")

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
    - 支持全职和实习两种岗位类型
    """
    source_name = source_config["name"]
    base_url = source_config["base_url"]

    crawl_logger.log_source_start(source, source_name)

    count = 0

    position_types = [
        {"type": "1", "job_type": None, "label": "全职岗位"},  # 使用API返回值
        {"type": "2", "job_type": "实习", "label": "实习岗位"},
    ]

    try:
        for pos_type in position_types:
            if max_items > 0 and count >= max_items:
                break

            # 实习板块先探测第一页是否有数据
            if pos_type["job_type"] == "实习":
                probe_data = {"pageNo": "1", "positionType": pos_type["type"]}
                probe_resp = fetch_with_retry(urljoin(base_url, source_config["list_url"]), method="POST", data=probe_data)
                if not probe_resp:
                    logger.info(f"[{pos_type['label']}] 探测失败，跳过")
                    continue
                try:
                    probe_result = probe_resp.json()
                    if probe_result.get("state") != 1:
                        logger.info(f"[{pos_type['label']}] API异常，跳过")
                        continue
                    probe_items = probe_result.get("object", {}).get("list", [])
                    if not probe_items:
                        logger.info(f"[{pos_type['label']}] 无数据，跳过")
                        continue
                except Exception:
                    logger.info(f"[{pos_type['label']}] 探测异常，跳过")
                    continue

            logger.info(f"▶ 爬取类型: {pos_type['label']}")
            page = 1

            while page <= MAX_PAGES:
                if max_items > 0 and count >= max_items:
                    logger.info(f"达到最大数量限制 ({max_items})，停止爬取")
                    break

                data = {"pageNo": str(page), "positionType": pos_type["type"]}
                response = fetch_with_retry(urljoin(base_url, source_config["list_url"]), method="POST", data=data)

                if not response:
                    logger.warning(f"[{pos_type['label']}] 第 {page} 页列表获取失败，停止爬取")
                    break

                try:
                    result = response.json()
                    if result.get("state") != 1:
                        crawl_logger.log_error(source, Exception(f"API返回state={result.get('state')}"), f"{pos_type['label']} 列表页 {page}")
                        break

                    items = result.get("object", {}).get("list", [])
                    if not items:
                        logger.debug(f"[{pos_type['label']}] 第 {page} 页无数据，爬取结束")
                        break

                    logger.info(f"[{pos_type['label']}] 第 {page} 页: 获取到 {len(items)} 条列表项")

                    # 检查当前页所有 URL 是否都已存在（覆盖模式下跳过此检查）
                    if not OVERWRITE_MODE:
                        page_urls = [urljoin(base_url, item.get("url", "")) for item in items if item.get("url")]
                        existing_count = sum(1 for url in page_urls if url_exists(url))

                        if existing_count == len(page_urls) and len(page_urls) > 0:
                            logger.info(f"[{pos_type['label']}] 第 {page} 页所有 URL 已存在 ({existing_count}/{len(page_urls)})，停止爬取")
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
                            title = raw_title or company

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

                            job_type = pos_type["job_type"] or detail.get("positionTypeValue", "全职")

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
                                "job_type": job_type,
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
    - 支持招聘信息和实习信息两个板块
    """
    from bs4 import BeautifulSoup
    from datetime import datetime, timedelta
    from src.spiders.shared_parsers import parse_swufe_detail, parse_swufe_list_date

    source = "swufe"
    source_name = source_config["name"]
    base_url = source_config["base_url"]

    crawl_logger.log_source_start(source, source_name)

    count = 0
    cutoff_date = datetime.now() - timedelta(days=date_filter_months * 30)

    list_configs = [
        {
            "url_pattern": "https://job3.swufe.edu.cn/jobs/jobs_list/page/{page}.htm",
            "job_type": None,  # 使用解析值
            "label": "招聘信息",
        },
        {
            "url_pattern": "https://job3.swufe.edu.cn/interns/internship_list/page/{page}.htm",
            "job_type": "实习",
            "label": "实习信息",
        },
    ]

    try:
        for list_config in list_configs:
            if max_items > 0 and count >= max_items:
                break

            # 实习板块先探测第一页是否有数据
            if list_config["job_type"] == "实习":
                probe_url = list_config["url_pattern"].format(page=1)
                probe_resp = fetch_with_retry(probe_url)
                if not probe_resp:
                    logger.info(f"[{list_config['label']}] 探测失败，跳过")
                    continue
                try:
                    probe_soup = BeautifulSoup(probe_resp.text, 'html.parser')
                    probe_list_box = probe_soup.find('div', class_='listb J_allListBox')
                    if not probe_list_box or not probe_list_box.find_all('div', class_='td-j-name'):
                        logger.info(f"[{list_config['label']}] 无数据，跳过")
                        continue
                except Exception:
                    logger.info(f"[{list_config['label']}] 探测异常，跳过")
                    continue

            logger.info(f"▶ 爬取板块: {list_config['label']}")
            page = 1

            while page <= MAX_PAGES:
                if max_items > 0 and count >= max_items:
                    logger.info(f"达到最大数量限制 ({max_items})，停止爬取")
                    break

                list_url = list_config["url_pattern"].format(page=page)

                response = fetch_with_retry(list_url)
                if not response:
                    logger.warning(f"[{list_config['label']}] 第 {page} 页列表获取失败，停止爬取")
                    break

                try:
                    soup = BeautifulSoup(response.text, 'html.parser')

                    list_box = soup.find('div', class_='listb J_allListBox')
                    if not list_box:
                        logger.debug(f"[{list_config['label']}] 第 {page} 页未找到列表容器，爬取结束")
                        break

                    job_items = list_box.find_all('div', class_='td-j-name')
                    if not job_items:
                        logger.debug(f"[{list_config['label']}] 第 {page} 页无岗位数据，爬取结束")
                        break

                    logger.info(f"[{list_config['label']}] 第 {page} 页: 获取到 {len(job_items)} 条列表项")

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
                            logger.info(f"[{list_config['label']}] 第 {page} 页所有 URL 已存在 ({existing_count}/{len(page_urls)})，停止爬取")
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
                                # 覆盖 job_type
                                if list_config["job_type"]:
                                    job["job_type"] = list_config["job_type"]

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


# ==================== 通用详情页解析工具函数 ====================

def _extract_text_from_html(html_content: str, selectors: list, default: str = "") -> str:
    """从 HTML 内容中使用多个选择器提取文本

    Args:
        html_content: HTML 内容
        selectors: CSS 选择器列表，按优先级尝试
        default: 默认值

    Returns:
        提取的文本或默认值
    """
    from bs4 import BeautifulSoup
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        for selector in selectors:
            elem = soup.select_one(selector)
            if elem:
                text = elem.get_text(strip=True)
                if text:
                    return text
        return default
    except Exception:
        return default


def _extract_description_from_html(html_content: str, content_selectors: list = None) -> str:
    """从 HTML 中提取岗位描述

    Args:
        html_content: HTML 内容
        content_selectors: 内容区域选择器列表

    Returns:
        提取的描述文本
    """
    from bs4 import BeautifulSoup
    if content_selectors is None:
        content_selectors = ['div.content', 'div#content', 'div.details-content', 'div.detail-content', 'article']

    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        description_parts = []

        # 尝试找到内容区域
        content_div = None
        for selector in content_selectors:
            content_div = soup.select_one(selector)
            if content_div:
                break

        if content_div:
            # 提取段落和列表项
            for elem in content_div.find_all(['p', 'div', 'li', 'span', 'section']):
                text = elem.get_text(strip=True)
                # 过滤短文本和无关内容
                if text and len(text) > 5 and not any(skip in text for skip in ['发布时间', '浏览量', '返回列表']):
                    description_parts.append(text)

        return '\n'.join(description_parts) if description_parts else ""
    except Exception:
        return ""


def _extract_salary_from_text(text: str) -> str:
    """从文本中提取薪资信息

    Args:
        text: 输入文本

    Returns:
        提取的薪资或"面议"
    """
    salary_patterns = [
        r'(\d+\s*[Kk千]\s*[-~～]\s*\d+\s*[Kk千])',
        r'(\d+\s*万\s*[-~～]\s*\d+\s*万)',
        r'(\d{3,4}\s*[-~～]\s*\d{3,4}\s*元?\s*/\s*(月|年|天))',
        r'(\d+\s*[-~～]\s*\d+\s*元?\s*/\s*(月|年|天))',
        r'(\d+[\d\-\.]*\s*[元kK/月]*)',
    ]

    for pattern in salary_patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1)
    return "面议"


def _extract_education_from_text(text: str) -> str:
    """从文本中提取学历要求

    Args:
        text: 输入文本

    Returns:
        提取的学历要求
    """
    edu_patterns = [
        r'学历[要求]*[：:]\s*(本科|硕士|博士|大专|中专|高中|不限)',
        r'学历[：:]\s*(本科|硕士|博士|大专|中专|高中|不限)',
        r'要求[：:]\s*(本科|硕士|博士|大专|中专|高中|不限)',
    ]

    for pattern in edu_patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1)
    return ""


def _extract_job_type_from_text(text: str, default: str = "全职") -> str:
    """从文本中提取工作类型

    Args:
        text: 输入文本
        default: 默认值

    Returns:
        提取的工作类型
    """
    type_patterns = [
        r'工作类型[：:]\s*(全职|兼职|实习)',
        r'工作性质[：:]\s*(全职|兼职|实习)',
        r'职位类型[：:]\s*(全职|兼职|实习)',
    ]

    for pattern in type_patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1)
    return default


def _parse_detail_page(html_content: str, item_data: Dict, source_config: Dict, job_type: str = "全职") -> Dict:
    """通用详情页解析函数

    Args:
        html_content: HTML 内容
        item_data: 列表项数据
        source_config: 源配置
        job_type: 工作类型

    Returns:
        解析后的岗位数据
    """
    # 提取标题
    title_selectors = ['h1', 'h2.title', '.job-title', '.position-title', 'title']
    title = _extract_text_from_html(html_content, title_selectors, item_data.get('title', ''))

    # 提取描述
    description = _extract_description_from_html(html_content)

    # 提取薪资
    salary = _extract_salary_from_text(html_content)

    # 提取学历
    education = _extract_education_from_text(html_content)

    # 提取工作类型
    extracted_job_type = _extract_job_type_from_text(html_content, job_type)

    return {
        "title": title,
        "description": description,
        "salary": salary,
        "education": education,
        "job_type": extracted_job_type,
    }


def _parse_zjgsu_detail_page(html_content: str, item_data: Dict, job_type: str = "全职") -> Dict:
    """ZJGSU 详情页专用解析函数

    ZJGSU 详情页结构：
    - div.newDetails.editorConnect.ck-content - 完整描述
    - div.body > div.info - 基本信息（薪资、地点、学历、类型）
    - div.content > pre.text - 岗位职责和任职要求
    """
    from bs4 import BeautifulSoup

    try:
        soup = BeautifulSoup(html_content, 'html.parser')

        # 提取标题
        title = ""
        head_div = soup.select_one('div.head .table-item.name a')
        if head_div:
            title = head_div.get('title', '') or head_div.get_text(strip=True)
        if not title:
            title = item_data.get('zpzt', '')

        # 提取描述（从 ck-content 编辑器区域）
        description = ""
        ck_content = soup.select_one('div.newDetails.editorConnect.ck-content')
        if ck_content:
            description = ck_content.get_text(strip=True)

        # 提取基本信息
        info_items = soup.select('div.infoText .item')
        location = ""
        education = ""
        extracted_job_type = job_type
        salary = "面议"

        for item in info_items:
            text = item.get_text(strip=True)
            if '工作地点' in text:
                location = text.replace('工作地点：', '').replace('工作地点:', '').strip()
            elif '学历要求' in text:
                edu_text = text.replace('学历要求：', '').replace('学历要求:', '').strip()
                # 可能是 "硕士,本科" 格式，取第一个
                if ',' in edu_text or '，' in edu_text:
                    education = edu_text.split(',')[0].split('、')[0].strip()
                else:
                    education = edu_text
            elif '工作类型' in text:
                type_match = re.search(r'(全职|兼职|实习)', text)
                if type_match:
                    extracted_job_type = type_match.group(1)

        # 提取薪资（从 .table-item.name span 中）
        salary_span = soup.select_one('div.table-item.name span')
        if salary_span:
            salary_text = salary_span.get_text(strip=True)
            if salary_text and re.search(r'\d', salary_text):
                salary = salary_text

        # 提取岗位职责和任职要求（从 pre.text）
        requirement_parts = []
        pre_text = soup.select_one('div.content pre.text')
        if pre_text:
            requirement_parts.append(pre_text.get_text(strip=True))

        # 如果没有找到 pre.text，尝试从 newDetails 提取
        if not requirement_parts and description:
            requirement_parts.append(description)

        requirement = '\n'.join(requirement_parts)

        # 提取联系方式
        contact_info = []
        contact_patterns = [
            (r'联系人[：:]\s*(\S+)', '联系人'),
            (r'联系电话[：:]\s*([\d\-]+)', '联系电话'),
            (r'联系邮箱[：:]\s*([\w\.-]+@[\w\.-]+\.\w+)', '联系邮箱'),
            (r'联系邮件[：:]\s*([\w\.-]+@[\w\.-]+\.\w+)', '联系邮箱'),
            (r'[\w\.-]+@[\w\.-]+\.\w+', '联系邮箱'),
            (r'(?:电话|Tel)[：:]?\s*(\d[-\d]{7,})', '联系电话'),
        ]

        for pattern, label in contact_patterns:
            match = re.search(pattern, html_content)
            if match:
                contact_info.append(f"{label}：{match.group(1)}")

        return {
            "title": title,
            "description": description,
            "requirement": requirement,
            "location": location,
            "salary": salary,
            "education": education,
            "job_type": extracted_job_type,
            "contact_info": contact_info,
        }
    except Exception as e:
        logger.debug(f"ZJGSU详情页解析异常: {e}")
        return {
            "title": item_data.get('zpzt', ''),
            "description": "",
            "requirement": "",
            "location": "",
            "salary": "面议",
            "education": "",
            "job_type": job_type,
            "contact_info": [],
        }


def _parse_cueb_detail_page(html_content: str, item_data: Dict, job_type: str = "全职") -> Dict:
    """CUEB 详情页专用解析函数

    CUEB 详情页结构：
    - div.corp-detail-text - 岗位描述
    - div.corp-detail-box - 要求和联系方式
    """
    from bs4 import BeautifulSoup

    try:
        soup = BeautifulSoup(html_content, 'html.parser')

        # 提取标题
        title = item_data.get('title', '')
        title_elem = soup.select_one('h1, h2.title, .title')
        if title_elem:
            title = title_elem.get_text(strip=True) or title

        # 提取描述（从 corp-detail-text）
        description = ""
        detail_text = soup.select_one('div.corp-detail-text')
        if detail_text:
            description = detail_text.get_text(strip=True)

        # 提取要求和联系方式（从 corp-detail-box）
        requirement = ""
        contact_info = []
        education = ""

        detail_box = soup.select_one('div.corp-detail-box')
        if detail_box:
            box_text = detail_box.get_text('\n', strip=True)
            requirement = box_text

            # 从详情框中提取学历
            edu_match = re.search(r'(本科|硕士|博士|大专|中专|高中|不限)', box_text)
            if edu_match:
                education = edu_match.group(1)

            # 提取联系方式
            contact_patterns = [
                (r'联系人[：:]\s*(\S+)', '联系人'),
                (r'联系电话[：:]\s*([\d\-]+)', '联系电话'),
                (r'联系邮箱[：:]\s*([\w\.-]+@[\w\.-]+\.\w+)', '联系邮箱'),
                (r'[\w\.-]+@[\w\.-]+\.\w+', '联系邮箱'),
                (r'(?:电话|Tel)[：:]?\s*(\d[-\d]{7,})', '联系电话'),
            ]

            for pattern, label in contact_patterns:
                match = re.search(pattern, html_content)
                if match:
                    contact_info.append(f"{label}：{match.group(1)}")

        # 提取薪资
        salary = _extract_salary_from_text(html_content)

        return {
            "title": title,
            "description": description,
            "requirement": requirement,
            "salary": salary,
            "education": education,
            "job_type": job_type,
            "contact_info": contact_info,
        }
    except Exception as e:
        logger.debug(f"CUEB详情页解析异常: {e}")
        return {
            "title": item_data.get('title', ''),
            "description": "",
            "requirement": "",
            "salary": "面议",
            "education": "",
            "job_type": job_type,
            "contact_info": [],
        }


# ==================== ZJGSU 爬虫 ====================

def crawl_zjgsu(source_config: Dict, max_items: int = 0) -> Iterator[Dict]:
    """爬取 ZJGSU - 浙江工商大学（基于URL去重的增量爬取）

    增量策略：
    - 不记录页码，通过 URL 去重判断是否需要继续
    - 每页检查所有 URL 是否已存在，全部存在则停止爬取
    - 最多爬取 MAX_PAGES 页
    - 支持招聘信息(zpxx)和实习信息(sxzpxx)两个板块
    - 需要访问详情页获取完整岗位信息
    """
    source = "zjgsu"
    source_name = source_config["name"]
    base_url = source_config["base_url"]

    crawl_logger.log_source_start(source, source_name)

    count = 0

    sections = [
        {
            "list_url": "/career/zpxx/search/zpxx",
            "view_url_template": "/career/zpxx/view/zpxx/{item_id}",
            "referer": "/career/zpxx/zpxx",
            "job_type": "全职",
            "label": "招聘信息",
        },
        {
            "list_url": "/career/zpxx/search/sxzpxx",
            "view_url_template": "/career/zpxx/view/sxzpxx/{item_id}",
            "referer": "/career/zpxx/sxzpxx",
            "job_type": "实习",
            "label": "实习信息",
        },
    ]

    headers = {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
    }

    try:
        for section in sections:
            if max_items > 0 and count >= max_items:
                break

            list_url = urljoin(base_url, section["list_url"])

            # 探测第一页是否有数据
            probe_data = {"pageNo": "1", "pageSize": "10"}
            probe_headers = {**headers, "Referer": urljoin(base_url, section["referer"])}
            probe_resp = fetch_with_retry(list_url, method="POST", data=probe_data, headers=probe_headers)
            if not probe_resp:
                logger.info(f"[{section['label']}] 探测失败，跳过")
                continue
            try:
                probe_result = probe_resp.json()
                if probe_result.get("code") != 200:
                    logger.info(f"[{section['label']}] API异常，跳过")
                    continue
                probe_items = probe_result.get("data", {}).get("list", [])
                if not probe_items:
                    logger.info(f"[{section['label']}] 无数据，跳过")
                    continue
            except Exception:
                logger.info(f"[{section['label']}] 探测异常，跳过")
                continue

            logger.info(f"▶ 爬取板块: {section['label']}")
            page = 1

            while page <= MAX_PAGES:
                if max_items > 0 and count >= max_items:
                    logger.info(f"达到最大数量限制 ({max_items})，停止爬取")
                    break

                data = {"pageNo": str(page), "pageSize": "10"}
                request_headers = {**headers, "Referer": urljoin(base_url, section["referer"])}
                response = fetch_with_retry(list_url, method="POST", data=data, headers=request_headers)

                if not response:
                    logger.warning(f"[{section['label']}] 第 {page} 页列表获取失败，停止爬取")
                    break

                try:
                    result = response.json()
                    if result.get("code") != 200:
                        crawl_logger.log_error(source, Exception(f"API返回code={result.get('code')}"), f"{section['label']} 列表页 {page}")
                        break

                    items = result.get("data", {}).get("list", [])
                    if not items:
                        logger.debug(f"[{section['label']}] 第 {page} 页无数据，爬取结束")
                        break

                    logger.info(f"[{section['label']}] 第 {page} 页: 获取到 {len(items)} 条列表项")

                    # 检查当前页所有 URL 是否都已存在
                    if not OVERWRITE_MODE:
                        page_urls = [urljoin(base_url, section["view_url_template"].format(item_id=item.get('zpxxid')))
                                    for item in items if item.get('zpxxid')]
                        existing_count = sum(1 for url in page_urls if url_exists(url))

                        if existing_count == len(page_urls) and len(page_urls) > 0:
                            logger.info(f"[{section['label']}] 第 {page} 页所有 URL 已存在 ({existing_count}/{len(page_urls)})，停止爬取")
                            break

                    for item in items:
                        if max_items > 0 and count >= max_items:
                            break

                        item_id = item.get("zpxxid")
                        if not item_id:
                            continue

                        view_url = urljoin(base_url, section["view_url_template"].format(item_id=item_id))

                        if not OVERWRITE_MODE and url_exists(view_url):
                            continue

                        # 访问详情页获取完整信息
                        detail_response = fetch_with_retry(view_url)
                        if not detail_response:
                            continue

                        try:
                            # 使用 ZJGSU 专用解析函数
                            parsed = _parse_zjgsu_detail_page(
                                detail_response.text,
                                item,
                                section["job_type"]
                            )

                            # 提取基本信息
                            company = item.get('dwmc', '')
                            location = parsed["location"] or item.get('szxmc', '') or item.get('szsmc', '')
                            industry = item.get('hyyjmc', '')
                            company_type = item.get('xzyjmc', '')
                            company_size = item.get('rsgmmc', '')
                            publish_date = item.get('fbrq', '')
                            deadline = item.get('zpjzrq', '')
                            recruit_count = item.get('xqrsmc', '') or str(item.get('xqrs', ''))
                            contact_email = item.get('jltdyx', '')
                            views = item.get('djs', 0)

                            # 构造完整描述
                            description_parts = []

                            # 添加单位信息
                            extra_info = []
                            if company_type:
                                extra_info.append(f"单位性质: {company_type}")
                            if company_size:
                                extra_info.append(f"单位规模: {company_size}")
                            if recruit_count and recruit_count != "0":
                                extra_info.append(f"招聘人数: {recruit_count}")
                            if contact_email:
                                extra_info.append(f"简历投递邮箱: {contact_email}")
                            if views:
                                extra_info.append(f"浏览量: {views}")

                            if extra_info:
                                description_parts.append("【单位信息】\n" + "\n".join(extra_info))

                            # 添加岗位要求（从 pre.text）
                            if parsed["requirement"]:
                                description_parts.append("【岗位要求】\n" + parsed["requirement"])

                            # 添加描述内容
                            if parsed["description"]:
                                description_parts.append(parsed["description"])

                            # 添加联系方式
                            if parsed.get("contact_info"):
                                description_parts.append("【联系方式】\n" + "\n".join(parsed["contact_info"]))

                            full_description = "\n\n".join(description_parts)

                            job = {
                                "title": parsed["title"],
                                "company": company,
                                "location": location,
                                "salary": parsed["salary"],
                                "education": parsed["education"],
                                "industry": industry,
                                "description": truncate_text(full_description),
                                "publish_date": publish_date,
                                "deadline": deadline,
                                "job_type": parsed["job_type"],
                                "source": source,
                                "university": source_name,
                                "source_url": view_url,
                                "apply_url": view_url,
                            }

                            yield job
                            count += 1

                            if count % 20 == 0:
                                logger.info(f"  已完成: {count} 条")

                            time.sleep(DETAIL_DELAY)

                        except Exception as e:
                            crawl_logger.log_error(source, e, f"解析详情页: {view_url}")
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


def crawl_cueb(source_config: Dict, max_items: int = 0) -> Iterator[Dict]:
    """爬取 CUEB - 首都经济贸易大学（基于URL去重的增量爬取）

    增量策略：
    - 不记录页码，通过 URL 去重判断是否需要继续
    - 每页检查所有 URL 是否已存在，全部存在则停止爬取
    - 最多爬取 MAX_PAGES 页
    - 支持全职和实习两种岗位类型
    - 需要访问详情页获取完整岗位信息
    """
    source = "cueb"
    source_name = source_config["name"]
    base_url = source_config["base_url"]
    full_config = get_spider_config(source)
    list_api = full_config.get("list_api", "")

    crawl_logger.log_source_start(source, source_name)

    count = 0

    position_types = [
        {"type": "1", "job_type": "全职", "label": "全职岗位"},
        {"type": "2", "job_type": "实习", "label": "实习岗位"},
    ]

    headers = {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://jy.cueb.edu.cn/front/channel.jspa?channelId=764&parentId=625",
    }

    try:
        for pos_type in position_types:
            if max_items > 0 and count >= max_items:
                break

            # 探测第一页是否有数据
            probe_data = {"xxlx": pos_type["type"], "curPage": "1", "gzcs": "", "dwhydm": "", "dwxzdm": "", "dwmc": ""}
            probe_resp = fetch_with_retry(list_api, method="POST", data=probe_data, headers=headers)
            if not probe_resp:
                logger.info(f"[{pos_type['label']}] 探测失败，跳过")
                continue
            try:
                probe_result = probe_resp.json()
                if probe_result.get("msg") != "Y":
                    logger.info(f"[{pos_type['label']}] API异常，跳过")
                    continue
                probe_items = probe_result.get("data", [])
                if not probe_items:
                    logger.info(f"[{pos_type['label']}] 无数据，跳过")
                    continue
            except Exception:
                logger.info(f"[{pos_type['label']}] 探测异常，跳过")
                continue

            logger.info(f"▶ 爬取类型: {pos_type['label']}")
            page = 1

            while page <= MAX_PAGES:
                if max_items > 0 and count >= max_items:
                    logger.info(f"达到最大数量限制 ({max_items})，停止爬取")
                    break

                data = {
                    "xxlx": pos_type["type"],
                    "curPage": str(page),
                    "gzcs": "",
                    "dwhydm": "",
                    "dwxzdm": "",
                    "dwmc": ""
                }
                response = fetch_with_retry(list_api, method="POST", data=data, headers=headers)

                if not response:
                    logger.warning(f"[{pos_type['label']}] 第 {page} 页列表获取失败，停止爬取")
                    break

                try:
                    result = response.json()
                    if result.get("msg") != "Y":
                        crawl_logger.log_error(source, Exception(f"API返回msg={result.get('msg')}"), f"{pos_type['label']} 列表页 {page}")
                        break

                    items = result.get("data", [])
                    if not items:
                        logger.debug(f"[{pos_type['label']}] 第 {page} 页无数据，爬取结束")
                        break

                    logger.info(f"[{pos_type['label']}] 第 {page} 页: 获取到 {len(items)} 条列表项")

                    # 检查当前页所有 URL 是否都已存在
                    if not OVERWRITE_MODE:
                        page_urls = [f"https://jy.cueb.edu.cn/front/zpxx.jspa?tid={item.get('tid')}"
                                    for item in items if item.get('tid')]
                        existing_count = sum(1 for url in page_urls if url_exists(url))

                        if existing_count == len(page_urls) and len(page_urls) > 0:
                            logger.info(f"[{pos_type['label']}] 第 {page} 页所有 URL 已存在 ({existing_count}/{len(page_urls)})，停止爬取")
                            break

                    for item in items:
                        if max_items > 0 and count >= max_items:
                            break

                        tid = item.get("tid")
                        if not tid:
                            continue

                        view_url = f"https://jy.cueb.edu.cn/front/zpxx.jspa?tid={tid}"

                        if not OVERWRITE_MODE and url_exists(view_url):
                            continue

                        # 访问详情页获取完整信息
                        detail_response = fetch_with_retry(view_url)
                        if not detail_response:
                            continue

                        try:
                            # 使用 CUEB 专用解析函数
                            parsed = _parse_cueb_detail_page(
                                detail_response.text,
                                item,
                                pos_type["job_type"]
                            )

                            # 提取基本信息
                            company = item.get('dwmc', '')
                            location = item.get('dwszddm', '')
                            views = item.get('click', 0)

                            # 转换时间戳
                            create_time = item.get('createTime', 0)
                            if create_time:
                                import datetime
                                publish_date = datetime.datetime.fromtimestamp(create_time / 1000).strftime('%Y-%m-%d')
                            else:
                                publish_date = ''

                            # 构造完整描述
                            description_parts = []

                            # 添加信息
                            extra_info = []
                            if views:
                                extra_info.append(f"浏览量: {views}")

                            if extra_info:
                                description_parts.append("【信息】\n" + "\n".join(extra_info))

                            # 添加岗位要求
                            if parsed["requirement"]:
                                description_parts.append("【岗位要求】\n" + parsed["requirement"])

                            # 添加描述内容
                            if parsed["description"]:
                                description_parts.append(parsed["description"])

                            # 添加联系方式
                            if parsed.get("contact_info"):
                                description_parts.append("【联系方式】\n" + "\n".join(parsed["contact_info"]))

                            full_description = "\n\n".join(description_parts)

                            job = {
                                "title": parsed["title"],
                                "company": company,
                                "location": location,
                                "salary": parsed["salary"],
                                "education": parsed["education"],
                                "description": truncate_text(full_description),
                                "publish_date": publish_date,
                                "job_type": parsed["job_type"],
                                "source": source,
                                "university": source_name,
                                "source_url": view_url,
                                "apply_url": view_url,
                            }

                            yield job
                            count += 1

                            if count % 20 == 0:
                                logger.info(f"  已完成: {count} 条")

                            time.sleep(DETAIL_DELAY)

                        except Exception as e:
                            crawl_logger.log_error(source, e, f"解析详情页: {view_url}")
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


def _decode_zufe_embedded(html: str) -> str:
    """解码浙江财经大学页面中嵌入的压缩内容（unzip+Base64）

    才立方就业平台将列表和详情内容通过 pako 压缩 + Base64 编码嵌入页面 HTML，
    前端通过 JS 解码后替换 DOM 节点。此函数模拟该解码过程。

    支持两种嵌入格式：
    1. 列表页: .replaceWith(Base64.decode(unzip("...").substr(N)).substr(N))
    2. 详情页: .html(Base64.decode(unzip("...")))

    Args:
        html: 页面原始 HTML

    Returns:
        解码后的 HTML 内容，若无嵌入内容则返回空字符串
    """
    import base64 as _b64
    import zlib as _zlib

    # 格式1: replaceWith + substr 或 .html + substr
    match = re.search(
        r'(?:replaceWith|html)\(Base64\.decode\(unzip\("([^"]+)"\)\.substr\((\d+)\)\)\.substr\((\d+)\)',
        html
    )
    offset1 = 0
    offset2 = 0
    need_find_b64_start = False

    if match:
        encoded = match.group(1)
        offset1 = int(match.group(2))
        offset2 = int(match.group(3))
    else:
        # 格式2: Base64.decode(unzip("...")) - 无 substr
        match = re.search(r'Base64\.decode\(unzip\("([^"]+)"\)\)', html)
        if not match:
            return ""
        encoded = match.group(1)
        # 格式2 没有 substr 偏移，但解压后仍是 Base64 内容
        # 需要找到 Base64 内容的起始位置（跳过前缀填充）
        need_find_b64_start = True

    try:
        decoded = _b64.b64decode(encoded)
        decompressed = _zlib.decompress(decoded, 15)
        text = decompressed.decode('utf-8', errors='replace')

        if need_find_b64_start:
            # 格式2: 解压后是 Base64 内容，前面有填充字符
            # 找到第一个 Base64 字符的位置
            b64_start = 0
            for i, ch in enumerate(text):
                if ch in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/':
                    b64_start = i
                    break
            b64_text = text[b64_start:].strip()
        else:
            b64_text = text[offset1:].strip()

        b64_text = ''.join(b64_text.split())
        padding = 4 - len(b64_text) % 4
        if padding < 4:
            b64_text += '=' * padding

        content_bytes = _b64.b64decode(b64_text)
        content = content_bytes.decode('utf-8', errors='replace')

        if need_find_b64_start:
            # 格式2: 解码后的内容前面也有填充，找到 < 开始的位置
            html_start = content.find('<')
            if html_start > 0:
                content = content[html_start:]
        else:
            content = content[offset2:]

        return content
    except Exception as e:
        logger.debug(f"解码ZUFE嵌入内容失败: {e}")
        return ""


def _extract_email_from_text(text: str) -> str:
    """从文本中提取邮箱"""
    match = re.search(r'[\w.+-]+@[\w-]+\.[\w.-]+', text)
    return match.group(0) if match else ""


def _extract_phone_from_text(text: str) -> str:
    """从文本中提取电话号码"""
    patterns = [
        r'(?:联系电话|电话|联系方式|咨询)[：:\s]*(\d{3,4}[-\s]?\d{7,8})',
        r'(\d{3,4}[-\s]?\d{7,8})',
        r'(?:1[3-9]\d{9})',
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1) if match.lastindex else match.group(0)
    return ""


def crawl_zufe(source_config: Dict, max_items: int = 0, date_filter_months: int = 2) -> Iterator[Dict]:
    """爬取 ZUFE - 浙江财经大学（基于URL去重的增量爬取）

    浙江财经大学就业网站使用"才立方"平台，页面内容通过 pako 压缩 + Base64 编码
    嵌入 HTML 中，前端 JS 解码后渲染。本爬虫模拟该解码过程直接提取数据。

    两个板块：
    1. 校园招聘（campus）: 招聘公告列表 + 详情页
    2. 实习岗位（job）: 岗位列表 + 详情页，列表页包含薪资/地点/学历等元数据

    增量策略：
    - 通过 URL 去重判断是否需要继续
    - 每页检查所有 URL 是否已存在，全部存在则停止爬取
    - 最多爬取 MAX_PAGES 页
    - 检查发布时间，过期数据停止爬取
    """
    from bs4 import BeautifulSoup
    from datetime import datetime, timedelta

    source = "zufe"
    source_name = source_config["name"]
    base_url = source_config["base_url"]

    crawl_logger.log_source_start(source, source_name)

    count = 0
    cutoff_date = datetime.now() - timedelta(days=date_filter_months * 30)

    list_configs = [
        {
            "url_template": source_config.get("campus_list_url", ""),
            "page_suffix": "?page={page}",
            "job_type": "全职",
            "label": "校园招聘",
            "mode": "campus",
        },
        {
            "url_template": source_config.get("job_fulltime_list_url", ""),
            "page_suffix": "/page/{page}",
            "job_type": "全职",
            "label": "全职岗位",
            "mode": "job",
        },
        {
            "url_template": source_config.get("job_intern_list_url", ""),
            "page_suffix": "/page/{page}",
            "job_type": "实习",
            "label": "实习岗位",
            "mode": "job",
        },
    ]

    try:
        for list_config in list_configs:
            if max_items > 0 and count >= max_items:
                break

            base_list_url = list_config["url_template"]
            if not base_list_url:
                continue

            logger.info(f"▶ 爬取板块: {list_config['label']}")
            page = 1

            while page <= MAX_PAGES:
                if max_items > 0 and count >= max_items:
                    logger.info(f"达到最大数量限制 ({max_items})，停止爬取")
                    break

                if page == 1:
                    list_url = base_list_url
                else:
                    list_url = base_list_url.rstrip('/') + list_config["page_suffix"].format(page=page)

                response = fetch_with_retry(list_url)
                if not response:
                    logger.warning(f"[{list_config['label']}] 第 {page} 页列表获取失败，停止爬取")
                    break

                try:
                    # 解码嵌入的列表内容
                    embedded_html = _decode_zufe_embedded(response.text)
                    if not embedded_html:
                        logger.debug(f"[{list_config['label']}] 第 {page} 页无嵌入内容，爬取结束")
                        break

                    soup = BeautifulSoup(embedded_html, 'html.parser')

                    if list_config["mode"] == "campus":
                        items = soup.select('ul.infoList')
                    else:
                        items = soup.select('div.job-box ul.list > li')

                    if not items:
                        logger.debug(f"[{list_config['label']}] 第 {page} 页无数据，爬取结束")
                        break

                    logger.info(f"[{list_config['label']}] 第 {page} 页: 获取到 {len(items)} 条列表项")

                    # URL 去重检查
                    if not OVERWRITE_MODE:
                        page_urls = []
                        if list_config["mode"] == "campus":
                            for item in items:
                                a = item.select_one('li.span7 a')
                                if not a:
                                    a = item.find('a', href=True)
                                if a and a.get('href'):
                                    page_urls.append(urljoin(base_url, a['href']))
                        else:
                            for item in items:
                                a = item.select_one('div.name a')
                                if a and a.get('href'):
                                    page_urls.append(urljoin(base_url, a['href']))

                        existing_count = sum(1 for url in page_urls if url_exists(url))
                        if existing_count == len(page_urls) and len(page_urls) > 0:
                            logger.info(f"[{list_config['label']}] 第 {page} 页所有 URL 已存在 ({existing_count}/{len(page_urls)})，停止爬取")
                            break

                    should_stop = False

                    for item in items:
                        if max_items > 0 and count >= max_items:
                            break

                        list_config_override_job_type = None

                        # 提取列表项信息
                        if list_config["mode"] == "campus":
                            a_tag = item.select_one('li.span7 a')
                            if not a_tag:
                                a_tag = item.find('a', href=True)
                            date_tag = item.select_one('li.span4')
                            if not a_tag or not a_tag.get('href'):
                                continue
                            title = a_tag.get_text(strip=True)
                            detail_path = a_tag['href']
                            publish_date_str = ""
                            if date_tag:
                                date_match = re.search(r'(\d{4}-\d{2}-\d{2})', date_tag.get_text())
                                if date_match:
                                    publish_date_str = date_match.group(1)
                            company = ""
                            salary = "面议"
                            location = ""
                            education = ""
                        else:
                            # job 模式
                            name_div = item.select_one('div.name')
                            company_div = item.select_one('div.company')
                            salary_div = item.select_one('div.salary')

                            if not name_div:
                                continue
                            a_tag = name_div.find('a', href=True)
                            if not a_tag or not a_tag.get('href'):
                                continue
                            title = a_tag.get('title', '') or a_tag.get_text(strip=True)
                            detail_path = a_tag['href']

                            # 发布时间
                            span = name_div.find('span')
                            publish_date_str = ""
                            if span:
                                date_match = re.search(r'(\d{4}-\d{2}-\d{2})', span.get_text())
                                if date_match:
                                    publish_date_str = date_match.group(1)

                            # 公司
                            company = ""
                            if company_div:
                                company_a = company_div.find('a')
                                if company_a:
                                    company = company_a.get_text(strip=True)

                            # 薪资、地点、学历
                            salary_text = "面议"
                            location = ""
                            education = ""
                            if salary_div:
                                p_salary = salary_div.find('p')
                                if p_salary:
                                    salary_text = p_salary.get_text(strip=True)
                                lis = salary_div.select('ul li')
                                # lis[0]=地点, lis[1]=工作类型(全职/实习), lis[2]=学历
                                if len(lis) >= 1:
                                    location = lis[0].get_text(strip=True)
                                if len(lis) >= 2:
                                    type_text = lis[1].get_text(strip=True)
                                    if type_text in ('全职', '实习'):
                                        # lis[1] 是工作类型，覆盖列表配置的默认值
                                        list_config_override_job_type = type_text
                                if len(lis) >= 3:
                                    edu_text = lis[2].get_text(strip=True)
                                    if edu_text not in ('不限', ''):
                                        education = edu_text
                            salary = salary_text

                        # 日期过滤
                        if publish_date_str:
                            try:
                                pub_date = datetime.strptime(publish_date_str, '%Y-%m-%d')
                                if pub_date < cutoff_date:
                                    logger.info(f"遇到过期数据 ({publish_date_str})，停止爬取")
                                    should_stop = True
                                    break
                            except ValueError:
                                pass

                        detail_url = urljoin(base_url, detail_path)

                        if not OVERWRITE_MODE and url_exists(detail_url):
                            continue

                        # 访问详情页
                        detail_response = fetch_with_retry(detail_url)
                        if not detail_response:
                            continue

                        try:
                            # 提取详情页元数据
                            detail_soup = BeautifulSoup(detail_response.text, 'html.parser')

                            # 从详情页提取更多信息
                            description = ""
                            contact_email = ""
                            contact_phone = ""

                            # 解码嵌入的详情内容
                            embedded_detail = _decode_zufe_embedded(detail_response.text)
                            if embedded_detail:
                                detail_content_soup = BeautifulSoup(embedded_detail, 'html.parser')
                                description = detail_content_soup.get_text(strip=True)

                            # 如果是 campus 模式，从详情页提取公司名
                            if list_config["mode"] == "campus" and not company:
                                company_a = detail_soup.select_one('a.name')
                                if company_a:
                                    company = company_a.get_text(strip=True)

                            # 从详情页提取联系方式
                            full_text = detail_soup.get_text()
                            if not description:
                                # 如果嵌入内容解码失败，尝试从页面其他区域提取
                                info_div = detail_soup.select_one('div.info')
                                if info_div:
                                    description = info_div.get_text(strip=True)

                            # 从描述文本中提取邮箱和电话
                            search_text = description or full_text
                            contact_email = _extract_email_from_text(search_text)
                            contact_phone = _extract_phone_from_text(search_text)

                            # 从详情页提取学历（如果列表页没有）
                            if not education:
                                education = _extract_education_from_text(search_text)

                            # 构建描述
                            description_parts = []
                            if description:
                                # 清理描述文本
                                cleaned_desc = re.sub(r'\s+', ' ', description).strip()
                                description_parts.append(cleaned_desc[:2000])

                            if contact_email:
                                description_parts.append(f"联系邮箱: {contact_email}")
                            if contact_phone:
                                description_parts.append(f"联系电话: {contact_phone}")

                            full_description = '\n'.join(description_parts)

                            job = {
                                "title": title,
                                "company": company,
                                "location": location or source_config.get("location", "杭州"),
                                "salary": salary,
                                "education": education,
                                "description": truncate_text(full_description),
                                "publish_date": publish_date_str,
                                "job_type": list_config_override_job_type or list_config["job_type"],
                                "source": source,
                                "university": source_name,
                                "source_url": detail_url,
                                "apply_url": detail_url,
                            }

                            yield job
                            count += 1

                            if count % 10 == 0:
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


def crawl_91job(source_config: Dict, max_items: int = 0, date_filter_months: int = 2) -> Iterator[Dict]:
    """爬取91job平台 - 通用爬虫（基于URL去重的增量爬取）

    91job平台（如南京审计大学）使用统一API接口，POST请求获取岗位列表。
    列表API返回的zwms字段包含完整岗位详情（JSON字符串），无需请求详情页。

    增量策略：
    - 通过 URL 去重判断是否需要继续
    - 每页检查所有 URL 是否已存在，全部存在则停止爬取
    - 最多爬取 MAX_PAGES 页
    - 检查发布时间，过期数据停止爬取
    """
    import json as _json
    from datetime import datetime, timedelta

    source = source_config.get("source_id", "nau")
    source_name = source_config["name"]
    base_url = source_config["base_url"]
    xxdm = source_config.get("xxdm", "")
    lmid = source_config.get("lmid", "")
    list_api = source_config.get("list_api", "")
    referer = source_config.get("referer", "")
    default_location = source_config.get("location", "")

    crawl_logger.log_source_start(source, source_name)

    count = 0
    cutoff_date = datetime.now() - timedelta(days=date_filter_months * 30)
    page_size = 10

    headers = {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Content-Type": "application/json",
        "Referer": referer,
    }

    try:
        page = 1

        while page <= MAX_PAGES:
            if max_items > 0 and count >= max_items:
                logger.info(f"达到最大数量限制 ({max_items})，停止爬取")
                break

            payload = {
                "current": page,
                "size": page_size,
                "xxdm": xxdm,
                "lmid": lmid,
                "sjly": "Z",
                "dwgm": "",
                "dwxz": "",
                "fbsj": "",
                "jssj": "",
                "keyword": "",
                "kssj": "",
                "ssqy": "",
                "xlyq": "",
                "nxsx": "",
                "nxxx": "",
                "xqzy": "",
            }

            response = fetch_with_retry(list_api, method="POST", json=payload, headers=headers)

            if not response:
                logger.warning(f"第 {page} 页列表获取失败，停止爬取")
                break

            try:
                result = response.json()
                if not result.get("success") or result.get("code") != 200:
                    crawl_logger.log_error(source, Exception(f"API返回code={result.get('code')}"), f"列表页 {page}")
                    break

                records = result.get("result", {}).get("records", [])
                if not records:
                    logger.debug(f"第 {page} 页无数据，爬取结束")
                    break

                logger.info(f"第 {page} 页: 获取到 {len(records)} 条列表项")

                # 检查当前页所有 URL 是否都已存在
                if not OVERWRITE_MODE:
                    page_urls = [f"{base_url}/zpgw/{item.get('zpgwid')}"
                                for item in records if item.get('zpgwid')]
                    existing_count = sum(1 for url in page_urls if url_exists(url))

                    if existing_count == len(page_urls) and len(page_urls) > 0:
                        logger.info(f"第 {page} 页所有 URL 已存在 ({existing_count}/{len(page_urls)})，停止爬取")
                        break

                for item in records:
                    if max_items > 0 and count >= max_items:
                        break

                    zpgwid = item.get("zpgwid")
                    if not zpgwid:
                        continue

                    job_url = f"{base_url}/zpgw/{zpgwid}"

                    if not OVERWRITE_MODE and url_exists(job_url):
                        continue

                    # 解析 zwms 字段（JSON字符串，包含完整详情）
                    description_parts = []
                    zwms_str = item.get("zwms", "")
                    if zwms_str:
                        try:
                            zwms = _json.loads(zwms_str)
                            gwzz = zwms.get("gwzz", "")
                            rzzg = zwms.get("rzzg", "")
                            xzfl = zwms.get("xzfl", "")
                            if gwzz:
                                description_parts.append(f"【岗位职责】\n{gwzz}")
                            if rzzg:
                                description_parts.append(f"【任职资格】\n{rzzg}")
                            if xzfl:
                                description_parts.append(f"【薪资福利】\n{xzfl}")
                        except (_json.JSONDecodeError, TypeError):
                            # zwms 不是有效JSON，直接作为描述
                            if zwms_str:
                                description_parts.append(zwms_str)

                    full_description = "\n\n".join(description_parts)

                    # 解析发布时间
                    zwsxrq = item.get("zwsxrq", "")
                    publish_date = ""
                    if zwsxrq:
                        try:
                            dt = datetime.strptime(zwsxrq, "%Y-%m-%d %H:%M:%S")
                            publish_date = dt.strftime("%Y-%m-%d")
                            # 检查是否过期
                            if dt < cutoff_date:
                                logger.debug(f"岗位已过期: {item.get('zwmc', '')} [{publish_date}]")
                                continue
                        except ValueError:
                            publish_date = zwsxrq[:10] if len(zwsxrq) >= 10 else ""

                    company = item.get("dwmc", "")
                    location = item.get("gzdd", "") or default_location
                    education = item.get("xlyq", "")
                    dwxz = item.get("dwxz", "")
                    dwhy = item.get("dwhy", "")
                    zprs = item.get("zprs", 0)

                    # 补充企业信息到描述
                    extra_parts = []
                    if dwxz:
                        extra_parts.append(f"企业性质: {dwxz}")
                    if dwhy:
                        extra_parts.append(f"行业: {dwhy}")
                    if zprs:
                        extra_parts.append(f"招聘人数: {zprs}")
                    if extra_parts:
                        full_description = "【企业信息】\n" + "\n".join(extra_parts) + "\n\n" + full_description

                    job = {
                        "title": item.get("zwmc", ""),
                        "company": company,
                        "location": location,
                        "salary": "",
                        "education": education,
                        "description": truncate_text(full_description),
                        "publish_date": publish_date,
                        "job_type": "全职",
                        "source": source,
                        "university": source_name,
                        "source_url": job_url,
                        "apply_url": job_url,
                    }

                    yield job
                    count += 1

                    if count % 10 == 0:
                        logger.info(f"  已完成: {count} 条")

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


def crawl_bytedance(source_config: Dict, max_items: int = 0, date_filter_months: int = 2) -> Iterator[Dict]:
    """爬取字节跳动招聘（基于URL去重的增量爬取）

    字节跳动招聘网站使用 CSRF Token 机制保护 API，
    需要先获取 Token，再通过搜索 API 分页获取岗位列表。

    两个板块：
    1. 社招 (portal_type=2)
    2. 校招 (portal_type=1)

    增量策略：
    - 通过 URL 去重判断是否需要继续
    - 每页检查所有 URL 是否已存在，全部存在则停止爬取
    - 最多爬取 MAX_PAGES 页
    - 检查发布时间，过期数据停止爬取
    """
    from urllib.parse import unquote
    from datetime import datetime, timedelta

    source = "bytedance"
    source_name = source_config["name"]
    base_url = source_config["base_url"]

    crawl_logger.log_source_start(source, source_name)

    count = 0
    cutoff_date = datetime.now() - timedelta(days=date_filter_months * 30)

    csrf_token_url = "https://jobs.bytedance.com/api/v1/csrf/token"
    search_api_url = "https://jobs.bytedance.com/api/v1/search/job/posts"

    sections = [
        {"portal_type": 2, "label": "社招", "job_type": "全职"},
        {"portal_type": 1, "label": "校招", "job_type": "校招"},
    ]

    session = requests.Session()
    session.headers.update(_get_random_headers())

    try:
        # 第一步：获取 CSRF Token
        logger.info("▶ 获取字节跳动 CSRF Token...")
        csrf_response = None
        for attempt in range(MAX_RETRIES):
            try:
                csrf_response = session.post(csrf_token_url, timeout=30)
                if csrf_response.status_code == 200:
                    break
                logger.warning(f"CSRF Token 请求返回 {csrf_response.status_code}，重试...")
                time.sleep(2 ** attempt + _random.uniform(1.0, 3.0))
            except requests.exceptions.RequestException as e:
                logger.warning(f"CSRF Token 请求异常: {type(e).__name__}: {e}")
                if attempt < MAX_RETRIES - 1:
                    time.sleep(2 ** attempt + _random.uniform(1.0, 3.0))

        if not csrf_response or csrf_response.status_code != 200:
            logger.error("获取 CSRF Token 失败，停止爬取")
            return

        # 从 cookie 中提取 atsx-csrf-token，需要 URL 解码
        csrf_token = ""
        for cookie in session.cookies:
            if cookie.name == "atsx-csrf-token":
                csrf_token = unquote(cookie.value)
                break

        if not csrf_token:
            logger.error("未从 cookie 中找到 atsx-csrf-token，停止爬取")
            return

        logger.info(f"✓ CSRF Token 获取成功: {csrf_token[:20]}...")

        # 第二步：分页请求岗位搜索 API
        for section in sections:
            if max_items > 0 and count >= max_items:
                break

            portal_type = section["portal_type"]
            label = section["label"]
            default_job_type = section["job_type"]

            logger.info(f"▶ 爬取板块: {label}")
            offset = 0
            limit = 10

            while offset < MAX_PAGES * limit:
                if max_items > 0 and count >= max_items:
                    logger.info(f"达到最大数量限制 ({max_items})，停止爬取")
                    break

                payload = {
                    "job_category_id_list": [],
                    "keyword": "",
                    "limit": limit,
                    "location_code_list": [],
                    "offset": offset,
                    "portal_entrance": 1,
                    "portal_type": portal_type,
                    "recruitment_id_list": [],
                    "subject_id_list": [],
                }

                headers = {
                    "Content-Type": "application/json",
                    "x-csrf-token": csrf_token,
                    "Referer": "https://jobs.bytedance.com/",
                }

                response = None
                for attempt in range(MAX_RETRIES):
                    try:
                        response = session.post(search_api_url, json=payload, headers=headers, timeout=30)
                        if response.status_code == 200:
                            break
                        logger.warning(f"[{label}] 搜索 API 返回 {response.status_code}，重试...")
                        time.sleep(2 ** attempt + _random.uniform(1.0, 3.0))
                    except requests.exceptions.RequestException as e:
                        logger.warning(f"[{label}] 搜索 API 请求异常: {type(e).__name__}: {e}")
                        if attempt < MAX_RETRIES - 1:
                            time.sleep(2 ** attempt + _random.uniform(1.0, 3.0))

                if not response or response.status_code != 200:
                    logger.warning(f"[{label}] offset={offset} 请求失败，停止爬取")
                    break

                try:
                    data = response.json()
                except (ValueError, json.JSONDecodeError) as e:
                    logger.warning(f"[{label}] offset={offset} JSON 解析失败: {e}")
                    break

                job_post_list = data.get("data", {}).get("job_post_list", [])
                if not job_post_list:
                    logger.debug(f"[{label}] offset={offset} 无数据，爬取结束")
                    break

                logger.info(f"[{label}] offset={offset}: 获取到 {len(job_post_list)} 条岗位")

                # URL 去重检查
                if not OVERWRITE_MODE:
                    page_urls = []
                    for post in job_post_list:
                        post_id = post.get("id", "")
                        if post_id:
                            page_urls.append(f"{base_url}/referral/pc/position/detail?id={post_id}")

                    existing_count = sum(1 for url in page_urls if url_exists(url))
                    if existing_count == len(page_urls) and len(page_urls) > 0:
                        logger.info(f"[{label}] offset={offset} 所有 URL 已存在 ({existing_count}/{len(page_urls)})，停止爬取")
                        break

                should_stop = False

                for post in job_post_list:
                    if max_items > 0 and count >= max_items:
                        break

                    post_id = post.get("id", "")
                    if not post_id:
                        continue

                    detail_url = f"{base_url}/referral/pc/position/detail?id={post_id}"

                    # URL 去重
                    if not OVERWRITE_MODE and url_exists(detail_url):
                        continue

                    title = post.get("title", "")
                    # 城市信息在 city_info 嵌套对象中
                    city_info = post.get("city_info", {})
                    city_name = city_info.get("name", "") if isinstance(city_info, dict) else ""
                    if not city_name:
                        # 备选：从 city_list 中取第一个
                        city_list = post.get("city_list", [])
                        if city_list and isinstance(city_list, list):
                            city_name = city_list[0].get("name", "")
                    description_html = post.get("description", "")
                    requirement_html = post.get("requirement", "")
                    publish_time = post.get("publish_time", "")
                    recruit_type_obj = post.get("recruit_type", {})

                    # 解析发布时间（publish_time 为毫秒时间戳）
                    publish_date_str = ""
                    if publish_time:
                        try:
                            if isinstance(publish_time, (int, float)):
                                pub_date = datetime.fromtimestamp(publish_time / 1000)
                                publish_date_str = pub_date.strftime("%Y-%m-%d")
                            else:
                                publish_date_str = str(publish_time)[:10]
                        except (ValueError, OSError, OverflowError):
                            pass

                    # 日期过滤
                    if publish_date_str:
                        try:
                            pub_date = datetime.strptime(publish_date_str, '%Y-%m-%d')
                            if pub_date < cutoff_date:
                                logger.info(f"遇到过期数据 ({publish_date_str})，停止爬取")
                                should_stop = True
                                break
                        except ValueError:
                            pass

                    # 清理 HTML 描述
                    description = ""
                    desc_parts = []
                    if description_html:
                        try:
                            from bs4 import BeautifulSoup
                            desc_soup = BeautifulSoup(description_html, 'html.parser')
                            desc_parts.append("【岗位职责】\n" + desc_soup.get_text(separator='\n', strip=True))
                        except Exception:
                            cleaned = re.sub(r'<[^>]+>', '', description_html)
                            if cleaned.strip():
                                desc_parts.append("【岗位职责】\n" + cleaned.strip())
                    if requirement_html:
                        try:
                            from bs4 import BeautifulSoup
                            req_soup = BeautifulSoup(requirement_html, 'html.parser')
                            desc_parts.append("【任职要求】\n" + req_soup.get_text(separator='\n', strip=True))
                        except Exception:
                            cleaned = re.sub(r'<[^>]+>', '', requirement_html)
                            if cleaned.strip():
                                desc_parts.append("【任职要求】\n" + cleaned.strip())
                    description = "\n\n".join(desc_parts)

                    # 判断 job_type（recruit_type 是嵌套对象）
                    job_type = default_job_type
                    if isinstance(recruit_type_obj, dict):
                        parent = recruit_type_obj.get("parent", {})
                        if isinstance(parent, dict):
                            parent_name = parent.get("name", "")
                            if "校招" in parent_name:
                                job_type = "校招"
                            elif "社招" in parent_name:
                                job_type = "全职"

                    job = {
                        "title": title,
                        "company": "字节跳动",
                        "location": city_name,
                        "salary": "面议",
                        "education": "",
                        "description": truncate_text(description),
                        "publish_date": publish_date_str,
                        "job_type": job_type,
                        "source": source,
                        "university": source_name,
                        "source_url": detail_url,
                        "apply_url": detail_url,
                    }

                    yield job
                    count += 1

                    if count % 10 == 0:
                        logger.info(f"  已完成: {count} 条")

                    time.sleep(DETAIL_DELAY)

                if should_stop:
                    break

                offset += limit
                time.sleep(_random.uniform(1.0, 2.5))

    except KeyboardInterrupt:
        logger.warning("用户中断爬取")
    except Exception as e:
        crawl_logger.log_error(source, e, "爬取过程异常")
    finally:
        save_crawl_state(source, 0, count, extra='{}')

    crawl_logger.log_source_end(source, source_name, count)


def crawl_yunjiuye(source_config: Dict, max_items: int = 0, date_filter_months: int = 2) -> Iterator[Dict]:
    """爬取云就业平台 (bysjy.com.cn / bibibi.net) 通用爬虫

    支持所有基于云就业平台的高校就业网站，如：
    - 天津财经大学 (tjufe): https://tjufe.bysjy.com.cn
    - 广东财经大学 (gdufe): http://gdcj.bibibi.net
    - 江西财经大学 (jxufe): http://career.jxufe.edu.cn

    API端点（通用）:
    - 在线招聘总数: GET {base_url}/module/getonlines?is_total=1&start=0&count=0
    - 在线招聘列表: GET {base_url}/module/getonlines?start_page={page}&start=0&count=15
    - 宣讲会总数: GET {base_url}/module/getcareers?is_total=1&start=0&count=0&k=&panel_name=&type=inner&day=&panel_id=&professionals=&work_city=&is_yun_career=
    - 宣讲会列表: GET {base_url}/module/getcareers?start_page={page}&start=1&count=15&k=&panel_name=&type=inner&day=&panel_id=&professionals=&work_city=&is_yun_career=

    增量策略：
    - 通过 URL 去重判断是否需要继续
    - 每页检查所有 URL 是否已存在，全部存在则停止爬取
    - 最多爬取 MAX_PAGES 页
    - 检查发布时间，过期数据停止爬取
    """
    from datetime import datetime, timedelta
    import json as _json
    base_url = source_config["base_url"]
    source_name = source_config["name"]
    default_location = source_config.get("location", "")

    # 从 HTTP_SOURCES 反查 source key
    source = ""
    for key, cfg in HTTP_SOURCES.items():
        if cfg.get("base_url") == base_url and cfg.get("spider_type") == "yunjiuye":
            source = key
            break
    if not source:
        source = "yunjiuye"

    crawl_logger.log_source_start(source, source_name)

    count = 0
    cutoff_date = datetime.now() - timedelta(days=date_filter_months * 30)

    list_configs = [
        {
            "api_path": "/module/getonlines",
            "params_template": "start_page={page}&start=0&count=15",
            "total_params": "is_total=1&start=0&count=0",
            "data_key": "data",
            "id_field": "recruitment_id",
            "label": "在线招聘",
            "job_type": "全职",
        },
        {
            "api_path": "/module/getcareers",
            "params_template": "start_page={page}&start=1&count=15&k=&panel_name=&type=inner&day=&panel_id=&professionals=&work_city=&is_yun_career=",
            "total_params": "is_total=1&start=0&count=0&k=&panel_name=&type=inner&day=&panel_id=&professionals=&work_city=&is_yun_career=",
            "data_key": "data",
            "id_field": "career_talk_id",
            "label": "宣讲会",
            "job_type": "宣讲会",
        },
    ]

    try:
        for list_config in list_configs:
            if max_items > 0 and count >= max_items:
                break

            api_path = list_config["api_path"]
            label = list_config["label"]
            default_job_type = list_config["job_type"]
            id_field = list_config["id_field"]

            # 获取总数
            total_url = f"{base_url}{api_path}?{list_config['total_params']}"
            total_resp = fetch_with_retry(total_url)
            total_count = 0
            if total_resp:
                try:
                    total_data = total_resp.json()
                    total_count = total_data.get("data", 0)
                    logger.info(f"[{label}] 总数: {total_count}")
                except (ValueError, json.JSONDecodeError):
                    logger.warning(f"[{label}] 获取总数失败")

            logger.info(f"▶ 爬取板块: {label}")

            page = 1

            while page <= MAX_PAGES:
                if max_items > 0 and count >= max_items:
                    logger.info(f"达到最大数量限制 ({max_items})，停止爬取")
                    break

                list_url = f"{base_url}{api_path}?{list_config['params_template'].format(page=page)}"

                response = fetch_with_retry(list_url)
                if not response:
                    logger.warning(f"[{label}] 第 {page} 页列表获取失败，停止爬取")
                    break

                try:
                    result = response.json()
                except (ValueError, json.JSONDecodeError) as e:
                    logger.warning(f"[{label}] 第 {page} 页 JSON 解析失败: {e}")
                    break

                items = result.get("data", [])
                if not items:
                    logger.debug(f"[{label}] 第 {page} 页无数据，爬取结束")
                    break

                if not isinstance(items, list):
                    logger.warning(f"[{label}] 第 {page} 页返回数据格式异常 (非列表)，停止爬取")
                    break

                logger.info(f"[{label}] 第 {page} 页: 获取到 {len(items)} 条")

                # URL 去重检查
                if not OVERWRITE_MODE:
                    page_urls = []
                    for item in items:
                        item_id = item.get(id_field, "")
                        if item_id:
                            page_urls.append(f"{base_url}/module/recruitmentinfo/detail?recruitment_id={item_id}")
                    existing_count = sum(1 for url in page_urls if url_exists(url))
                    if existing_count == len(page_urls) and len(page_urls) > 0:
                        logger.info(f"[{label}] 第 {page} 页所有 URL 已存在 ({existing_count}/{len(page_urls)})，停止爬取")
                        break

                should_stop = False

                for item in items:
                    if max_items > 0 and count >= max_items:
                        break

                    item_id = item.get(id_field, "")
                    if not item_id:
                        continue

                    # 构建详情URL
                    if id_field == "recruitment_id":
                        detail_url = f"{base_url}/module/recruitmentinfo/detail?recruitment_id={item_id}"
                    else:
                        detail_url = f"{base_url}/module/careertalks/detail?career_talk_id={item_id}"

                    # URL 去重
                    if not OVERWRITE_MODE and url_exists(detail_url):
                        continue

                    # 提取字段
                    title = item.get("title", "") or item.get("meet_name", "")
                    company = item.get("company_name", "")
                    location = item.get("work_city", "") or item.get("city_name", "") or default_location
                    create_time = item.get("create_time", "") or item.get("meet_day", "")
                    description = item.get("content", "")

                    # 解析发布时间
                    publish_date_str = ""
                    if create_time:
                        try:
                            if isinstance(create_time, (int, float)):
                                pub_date = datetime.fromtimestamp(create_time / 1000)
                                publish_date_str = pub_date.strftime("%Y-%m-%d")
                            else:
                                publish_date_str = str(create_time)[:10]
                        except (ValueError, OSError, OverflowError):
                            pass

                    # 日期过滤
                    if publish_date_str:
                        try:
                            pub_date = datetime.strptime(publish_date_str, '%Y-%m-%d')
                            if pub_date < cutoff_date:
                                logger.info(f"遇到过期数据 ({publish_date_str})，停止爬取")
                                should_stop = True
                                break
                        except ValueError:
                            pass

                    # 清理 HTML 描述
                    if description:
                        try:
                            from bs4 import BeautifulSoup
                            desc_soup = BeautifulSoup(description, 'html.parser')
                            description = desc_soup.get_text(separator='\n', strip=True)
                        except Exception:
                            description = re.sub(r'<[^>]+>', '', description)

                    # 构建描述补充信息
                    desc_parts = []
                    if description:
                        desc_parts.append(description[:2000])

                    professionals = item.get("professionals", "")
                    if professionals:
                        desc_parts.append(f"专业要求: {professionals}")

                    recruitment_num = item.get("recruitment_num", "")
                    if recruitment_num:
                        desc_parts.append(f"招聘人数: {recruitment_num}")

                    # 宣讲会特有字段
                    meet_time = item.get("meet_time", "")
                    meet_end_time = item.get("meet_end_time", "")
                    address = item.get("address", "")
                    if meet_time:
                        time_info = f"时间: {meet_time}"
                        if meet_end_time:
                            time_info += f" - {meet_end_time}"
                        desc_parts.append(time_info)
                    if address:
                        desc_parts.append(f"地点: {address}")

                    company_property = item.get("company_property", "")
                    if company_property:
                        desc_parts.append(f"企业性质: {company_property}")

                    scale = item.get("scale", "")
                    if scale:
                        desc_parts.append(f"企业规模: {scale}")

                    industry_category = item.get("industry_category", "")
                    if industry_category:
                        desc_parts.append(f"行业: {industry_category}")

                    full_description = '\n'.join(desc_parts)

                    # 判断 job_type
                    job_type = default_job_type
                    recruit_type = item.get("recruit_type", "")
                    if recruit_type:
                        recruit_type_str = str(recruit_type)
                        if recruit_type_str in ("1", "校招"):
                            job_type = "校招"
                        elif recruit_type_str in ("2", "社招"):
                            job_type = "全职"

                    # 学历要求
                    education = ""
                    is_above_bachelor = item.get("is_above_bachelor_degree", "")
                    if is_above_bachelor:
                        education = "本科及以上"

                    job = {
                        "title": title,
                        "company": company,
                        "location": location,
                        "salary": "面议",
                        "education": education,
                        "description": truncate_text(full_description),
                        "publish_date": publish_date_str,
                        "job_type": job_type,
                        "source": source,
                        "university": source_name,
                        "source_url": detail_url,
                        "apply_url": detail_url,
                    }

                    yield job
                    count += 1

                    if count % 10 == 0:
                        logger.info(f"  已完成: {count} 条")

                    time.sleep(DETAIL_DELAY)

                if should_stop:
                    break

                page += 1
                time.sleep(_random.uniform(1.0, 2.5))

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


AI_FALLBACK_MODELS = [
    'glm-4.7-flash',
    'glm-4-flash-250414',
    'glm-4.5-air',
    'glm-4.7',
    'glm-4.6v-flash',
    'glm-4.1v-thinking-flash',
    'glm-4.6v',
]
AI_TIMEOUT = 120


def call_zhipu_ai_with_fallback(messages: list, primary_model: str = "glm-4.7-flash") -> dict:
    """调用智谱AI API，支持模型降级链

    Args:
        messages: 消息列表 [{role: "system"|"user", content: "..."}]
        primary_model: 主模型名称

    Returns:
        AI响应的JSON字典
    """
    import json as _json

    api_key = os.environ.get("ZHIPU_API_KEY", "")
    if not api_key:
        raise ValueError("未配置 ZHIPU_API_KEY，请在 .env 文件中设置")

    url = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    models = [primary_model] + [m for m in AI_FALLBACK_MODELS if m != primary_model]

    last_error = None

    for i, model in enumerate(models):
        data = {
            "model": model,
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": 8192
        }

        logger.debug(f"  调用智谱AI API: {model} ({i + 1}/{len(models)})")
        try:
            response = requests.post(url, headers=headers, json=data, timeout=AI_TIMEOUT)

            if response.status_code == 200:
                result = response.json()
                if i > 0:
                    logger.info(f"  AI fallback: 使用备用模型 {model} 成功 (主模型 {models[0]} 不可用)")
                return result
            elif response.status_code == 429:
                last_error = Exception(f"AI限流(429): {model}")
                logger.warning(f"  AI模型 {model} 限流(429)，尝试下一个... ({i + 1}/{len(models)})")
            else:
                last_error = Exception(f"AI错误{response.status_code}: {response.text[:100]}")
                logger.warning(f"  AI模型 {model} 错误 {response.status_code}，尝试下一个... ({i + 1}/{len(models)})")
        except requests.exceptions.Timeout:
            last_error = Exception(f"超时({AI_TIMEOUT}s): {model}")
            logger.warning(f"  AI模型 {model} 超时({AI_TIMEOUT}s)，尝试下一个... ({i + 1}/{len(models)})")
        except requests.exceptions.RequestException as e:
            last_error = e
            logger.warning(f"  AI模型 {model} 网络错误: {str(e)[:80]}，尝试下一个... ({i + 1}/{len(models)})")

        if i < len(models) - 1:
            delay = 2 if '超时' in str(last_error) or '429' in str(last_error) else 1
            time.sleep(delay)

    raise last_error or Exception("所有AI模型均失败")


def call_zhipu_ai(messages: list, model: str = "glm-4.7-flash") -> dict:
    """直接调用智谱AI API（兼容旧接口，自动使用降级链）

    Args:
        messages: 消息列表 [{role: "system"|"user", content: "..."}]
        model: 模型名称

    Returns:
        AI响应的JSON字典
    """
    return call_zhipu_ai_with_fallback(messages, primary_model=model)


def get_alerts_from_db() -> list:
    """从数据库获取所有启用的订阅"""
    import json as _json
    db.conn.row_factory = sqlite3.Row
    rows = db.execute("""
        SELECT id, email, keywords, sources, locations, industries, education,
               min_notify_interval, last_notified_at, notify_count, enabled
        FROM user_job_alerts
        WHERE enabled = 1
        ORDER BY id
    """).fetchall()

    alerts = []
    for row in rows:
        alert = dict(row)
        # 解析JSON字段
        for field in ['keywords', 'sources', 'locations', 'industries']:
            val = alert.get(field)
            if isinstance(val, str):
                try:
                    alert[field] = _json.loads(val)
                except:
                    alert[field] = []
            elif val is None:
                alert[field] = []
        alerts.append(alert)

    return alerts


def get_jobs_from_db(job_ids: list = None, limit: int = 100) -> list:
    """从数据库获取岗位数据

    Args:
        job_ids: 指定的岗位ID列表（如果提供）
        limit: 限制数量（当job_ids为None时使用）

    Returns:
        岗位字典列表
    """
    db.conn.row_factory = sqlite3.Row

    if job_ids:
        placeholders = ','.join(['?' for _ in job_ids])
        rows = db.execute(f"""
            SELECT id, title, company, location, salary, description, requirements,
                   job_type, industry, education, experience, source, university,
                   source_url, apply_url, publish_date, tags, created_at
            FROM jobs
            WHERE id IN ({placeholders})
            ORDER BY id DESC
        """, job_ids).fetchall()
    else:
        rows = db.execute("""
            SELECT id, title, company, location, salary, description, requirements,
                   job_type, industry, education, experience, source, university,
                   source_url, apply_url, publish_date, tags, created_at
            FROM jobs
            ORDER BY id DESC
            LIMIT ?
        """, (limit,)).fetchall()

    return [dict(row) for row in rows]


def build_ai_prompt(alert: dict, jobs: list) -> list:
    """构建AI分析的prompt

    Args:
        alert: 订阅字典
        jobs: 岗位列表

    Returns:
        消息列表
    """
    keywords = alert.get('keywords', [])
    sources = alert.get('sources', [])
    locations = alert.get('locations', [])
    industries = alert.get('industries', [])
    education = alert.get('education', '')

    user_preferences = [
        f"关键词（OR逻辑，任一匹配即推送）：{'、'.join(keywords) if keywords else '未设置'}",
        f"数据源筛选：{'、'.join(sources) if sources else '全部'}",
        f"期望地点：{'、'.join(locations) if locations else '不限'}",
        f"期望行业：{'、'.join(industries) if industries else '不限'}",
        f"最低学历要求：{education or '不限'}",
    ]

    jobs_text = "\n".join([f"""
【岗位 {i+1}】ID={job['id']}
- 职位名称：{job.get('title', '')}
- 公司名称：{job.get('company', '')}
- 工作地点：{job.get('location', '')}
- 薪资范围：{job.get('salary', '面议')}
- 岗位类型：{job.get('job_type', '全职')}
- 所属行业：{job.get('industry', '')}
- 学历要求：{job.get('education', '')}
- 数据来源：{job.get('university', '')} ({job.get('source', '')})
- 职位描述：{(job.get('description') or '')[:300]}
- 任职要求：{(job.get('requirements') or '')[:200]}
""" for i, job in enumerate(jobs)])

    messages = [
        {
            "role": "system",
            "content": """你是一个专业的职位推荐助手。你的任务是根据用户的订阅偏好，从一批新发布的岗位中筛选出最匹配的岗位。

核心规则：
1. 关键词采用OR逻辑：用户设置的多个关键词，只要岗位与其中任意一个相关就算匹配
2. 语义理解：不仅要看字面匹配，还要理解语义相关性。例如"数据分析"可以匹配"数据挖掘"、"BI工程师"、"数据运营"等
3. 如果用户设置了数据源/地点/行业/学历筛选条件，必须同时满足
4. 每个匹配的岗位必须给出简洁的推荐理由（一句话）
5. 按匹配度从高到低排序输出"""
        },
        {
            "role": "user",
            "content": f"""## 用户订阅偏好
{chr(10).join(user_preferences)}

## 待筛选的岗位（共 {len(jobs)} 个）
{jobs_text}

请分析以上岗位，返回JSON格式的匹配结果。只返回JSON，不要其他内容。格式如下：
{{
  "matched": [
    {{
      "job_id": 岗位ID数字,
      "matched_keywords": ["命中的关键词1", "命中的关键词2"],
      "reason": "一句话推荐理由",
      "relevance_score": 匹配度分数1-100
    }}
  ]
}}

如果没有任何岗位匹配，返回 {{"matched": []}}"""
        }
    ]

    return messages


def parse_ai_response(ai_result: dict) -> list:
    """解析AI响应

    Args:
        ai_result: AI API返回的结果

    Returns:
        匹配的岗位列表
    """
    import json as _json
    import re

    try:
        content = ai_result['choices'][0]['message']['content']

        # 提取 ```json ... ``` 代码块中的内容
        json_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', content, re.DOTALL)
        if json_match:
            cleaned = json_match.group(1).strip()
        else:
            # 没有代码块，尝试直接清理
            cleaned = content.replace('```json', '').replace('```', '').strip()

        # 找到第一个 { 和最后一个 }，提取完整JSON对象
        start_idx = cleaned.find('{')
        end_idx = cleaned.rfind('}')
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            cleaned = cleaned[start_idx:end_idx + 1]

        parsed = _json.loads(cleaned)

        if not parsed.get('matched') or not isinstance(parsed['matched'], list):
            return []

        matched_jobs = []
        for item in parsed['matched']:
            matched_jobs.append({
                'job_id': item.get('job_id'),
                'matched_keywords': item.get('matched_keywords', []),
                'reason': item.get('reason', ''),
                'relevance_score': min(100, max(0, item.get('relevance_score', 50)))
            })

        # 按匹配度排序
        matched_jobs.sort(key=lambda x: x['relevance_score'], reverse=True)
        return matched_jobs

    except Exception as e:
        logger.error(f"解析AI响应失败: {e}")
        logger.error(f"原始响应: {str(ai_result)[:500]}")
        return []


def send_email_direct(to: str, subject: str, html_content: str, text_content: str) -> bool:
    """直接发送邮件（不通过API）

    Args:
        to: 收件人邮箱
        subject: 邮件主题
        html_content: HTML内容
        text_content: 纯文本内容

    Returns:
        是否发送成功
    """
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    smtp_host = os.environ.get('SMTP_HOST')
    smtp_port = int(os.environ.get('SMTP_PORT', '587'))
    smtp_user = os.environ.get('SMTP_USER')
    smtp_pass = os.environ.get('SMTP_PASS')
    smtp_from_name = os.environ.get('SMTP_FROM_NAME', '职位提醒')
    smtp_from_email = os.environ.get('SMTP_FROM_EMAIL', smtp_user)

    if not all([smtp_host, smtp_user, smtp_pass]):
        logger.warning(f"邮件服务未配置，跳过发送到 {to}")
        return False

    try:
        import email.utils
        from email.header import Header

        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = email.utils.formataddr((Header(smtp_from_name, 'utf-8').encode(), smtp_from_email))
        msg['To'] = to

        msg.attach(MIMEText(text_content, 'plain', 'utf-8'))
        msg.attach(MIMEText(html_content, 'html', 'utf-8'))

        server = smtplib.SMTP(smtp_host, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_from_email, [to], msg.as_string())
        server.quit()

        logger.info(f"✅ 邮件发送成功: {to}")
        return True

    except Exception as e:
        logger.error(f"❌ 邮件发送失败 ({to}): {e}")
        return False


def build_email_content(alert: dict, matched_jobs: list, all_jobs: list) -> tuple:
    """构建邮件内容

    Args:
        alert: 订阅信息
        matched_jobs: 匹配的岗位列表
        all_jobs: 所有岗位（用于查找详情）

    Returns:
        (html_content, text_content)
    """
    keywords = alert.get('keywords', [])
    keyword_str = '、'.join(keywords) if keywords else '未设置'

    job_map = {job['id']: job for job in all_jobs}

    job_list_html = ""
    job_list_text = ""

    for i, matched in enumerate(matched_jobs):
        job = job_map.get(matched['job_id'], {})
        score = matched.get('relevance_score', 0)
        color = '#10b981' if score >= 80 else ('#3b82f6' if score >= 60 else '#f59e0b')

        job_list_html += f"""
    <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid {color};">
      <h3 style="margin: 0 0 10px 0; font-size: 16px;">
        <a href="{job.get('source_url', '#')}" style="color: #3b82f6; text-decoration: none;">
          {i+1}. {job.get('title', '未知职位')}
        </a>
        <span style="margin-left: 8px; font-size: 12px; background: {'#d1fae5' if score >= 80 else ('#dbeafe' if score >= 60 else '#fef3c7')}; color: {'#059669' if score >= 80 else ('#1d4ed8' if score >= 60 else '#d97706')}; padding: 2px 8px; border-radius: 12px;">匹配度 {score}%</span>
      </h3>
      {f'<p style="margin: 5px 0; color: #666;"><strong>公司：</strong>{job.get("company", "")}</p>' if job.get('company') else ''}
      {f'<p style="margin: 5px 0; color: #666;"><strong>地点：</strong>{job.get("location", "")}</p>' if job.get('location') else ''}
      {f'<p style="margin: 5px 0; color: #666;"><strong>薪资：</strong>{job.get("salary", "")}</p>' if job.get('salary') else ''}
      {f'<p style="margin: 5px 0; color: #666;"><strong>来源：</strong>{job.get("university", "")}</p>' if job.get('university') else ''}
      <p style="margin: 5px 0; color: #3b82f6;">
        <strong>匹配关键词：</strong>{'、'.join(matched.get('matched_keywords', []))}
      </p>
      {f'<p style="margin: 5px 0; color: #059669; font-style: italic; background: #ecfdf5; padding: 8px 12px; border-radius: 6px;"><strong>AI推荐理由：</strong>{matched.get("reason", "")}</p>' if matched.get('reason') else ''}
    </div>
"""

        job_list_text += f"""
{i+1}. {job.get('title', '未知职位')} [匹配度 {score}%]
   公司：{job.get('company', '未知')}
   地点：{job.get('location', '未知')}
   薪资：{job.get('salary', '面议')}
   来源：{job.get('university', '未知')}
   匹配关键词：{'、'.join(matched.get('matched_keywords', []))}
   {f'AI推荐理由：{matched.get("reason", "")}' if matched.get('reason') else ''}
   链接：{job.get('source_url', '')}
"""

    html = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }}
    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
    .header {{ background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; }}
    .content {{ background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }}
    .footer {{ text-align: center; padding: 20px; color: #9ca3af; font-size: 12px; }}
    .keyword-tag {{ display: inline-block; background: #dbeafe; color: #1d4ed8; padding: 4px 12px; border-radius: 20px; margin: 2px; font-size: 14px; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">🤖 AI 职位推荐</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">发现 {len(matched_jobs)} 个匹配岗位（AI智能匹配 - 智能语义分析）</p>
    </div>
    <div class="content">
      <p>您好！</p>
      <p>根据您订阅的关键词：</p>
      <p style="margin: 15px 0;">
        {''.join([f'<span class="keyword-tag">{k}</span>' for k in keywords])}
      </p>
      <p>我们发现了以下 <strong>{len(matched_jobs)}</strong> 个新岗位：</p>
      <div style="margin: 20px 0;">
        {job_list_html}
      </div>
      <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #666;">
        如需修改订阅设置，请登录系统设置页面。
      </p>
    </div>
    <div class="footer">
      <p>此邮件由系统自动发送，请勿直接回复。</p>
      <p>© {datetime.now().year} Job Hub 职位提醒服务</p>
    </div>
  </div>
</body>
</html>
"""

    text = f"""
职位提醒 - 发现 {len(matched_jobs)} 个匹配岗位（AI 智能推荐）

您好！

根据您订阅的关键词：{keyword_str}

AI助手为您筛选出以下 {len(matched_jobs)} 个最相关的岗位：

{job_list_text}

---
本邮件由 AI 智能匹配引擎生成，根据您的订阅偏好进行语义分析和岗位推荐。

如需修改订阅设置，请登录系统设置页面。

此邮件由系统自动发送，请勿直接回复。
""".strip()

    return html, text


def test_email_mode(count: int = 100):
    """测试邮件模式（直接AI分析版）：从数据库获取记录 -> AI分析 -> 发送邮件

    流程：
    1. 从数据库获取最近的岗位记录
    2. 从数据库获取所有启用的订阅
    3. 对每个订阅，调用AI进行匹配分析
    4. 发送邮件

    Args:
        count: 获取的记录数量 (默认: 100)
    """
    import json as _json

    start_time = time.time()

    try:
        logger.info("=" * 70)
        logger.info("📧 测试邮件模式（直接AI分析）")
        logger.info(f"   流程: DB提取数据 -> AI智能分析 -> 发送邮件")
        logger.info("=" * 70 + "\n")

        # 1. 获取岗位数据
        logger.info(f"📥 步骤1: 从数据库查询最近 {count} 条岗位记录...")
        jobs = get_jobs_from_db(limit=count)

        if not jobs:
            logger.warning("❌ 数据库中没有找到任何岗位记录！")
            logger.warning("   请先运行爬虫获取数据: python lite_crawler.py")
            return

        logger.info(f"✅ 找到 {len(jobs)} 条岗位记录 (ID范围: {jobs[-1]['id']} - {jobs[0]['id']})")

        # 显示前5条记录的摘要
        logger.info("\n📋 岗位样本:")
        for i, job in enumerate(jobs[:5]):
            logger.info(f"   {i+1}. [{job['id']}] {job['title'][:40]} - {job.get('company', '未知')} ({job.get('source', '?')})")
        if len(jobs) > 5:
            logger.info(f"   ... 还有 {len(jobs) - 5} 条记录")
        logger.info("")

        # 2. 获取订阅数据
        logger.info("📥 步骤2: 从数据库查询订阅信息...")
        alerts = get_alerts_from_db()

        if not alerts:
            logger.warning("❌ 数据库中没有找到任何已启用的订阅！")
            logger.warning("   请先在系统中创建订阅")
            return

        logger.info(f"✅ 找到 {len(alerts)} 个已启用的订阅")

        # 显示订阅摘要
        logger.info("\n📋 订阅列表:")
        for i, alert in enumerate(alerts[:10]):
            keywords = '、'.join(alert.get('keywords', [])[:3])
            if len(alert.get('keywords', [])) > 3:
                keywords += f"...(+{len(alert.get('keywords', [])) - 3})"
            logger.info(f"   {i+1}. [{alert['id']}] {alert['email']} | 关键词: {keywords}")
        if len(alerts) > 10:
            logger.info(f"   ... 还有 {len(alerts) - 10} 个订阅")
        logger.info("")

        # 3. 对每个订阅进行AI分析
        logger.info("🤖 步骤3: 开始AI智能匹配分析...\n")
        total_sent = 0
        total_failed = 0
        total_skipped = 0
        results_detail = []

        for idx, alert in enumerate(alerts):
            alert_id = alert['id']
            email = alert['email']
            keywords = alert.get('keywords', [])

            logger.info(f"{'='*50}")
            logger.info(f"📬 处理订阅 {idx+1}/{len(alerts)}: ID={alert_id}, 邮箱={email}")
            logger.info(f"   关键词: {'、'.join(keywords) if keywords else '(未设置)'}")

            # 检查频率限制
            min_interval = alert.get('min_notify_interval', 0)
            last_notified = alert.get('last_notified_at')

            if min_interval and min_interval > 0 and last_notified:
                last_time = datetime.strptime(last_notified, '%Y-%m-%d %H:%M:%S') if isinstance(last_notified, str) else datetime.fromisoformat(str(last_notified))
                elapsed = (datetime.now() - last_time).total_seconds() / 60  # 分钟
                if elapsed < min_interval:
                    remaining = int(min_interval - elapsed)
                    logger.info(f"   ⏭️  跳过(频率限制): 距上次推送不足 {min_interval} 分钟 (还需 {remaining} 分钟)")
                    total_skipped += 1
                    results_detail.append({
                        'alert_id': alert_id,
                        'email': email,
                        'status': 'skipped',
                        'reason': f'频率限制: 还需{remaining}分钟'
                    })
                    continue

            try:
                # 调用AI进行分析
                logger.info(f"   🤖 正在调用AI分析 {len(jobs)} 个岗位...")
                ai_start = time.time()

                messages = build_ai_prompt(alert, jobs)
                ai_result = call_zhipu_ai(messages)
                matched_jobs = parse_ai_response(ai_result)

                ai_elapsed = time.time() - ai_start
                logger.info(f"   ✅ AI分析完成 ({ai_elapsed:.1f}s): 匹配 {len(matched_jobs)} 个岗位")

                if not matched_jobs:
                    logger.info(f"   ⚠️  无匹配岗位")
                    results_detail.append({
                        'alert_id': alert_id,
                        'email': email,
                        'status': 'no_match',
                        'matched_count': 0
                    })
                    continue

                # 显示匹配结果摘要
                logger.info(f"   🎯 匹配岗位:")
                for i, matched in enumerate(matched_jobs[:5]):
                    job_id = matched['job_id']
                    job = next((j for j in jobs if j['id'] == job_id), {})
                    score = matched.get('relevance_score', 0)
                    kw_str = '、'.join(matched.get('matched_keywords', [])[:3])
                    logger.info(f"      {i+1}. [{job_id}] {job.get('title', '?')[:30]} | 匹配度:{score}% | 关键词:{kw_str}")
                if len(matched_jobs) > 5:
                    logger.info(f"      ... 还有 {len(matched_jobs) - 5} 个岗位")

                # 构建并发送邮件
                logger.info(f"   📧 正在发送邮件...")
                html_content, text_content = build_email_content(alert, matched_jobs, jobs)
                subject = f"【AI职位推荐】发现 {len(matched_jobs)} 个匹配岗位 - {'、'.join(keywords[:3]) if keywords else '全部'}"

                send_success = send_email_direct(email, subject, html_content, text_content)

                if send_success:
                    total_sent += 1
                    logger.info(f"   ✅ 邮件发送成功!")
                    results_detail.append({
                        'alert_id': alert_id,
                        'email': email,
                        'status': 'sent',
                        'matched_count': len(matched_jobs),
                        'mode': 'AI直接分析'
                    })

                    # 记录到历史表（如果需要）
                    job_ids = [m['job_id'] for m in matched_jobs]
                    try:
                        db.execute("""
                            INSERT INTO job_alert_history (alert_id, job_ids, email_sent, error_message, created_at)
                            VALUES (?, ?, ?, ?, ?)
                        """, (alert_id, str(job_ids), 1, '', datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
                        db.commit()
                    except Exception as e:
                        logger.debug(f"   记录历史失败(非关键): {e}")

                    # 更新最后通知时间
                    try:
                        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                        db.execute("""
                            UPDATE user_job_alerts SET last_notified_at = ?, notify_count = notify_count + 1 WHERE id = ?
                        """, (now, alert_id))
                        db.commit()
                    except Exception as e:
                        logger.debug(f"   更新通知时间失败(非关键): {e}")

                else:
                    total_failed += 1
                    logger.warning(f"   ❌ 邮件发送失败!")
                    results_detail.append({
                        'alert_id': alert_id,
                        'email': email,
                        'status': 'failed',
                        'matched_count': len(matched_jobs),
                        'reason': '邮件服务错误'
                    })

            except Exception as e:
                total_failed += 1
                logger.error(f"   ❌ 处理失败: {e}")
                results_detail.append({
                    'alert_id': alert_id,
                    'email': email,
                    'status': 'error',
                    'reason': str(e)
                })

        # 4. 输出汇总统计
        elapsed = time.time() - start_time

        logger.info("\n" + "=" * 70)
        logger.info("📊 处理完成汇总")
        logger.info("=" * 70)
        logger.info(f"\n⏱️  总耗时: {elapsed:.1f}s")
        logger.info(f"📊 岗位数: {len(jobs)}")
        logger.info(f"📊 订阅数: {len(alerts)}")
        logger.info(f"\n📈 结果统计:")
        logger.info(f"   ✅ 发送成功: {total_sent}")
        logger.info(f"   ❌ 发送失败: {total_failed}")
        logger.info(f"   ⏭️  跳过(频率限制/无匹配): {total_skipped}")
        logger.info(f"   📊 成功率: {(total_sent / len(alerts) * 100) if alerts else 0:.1f}%")

        if results_detail:
            logger.info(f"\n📋 详细结果:")
            for r in results_detail:
                status_icon = {
                    'sent': '✅',
                    'failed': '❌',
                    'skipped': '⏭️ ',
                    'no_match': '⚠️ ',
                    'error': '💥'
                }.get(r.get('status'), '❓')

                status_text = {
                    'sent': '已发送',
                    'failed': f"失败: {r.get('reason', '')}",
                    'skipped': r.get('reason', ''),
                    'no_match': '无匹配',
                    'error': f"错误: {r.get('reason', '')}"
                }.get(r.get('status'), '')

                matched_info = f", {r.get('matched_count', 0)}个匹配" if r.get('matched_count') else ""
                mode_info = f" [{r.get('mode', '')}]" if r.get('mode') else ''

                logger.info(f"   {status_icon} 订阅{r.get('alert_id')} ({r.get('email')}){matched_info}{mode_info}: {status_text}")

        logger.info("\n" + "=" * 70)
        logger.info("✨ 测试完成!")
        logger.info("=" * 70)

    except ValueError as ve:
        logger.error(f"\n❌ 配置错误: {ve}")
        logger.error("   请检查 .env 文件中的 ZHIPU_API_KEY 等配置")
    except Exception as e:
        logger.error(f"\n❌ 测试邮件失败: {e}")
        import traceback
        logger.error(traceback.format_exc())


def trigger_job_alerts(since_minutes: int = 30):
    """触发职位提醒：检查新增岗位并推送邮件
    
    Args:
        since_minutes: 检查最近N分钟内新增的岗位
    """
    import requests
    import json as _json
    
    try:
        logger.info("正在检查职位提醒订阅...")
        
        api_url = os.environ.get("API_BASE_URL", "http://localhost:3001") + "/api/alerts/trigger"
        logger.debug(f"  API地址: {api_url}")
        logger.debug(f"  since_minutes: {since_minutes}")
        
        response = requests.post(
            api_url,
            json={"since_minutes": since_minutes},
            timeout=120
        )
        
        logger.debug(f"  HTTP状态码: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            
            debug_info = result.get("_debug", {})
            if debug_info:
                logger.debug(f"  [DEBUG] 请求参数: {debug_info.get('request_params', {})}")
                logger.debug(f"  [DEBUG] 订阅数量: {debug_info.get('alerts_count', '?')}")
                logger.debug(f"  [DEBUG] 岗位数量: {debug_info.get('jobs_count', '?')}")
                logger.debug(f"  [DEBUG] AI服务: {'可用' if debug_info.get('ai_service_available') else '不可用'}")
                logger.debug(f"  [DEBUG] 邮件服务: {'已配置' if debug_info.get('email_configured') else '未配置'}")
                
                if debug_info.get('jobs_count', 0) == 0:
                    db_total = debug_info.get('db_total_jobs', '?')
                    latest = debug_info.get('db_latest_job', {})
                    recent_cnt = debug_info.get('db_recent_jobs_count', '?')
                    since_t = debug_info.get('since_time', '?')
                    curr_t = debug_info.get('current_time', '?')
                    logger.warning(f"  [DEBUG] 无新岗位! DB总岗位={db_total}, 最近岗位={latest}, 近{since_minutes}分钟内={recent_cnt}")
                    logger.warning(f"  [DEBUG] 时间范围: 当前={curr_t}, 查询起始={since_t}")
                    
                    alerts_detail = debug_info.get('alerts_detail', [])
                    if len(alerts_detail) == 0:
                        logger.warning("  [DEBUG] 订阅表为空！没有找到任何已启用的订阅")
                    else:
                        for a in alerts_detail:
                            logger.debug(f"  [DEBUG] 订阅 ID={a.get('id')} email={a.get('email')} keywords={a.get('keywords')} enabled={a.get('enabled')}")
            
            if result.get("success"):
                alerts_triggered = result.get("alerts_triggered", 0)
                jobs_processed = result.get("jobs_processed", 0)
                elapsed = debug_info.get('elapsed_ms', '?')
                logger.info(f"职位提醒处理完成: 检查 {jobs_processed} 个岗位, 触发 {alerts_triggered} 个订阅 (耗时{elapsed}ms)")
                
                results_list = result.get("results", [])
                for r in results_list:
                    skip = r.get("skipped_reason")
                    if skip:
                        logger.info(f"  订阅 {r.get('alert_id')} ({r.get('email')}): 跳过 - {skip}")
                    else:
                        status = "已发送" if r.get("email_sent") else ("失败: " + str(r.get("error", ""))) if not r.get("email_sent") else "未发送"
                        mode = r.get('match_mode') or (f"AI({r.get('ai_model')})" if r.get('ai_model') else '未知')
                        logger.info(f"  订阅 {r.get('alert_id')} ({r.get('email')}): {r.get('matched_count')} 个匹配 [{mode}], 邮件{status}")
                    
                if alerts_triggered == 0 and jobs_processed > 0:
                    logger.warning(f"  有 {jobs_processed} 个岗位但无任何订阅匹配成功，可能原因:")
                    logger.warning(f"    1. 订阅关键词与岗位不匹配")
                    logger.warning(f"    2. 所有匹配的订阅被频率限制拦截")
                    logger.warning(f"    3. AI服务返回空结果（检查AI配置是否正确）")
            else:
                error_msg = result.get("error", "未知错误")
                err_debug = result.get("_debug", {}).get("error", "")
                logger.warning(f"职位提醒API返回错误: {error_msg}")
                if err_debug:
                    logger.warning(f"  详细错误: {err_debug}")
        else:
            response_text = response.text[:500] if response.text else "(empty)"
            logger.warning(f"职位提醒API请求失败: HTTP {response.status_code}")
            logger.warning(f"  响应内容: {response_text}")
            
    except requests.exceptions.ConnectionError:
        logger.warning(f"无法连接到职位提醒API，请确保Web服务正在运行 ({api_url})")
    except requests.exceptions.Timeout:
        logger.warning(f"职位提醒API请求超时 (>120秒), API可能处理时间过长 ({api_url})")
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
    elif source == "zjgsu":
        job_iterator = crawl_zjgsu(source_config, max_items)
    elif source == "cueb":
        job_iterator = crawl_cueb(source_config, max_items)
    elif source == "zufe":
        job_iterator = crawl_zufe(source_config, max_items, date_filter_months)
    elif source == "bytedance":
        job_iterator = crawl_bytedance(source_config, max_items, date_filter_months)
    elif source == "nau":
        job_iterator = crawl_91job(source_config, max_items, date_filter_months)
    elif source in ("tjufe", "gdufe", "jxufe"):
        job_iterator = crawl_yunjiuye(source_config, max_items, date_filter_months)
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
    parser.add_argument("--test-email", action="store_true",
                        help="跳过爬取，直接从数据库获取最近100条记录测试邮件发送")
    parser.add_argument("--test-email-count", type=int, default=100,
                        help="测试邮件时使用的记录数量 (默认: 100)")
    args = parser.parse_args()
    
    crawl_logger.set_level(args.log_level)
    
    if args.list_sources:
        logger.info("\n可用数据源:")
        for key, config in HTTP_SOURCES.items():
            logger.info(f"  {key:12s} - {config['name']}")
        logger.info("")
        return
    
    init_database()

    # 测试邮件模式：跳过爬取，直接从数据库获取记录
    if args.test_email:
        logger.info("=" * 70)
        logger.info("📧 测试邮件模式")
        logger.info(f"   将从数据库获取最近 {args.test_email_count} 条岗位记录")
        logger.info(f"   直接调用职位提醒API进行分析和发送")
        logger.info("=" * 70 + "\n")

        test_email_mode(args.test_email_count)
        return

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
