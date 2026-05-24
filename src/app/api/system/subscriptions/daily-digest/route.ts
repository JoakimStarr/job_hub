import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db-utils';
import { SubscriptionAnalyzer } from '@/lib/subscription-analyzer';
import { sendSubscriptionAnalysisEmail, isEmailConfigured } from '@/lib/email-service';

export async function POST() {
  try {
    if (!isEmailConfigured()) {
      return NextResponse.json({ success: false, error: '邮件服务未配置' }, { status: 400 });
    }

    const subscriptions = db.prepare('SELECT id, name, enabled FROM subscriptions WHERE enabled = 1').all() as Array<{ id: number; name: string; enabled: number }>;

    if (subscriptions.length === 0) {
      return NextResponse.json({ success: true, message: '没有启用的订阅', results: [] });
    }

    const analyzer = new SubscriptionAnalyzer();
    const results: Array<{ subscriptionId: number; subscriptionName: string; emailSent: boolean; matchedCount: number; error?: string }> = [];

    for (const sub of subscriptions) {
      try {
        const lastAnalysis = db.prepare(
          'SELECT id, analyzed_at, total_jobs_scanned, new_jobs_count, matched_jobs_count, ai_summary FROM subscription_analyses WHERE subscription_id = ? AND status = ? ORDER BY analyzed_at DESC LIMIT 1'
        ).get(sub.id, 'completed') as {
          id: number;
          analyzed_at: string;
          total_jobs_scanned: number;
          new_jobs_count: number;
          matched_jobs_count: number;
          ai_summary: string;
        } | undefined;

        if (!lastAnalysis || lastAnalysis.matched_jobs_count === 0) {
          results.push({ subscriptionId: sub.id, subscriptionName: sub.name, emailSent: false, matchedCount: 0 });
          continue;
        }

        const analysisResults = db.prepare(
          'SELECT r.job_id, j.title, j.company, j.location, j.salary, j.education, r.match_score, r.skill_match, r.education_match, r.location_match, r.ai_reasoning, r.ai_suggestions FROM subscription_analysis_results r JOIN jobs j ON r.job_id = j.id WHERE r.analysis_id = ? ORDER BY r.match_score DESC LIMIT 10'
        ).all(lastAnalysis.id) as Array<{
          job_id: number;
          title: string;
          company: string;
          location: string;
          salary: string;
          education: string;
          match_score: number;
          skill_match: number;
          education_match: number;
          location_match: number;
          ai_reasoning: string;
          ai_suggestions: string;
        }>;

        const userEmail = process.env.DEFAULT_NOTIFICATION_EMAIL || process.env.SMTP_USER;

        if (!userEmail) {
          results.push({ subscriptionId: sub.id, subscriptionName: sub.name, emailSent: false, matchedCount: lastAnalysis.matched_jobs_count, error: '未配置通知邮箱' });
          continue;
        }

        const emailResult = await sendSubscriptionAnalysisEmail({
          to: userEmail,
          subscriptionId: sub.id,
          subscriptionName: sub.name,
          totalScanned: lastAnalysis.total_jobs_scanned,
          newJobsCount: lastAnalysis.new_jobs_count,
          matchedCount: lastAnalysis.matched_jobs_count,
          aiSummary: lastAnalysis.ai_summary || undefined,
          jobs: analysisResults.map((r) => ({
            job_id: r.job_id,
            title: r.title,
            company: r.company,
            location: r.location,
            salary: r.salary,
            education: r.education,
            match_score: Math.round(r.match_score),
            ai_reasoning: r.ai_reasoning || undefined,
            is_new: false,
          })),
        });

        results.push({
          subscriptionId: sub.id,
          subscriptionName: sub.name,
          emailSent: emailResult.success,
          matchedCount: lastAnalysis.matched_jobs_count,
          error: emailResult.error,
        });
      } catch (subError) {
        const errorMessage = subError instanceof Error ? subError.message : 'Unknown error';
        logger.error(`Failed to send daily digest for subscription ${sub.id}:`, errorMessage);
        results.push({ subscriptionId: sub.id, subscriptionName: sub.name, emailSent: false, matchedCount: 0, error: errorMessage });
      }
    }

    const sentCount = results.filter((r) => r.emailSent).length;
    return NextResponse.json({
      success: true,
      message: `处理完成：${subscriptions.length} 个订阅，发送 ${sentCount} 封邮件`,
      results,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Daily digest failed:', errorMessage);
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

export async function GET() {
  try {
    const config = {
      emailConfigured: isEmailConfigured(),
      notificationEmail: process.env.DEFAULT_NOTIFICATION_EMAIL || null,
      subscriptionCount: (db.prepare('SELECT COUNT(*) as count FROM subscriptions WHERE enabled = 1').get() as { count: number }).count,
      lastDigestSent: null as string | null,
    };

    const lastDigestRow = db.prepare("SELECT MAX(analyzed_at) as last_sent FROM subscription_analyses WHERE status = 'completed'").get() as { last_sent: string } | undefined;
    if (lastDigestRow?.last_sent) {
      config.lastDigestSent = lastDigestRow.last_sent;
    }

    return NextResponse.json(config);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
