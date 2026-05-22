import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUnified } from '@/lib/auth-server';
import { AuthError } from '@/lib/auth';
import { logger } from '@/lib/logger';
import {
  batchMatchJobs,
  enhancedCalculateMatchScore,
  getAlgorithmExplanation,
} from '@/lib/enhanced-match-engine';
import { getActiveProfile, initUserProfileTables } from '@/lib/user-profile-db';
import { getDb } from '@/lib/db-utils';
import type { JobItem, ResumeProfile } from '@/types';

initUserProfileTables();

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthUnified(request);
    const userId = user.id || 1;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'algorithm') {
      return NextResponse.json({
        success: true,
        algorithm: getAlgorithmExplanation(),
      });
    }

    if (action === 'single') {
      const jobId = parseInt(searchParams.get('jobId') || '0');
      
      if (!jobId) {
        return NextResponse.json(
          { error: '缺少职位ID' },
          { status: 400 }
        );
      }

      const profile = getActiveProfile(userId);
      if (!profile) {
        return NextResponse.json(
          { error: '未找到用户画像，请先上传简历' },
          { status: 404 }
        );
      }

      const db = getDb();
      const job = db.prepare(`
        SELECT * FROM jobs WHERE id = ?
      `).get(jobId) as JobItem | undefined;

      if (!job) {
        return NextResponse.json(
          { error: '未找到该职位' },
          { status: 404 }
        );
      }

      const result = enhancedCalculateMatchScore(profile, job);

      logger.info('单职位匹配完成', { userId, jobId, score: result.totalScore });

      return NextResponse.json({
        success: true,
        match: result,
      });
    }

    return NextResponse.json(
      { error: '未知操作类型' },
      { status: 400 }
    );

  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('获取匹配信息失败:', error);
    return NextResponse.json(
      { error: '获取匹配信息失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthUnified(request);
    const userId = user.id || 1;

    const body = await request.json();
    const { action, jobIds, filters } = body;

    switch (action) {
      case 'batch_match': {
        const profile = getActiveProfile(userId);
        
        if (!profile) {
          return NextResponse.json(
            { error: '未找到用户画像，请先上传简历或创建画像' },
            { status: 404 }
          );
        }

        let jobs: JobItem[];

        if (Array.isArray(jobIds) && jobIds.length > 0) {
          const db = getDb();
          const placeholders = jobIds.map(() => '?').join(',');
          jobs = db.prepare(`
            SELECT * FROM jobs WHERE id IN (${placeholders})
          `).all(...jobIds) as JobItem[];
        } else {
          const db = getDb();
          
          let whereClause = '1=1';
          const params: any[] = [];

          if (filters?.location) {
            whereClause += ' AND location LIKE ?';
            params.push(`%${filters.location}%`);
          }

          if (filters?.industry) {
            whereClause += ' AND industry LIKE ?';
            params.push(`%${filters.industry}%`);
          }

          if (filters?.source) {
            whereClause += ' AND source = ?';
            params.push(filters.source);
          }

          if (filters?.limit) {
            whereClause += ` ORDER BY published_at DESC LIMIT ${parseInt(filters.limit)}`;
          } else {
            whereClause += ' ORDER BY published_at DESC LIMIT 100';
          }

          jobs = db.prepare(`
            SELECT * FROM jobs WHERE ${whereClause}
          `).all(...params) as JobItem[];
        }

        if (!jobs.length) {
          return NextResponse.json({
            success: true,
            matches: [],
            total: 0,
            message: '没有找到可匹配的职位',
          });
        }

        const startTime = Date.now();
        const results = await batchMatchJobs(userId, jobs);
        const durationMs = Date.now() - startTime;

        logger.info('批量匹配完成', {
          userId,
          jobCount: jobs.length,
          duration: `${durationMs}ms`,
          avgScore: Math.round(results.reduce((sum, r) => sum + r.totalScore, 0) / results.length),
        });

        const summary = {
          total: results.length,
          excellent: results.filter(r => r.matchLevel === 'excellent').length,
          good: results.filter(r => r.matchLevel === 'good').length,
          moderate: results.filter(r => r.matchLevel === 'moderate').length,
          poor: results.filter(r => r.matchLevel === 'poor').length,
          averageScore: Math.round(results.reduce((sum, r) => sum + r.totalScore, 0) / results.length),
          topMatches: results.slice(0, 5).map(r => ({
            jobId: r.jobId,
            score: r.totalScore,
            level: r.matchLevel,
          })),
        };

        return NextResponse.json({
          success: true,
          matches: results,
          summary,
          algorithmVersion: '2.0',
          processingTime: `${durationMs}ms`,
        });
      }

      default:
        return NextResponse.json(
          { error: '未知操作类型' },
          { status: 400 }
        );
    }

  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    
    if (error instanceof Error && error.message.includes('未找到用户画像')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }
    
    logger.error('匹配计算失败:', error);
    return NextResponse.json(
      { error: '匹配计算失败，请稍后重试' },
      { status: 500 }
    );
  }
}