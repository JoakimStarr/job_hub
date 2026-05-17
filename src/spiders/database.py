import aiosqlite
import hashlib
import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from loguru import logger

from .base import JobData


DB_DIR = Path(__file__).parent.parent.parent / "data"
DB_PATH = DB_DIR / "jobs.db"


class LocalDatabase:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = Path(db_path) if db_path else DB_PATH
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn: Optional[aiosqlite.Connection] = None

    async def connect(self):
        self._conn = await aiosqlite.connect(str(self.db_path))
        self._conn.row_factory = aiosqlite.Row
        await self._create_tables()
        logger.info(f"本地数据库已连接: {self.db_path}")

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
        if not self._conn:
            await self.connect()
        inserted = 0
        for job in jobs:
            try:
                d = job.to_dict()
                d["content_hash"] = self._compute_content_hash(d)
                if replace_existing:
                    await self._conn.execute('''
                        INSERT INTO jobs
                        (title, company, location, salary, description, requirements,
                         job_type, industry, education, experience, source, university,
                         source_url, apply_url, publish_date, deadline, category, tags,
                         content_hash)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(source_url) DO UPDATE SET
                            title=excluded.title, company=excluded.company,
                            location=excluded.location, salary=excluded.salary,
                            description=excluded.description, requirements=excluded.requirements,
                            job_type=excluded.job_type, industry=excluded.industry,
                            education=excluded.education, experience=excluded.experience,
                            source=excluded.source, university=excluded.university,
                            apply_url=excluded.apply_url, publish_date=excluded.publish_date,
                            deadline=excluded.deadline, category=excluded.category,
                            tags=excluded.tags, content_hash=excluded.content_hash,
                            updated_at=CURRENT_TIMESTAMP
                    ''', (
                        d["title"], d["company"], d["location"], d["salary"],
                        d["description"], d["requirements"], d["job_type"],
                        d["industry"], d["education"], d["experience"],
                        d["source"], d["university"], d["source_url"],
                        d["apply_url"], d["publish_date"], d["deadline"],
                        d["category"], d["tags"], d["content_hash"],
                    ))
                else:
                    await self._conn.execute('''
                        INSERT OR IGNORE INTO jobs
                        (title, company, location, salary, description, requirements,
                         job_type, industry, education, experience, source, university,
                         source_url, apply_url, publish_date, deadline, category, tags,
                         is_favorite, is_read, content_hash)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
                    ''', (
                        d["title"], d["company"], d["location"], d["salary"],
                        d["description"], d["requirements"], d["job_type"],
                        d["industry"], d["education"], d["experience"],
                        d["source"], d["university"], d["source_url"],
                        d["apply_url"], d["publish_date"], d["deadline"],
                        d["category"], d["tags"], d["content_hash"],
                    ))
                inserted += 1
            except aiosqlite.IntegrityError:
                pass
            except Exception as e:
                logger.warning(f"写入岗位失败: {job.title[:30]} - {e}")
        await self._conn.commit()
        return inserted

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
