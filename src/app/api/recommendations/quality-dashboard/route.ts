import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUnified } from '@/lib/auth-server';
import { AuthError } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { getAISummary, getAILogs, initAILogTable } from '@/lib/ai-logger';
import { getDb } from '@/lib/db-utils';

initAILogTable();

export async function GET(request: NextRequest) {
  try {
    await requireAuthUnified(request);

    const db = getDb();
    const aiSummary = getAISummary();
    const recentLogs = getAILogs({ limit: 10 });

    const totalJobs = (db.prepare('SELECT COUNT(*) as count FROM jobs').get() as { count: number }).count;
    const totalUsers = (db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get() as { count: number }).count;
    const totalFavorites = (db.prepare('SELECT COUNT(*) as count FROM jobs WHERE is_favorite = 1').get() as { count: number }).count;

    const recentErrors = recentLogs.filter((l) => l.status === 'error');
    const avgDurationByType: Record<string, number> = {};
    for (const log of getAILogs({ limit: 200 })) {
      if (!avgDurationByType[log.type]) {
        avgDurationByType[log.type] = 0;
      }
      avgDurationByType[log.type] += log.duration_ms;
    }
    for (const type of Object.keys(avgDurationByType)) {
      const count = recentLogs.filter((l) => l.type === type).length || 1;
      avgDurationByType[type] = Math.round(avgDurationByType[type] / count);
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      overview: {
        totalJobs,
        totalUsers,
        totalFavorites,
        ...aiSummary,
      },
      performance: {
        averageResponseTime: aiSummary.avgDuration,
        successRate: aiSummary.successRate,
        averageTokensPerCall: aiSummary.avgTokens,
        byType: avgDurationByType,
      },
      recentActivity: {
        logs: recentLogs.slice(0, 5),
        errors: recentErrors.slice(0, 5),
      },
      healthStatus: {
        aiServiceAvailable: true,
        databaseConnected: true,
        lastError: recentErrors.length > 0 ? recentErrors[0].error_message : null,
        lastErrorTime: recentErrors.length > 0 ? recentErrors[0].created_at : null,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('获取推荐质量仪表盘失败:', error);
    return NextResponse.json({ error: '获取数据失败' }, { status: 500 });
  }
}