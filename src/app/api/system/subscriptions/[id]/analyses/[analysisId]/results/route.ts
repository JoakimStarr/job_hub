import { NextRequest, NextResponse } from 'next/server';
import { getDb, initSubscriptionAnalysisTables } from '@/lib/db-utils';
import { getSubscriptionAnalyzer } from '@/lib/subscription-analyzer';
import { requirePermissionUnified } from '@/lib/auth-server';
import { AuthError } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; analysisId: string }> }
) {
  const { id, analysisId } = await params;
  
  try {
    await requirePermissionUnified(request, 'system:read');
    
    const db = getDb();
    initSubscriptionAnalysisTables(db);

    // 验证分析记录属于该订阅
    const analysis = db.prepare(`
      SELECT * FROM subscription_analyses WHERE id = ? AND subscription_id = ?
    `).get(parseInt(analysisId), parseInt(id));

    if (!analysis) {
      return NextResponse.json({ error: '分析记录不存在' }, { status: 404 });
    }

    const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '20'), 100);

    const analyzer = getSubscriptionAnalyzer();
    const result = analyzer.getAnalysisResults(db, parseInt(analysisId), page, limit);

    return NextResponse.json(result);

  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('获取分析结果错误:', error);
    return NextResponse.json(
      { error: '获取分析结果失败' },
      { status: 500 }
    );
  }
}
