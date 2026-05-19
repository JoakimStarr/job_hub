import aiosqlite
import hashlib
import json
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from loguru import logger

from .base import JobData


DB_DIR = Path(__file__).parent.parent.parent / "data"
DB_PATH = DB_DIR / "jobs.db"

BATCH_CHUNK_SIZE = 500

_INSERT_FIELDS = [
    "title", "company", "location", "salary", "description", "requirements",
    "job_type", "industry", "education", "experience", "source", "university",
    "source_url", "apply_url", "publish_date", "deadline", "category", "tags",
    "content_hash",
]

_INSERT_FIELDS_STR = ", ".join(_INSERT_FIELDS)

_PLACEHOLDERS = "(" + ",".join(["?"] * len(_INSERT_FIELDS)) + ")"

_UPSERT_SQL_TEMPLATE = f"""
    INSERT INTO jobs ({_INSERT_FIELDS_STR})
    VALUES {{placeholders}}
    ON CONFLICT(source_url) DO UPDATE SET
        title = excluded.title,
        company = excluded.company,
        location = excluded.location,
        salary = excluded.salary,
        description = excluded.description,
        requirements = excluded.requirements,
        job_type = excluded.job_type,
        industry = excluded.industry,
        education = excluded.education,
        experience = excluded.experience,
        source = excluded.source,
        university = excluded.university,
        apply_url = excluded.apply_url,
        publish_date = excluded.publish_date,
        deadline = excluded.deadline,
        category = excluded.category,
        tags = excluded.tags,
        content_hash = excluded.content_hash,
        updated_at = CURRENT_TIMESTAMP
"""

_IGNORE_SQL_TEMPLATE = f"""
    INSERT OR IGNORE INTO jobs ({_INSERT_FIELDS_STR}, is_favorite, is_read)
    VALUES {{placeholders}}
"""


