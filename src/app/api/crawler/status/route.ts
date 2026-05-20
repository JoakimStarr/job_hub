import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { getDb } from '@/lib/db-utils';

interface CrawlerStatus {
  is_running: boolean;
  status: string;
  progress: number;
  message: string;
  current_source: string | null;
  elapsed_seconds: number;
  total_sources: number;
  completed_sources: number;
  total_jobs: number;
  start_time: string | null;
  last_update: string | null;
}

export async function GET() {
  const startTime = Date.now();
  const path = '/api/crawler/status';

  try {
    const db = getDb();
    
    const statusRow = db.prepare(`
      SELECT * FROM crawler_status WHERE id = 1
    `).get() as {
      is_running: number;
      status: string;
      current_source: string | null;
      total_sources: number;
      completed_sources: number;
      total_jobs: number;
      start_time: string | null;
      last_update: string | null;
      pid: number | null;
    } | undefined;

    if (!statusRow) {
      const status: CrawlerStatus = {
        is_running: false,
        status: 'idle',
        progress: 0,
        message: '爬虫状态未知',
        current_source: null,
        elapsed_seconds: 0,
        total_sources: 0,
        completed_sources: 0,
        total_jobs: 0,
        start_time: null,
        last_update: null,
      };
      return NextResponse.json(status);
    }

    const isRunning = statusRow.is_running === 1;
    const progress = statusRow.total_sources > 0 
      ? Math.round((statusRow.completed_sources / statusRow.total_sources) * 100) 
      : 0;

    let elapsedSeconds = 0;
    if (statusRow.start_time) {
      const startDate = new Date(statusRow.start_time);
      const now = new Date();
      elapsedSeconds = Math.floor((now.getTime() - startDate.getTime()) / 1000);
    }

    let message = '爬虫当前未运行';
    if (isRunning) {
      if (statusRow.current_source) {
        message = `正在爬取: ${statusRow.current_source}`;
      } else {
        message = '爬虫正在运行中';
      }
    } else if (statusRow.status === 'completed') {
      message = `上次爬取完成，共 ${statusRow.total_jobs} 条数据`;
    } else if (statusRow.status === 'error') {
      message = '上次爬取出错';
    }

    const status: CrawlerStatus = {
      is_running: isRunning,
      status: statusRow.status,
      progress,
      message,
      current_source: statusRow.current_source,
      elapsed_seconds: elapsedSeconds,
      total_sources: statusRow.total_sources,
      completed_sources: statusRow.completed_sources,
      total_jobs: statusRow.total_jobs,
      start_time: statusRow.start_time,
      last_update: statusRow.last_update,
    };

    logger.api('GET', path, 200, Date.now() - startTime);

    return NextResponse.json(status);
  } catch (error) {
    logger.error('Failed to get crawler status', error, { path });
    return handleApiError(error, { path });
  }
}
