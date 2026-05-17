import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { logger } from '@/lib/logger';

interface CrawlerStatus {
  is_running: boolean;
  status: string;
  progress: number;
  message: string;
  current_source: string | null;
  elapsed_seconds: number;
}

export async function GET() {
  const startTime = Date.now();
  const path = '/api/crawler/status';

  try {
    let isRunning = false;

    try {
      const { existsSync, readFileSync } = await import('fs');
      const pidFile = '/home/joakim/Project/job_hub/.crawler.pid';
      if (existsSync(pidFile)) {
        const content = readFileSync(pidFile, 'utf-8').trim();
        if (content) {
          isRunning = true;
        }
      }
    } catch {
      isRunning = false;
    }

    const status: CrawlerStatus = isRunning
      ? {
          is_running: true,
          status: 'running',
          progress: 0,
          message: '爬虫正在运行中',
          current_source: null,
          elapsed_seconds: 0,
        }
      : {
          is_running: false,
          status: 'idle',
          progress: 0,
          message: '爬虫当前未运行',
          current_source: null,
          elapsed_seconds: 0,
        };

    logger.api('GET', path, 200, Date.now() - startTime);

    return NextResponse.json(status);
  } catch (error) {
    logger.error('Failed to get crawler status', error, { path });
    return handleApiError(error, { path });
  }
}
