import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db-utils';
import { withApiHandler } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import type { ResumeProfile, MatchResult, JobItem } from '@/lib/resume-types';
import { matchEngine } from '@/lib/match-engine';
import { scoreEngine } from '@/lib/score-engine';

export const POST = withApiHandler(async (request: NextRequest) => {
  const startTime = Date.now();

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

  const BATCH_SIZE = Math.ceil(jobs.length / 4);
  const batches = Array.from({ length: 4 }, (_, i) =>
    jobs.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)
  );

  const batchResults = await Promise.all(
    batches.map(batch =>
      Promise.all(batch.map(job => matchEngine.match(profile, job)))
    )
  );

  const matches: MatchResult[] = batchResults.flat().map((score, index) => ({
    job: jobs[index],
    score,
    rank: 0,
  }));

  matches.sort((a, b) => b.score.total - a.score.total);

  matches.forEach((match, index) => {
    match.rank = index + 1;
  });

  return NextResponse.json({
    matches: matches.slice(0, maxResults),
    total: matches.length,
    processingTime: Date.now() - startTime,
  });
}, { requireAuth: true });
