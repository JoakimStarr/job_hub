import { NextRequest, NextResponse } from 'next/server';
import { getAllEnabledAlerts, recordAlertHistory, initJobAlertsTables } from '@/lib/job-alerts-db';
import { matchJobsToAllAlerts, getNewJobsSince } from '@/lib/job-matcher';
import { sendJobAlertEmail, isEmailConfigured } from '@/lib/email-service';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    initJobAlertsTables();
    
    const body = await request.json();
    const { since_minutes = 30, job_ids } = body;
    
    const alerts = getAllEnabledAlerts();
    
    if (alerts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No enabled alerts found',
        results: [],
      });
    }
    
    let jobs;
    if (job_ids && Array.isArray(job_ids) && job_ids.length > 0) {
      const { getDb } = require('@/lib/db-utils');
      const db = getDb();
      
      const placeholders = job_ids.map(() => '?').join(',');
      const rows = db.prepare(`
        SELECT id, title, company, location, salary, description, requirements,
               job_type, industry, education, experience, source, university,
               source_url, apply_url, publish_date, tags
        FROM jobs
        WHERE id IN (${placeholders})
      `).all(...job_ids) as Record<string, unknown>[];
      
      jobs = rows.map(row => ({
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
    } else {
      const since = new Date(Date.now() - since_minutes * 60 * 1000);
      jobs = getNewJobsSince(since);
    }
    
    if (jobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new jobs found',
        results: [],
      });
    }
    
    logger.info(`Processing ${jobs.length} jobs against ${alerts.length} alerts`);
    
    const matchedResults = matchJobsToAllAlerts(jobs, alerts);
    
    const results: Array<{
      alert_id: number;
      email: string;
      matched_count: number;
      email_sent: boolean;
      error?: string;
    }> = [];
    
    const emailConfigured = isEmailConfigured();
    
    for (const [alertId, matchedJobs] of matchedResults) {
      const alert = alerts.find(a => a.id === alertId);

      if (!alert) continue;

      // 发送频率控制：检查距上次推送是否超过最短间隔
      if (alert.min_notify_interval && alert.min_notify_interval > 0 && alert.last_notified_at) {
        const lastNotified = new Date(alert.last_notified_at);
        const minIntervalMs = alert.min_notify_interval * 60 * 1000;
        const elapsed = Date.now() - lastNotified.getTime();
        if (elapsed < minIntervalMs) {
          const remainingMin = Math.ceil((minIntervalMs - elapsed) / 60000);
          logger.info(`Alert ${alertId} skipped: min_notify_interval=${alert.min_notify_interval}min, ${remainingMin}min remaining`);
          results.push({
            alert_id: alertId,
            email: alert.email,
            matched_count: matchedJobs.length,
            email_sent: false,
            error: `频率限制：距上次推送不足 ${alert.min_notify_interval} 分钟（还需 ${remainingMin} 分钟）`,
          });
          continue;
        }
      }

      const jobIds = matchedJobs.map(m => m.job.id);
      let emailSent = false;
      let errorMessage: string | undefined;
      
      if (emailConfigured) {
        const emailData = {
          to: alert.email,
          alertId: alert.id,
          keywords: alert.keywords,
          jobs: matchedJobs.map(m => ({
            id: m.job.id,
            title: m.job.title,
            company: m.job.company,
            location: m.job.location,
            salary: m.job.salary,
            source: m.job.source,
            university: m.job.university,
            source_url: m.job.source_url,
            matchedKeywords: m.matchedKeywords,
          })),
        };
        
        const emailResult = await sendJobAlertEmail(emailData);
        emailSent = emailResult.success;
        errorMessage = emailResult.error;
      } else {
        errorMessage = 'Email service not configured';
      }
      
      recordAlertHistory(alertId, jobIds, emailSent, errorMessage);
      
      results.push({
        alert_id: alertId,
        email: alert.email,
        matched_count: matchedJobs.length,
        email_sent: emailSent,
        error: errorMessage,
      });
      
      logger.info(`Alert ${alertId} processed: ${matchedJobs.length} matches, email ${emailSent ? 'sent' : 'failed'}`);
    }
    
    return NextResponse.json({
      success: true,
      message: `Processed ${jobs.length} jobs, ${results.length} alerts triggered`,
      jobs_processed: jobs.length,
      alerts_triggered: results.length,
      results,
    });
  } catch (error) {
    console.error('Failed to trigger alerts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to trigger alerts' },
      { status: 500 }
    );
  }
}
