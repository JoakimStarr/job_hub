import type { JobItem } from './types';
import type { JobAlert } from './job-alerts-db';
import { getNotifiedJobIds } from './job-alerts-db';
import { logger } from './logger';

export interface MatchRule {
  keywords: string[];
  sources?: string[];
  locations?: string[];
  industries?: string[];
  minSalary?: number;
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

function extractSalaryNumber(salary: string): number {
  if (!salary || salary === '面议') return 0;

  const patterns = [
    /(\d+)\s*[kK千]/,
    /(\d+)\s*万/,
    /(\d{4,})/,
  ];

  for (const pattern of patterns) {
    const match = salary.match(pattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (salary.includes('万')) {
        return num * 10000;
      }
      if (salary.toLowerCase().includes('k') || salary.includes('千')) {
        return num * 1000;
      }
      return num;
    }
  }

  return 0;
}

function matchKeywords(job: JobItem, keywords: string[]): string[] {
  const matched: string[] = [];

  const searchText = normalizeText([
    job.title,
    job.company,
    job.description,
    job.requirements,
    job.industry,
    job.tags,
  ].filter(Boolean).join(' '));

  for (const keyword of keywords) {
    const normalizedKeyword = normalizeText(keyword);
    if (normalizedKeyword && searchText.includes(normalizedKeyword)) {
      matched.push(keyword);
    }
  }

  return matched;
}

function matchLocation(job: JobItem, locations: string[]): boolean {
  if (!locations || locations.length === 0) return true;
  if (!job.location) return false;

  const jobLocation = normalizeText(job.location);
  return locations.some(loc => jobLocation.includes(normalizeText(loc)));
}

function matchIndustry(job: JobItem, industries: string[]): boolean {
  if (!industries || industries.length === 0) return true;
  if (!job.industry) return false;

  const jobIndustry = normalizeText(job.industry);
  return industries.some(ind => jobIndustry.includes(normalizeText(ind)));
}

function matchSource(job: JobItem, sources: string[]): boolean {
  if (!sources || sources.length === 0) return true;
  if (!job.source) return false;
  return sources.includes(job.source);
}

function matchSalary(job: JobItem, minSalary?: number): boolean {
  if (!minSalary) return true;

  const jobSalary = extractSalaryNumber(job.salary || '');
  if (jobSalary === 0) return true;

  return jobSalary >= minSalary;
}

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

export function matchJobToRule(job: JobItem, rule: MatchRule): MatchedJob | null {
  const matchedKeywords = matchKeywords(job, rule.keywords);

  if (matchedKeywords.length === 0) {
    return null;
  }

  if (!matchSource(job, rule.sources || [])) {
    return null;
  }

  if (!matchLocation(job, rule.locations || [])) {
    return null;
  }

  if (!matchIndustry(job, rule.industries || [])) {
    return null;
  }

  if (!matchSalary(job, rule.minSalary)) {
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
    minSalary: alert.min_salary ? parseInt(alert.min_salary, 10) : undefined,
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

  results.sort((a, b) => b.matchScore - a.matchScore);

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
