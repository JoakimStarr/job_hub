import type { JobItem } from './types';
import type { JobAlert } from './job-alerts-db';
import { getNotifiedJobIds } from './job-alerts-db';
import { logger } from './logger';

export interface MatchRule {
  keywords: string[];
  sources?: string[];
  locations?: string[];
  industries?: string[];
  education?: string;
}

export interface MatchedJob {
  job: JobItem;
  matchedKeywords: string[];
  matchScore: number;
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[\s\-_]/g, '');
}

/**
 * 关键词匹配（OR 逻辑）
 * 任一关键词命中即算匹配，返回所有命中的关键词列表
 * 搜索范围：title + company + tags + industry + description(前200字) + requirements(前100字)
 */
function matchKeywords(job: JobItem, keywords: string[]): string[] {
  const matched: string[] = [];

  const searchText = normalizeText([
    job.title,
    job.company,
    job.tags,
    job.industry,
    (job.description || '').slice(0, 200),
    (job.requirements || '').slice(0, 100),
  ].filter(Boolean).join(' '));

  for (const keyword of keywords) {
    const normalizedKeyword = normalizeText(keyword);
    if (normalizedKeyword && searchText.includes(normalizedKeyword)) {
      matched.push(keyword);
    }
  }

  return matched;
}

/**
 * 数据源匹配：不选默认全通过
 */
function matchSource(job: JobItem, sources?: string[]): boolean {
  if (!sources || sources.length === 0) return true;
  if (!job.source) return true;
  return sources.includes(job.source);
}

/**
 * 地点匹配：不选默认全通过
 */
function matchLocation(job: JobItem, locations?: string[]): boolean {
  if (!locations || locations.length === 0) return true;
  if (!job.location) return true;

  const jobLocation = normalizeText(job.location);
  return locations.some(loc => jobLocation.includes(normalizeText(loc)));
}

/**
 * 行业匹配：不选默认全通过
 */
function matchIndustry(job: JobItem, industries?: string[]): boolean {
  if (!industries || industries.length === 0) return true;
  if (!job.industry) return true;

  const jobIndustry = normalizeText(job.industry);
  return industries.some(ind => jobIndustry.includes(normalizeText(ind)));
}

/**
 * 学历匹配：不选默认全通过，岗位学历 >= 用户要求学历
 */
function matchEducation(job: JobItem, education?: string): boolean {
  if (!education) return true;
  if (!job.education) return true;

  const jobEdu = normalizeText(job.education);
  const targetEdu = normalizeText(education);

  const eduLevels = ['大专', '本科', '硕士', '博士'];
  const jobLevel = eduLevels.findIndex(e => jobEdu.includes(normalizeText(e)));
  const targetLevel = eduLevels.findIndex(e => targetEdu.includes(normalizeText(e)));

  if (jobLevel === -1 || targetLevel === -1) return true;

  return jobLevel >= targetLevel;
}

/**
 * 单岗位匹配
 * 关键词为 OR 逻辑：任一关键词命中即匹配
 * 其他维度（数据源/地点/行业/学历）不选默认全通过
 * 评分 = 命中关键词数 / 总关键词数 × 100
 * 排序按命中关键词数降序（关键词多的排前面）
 */
export function matchJobToRule(job: JobItem, rule: MatchRule): MatchedJob | null {
  const matchedKeywords = matchKeywords(job, rule.keywords);

  // OR 逻辑：至少命中一个关键词
  if (matchedKeywords.length === 0) {
    return null;
  }

  if (!matchSource(job, rule.sources)) {
    return null;
  }

  if (!matchLocation(job, rule.locations)) {
    return null;
  }

  if (!matchIndustry(job, rule.industries)) {
    return null;
  }

  if (!matchEducation(job, rule.education)) {
    return null;
  }

  const matchScore = (matchedKeywords.length / rule.keywords.length) * 100;

  return {
    job,
    matchedKeywords,
    matchScore: Math.round(matchScore),
  };
}

export function matchJobsToAlert(jobs: JobItem[], alert: JobAlert): MatchedJob[] {
  const rule: MatchRule = {
    keywords: alert.keywords,
    sources: alert.sources,
    locations: alert.locations,
    industries: alert.industries,
    education: alert.education,
  };

  // 防重复推送：获取该订阅已推送过的 job_ids
  const notifiedJobIds = getNotifiedJobIds(alert.id);

  const results: MatchedJob[] = [];

  for (const job of jobs) {
    // 跳过已推送过的岗位
    if (notifiedJobIds.has(job.id)) {
      continue;
    }

    const matched = matchJobToRule(job, rule);
    if (matched) {
      results.push(matched);
    }
  }

  // 按匹配关键词数降序排序（关键词多的排前面），相同则按评分降序
  results.sort((a, b) => {
    if (b.matchedKeywords.length !== a.matchedKeywords.length) {
      return b.matchedKeywords.length - a.matchedKeywords.length;
    }
    return b.matchScore - a.matchScore;
  });

  if (notifiedJobIds.size > 0) {
    logger.info(`Alert ${alert.id}: skipped ${notifiedJobIds.size} previously notified jobs`);
  }

  return results;
}

export function matchJobsToAllAlerts(jobs: JobItem[], alerts: JobAlert[]): Map<number, MatchedJob[]> {
  const results = new Map<number, MatchedJob[]>();

  for (const alert of alerts) {
    const matchedJobs = matchJobsToAlert(jobs, alert);
    if (matchedJobs.length > 0) {
      results.set(alert.id, matchedJobs);
      logger.info(`Alert ${alert.id} (${alert.email}) matched ${matchedJobs.length} jobs`);
    }
  }

  return results;
}

export function getNewJobsSince(since: Date): JobItem[] {
  const { getDb } = require('./db-utils');
  const db = getDb();

  const sinceStr = since.toISOString().replace('T', ' ').slice(0, 19);

  const rows = db.prepare(`
    SELECT id, title, company, location, salary, description, requirements,
           job_type, industry, education, experience, source, university,
           source_url, apply_url, publish_date, tags
    FROM jobs
    WHERE created_at >= ?
    ORDER BY created_at DESC
  `).all(sinceStr) as Record<string, unknown>[];

  return rows.map(row => ({
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
}
