import { NextRequest, NextResponse } from 'next/server';
import { getDb, initSubscriptionAnalysisTables } from '@/lib/db-utils';
import { getSubscriptionAnalyzer } from '@/lib/subscription-analyzer';
import { requirePermissionUnified } from '@/lib/auth-server';
import { AuthError } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    await requirePermissionUnified(request);
    
    const db = getDb();
    initSubscriptionAnalysisTables(db);

    const analyzer = getSubscriptionAnalyzer();
    const history = analyzer.getAnalysisHistory(db, parseInt(id), 40);

    return NextResponse.json({
      total: history.length,
      analyses: history.map(h => ({
        id: h.id,
        analyzed_at: h.analyzed_at,
        status: h.status,
        total_scanned: h.total_jobs_scanned,
        matched_jobs_count: h.matched_jobs_count,
        ai_summary: h.ai_summary || undefined,
      })),
    });

  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('获取分析历史错误:', error);
    return NextResponse.json(
      { error: '获取分析历史失败' },
      { status: 500 }
    );
  }
}
