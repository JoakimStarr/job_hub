import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db-utils';
import { matchJobsToAlert, getNewJobsSince } from '@/lib/job-matcher';
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
    
    const matchedJobs = matchJobsToAlert(jobs, alert);
    
    logger.info(`Preview alert ${alertId}: ${matchedJobs.length} matched from ${jobs.length} jobs`);
    
    return NextResponse.json({
      success: true,
      data: {
        alert: {
          id: alert.id,
          email: alert.email,
          keywords: alert.keywords,
        },
        total_jobs: jobs.length,
        matched_count: matchedJobs.length,
        matched_jobs: matchedJobs.slice(0, 10).map(m => ({
          id: m.job.id,
          title: m.job.title,
          company: m.job.company,
          location: m.job.location,
          salary: m.job.salary,
          university: m.job.university,
          source_url: m.job.source_url,
          matchedKeywords: m.matchedKeywords,
          matchScore: m.matchScore,
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
