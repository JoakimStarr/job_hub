#!/usr/bin/env python3
"""
轻量化单线程爬虫
专为低内存服务器设计（< 2GB 内存）

特性:
- 单线程执行，无并发
- 只支持 HTTP 爬虫（sufe, zuel, cufe, dufe, swufe）
- 逐条写入数据库，不缓存数据
- 失败重试 5 次（指数退避）
- 最小日志输出
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
"""

import argparse
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
MAX_RETRIES = 5
RETRY_DELAY_BASE = 2
SCHEDULE_INTERVALS = {
    "hourly": 3600,
    "daily": 86400,
    "weekly": 604800,
}

HTTP_SOURCES = get_lite_http_sources()


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


def url_exists(url: str) -> bool:
    """检查 URL 是否已存在"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM jobs WHERE source_url = ? LIMIT 1", (url,))
    exists = cursor.fetchone() is not None
    conn.close()
    return exists


def insert_job(job: Dict) -> bool:
    """插入岗位数据"""
    try:
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT OR IGNORE INTO jobs 
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
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"✗ 插入数据库失败: {e}")
        return False


def fetch_with_retry(url: str, method: str = "GET", **kwargs) -> Optional[requests.Response]:
    """带重试的 HTTP 请求"""
    for attempt in range(MAX_RETRIES):
        try:
            if method.upper() == "GET":
                response = requests.get(url, timeout=30, **kwargs)
            else:
                response = requests.post(url, timeout=30, **kwargs)
            
            if response.status_code == 200:
                return response
            
            if attempt < MAX_RETRIES - 1:
                delay = RETRY_DELAY_BASE ** attempt
                time.sleep(delay)
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                delay = RETRY_DELAY_BASE ** attempt
                time.sleep(delay)
            else:
                print(f"✗ 请求失败 {url}: {e}")
    
    return None


def crawl_sufe(source_config: Dict, max_items: int = 0) -> Iterator[Dict]:
    """爬取 SUFE"""
    base_url = source_config["base_url"]
    list_url = urljoin(base_url, source_config["list_url"])
    field_mapping = source_config["field_mapping"]
    
    page = 1
    count = 0
    
    while True:
        if max_items > 0 and count >= max_items:
            break
        
        data = {"pageNo": str(page), "pageSize": "10"}
        response = fetch_with_retry(list_url, method="POST", data=data)
        
        if not response:
            break
        
        try:
            result = response.json()
            if result.get("code") != 200:
                break
            
            items = result.get("data", {}).get("list", [])
            if not items:
                break
            
            for item in items:
                if max_items > 0 and count >= max_items:
                    break
                
                item_id = item.get("zpxxid")
                if not item_id:
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
                        "source": "sufe",
                        "university": source_config["name"],
                        "source_url": detail_url,
                        "apply_url": detail_url,
                    }
                    
                    yield job
                    count += 1
                except Exception:
                    continue
            
            page += 1
        except Exception:
            break


def crawl_zuel(source_config: Dict, max_items: int = 0) -> Iterator[Dict]:
    """爬取 ZUEL"""
    base_url = source_config["base_url"]
    field_mapping = source_config["field_mapping"]
    
    page = 1
    count = 0
    
    while True:
        if max_items > 0 and count >= max_items:
            break
        
        list_url = source_config["list_url"].format(page=page, limit=10)
        full_url = urljoin(base_url, list_url)
        
        response = fetch_with_retry(full_url)
        if not response:
            break
        
        try:
            result = response.json()
            if result.get("code") != 0:
                break
            
            items = result.get("data", [])
            if not items:
                break
            
            for item in items:
                if max_items > 0 and count >= max_items:
                    break
                
                item_id = item.get("id")
                if not item_id:
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
                        "source": "zuel",
                        "university": source_config["name"],
                        "source_url": full_detail_url,
                        "apply_url": full_detail_url,
                    }
                    
                    yield job
                    count += 1
                except Exception:
                    continue
            
            page += 1
        except Exception:
            break


def crawl_platform(source: str, source_config: Dict, max_items: int = 0) -> Iterator[Dict]:
    """爬取平台类数据源（CUFE/DUFE）"""
    base_url = source_config["base_url"]
    field_mapping = source_config["field_mapping"]
    
    page = 1
    count = 0
    
    while True:
        if max_items > 0 and count >= max_items:
            break
        
        data = {"pageNo": str(page), "positionType": "1"}
        response = fetch_with_retry(urljoin(base_url, source_config["list_url"]), method="POST", data=data)
        
        if not response:
            break
        
        try:
            result = response.json()
            if result.get("state") != 1:
                break
            
            items = result.get("object", {}).get("list", [])
            if not items:
                break
            
            for item in items:
                if max_items > 0 and count >= max_items:
                    break
                
                url_path = item.get("url", "")
                if not url_path:
                    continue
                
                from urllib.parse import parse_qs, urlparse
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
                        "university": source_config["name"],
                        "source_url": urljoin(base_url, url_path),
                        "apply_url": urljoin(base_url, url_path),
                    }
                    
                    yield job
                    count += 1
                except Exception:
                    continue
            
            page += 1
        except Exception:
            break


def crawl_swufe(source_config: Dict, max_items: int = 0) -> Iterator[Dict]:
    """爬取 SWUFE"""
    base_url = source_config["base_url"]
    field_mapping = source_config["field_mapping"]
    
    page = 1
    count = 0
    
    while True:
        if max_items > 0 and count >= max_items:
            break
        
        list_url = source_config["list_url"].format(page=page)
        full_url = urljoin(base_url, list_url)
        
        response = fetch_with_retry(full_url)
        if not response:
            break
        
        try:
            result = response.json()
            items = result.get("list", [])
            
            if not items:
                break
            
            for item in items:
                if max_items > 0 and count >= max_items:
                    break
                
                item_id = item.get("id")
                if not item_id:
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
                        "source": "swufe",
                        "university": source_config["name"],
                        "source_url": full_detail_url,
                        "apply_url": full_detail_url,
                    }
                    
                    yield job
                    count += 1
                except Exception:
                    continue
            
            page += 1
        except Exception:
            break


_running = True


def signal_handler(signum, frame):
    """信号处理函数"""
    global _running
    print("\n\n收到停止信号，正在优雅退出...")
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
        print(f"✗ 无效的定时参数: {schedule}")
        print("  支持的参数: hourly, daily, weekly, 或 cron 表达式 (如 '0 2 * * *')")
        return
    
    print(f"定时爬取已启动")
    print(f"  间隔: {schedule} ({interval}秒)")
    print(f"  数据源: {', '.join(sources)}")
    print(f"  按 Ctrl+C 停止\n")
    
    run_count = 0
    
    while _running:
        run_count += 1
        print(f"\n{'=' * 60}")
        print(f"第 {run_count} 次运行 | {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print('=' * 60)
        
        start_time = time.time()
        total_count = 0
        
        for source in sources:
            if not _running:
                break
            count = crawl_source(source, max_items)
            total_count += count
        
        elapsed = time.time() - start_time
        
        print(f"\n本次完成 | 总岗位数: {total_count} | 耗时: {elapsed:.1f}s")
        
        if _running:
            print(f"\n下次运行时间: {(datetime.now() + __import__('datetime').timedelta(seconds=interval)).strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"等待 {interval} 秒...\n")
            
            for _ in range(int(interval)):
                if not _running:
                    break
                time.sleep(1)
    
    print("\n定时爬取已停止")


def crawl_source(source: str, max_items: int = 0) -> int:
    """爬取单个数据源"""
    if source not in HTTP_SOURCES:
        print(f"✗ 未知数据源: {source}")
        return 0
    
    source_config = HTTP_SOURCES[source]
    count = 0
    
    print(f"▶ 开始爬取 [{source_config['name']}]")
    
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
        if insert_job(job):
            count += 1
            if count % 10 == 0:
                print(f"  已完成: {count} 条")
    
    print(f"✓ [{source_config['name']}] 完成: {count} 条")
    return count


def main():
    parser = argparse.ArgumentParser(description="轻量化单线程爬虫")
    parser.add_argument("--sources", nargs="*", help="指定数据源")
    parser.add_argument("--list-sources", action="store_true", help="列出所有数据源")
    parser.add_argument("--max-items", type=int, default=0, help="每个数据源最大爬取数量 (0=不限)")
    parser.add_argument("--schedule", type=str, help="定时爬取 (hourly/daily/weekly 或 cron 表达式)")
    args = parser.parse_args()
    
    if args.list_sources:
        print("\n可用数据源:")
        for key, config in HTTP_SOURCES.items():
            print(f"  {key:12s} - {config['name']}")
        print()
        return
    
    init_database()
    
    sources = args.sources or list(HTTP_SOURCES.keys())
    
    if args.schedule:
        run_scheduled(sources, args.max_items, args.schedule)
        return
    
    print("\n" + "=" * 60)
    print("轻量化单线程爬虫启动")
    print(f"数据源: {', '.join(sources)}")
    if args.max_items > 0:
        print(f"每个源最多: {args.max_items} 条")
    print("=" * 60 + "\n")
    
    start_time = time.time()
    total_count = 0
    
    for source in sources:
        count = crawl_source(source, args.max_items)
        total_count += count
    
    elapsed = time.time() - start_time
    
    print("\n" + "=" * 60)
    print(f"爬取完成 | 总耗时 {elapsed:.1f}s")
    print(f"总岗位数: {total_count}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
