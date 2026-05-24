import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db-utils';
import { aiMatchJobsToAlert } from '@/lib/ai-matcher';
import { getAlertById, initJobAlertsTables } from '@/lib/job-alerts-db';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    initJobAlertsTables();

    const { searchParams } = new URL(request.url);
    const alertId = searchParams.get('alert_id');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    if (!alertId) {
      return NextResponse.json(
        { success: false, error: '缺少订阅ID' },
        { status: 400 }
      );
    }

    const alert = getAlertById(parseInt(alertId, 10));

    if (!alert) {
      return NextResponse.json(
        { success: false, error: '订阅不存在' },
        { status: 404 }
      );
    }

    const db = getDb();

    const rows = db.prepare(`
      SELECT id, title, company, location, salary, description, requirements,
             job_type, industry, education, experience, source, university,
             source_url, apply_url, publish_date, tags
      FROM jobs
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit) as Record<string, unknown>[];

    const jobs = rows.map(row => ({
      id: row.id as number,
      title: row.title as string,
      company: row.company as string,
      location: row.location as string,
      salary: row.salary as string,
      description: row.description as string,
      requirements: row.requirements as string,
      job_type: row.job_type as string,
      industry: row.industry as string,
      education: row.education as string,
      experience: row.experience as string,
      source: row.source as string,
      university: row.university as string,
      source_url: row.source_url as string,
      apply_url: row.apply_url as string,
      publish_date: row.publish_date as string,
      tags: row.tags as string,
    }));

    const aiResult = await aiMatchJobsToAlert(jobs, alert, { skipNotifiedFilter: true });

    logger.info(`Preview alert ${alertId}: ${aiResult.matched_jobs.length} matched from ${jobs.length} jobs (AI mode)`);

    return NextResponse.json({
      success: true,
      data: {
        alert: {
          id: alert.id,
          email: alert.email,
          keywords: alert.keywords,
        },
        total_jobs: jobs.length,
        matched_count: aiResult.matched_jobs.length,
        ai_model: aiResult.model_used,
        matched_jobs: aiResult.matched_jobs.slice(0, 10).map(m => ({
          id: m.job_id,
          title: jobs.find(j => j.id === m.job_id)?.title || '',
          company: jobs.find(j => j.id === m.job_id)?.company || '',
          location: jobs.find(j => j.id === m.job_id)?.location || '',
          salary: jobs.find(j => j.id === m.job_id)?.salary || '',
          university: jobs.find(j => j.id === m.job_id)?.university || '',
          source_url: jobs.find(j => j.id === m.job_id)?.source_url || '',
          matchedKeywords: m.matched_keywords,
          reason: m.reason,
          matchScore: m.relevance_score,
        })),
      },
    });
  } catch (error) {
    console.error('Failed to preview alert:', error);
    return NextResponse.json(
      { success: false, error: '预览失败' },
      { status: 500 }
    );
  }
}
