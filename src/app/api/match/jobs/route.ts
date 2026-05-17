import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import type { ResumeProfile, MatchResult, JobItem } from '@/lib/resume-types';
import { matchEngine } from '@/lib/match-engine';
import { scoreEngine } from '@/lib/score-engine';

const DB_PATH = path.join(process.cwd(), 'data', 'jobs.db');

export async function POST(request: NextRequest) {
  try {
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

    const db = new Database(DB_PATH, { readonly: true, fileMustExist: false });
    
    try {
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

      const maxResults = filters?.maxResults || 100;
      query += ` LIMIT ${maxResults}`;

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

      const processingTime = Date.now();

      return NextResponse.json({
        matches: matches.slice(0, maxResults),
        total: matches.length,
        processingTime: Date.now() - processingTime,
      });

    } finally {
      db.close();
    }

  } catch (error) {
    console.error('岗位匹配错误:', error);
    return NextResponse.json(
      { error: '岗位匹配失败' },
      { status: 500 }
    );
  }
}
