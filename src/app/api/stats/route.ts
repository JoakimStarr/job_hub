import { NextResponse } from 'next/server';
import { getDb, getSourceName } from '@/lib/db-utils';

export async function GET() {
  try {
    const db = getDb();
    
    const totalJobs = db.prepare('SELECT COUNT(*) as count FROM jobs').get() as { count: number };
    const favoriteJobs = db.prepare('SELECT COUNT(*) as count FROM jobs WHERE is_favorite = 1').get() as { count: number };
    const readJobs = db.prepare('SELECT COUNT(*) as count FROM jobs WHERE is_read = 1').get() as { count: number };
    
    const sourceStats = db.prepare(`
      SELECT source, COUNT(*) as count 
      FROM jobs 
      GROUP BY source 
      ORDER BY count DESC
    `).all() as { source: string; count: number }[];
    
    const jobTypeStats = db.prepare(`
      SELECT job_type, COUNT(*) as count 
      FROM jobs 
      GROUP BY job_type 
      ORDER BY count DESC
    `).all() as { job_type: string; count: number }[];
    
    const locationStats = db.prepare(`
      SELECT location, COUNT(*) as count 
      FROM jobs 
      GROUP BY location 
      ORDER BY count DESC
      LIMIT 10
    `).all() as { location: string; count: number }[];
    
    const recentJobs = db.prepare(`
      SELECT 
        id, title, company, location, salary, source, 
        publish_date, created_at
      FROM jobs 
      ORDER BY created_at DESC
      LIMIT 5
    `).all() as Record<string, unknown>[];
    
    return NextResponse.json({
      total_jobs: totalJobs.count,
      favorite_jobs: favoriteJobs.count,
      read_jobs: readJobs.count,
      source_stats: sourceStats.map(item => ({
        source: getSourceName(item.source),
        count: item.count,
      })),
      job_type_stats: jobTypeStats,
      location_stats: locationStats,
      recent_jobs: recentJobs.map(job => ({
        ...job,
        source: getSourceName(String(job.source || '')),
      })),
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
