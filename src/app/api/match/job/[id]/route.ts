import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db-utils';
import { requireAuthUnified } from '@/lib/auth-server';
import { AuthError } from '@/lib/auth';
import type { ResumeProfile } from '@/lib/resume-types';
import { matchEngine } from '@/lib/match-engine';
import { scoreEngine } from '@/lib/score-engine';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuthUnified(request);

    const { id } = await params;
    const jobId = parseInt(id);

    if (isNaN(jobId)) {
      return NextResponse.json(
        { error: '无效的岗位ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { profile } = body as { profile: ResumeProfile };

    if (!profile) {
      return NextResponse.json(
        { error: '缺少用户画像数据' },
        { status: 400 }
      );
    }

    const db = getDb();

    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);

    if (!job) {
      return NextResponse.json(
        { error: '岗位不存在' },
        { status: 404 }
      );
    }

    const score = matchEngine.match(profile, job as any);
    const recommendation = scoreEngine.getMatchLevel(score.total);
    const suggestions = scoreEngine.generateSuggestions(profile, job as any, score);
    const actionPlan = scoreEngine.generateActionPlan(profile, job as any, score);

    return NextResponse.json({
      score,
      recommendation,
      suggestions,
      actionPlan,
      matchColor: scoreEngine.getMatchColor(score.total),
      priority: scoreEngine.getRecommendationPriority(score.total),
    });

  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('单岗位匹配错误:', error);
    return NextResponse.json(
      { error: '岗位匹配失败' },
      { status: 500 }
    );
  }
}
