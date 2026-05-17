import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db-utils';

export async function GET() {
  try {
    const db = getDb();
    
    const totalJobs = db.prepare('SELECT COUNT(*) as count FROM jobs').get() as { count: number };
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayJobs = db.prepare('SELECT COUNT(*) as count FROM jobs WHERE created_at >= ?').get(todayStart.toISOString()) as { count: number };
    
    const status: {
      app: { version: string };
      database: { total_jobs: number };
      today_jobs: number;
      crawler_success_rate: number;
      ai_runtime: {
        timeout_rate: number;
        cache_hit_rate: number;
        daily_budget: number;
        daily_tokens: number;
        recent_failures: Array<{ model?: string; time?: string; message?: string }>;
      };
      task_center: Array<{ name: string; status: string; summary?: string; meta?: string[] }>;
      progress_summary: Array<{ status: string; count: number }>;
      recent_errors: Array<{ source?: string; time?: string; status?: string; message?: string }>;
      crawler_diagnostics: Record<string, { runs?: number; fetched?: number; saved?: number; duplicates?: number; failed?: number; write_failures?: number }>;
    } = {
      app: { version: 'v6.5.0' },
      database: { total_jobs: totalJobs.count },
      today_jobs: todayJobs.count,
      crawler_success_rate: 95,
      ai_runtime: {
        timeout_rate: 2,
        cache_hit_rate: 85,
        daily_budget: 1000,
        daily_tokens: 0,
        recent_failures: [],
      },
      task_center: [],
      progress_summary: [
        { status: 'pending', count: 0 },
        { status: 'completed', count: totalJobs.count },
      ],
      recent_errors: [],
      crawler_diagnostics: {},
    };
    
    return NextResponse.json(status);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch system status' },
      { status: 500 }
    );
  }
}
