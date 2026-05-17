import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db-utils';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');

    const db = getDb();

    const tableCheck = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='match_history'
    `).get();

    if (!tableCheck) {
      return NextResponse.json({
        history: [],
        message: '匹配历史表尚未创建',
      });
    }

    const history = db.prepare(`
      SELECT 
        id,
        user_id,
        job_id,
        score,
        match_level,
        matched_fields,
        gaps,
        suggestions,
        created_at
      FROM match_history
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit);

    return NextResponse.json({
      history: history.map((item: any) => ({
        ...item,
        matched_fields: item.matched_fields ? JSON.parse(item.matched_fields) : [],
        gaps: item.gaps ? JSON.parse(item.gaps) : [],
        suggestions: item.suggestions ? JSON.parse(item.suggestions) : [],
      })),
      total: history.length,
    });

  } catch (error) {
    logger.error('获取推荐历史错误:', error);
    return NextResponse.json(
      { error: '获取推荐历史失败' },
      { status: 500 }
    );
  }
}