class LocalDatabase:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = Path(db_path) if db_path else DB_PATH
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn: Optional[aiosqlite.Connection] = None

    async def connect(self):
        """连接数据库并启用WAL模式以提升并发性能"""
        self._conn = await aiosqlite.connect(str(self.db_path))
        self._conn.row_factory = aiosqlite.Row
        
        await self._conn.execute("PRAGMA journal_mode=WAL")
        await self._conn.execute("PRAGMA synchronous=NORMAL")
        await self._conn.execute("PRAGMA cache_size=-64000")
        await self._conn.execute("PRAGMA temp_store=MEMORY")
        
        cursor = await self._conn.execute("PRAGMA journal_mode")
        mode = await cursor.fetchone()
        logger.info(f"SQLite日志模式: {mode[0]}")
        
        await self._create_tables()
        logger.info(f"本地数据库已连接: {self.db_path} (WAL模式)")

    async def close(self):
        if self._conn:
            await self._conn.close()
            self._conn = None

    async def _create_tables(self):
        await self._conn.execute('''
            CREATE TABLE IF NOT EXISTS jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                company TEXT NOT NULL,
                location TEXT DEFAULT '',
                salary TEXT DEFAULT '面议',
                description TEXT DEFAULT '',
                requirements TEXT DEFAULT '',
                job_type TEXT DEFAULT '实习',
                industry TEXT DEFAULT '',
                education TEXT DEFAULT '',
                experience TEXT DEFAULT '',
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
        ''')
        await self._conn.execute('''
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
        ''')
        await self._conn.execute('CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source)')
        await self._conn.execute('CREATE INDEX IF NOT EXISTS idx_jobs_source_url ON jobs(source_url)')
        await self._conn.execute('CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company)')
        await self._conn.execute('CREATE INDEX IF NOT EXISTS idx_jobs_publish_date ON jobs(publish_date)')
        await self._conn.commit()

    @staticmethod
    def _compute_content_hash(job: Dict[str, Any]) -> str:
        key_fields = ["title", "company", "location", "salary", "source_url"]
        content = "|".join(str(job.get(f, "")) for f in key_fields)
        return hashlib.md5(content.encode()).hexdigest()

    async def insert_jobs_batch(self, jobs: List[JobData], replace_existing: bool = False) -> int:
        if not jobs:
            return 0
        if not self._conn:
            await self.connect()

        start_time = time.perf_counter()
        total_inserted = 0

        if len(jobs) <= BATCH_CHUNK_SIZE:
            total_inserted = await self._execute_batch_insert(jobs, replace_existing)
        else:
            for i in range(0, len(jobs), BATCH_CHUNK_SIZE):
                chunk = jobs[i:i + BATCH_CHUNK_SIZE]
                inserted = await self._execute_batch_insert(chunk, replace_existing)
                total_inserted += inserted

        elapsed = time.perf_counter() - start_time
        logger.info(
            f"批量写入完成: {total_inserted}/{len(jobs)} 条, "
            f"耗时 {elapsed:.3f}s, 吞吐量 {len(jobs)/elapsed:.0f} 条/秒"
        )
        return total_inserted

    async def _execute_batch_insert(self, jobs: List[JobData], replace_existing: bool) -> int:
        flat_values: List[Any] = []
        for job in jobs:
            d = job.to_dict()
            d["content_hash"] = self._compute_content_hash(d)
            flat_values.extend(d[f] for f in _INSERT_FIELDS)
            if not replace_existing:
                flat_values.extend([0, 0])

        num_params_per_row = len(_INSERT_FIELDS) + (0 if replace_existing else 2)
        row_placeholder = "(" + ",".join(["?"] * num_params_per_row) + ")"
        placeholders = ",".join([row_placeholder] * len(jobs))

        if replace_existing:
            sql = _UPSERT_SQL_TEMPLATE.format(placeholders=placeholders)
        else:
            sql = _IGNORE_SQL_TEMPLATE.format(placeholders=placeholders)

        await self._conn.execute("BEGIN")
        try:
            cursor = await self._conn.execute(sql, flat_values)
            await self._conn.commit()
            return cursor.rowcount
        except Exception:
            await self._conn.rollback()
            raise

    async def get_existing_urls(self, urls: List[str]) -> Set[str]:
        if not self._conn:
            await self.connect()
        if not urls:
            return set()
        placeholders = ",".join("?" * len(urls))
        cursor = await self._conn.execute(
            f"SELECT source_url FROM jobs WHERE source_url IN ({placeholders})", urls
        )
        rows = await cursor.fetchall()
        return {row[0] for row in rows}
    
    async def get_all_urls_by_source(self, source: str) -> Set[str]:
        """
        获取指定数据源的所有URL
        
        Args:
            source: 数据源名称
        
        Returns:
            URL集合
        """
        if not self._conn:
            await self.connect()
        
        cursor = await self._conn.execute(
            "SELECT source_url FROM jobs WHERE source = ? AND source_url IS NOT NULL AND source_url != ''",
            (source,)
        )
        rows = await cursor.fetchall()
        return {row[0] for row in rows}
    
    async def get_dedup_stats(self, source: str) -> Dict[str, Any]:
        """
        获取去重统计信息
        
        Args:
            source: 数据源名称
        
        Returns:
            统计信息字典
        """
        if not self._conn:
            await self.connect()
        
        cursor = await self._conn.execute(
            "SELECT COUNT(*) FROM jobs WHERE source = ?",
            (source,)
        )
        total_count = (await cursor.fetchone())[0]
        
        cursor = await self._conn.execute(
            "SELECT COUNT(DISTINCT source_url) FROM jobs WHERE source = ?",
            (source,)
        )
        unique_count = (await cursor.fetchone())[0]
        
        return {
            "source": source,
            "total_count": total_count,
            "unique_count": unique_count,
            "duplicate_count": total_count - unique_count,
        }
    
    async def clean_invalid_data(self, source: Optional[str] = None) -> int:
        """
        清理无效数据（空标题、空公司、空URL）
        
        Args:
            source: 数据源名称（可选，不指定则清理所有）
        
        Returns:
            删除的记录数
        """
        if not self._conn:
            await self.connect()
        
        if source:
            cursor = await self._conn.execute(
                "DELETE FROM jobs WHERE source = ? AND (title = '' OR company = '' OR source_url = '' OR source_url IS NULL)",
                (source,)
            )
        else:
            cursor = await self._conn.execute(
                "DELETE FROM jobs WHERE title = '' OR company = '' OR source_url = '' OR source_url IS NULL"
            )
        
        deleted = cursor.rowcount
        await self._conn.commit()
        
        if deleted > 0:
            logger.info(f"清理无效数据: {deleted} 条")
        
        return deleted

    async def get_job_count(self) -> int:
        if not self._conn:
            await self.connect()
        cursor = await self._conn.execute("SELECT COUNT(*) FROM jobs")
        row = await cursor.fetchone()
        return row[0] if row else 0

    async def get_jobs_by_source(self, source: str) -> List[Dict[str, Any]]:
        if not self._conn:
            await self.connect()
        cursor = await self._conn.execute(
            "SELECT * FROM jobs WHERE source = ? ORDER BY publish_date DESC", (source,)
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]

    async def log_crawl(self, source: str, status: str, jobs_count: int = 0,
                        error_message: str = None, start_time: str = None,
                        end_time: str = None, duration: float = 0):
        if not self._conn:
            await self.connect()
        await self._conn.execute('''
            INSERT INTO crawl_logs (source, status, jobs_count, error_message, start_time, end_time, duration)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (source, status, jobs_count, error_message, start_time, end_time, duration))
        await self._conn.commit()

if __name__ == "__main__":
    import asyncio

    async def benchmark():
        db = LocalDatabase()
        await db.connect()

        test_jobs = [
            JobData(
                title=f"测试岗位_{i}",
                company=f"测试公司_{i}",
                location="上海",
                salary="面议",
                description="测试描述",
                requirements="测试要求",
                job_type="实习",
                industry="金融",
                education="本科",
                experience="无经验",
                source="benchmark",
                university="测试大学",
                source_url=f"http://test.com/{i}",
                apply_url="",
            )
            for i in range(1000)
        ]

        start = time.perf_counter()
        count = await db.insert_jobs_batch(test_jobs)
        elapsed = time.perf_counter() - start

        print(f"✅ 插入 {count} 条数据, 耗时 {elapsed:.3f}秒")
        print(f"   吞吐量: {len(test_jobs)/elapsed:.0f} 条/秒")

        await db.close()

    asyncio.run(benchmark())
