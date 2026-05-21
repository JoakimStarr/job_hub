import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUnified, optionalAuthUnified } from '@/lib/auth-server';
import { AuthError } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { semanticSearch, batchGenerateEmbeddings } from '@/lib/embedding-service';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    await optionalAuthUnified(request);

    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q');
    const topK = parseInt(searchParams.get('top_k') || '10');

    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return NextResponse.json({ error: '请提供搜索关键词' }, { status: 400 });
    }

    const results = await semanticSearch(q.trim(), topK);

    const duration = Date.now() - startTime;
    logger.api('GET', '/api/jobs/semantic-search', 200, duration);

    return NextResponse.json({
      query: q,
      results,
      total: results.length,
      duration,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const duration = Date.now() - startTime;
    logger.error('语义搜索失败:', error);
    logger.api('GET', '/api/jobs/semantic-search', 500, duration);
    return NextResponse.json({ error: '语义搜索失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    await requireAuthUnified(request);

    const body = await request.json();
    const { action } = body;

    if (action === 'generate_embeddings') {
      const limit = body.limit || 100;
      const { success, failed } = await batchGenerateEmbeddings(limit);
      const duration = Date.now() - startTime;
      logger.api('POST', '/api/jobs/semantic-search', 200, duration);
      return NextResponse.json({
        success: true,
        generated: success,
        failed,
        duration,
      });
    }

    if (action === 'search') {
      const { query, top_k } = body;
      if (!query) {
        return NextResponse.json({ error: '请提供搜索关键词' }, { status: 400 });
      }
      const results = await semanticSearch(query, top_k || 10);
      return NextResponse.json({ query, results, total: results.length });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const duration = Date.now() - startTime;
    logger.error('语义搜索操作失败:', error);
    logger.api('POST', '/api/jobs/semantic-search', 500, duration);
    return NextResponse.json({ error: '语义搜索操作失败' }, { status: 500 });
  }
}