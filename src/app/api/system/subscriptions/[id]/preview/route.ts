import { NextRequest, NextResponse } from 'next/server';
import { getDb, initSubscriptionAnalysisTables, splitMultiDelimiter } from '@/lib/db-utils';
import { getSubscriptionAnalyzer, type AnalysisProgress } from '@/lib/subscription-analyzer';
import { requirePermissionUnified } from '@/lib/auth-server';
import { AuthError } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  const acceptSSE = request.headers.get('accept')?.includes('text/event-stream');
  
  if (acceptSSE) {
    return handleSSEPreview(request, parseInt(id));
  }

  try {
    await requirePermissionUnified(request, 'system:read');
    
    const db = getDb();
    initSubscriptionAnalysisTables(db);

    const subscription = db.prepare(`
      SELECT id, name, keyword, locations, industries, job_types, education
      FROM subscriptions
      WHERE id = ?
    `).get(parseInt(id)) as {
      id: number;
      name: string;
      keyword: string | null;
      locations: string | null;
      industries: string | null;
      job_types: string | null;
      education: string | null;
    } | undefined;

    if (!subscription) {
      return NextResponse.json({ error: '订阅不存在' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const forceRefresh = body.force_refresh === true;

    const condition = {
      ...subscription,
      locations: splitMultiDelimiter(subscription.locations),
      industries: splitMultiDelimiter(subscription.industries),
      job_types: splitMultiDelimiter(subscription.job_types),
    };

    let aiService = null;
    try {
      const { createAIService } = await import('@/lib/ai-service');
      aiService = createAIService();
    } catch (e) {
      logger.warn('AI服务未配置，将使用本地规则匹配');
    }

    const analyzer = getSubscriptionAnalyzer({ aiService });
    const result = await analyzer.preview(condition, forceRefresh);

    return NextResponse.json(result);

  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('订阅预览分析错误:', error);
    return NextResponse.json(
      { error: '分析失败，请稍后重试' },
      { status: 500 }
    );
  }
}

async function handleSSEPreview(request: NextRequest, subscriptionId: number) {
  try {
    await requirePermissionUnified(request, 'system:read');
    
    const db = getDb();
    initSubscriptionAnalysisTables(db);

    const subscription = db.prepare(`
      SELECT id, name, keyword, locations, industries, job_types, education
      FROM subscriptions
      WHERE id = ?
    `).get(subscriptionId) as {
      id: number;
      name: string;
      keyword: string | null;
      locations: string | null;
      industries: string | null;
      job_types: string | null;
      education: string | null;
    } | undefined;

    if (!subscription) {
      return new Response(JSON.stringify({ error: '订阅不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json().catch(() => ({}));
    const forceRefresh = body.force_refresh === true;

    const condition = {
      ...subscription,
      locations: splitMultiDelimiter(subscription.locations),
      industries: splitMultiDelimiter(subscription.industries),
      job_types: splitMultiDelimiter(subscription.job_types),
    };

    let aiService = null;
    try {
      const { createAIService } = await import('@/lib/ai-service');
      aiService = createAIService();
    } catch (e) {
      logger.warn('AI服务未配置，将使用本地规则匹配');
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: Record<string, unknown>, eventName?: string) => {
          let payload = '';
          if (eventName) payload += `event: ${eventName}\n`;
          payload += `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        };

        try {
          sendEvent({ phase: 'scanning', phaseLabel: '扫描岗位数据', current: 0, total: 100, message: '正在初始化...' });

          const analyzer = getSubscriptionAnalyzer({
            aiService,
            onProgress: (progress: AnalysisProgress) => {
              sendEvent(progress as unknown as Record<string, unknown>);
            },
          });

          const result = await analyzer.preview(condition, forceRefresh);
          
          sendEvent({ ...result, type: 'complete' }, 'complete');
          controller.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '未知错误';
          sendEvent({ phase: 'failed', phaseLabel: '分析失败', current: 0, total: 0, message: errorMessage, type: 'error' }, 'error');
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('SSE预览分析错误:', error);
    return NextResponse.json({ error: '分析失败' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    await requirePermissionUnified(request, 'system:read');
    
    const db = getDb();
    initSubscriptionAnalysisTables(db);

    const latestAnalysis = db.prepare(`
      SELECT * FROM subscription_analyses 
      WHERE subscription_id = ?
      ORDER BY analyzed_at DESC 
      LIMIT 1
    `).get(parseInt(id)) as Record<string, unknown> | undefined;

    if (!latestAnalysis) {
      return NextResponse.json({
        analysis_id: null,
        status: 'no_analysis',
        message: '暂无分析记录',
        summary: null,
        results: [],
      });
    }

    return NextResponse.json({
      analysis_id: latestAnalysis.id,
      status: latestAnalysis.status,
      summary: {
        total_scanned: latestAnalysis.total_jobs_scanned,
        filtered_count: latestAnalysis.filtered_count ?? latestAnalysis.total_jobs_scanned,
        new_jobs: latestAnalysis.new_jobs_count,
        matched: latestAnalysis.matched_jobs_count,
        ai_summary: latestAnalysis.ai_summary || undefined,
      },
      cached_at: latestAnalysis.analyzed_at,
    });

  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('获取分析状态错误:', error);
    return NextResponse.json(
      { error: '获取分析状态失败' },
      { status: 500 }
    );
  }
}
