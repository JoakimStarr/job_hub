import { NextRequest, NextResponse } from 'next/server';
import { getDb, initSubscriptionAnalysisTables } from '@/lib/db-utils';
import { requirePermissionUnified } from '@/lib/auth-server';
import { AuthError } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; analysisId: string; resultId: string }> }
) {
  const { id, analysisId, resultId } = await params;
  
  try {
    await requirePermissionUnified(request, 'system:write');
    
    const db = getDb();
    initSubscriptionAnalysisTables(db);

    // 验证记录存在
    const result = db.prepare(`
      SELECT * FROM subscription_analysis_results 
      WHERE id = ? AND analysis_id = ?
    `).get(parseInt(resultId), parseInt(analysisId));

    if (!result) {
      return NextResponse.json({ error: '结果记录不存在' }, { status: 404 });
    }

    const body = await request.json();
    const isInterested = body.interested === true;

    db.prepare(`
      UPDATE subscription_analysis_results 
      SET is_interested = ? 
      WHERE id = ?
    `).run(isInterested ? 1 : 0, parseInt(resultId));

    return NextResponse.json({
      success: true,
      is_interested: isInterested,
    });

  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('标记感兴趣错误:', error);
    return NextResponse.json(
      { error: '操作失败' },
      { status: 500 }
    );
  }
}
