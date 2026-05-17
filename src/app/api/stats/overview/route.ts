import { NextResponse } from 'next/server';
import { getDb, getSourceName } from '@/lib/db-utils';
import { handleApiError } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import type { StatsOverview, JobItem } from '@/types';

export async function GET() {
  const startTime = Date.now();
  const path = '/api/stats/overview';
  
  try {
    const db = getDb();
    
    try {
      const totalJobs = db.prepare('SELECT COUNT(*) as count FROM jobs').get() as { count: number };
      const favoriteJobs = db.prepare('SELECT COUNT(*) as count FROM jobs WHERE is_favorite = 1').get() as { count: number };
      
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayJobs = db.prepare('SELECT COUNT(*) as count FROM jobs WHERE created_at >= ?').get(todayStart.toISOString()) as { count: number };
      
      const sourcesResult = db.prepare("SELECT COUNT(DISTINCT source) as count FROM jobs WHERE source IS NOT NULL AND source != ''").get() as { count: number };
      
      const sourceStats = db.prepare(`
        SELECT source, COUNT(*) as count 
        FROM jobs 
        WHERE source IS NOT NULL AND source != ''
        GROUP BY source 
        ORDER BY count DESC
        LIMIT 10
      `).all() as { source: string; count: number }[];
      
      const recentJobs = db.prepare(`
        SELECT 
          id, title, company, location, salary, source, 
          publish_date, created_at
        FROM jobs 
        ORDER BY created_at DESC
        LIMIT 6
      `).all() as JobItem[];
      
      const hotKeywords = extractHotKeywords(db);
      
      const response: StatsOverview = {
        overview: {
          total_jobs: totalJobs.count,
          favorite_jobs: favoriteJobs.count,
          today_jobs: todayJobs.count,
          sources_count: sourcesResult.count,
        },
        by_source: sourceStats.map(item => ({
          source: getSourceName(item.source),
          count: item.count,
          percentage: totalJobs.count > 0 ? Math.round((item.count / totalJobs.count) * 100 * 100) / 100 : 0,
        })),
        hot_keywords: hotKeywords,
        latest_jobs: recentJobs.map(job => ({
          ...job,
          source: getSourceName(String(job.source || '')),
        })),
      };
      
      logger.api('GET', path, 200, Date.now() - startTime, {
        totalJobs: totalJobs.count,
        sources: sourceStats.length,
      });
      
      return NextResponse.json(response);
    } finally {
      // Database connection is managed by singleton
    }
  } catch (error) {
    logger.error('Failed to fetch stats overview', error, { path });
    return handleApiError(error, { path });
  }
}

function extractHotKeywords(db: ReturnType<typeof getDb>) {
  const jobs = db.prepare(`
    SELECT title, description 
    FROM jobs 
    WHERE title IS NOT NULL OR description IS NOT NULL
    LIMIT 200
  `).all() as { title: string | null; description: string | null }[];
  
  const financeKeywords = [
    "金融", "投资", "证券", "基金", "银行", "保险", "信托",
    "投行", "行研", "分析师", "风控", "合规", "资管",
    "量化", "交易", "财富", "理财", "信贷", "债券",
    "股票", "期货", "外汇", "衍生品", "IPO", "并购",
    "实习", "研究员", "经理", "助理"
  ];
  
  const keywordCounts: Record<string, number> = {};
  
  for (const job of jobs) {
    const text = `${job.title || ''} ${job.description || ''}`;
    for (const keyword of financeKeywords) {
      if (text.includes(keyword)) {
        keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
      }
    }
  }
  
  return Object.entries(keywordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([keyword, count]) => ({ keyword, count }));
}
