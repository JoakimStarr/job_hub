import { NextRequest, NextResponse } from 'next/server';
import { getAllEnabledAlerts, recordAlertHistory, initJobAlertsTables } from '@/lib/job-alerts-db';
import { getNewJobsSince } from '@/lib/job-matcher';
import { aiMatchJobsToAllAlerts } from '@/lib/ai-matcher';
import { sendJobAlertEmail, isEmailConfigured } from '@/lib/email-service';
import { withApiHandler } from '@/lib/api-response';
import { logger } from '@/lib/logger';

export const POST = withApiHandler(async (request: NextRequest) => {
  const startTime = Date.now();
  let debugInfo: Record<string, unknown> = {};

  initJobAlertsTables();

  const body = await request.json();
  const { since_minutes = 30, job_ids } = body;

  debugInfo.request_params = { since_minutes, job_ids: job_ids?.length || 0, has_job_ids: !!job_ids };

  const alerts = getAllEnabledAlerts();
  debugInfo.alerts_count = alerts.length;
  debugInfo.alerts_detail = alerts.map(a => ({
    id: a.id,
    email: a.email,
    keywords: a.keywords,
    sources: a.sources,
    locations: a.locations,
    industries: a.industries,
    education: a.education,
    min_notify_interval: a.min_notify_interval,
    enabled: a.enabled,
    last_notified_at: a.last_notified_at,
    notify_count: a.notify_count,
  }));

  if (alerts.length === 0) {
    logger.info(`[TRIGGER] 无已启用的订阅，直接返回`);
    return NextResponse.json({
      success: true,
      message: 'No enabled alerts found',
      results: [],
      _debug: debugInfo,
    });
  }

  let jobs;
  if (job_ids && Array.isArray(job_ids) && job_ids.length > 0) {
    const { getDb } = require('@/lib/db-utils');
    const db = getDb();

    debugInfo.db_path = process.env.DATABASE_PATH || 'default';

    const placeholders = job_ids.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT id, title, company, location, salary, description, requirements,
             job_type, industry, education, experience, source, university,
             source_url, apply_url, publish_date, tags, created_at
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
      created_at: row.created_at as string,
    }));
    debugInfo.jobs_source = 'job_ids';
  } else {
    const since = new Date(Date.now() - since_minutes * 60 * 1000);
    debugInfo.since_time = since.toISOString();
    debugInfo.since_minutes = since_minutes;
    debugInfo.current_time = new Date().toISOString();

    jobs = getNewJobsSince(since);
    debugInfo.jobs_source = 'since_minutes';

    if (jobs.length > 0) {
      debugInfo.jobs_sample = jobs.slice(0, 3).map(j => ({
        id: j.id,
        title: j.title,
        created_at: j.publish_date,
        source: j.source,
      }));
    }
  }

  debugInfo.jobs_count = jobs.length;

  if (jobs.length === 0) {
    logger.info(`[TRIGGER] 无新岗位: since_minutes=${since_minutes}, alerts=${alerts.length}`);
    logger.info(`[TRIGGER-DEBUG] ${JSON.stringify(debugInfo)}`);

    const { getDb } = require('@/lib/db-utils');
    const db = getDb();

    const totalJobs = db.prepare('SELECT COUNT(*) as cnt FROM jobs').get() as { cnt: number };
    const latestJob = db.prepare('SELECT id, title, created_at FROM jobs ORDER BY id DESC LIMIT 1').get() as Record<string, unknown> | undefined;
    const recentJobs = db.prepare(
      "SELECT COUNT(*) as cnt FROM jobs WHERE created_at >= datetime('now', ? || ' minutes')"
    ).get(String(-since_minutes)) as { cnt: number };

    debugInfo.db_total_jobs = totalJobs.cnt;
    debugInfo.db_latest_job = latestJob ? { id: latestJob.id, title: latestJob.title, created_at: latestJob.created_at } : null;
    debugInfo.db_recent_jobs_count = recentJobs.cnt;

    return NextResponse.json({
      success: true,
      message: 'No new jobs found',
      results: [],
      _debug: debugInfo,
    });
  }

  logger.info(`[TRIGGER] 开始处理: ${jobs.length} 个岗位 vs ${alerts.length} 个订阅 (AI matching)`);

  const aiServiceAvailable = !!require('@/lib/ai-service').aiService;
  debugInfo.ai_service_available = aiServiceAvailable;

  const matchedResults = await aiMatchJobsToAllAlerts(jobs, alerts);
  debugInfo.matched_alerts_count = matchedResults.size;

  const results: Array<{
    alert_id: number;
    email: string;
    matched_count: number;
    email_sent: boolean;
    error?: string;
    ai_model?: string;
    match_mode?: string;
    skipped_reason?: string;
  }> = [];

  const emailConfigured = isEmailConfigured();
  debugInfo.email_configured = emailConfigured;

  const jobMap = new Map(jobs.map(j => [j.id, j]));

  for (const [alertId, aiResult] of matchedResults) {
    const alert = alerts.find(a => a.id === alertId);

    if (!alert) continue;

    if (alert.min_notify_interval && alert.min_notify_interval > 0 && alert.last_notified_at) {
      const lastNotified = new Date(alert.last_notified_at);
      const minIntervalMs = alert.min_notify_interval * 60 * 1000;
      const elapsed = Date.now() - lastNotified.getTime();
      if (elapsed < minIntervalMs) {
        const remainingMin = Math.ceil((minIntervalMs - elapsed) / 60000);
        logger.info(`[TRIGGER] Alert ${alertId}: 跳过(频率限制), interval=${alert.min_notify_interval}min, 剩余${remainingMin}min`);
        results.push({
          alert_id: alertId,
          email: alert.email,
          matched_count: aiResult.matched_jobs.length,
          email_sent: false,
          skipped_reason: `频率限制：距上次推送不足 ${alert.min_notify_interval} 分钟（还需 ${remainingMin} 分钟）`,
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
        matchMode: aiResult.model_used,
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
      match_mode: aiResult.model_used === 'rule-fallback' ? '规则匹配' : `AI(${aiResult.model_used || '未知'})`,
    });

    const matchMode = aiResult.model_used === 'rule-fallback' ? '规则匹配' : `AI(${aiResult.model_used || '未知'})`;
    logger.info(
      `[TRIGGER] Alert ${alertId}: ${aiResult.matched_jobs.length} 匹配 [${matchMode}], 邮件${emailSent ? '已发送' : '失败'}`
    );
  }

  const elapsed = Date.now() - startTime;
  debugInfo.elapsed_ms = elapsed;
  debugInfo.processed_alerts = results.length;
  debugInfo.results_summary = results.map(r => ({
    id: r.alert_id,
    matched: r.matched_count,
    sent: r.email_sent,
    error: r.error,
    skip: r.skipped_reason,
  }));

  logger.info(`[TRIGGER] 完成: ${jobs.length}岗位, ${results.length}订阅处理, 耗时${elapsed}ms`);

  return NextResponse.json({
    success: true,
    message: `Processed ${jobs.length} jobs, ${results.length} alerts triggered (AI mode)`,
    jobs_processed: jobs.length,
    alerts_triggered: results.length,
    results,
    _debug: debugInfo,
  });
});
