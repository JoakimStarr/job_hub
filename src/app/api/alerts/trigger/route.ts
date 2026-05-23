import { NextRequest, NextResponse } from 'next/server';
import { getAllEnabledAlerts, recordAlertHistory, initJobAlertsTables } from '@/lib/job-alerts-db';
import { getNewJobsSince } from '@/lib/job-matcher';
import { aiMatchJobsToAllAlerts } from '@/lib/ai-matcher';
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

    logger.info(`Processing ${jobs.length} jobs against ${alerts.length} alerts (AI matching)`);

    const matchedResults = await aiMatchJobsToAllAlerts(jobs, alerts);

    const results: Array<{
      alert_id: number;
      email: string;
      matched_count: number;
      email_sent: boolean;
      error?: string;
      ai_model?: string;
    }> = [];

    const emailConfigured = isEmailConfigured();
    const jobMap = new Map(jobs.map(j => [j.id, j]));

    for (const [alertId, aiResult] of matchedResults) {
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
            matched_count: aiResult.matched_jobs.length,
            email_sent: false,
            error: `频率限制：距上次推送不足 ${alert.min_notify_interval} 分钟（还需 ${remainingMin} 分钟）`,
          });
          continue;
        }
      }

      const jobIds = aiResult.matched_jobs.map(m => m.job_id);
      let emailSent = false;
      let errorMessage: string | undefined;

      if (emailConfigured) {
        const emailData = {
          to: alert.email,
          alertId: alert.id,
          keywords: alert.keywords,
          jobs: aiResult.matched_jobs.map(m => {
            const job = jobMap.get(m.job_id);
            return {
              id: m.job_id,
              title: job?.title || '',
              company: job?.company || '',
              location: job?.location || '',
              salary: job?.salary || '',
              source: job?.source || '',
              university: job?.university || '',
              source_url: job?.source_url || '',
              matchedKeywords: m.matched_keywords,
              reason: m.reason,
              relevanceScore: m.relevance_score,
            };
          }),
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
        matched_count: aiResult.matched_jobs.length,
        email_sent: emailSent,
        error: errorMessage,
        ai_model: aiResult.model_used,
      });

      logger.info(
        `Alert ${alertId} processed: ${aiResult.matched_jobs.length} matches, ` +
        `email ${emailSent ? 'sent' : 'failed'}, model=${aiResult.model_used || 'N/A'}`
      );
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${jobs.length} jobs, ${results.length} alerts triggered (AI mode)`,
      jobs_processed: jobs.length,
      alerts_triggered: results.length,
      results,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : '';
    console.error('Failed to trigger alerts:', errMsg);
    console.error('Stack:', errStack);
    return NextResponse.json(
      { success: false, error: `Failed to trigger alerts: ${errMsg}` },
      { status: 500 }
    );
  }
}
