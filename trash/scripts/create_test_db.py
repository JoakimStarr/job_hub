#!/usr/bin/env python3
"""
创建数据库并插入测试数据
"""

import sqlite3
from pathlib import Path
from datetime import datetime, timedelta
import random

DB_PATH = Path(__file__).parent / "data" / "jobs.db"

def create_database():
    """创建数据库和表"""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    # 创建jobs表
    cursor.execute('''
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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    print("数据库创建成功")
    return conn

def insert_test_data(conn):
    """插入测试数据"""
    cursor = conn.cursor()
    
    # 测试数据
    sources = ['sufe', 'zuel', 'cufe', 'dufe', 'swufe', 'smartedu', 'uibe', 'jxufe', 'neu']
    source_names = ['上海财经大学', '中南财经政法大学', '中央财经大学', '东北财经大学', '西南财经大学', 
                    '国家大学生就业服务平台', '对外经济贸易大学', '江西财经大学', '东北大学']
    job_types = ['全职', '兼职', '实习', '校招']
    locations = ['上海', '北京', '深圳', '广州', '杭州', '成都', '武汉', '南京', '西安', '重庆']
    industries = ['保险', '信托', '咨询', '基金/资管', '投资/PEVC', '银行', '证券', '期货', '互联网金融', '其他']
    titles = ['投资分析师', '量化研究员', '风险管理师', '产品经理', '数据分析师', '财务分析师', 
              '市场营销', '人力资源', '运营专员', '技术开发']
    companies = ['中信证券', '国泰君安', '华泰证券', '招商银行', '平安保险', '华夏基金', 
                 '中金公司', '海通证券', '广发证券', '东方证券']
    
    # 插入100条测试数据
    for i in range(100):
        source = random.choice(sources)
        source_name = source_names[sources.index(source)]
        title = random.choice(titles)
        company = random.choice(companies)
        location = random.choice(locations)
        job_type = random.choice(job_types)
        industry = random.choice(industries)
        salary = f"{random.randint(5, 20)}K-{random.randint(20, 40)}K/月"
        education = random.choice(['本科', '硕士', '博士', '不限'])
        experience = random.choice(['应届', '1-3年', '3-5年', '5-10年', '不限'])
        
        # 随机日期
        days_ago = random.randint(0, 30)
        publish_date = (datetime.now() - timedelta(days=days_ago)).strftime('%Y-%m-%d')
        
        cursor.execute('''
            INSERT OR IGNORE INTO jobs 
            (title, company, location, salary, description, requirements, job_type, 
             industry, education, experience, source, university, source_url, 
             publish_date, is_favorite, is_read, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            title, company, location, salary, 
            f'{title}岗位描述，负责相关工作', 
            f'{education}学历，{experience}经验',
            job_type, industry, education, experience, 
            source, source_name, f'https://example.com/job/{i}', 
            publish_date, 
            random.randint(0, 1), random.randint(0, 1),
            datetime.now().isoformat(), datetime.now().isoformat()
        ))
    
    conn.commit()
    print(f"成功插入 {cursor.rowcount} 条测试数据")

def main():
    """主函数"""
    print("开始创建数据库...")
    conn = create_database()
    
    print("开始插入测试数据...")
    insert_test_data(conn)
    
    # 验证数据
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM jobs")
    count = cursor.fetchone()[0]
    print(f"数据库中共有 {count} 条数据")
    
    # 统计数据
    cursor.execute("SELECT source, COUNT(*) FROM jobs GROUP BY source")
    print("\n来源统计:")
    for row in cursor.fetchall():
        print(f"  {row[0]}: {row[1]} 条")
    
    cursor.execute("SELECT job_type, COUNT(*) FROM jobs GROUP BY job_type")
    print("\n岗位类型统计:")
    for row in cursor.fetchall():
        print(f"  {row[0]}: {row[1]} 条")
    
    conn.close()
    print("\n数据库创建完成！")

if __name__ == "__main__":
    main()
