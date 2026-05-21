import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUnified, optionalAuthUnified } from '@/lib/auth-server';
import { AuthError } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { getAILogs, getAISummary, initAILogTable } from '@/lib/ai-logger';

initAILogTable();

export async function GET(request: NextRequest) {
  try {
    await optionalAuthUnified(request);

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const jobId = searchParams.get('job_id') ? parseInt(searchParams.get('job_id')!) : undefined;

    if (searchParams.get('summary') === '1') {
      const summary = getAISummary();
      return NextResponse.json(summary);
    }

    const logs = getAILogs({ type, limit, offset, jobId });
    return NextResponse.json({ logs, total: logs.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('获取AI日志失败:', error);
    return NextResponse.json({ error: '获取AI日志失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAuthUnified(request);

    const db = (await import('@/lib/db-utils')).getDb();
    const searchParams = request.nextUrl.searchParams;
    const beforeDate = searchParams.get('before');

    if (beforeDate) {
      db.prepare(`DELETE FROM ai_logs WHERE created_at < ?`).run(beforeDate);
      return NextResponse.json({
        success: true,
        message: `已删除 ${beforeDate} 之前的日志`,
      });
    }

    db.prepare(`DELETE FROM ai_logs`).run();
    return NextResponse.json({ success: true, message: '已清空所有AI日志' });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('删除AI日志失败:', error);
    return NextResponse.json({ error: '删除AI日志失败' }, { status: 500 });
  }
}