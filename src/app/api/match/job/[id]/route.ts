import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import type { ResumeProfile } from '@/lib/resume-types';
import { matchEngine } from '@/lib/match-engine';
import { scoreEngine } from '@/lib/score-engine';

const DB_PATH = path.join(process.cwd(), 'data', 'jobs.db');

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const db = new Database(DB_PATH, { readonly: true, fileMustExist: false });
    
    try {
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

    } finally {
      db.close();
    }

  } catch (error) {
    console.error('单岗位匹配错误:', error);
    return NextResponse.json(
      { error: '岗位匹配失败' },
      { status: 500 }
    );
  }
}
