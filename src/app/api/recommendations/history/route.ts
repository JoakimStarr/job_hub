import { NextRequest, NextResponse } from 'next/server';
import { optionalAuthUnified, requireAuthUnified } from '@/lib/auth-server';
import { AuthError } from '@/lib/auth';
import { logger } from '@/lib/logger';
import {
  getRecommendationHistory,
  initRecommendationHistoryTable,
} from '@/lib/recommendation-history';

initRecommendationHistoryTable();

export async function GET(request: NextRequest) {
  try {
    const user = await optionalAuthUnified(request);

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const mode = searchParams.get('mode') || undefined;

    const history = getRecommendationHistory({
      userId: user.user?.id,
      mode,
      limit,
    });

    return NextResponse.json({
      history: history.map((item) => ({
        ...item,
        result: typeof item.result === 'string' ? JSON.parse(item.result) : item.result,
      })),
      total: history.length,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('获取推荐历史错误:', error);
    return NextResponse.json(
      { error: '获取推荐历史失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAuthUnified(request);
    const db = (await import('@/lib/db-utils')).getDb();
    db.prepare(`DELETE FROM recommendation_history`).run();
    return NextResponse.json({ success: true, message: '历史记录已清空' });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('删除推荐历史失败:', error);
    return NextResponse.json({ error: '删除推荐历史失败' }, { status: 500 });
  }
}