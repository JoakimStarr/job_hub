import re
import asyncio
from datetime import datetime
from typing import List, Any, Callable, Awaitable

try:
    from .constants import COMPANY_SUFFIXES
except ImportError:
    from constants import COMPANY_SUFFIXES
from loguru import logger


def html_to_text(html: str) -> str:
    if not html:
        return ""
    text = re.sub(r'<br\s*/?>', '\n', html)
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&lt;', '<', text)
    text = re.sub(r'&gt;', '>', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


async def gather_limited(items: List[Any], coro_fn: Callable[[Any], Awaitable[Any]], concurrency: int = 4) -> List[Any]:
    semaphore = asyncio.Semaphore(concurrency)
    results = []
    
    async def _run(item):
        async with semaphore:
            try:
                return await coro_fn(item)
            except Exception as e:
                logger.warning(f"并发任务失败: {e}")
                return None
    
    for item in items:
        results.append(_run(item))
    
    completed = await asyncio.gather(*results, return_exceptions=True)
    return [r for r in completed if r and not isinstance(r, Exception)]


def normalize_publish_date(date_str: str) -> str:
    if not date_str:
        return ""
    date_str = str(date_str).strip()
    if re.match(r'^\d{13}$', date_str):
        ts = int(date_str) / 1000
        return datetime.fromtimestamp(ts).strftime('%Y-%m-%d')
    if re.match(r'^\d{10}$', date_str):
        ts = int(date_str)
        return datetime.fromtimestamp(ts).strftime('%Y-%m-%d')
    formats = [
        '%Y-%m-%dT%H:%M:%S',
        '%Y-%m-%d %H:%M:%S',
        '%Y-%m-%d %H:%M',
        '%Y-%m-%d',
        '%Y/%m/%d %H:%M:%S',
        '%Y/%m/%d %H:%M',
        '%Y/%m/%d',
        '%Y年%m月%d日',
    ]
    for fmt in formats:
        try:
            if 'T' in date_str:
                return datetime.strptime(date_str[:19], fmt).strftime('%Y-%m-%d')
            else:
                return datetime.strptime(date_str, fmt).strftime('%Y-%m-%d')
        except (ValueError, TypeError):
            continue
    return ""


def clean_company_name(raw: str) -> str:
    if not raw:
        return ""
    name = raw.strip()
    for suffix in sorted(COMPANY_SUFFIXES, key=len, reverse=True):
        if name.endswith(suffix):
            name = name[: -len(suffix)].strip()
            break
    year_pattern = r'[\s\-—_]*(20\d{2})[\s\-—_]*(届|年|秋|春)[\s\-—_]*$'
    name = re.sub(year_pattern, '', name).strip()
    name = re.sub(r'[\s\-—_]+$', '', name).strip()
    return name if len(name) >= 2 else raw.strip()


def is_current_year_date(date_str: str) -> bool:
    if not date_str:
        return False
    try:
        parsed = normalize_publish_date(date_str)
        if not parsed:
            return False
        return parsed.startswith(str(datetime.now().year))
    except Exception:
        return False


def extract_salary(low: object, high: object, unit: str = "K") -> str:
    try:
        l = int(low) if low else 0
        h = int(high) if high else 0
        if l <= 0 and h <= 0:
            return "面议"
        if unit.upper() == "K":
            if l > 0 and h > 0:
                return f"{l}-{h}K"
            elif l > 0:
                return f"{l}K+"
            else:
                return f"最高{h}K"
        return f"{l}-{h}" if l > 0 and h > 0 else "面议"
    except (ValueError, TypeError):
        return "面议"


def truncate_text(text: str, max_len: int = 2000) -> str:
    if not text:
        return ""
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:max_len] + "..." if len(text) > max_len else text


def safe_get(data: dict, *keys, default=""):
    current = data
    for key in keys:
        if isinstance(current, dict):
            current = current.get(key, default)
        else:
            return default
    return current if current is not None else default
