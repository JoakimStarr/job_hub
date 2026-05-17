import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db-utils';
import { requireAuth, AuthError } from '@/lib/auth';
import { logger } from '@/lib/logger';
import type { ResumeProfile, MatchResult, JobItem } from '@/lib/resume-types';
import { matchEngine } from '@/lib/match-engine';
import { scoreEngine } from '@/lib/score-engine';

export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now();
    requireAuth(request);

    const body = await request.json();
    const { profile, filters } = body as {
      profile: ResumeProfile;
      filters?: {
        location?: string[];
        jobType?: string[];
        industry?: string[];
        maxResults?: number;
      };
    };

    if (!profile) {
      return NextResponse.json(
        { error: '缺少用户画像数据' },
        { status: 400 }
      );
    }

    const db = getDb();

    let query = 'SELECT * FROM jobs WHERE 1=1';
    const params: any[] = [];

    if (filters?.location && filters.location.length > 0) {
      query += ` AND location LIKE ?`;
      params.push(`%${filters.location[0]}%`);
    }

    if (filters?.jobType && filters.jobType.length > 0) {
      query += ` AND job_type IN (${filters.jobType.map(() => '?').join(',')})`;
      params.push(...filters.jobType);
    }

    if (filters?.industry && filters.industry.length > 0) {
      query += ` AND industry LIKE ?`;
      params.push(`%${filters.industry[0]}%`);
    }

    query += ' ORDER BY publish_date DESC';

    const maxResults = Math.min(Math.max(1, Number(filters?.maxResults) || 100), 500);
    query += ` LIMIT ?`;
    params.push(maxResults);

    const jobs = db.prepare(query).all(...params) as JobItem[];

    const matches: MatchResult[] = jobs.map(job => {
      const score = matchEngine.match(profile, job);
      return {
        job,
        score,
        rank: 0,
      };
    });

    matches.sort((a, b) => b.score.total - a.score.total);

    matches.forEach((match, index) => {
      match.rank = index + 1;
    });

    return NextResponse.json({
      matches: matches.slice(0, maxResults),
      total: matches.length,
      processingTime: Date.now() - startTime,
    });

  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('岗位匹配错误:', error);
    return NextResponse.json(
      { error: '岗位匹配失败' },
      { status: 500 }
    );
  }
}
