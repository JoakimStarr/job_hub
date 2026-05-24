import { NextRequest, NextResponse } from 'next/server';
import { getDb, initSubscriptionAnalysisTables } from '@/lib/db-utils';
import { getSubscriptionAnalyzer } from '@/lib/subscription-analyzer';
import { requirePermissionUnified } from '@/lib/auth-server';
import { AuthError } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    await requirePermissionUnified(request);
    
    const db = getDb();
    initSubscriptionAnalysisTables(db);

    // 获取订阅信息
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

    // 解析请求参数
    const body = await request.json().catch(() => ({}));
    const forceRefresh = body.force_refresh === true;

    // 转换格式
    const condition = {
      ...subscription,
      locations: subscription.locations ? subscription.locations.split(',').map(s => s.trim()).filter(Boolean) : [],
      industries: subscription.industries ? subscription.industries.split(',').map(s => s.trim()).filter(Boolean) : [],
      job_types: subscription.job_types ? subscription.job_types.split(',').map(s => s.trim()).filter(Boolean) : [],
    };

    // 获取 AI 服务
    let aiService = null;
    try {
      const { getAIService } = await import('@/lib/ai-service');
      aiService = getAIService();
    } catch (e) {
      logger.warn('AI服务未配置，将使用本地规则匹配');
    }

    // 执行分析
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    await requirePermissionUnified(request);
    
    const db = getDb();
    initSubscriptionAnalysisTables(db);

    // 获取最新分析状态
    const latestAnalysis = db.prepare(`
      SELECT * FROM subscription_analyses 
      WHERE subscription_id = ?
      ORDER BY analyzed_at DESC 
      LIMIT 1
    `).get(parseInt(id));

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
