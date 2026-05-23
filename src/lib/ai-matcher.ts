import type { JobItem } from './types';
import type { JobAlert } from './job-alerts-db';
import { aiService } from './ai-service';
import { getNotifiedJobIds } from './job-alerts-db';
import { logger } from './logger';

export interface AIMatchedJob {
  job_id: number;
  matched_keywords: string[];
  reason: string;
  relevance_score: number;
}

export interface AIMatchResult {
  alert_id: number;
  matched_jobs: AIMatchedJob[];
  total_candidates: number;
  model_used?: string;
}

interface LLMJobInput {
  id: number;
  title: string;
  company: string;
  location: string;
  salary: string;
  description: string;
  requirements: string;
  job_type: string;
  industry: string;
  education: string;
  source: string;
  university: string;
}

function jobToLLMInput(job: JobItem): LLMJobInput {
  return {
    id: job.id,
    title: job.title || '',
    company: job.company || '',
    location: job.location || '',
    salary: job.salary || '面议',
    description: (job.description || '').slice(0, 500),
    requirements: (job.requirements || '').slice(0, 300),
    job_type: job.job_type || '全职',
    industry: job.industry || '',
    education: job.education || '',
    source: job.source || '',
    university: job.university || '',
  };
}

function buildMatchPrompt(
  alert: JobAlert,
  jobs: LLMJobInput[],
  excludedJobIds: Set<number>,
): { messages: Array<{ role: string; content: string }> } {
  const filteredJobs = jobs.filter(j => !excludedJobIds.has(j.id));

  const userPreferences = [
    `关键词（OR逻辑，任一匹配即推送）：${alert.keywords.join('、')}`,
    alert.sources?.length ? `数据源筛选：${alert.sources.join('、')}` : null,
    alert.locations?.length ? `期望地点：${alert.locations.join('、')}` : null,
    alert.industries?.length ? `期望行业：${alert.industries.join('、')}` : null,
    alert.education ? `最低学历要求：${alert.education}` : null,
  ].filter(Boolean).join('\n');

  const jobsText = filteredJobs.map((job, idx) => `
【岗位 ${idx + 1}】ID=${job.id}
- 职位名称：${job.title}
- 公司名称：${job.company}
- 工作地点：${job.location}
- 薪资范围：${job.salary}
- 岗位类型：${job.job_type}
- 所属行业：${job.industry}
- 学历要求：${job.education}
- 数据来源：${job.university} (${job.source})
- 职位描述：${job.description || '无'}
- 任职要求：${job.requirements || '无'}
`).join('\n');

  const messages = [
    {
      role: 'system',
      content: `你是一个专业的职位推荐助手。你的任务是根据用户的订阅偏好，从一批新发布的岗位中筛选出最匹配的岗位。

核心规则：
1. 关键词采用OR逻辑：用户设置的多个关键词，只要岗位与其中任意一个相关就算匹配
2. 语义理解：不仅要看字面匹配，还要理解语义相关性。例如"数据分析"可以匹配"数据挖掘"、"BI工程师"、"数据运营"等
3. 如果用户设置了数据源/地点/行业/学历筛选条件，必须同时满足
4. 排除已推送过的岗位（excluded_ids列表中的）
5. 每个匹配的岗位必须给出简洁的推荐理由（一句话）
6. 按匹配度从高到低排序输出`,
    },
    {
      role: 'user',
      content: `## 用户订阅偏好
${userPreferences}

## 已推送过的岗位ID（必须排除）
${Array.from(excludedJobIds).join(', ') || '无'}

## 待筛选的新岗位（共 ${filteredJobs.length} 个）
${jobsText}

请分析以上岗位，返回JSON格式的匹配结果。只返回JSON，不要其他内容。格式如下：
{
  "matched": [
    {
      "job_id": 岗位ID数字,
      "matched_keywords": ["命中的关键词1", "命中的关键词2"],
      "reason": "一句话推荐理由",
      "relevance_score": 匹配度分数1-100
    }
  ]
}

如果没有任何岗位匹配，返回 {"matched": []}`,
    },
  ];

  return { messages };
}

function parseLLMResponse(responseContent: string): AIMatchedJob[] {
  const cleaned = responseContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed.matched || !Array.isArray(parsed.matched)) {
      throw new Error('Invalid format: missing matched array');
    }
    return parsed.matched.map((item: Record<string, unknown>) => ({
      job_id: item.job_id as number,
      matched_keywords: Array.isArray(item.matched_keywords) ? item.matched_keywords as string[] : [],
      reason: (item.reason as string) || '',
      relevance_score: Math.min(100, Math.max(0, Number(item.relevance_score) || 50)),
    }));
  } catch (error) {
    logger.error(`解析LLM响应失败: ${error instanceof Error ? error.message : String(error)}`);
    logger.error(`原始响应: ${responseContent.slice(0, 500)}`);
    return [];
  }
}

export async function aiMatchJobsToAlert(
  jobs: JobItem[],
  alert: JobAlert,
): Promise<AIMatchResult> {
  if (!aiService) {
    logger.warn(`AI服务未配置，Alert ${alert.id} 使用规则匹配回退`);
    return { alert_id: alert.id, matched_jobs: [], total_candidates: jobs.length };
  }

  const notifiedJobIds = getNotifiedJobIds(alert.id);
  const llmJobs = jobs.map(jobToLLMInput);

  const { messages } = buildMatchPrompt(alert, llmJobs, notifiedJobIds);

  try {
    const response = await aiService.chat(messages as import('./ai-service').AIMessage[]);
    const matchedJobs = parseLLMResponse(response.content);

    matchedJobs.sort((a, b) => b.relevance_score - a.relevance_score);

    logger.info(
      `AI Alert ${alert.id}: ${matchedJobs.length}/${llmJobs.length} 匹配, ` +
      `排除 ${notifiedJobIds.size} 已推送, model=${response.model}`
    );

    return {
      alert_id: alert.id,
      matched_jobs: matchedJobs,
      total_candidates: llmJobs.length,
      model_used: response.model,
    };
  } catch (error) {
    logger.error(`AI匹配失败 Alert ${alert.id}: ${error instanceof Error ? error.message : String(error)}`);
    return { alert_id: alert.id, matched_jobs: [], total_candidates: llmJobs.length };
  }
}

export async function aiMatchJobsToAllAlerts(
  jobs: JobItem[],
  alerts: JobAlert[],
): Promise<Map<number, AIMatchResult>> {
  const results = new Map<number, AIMatchResult>();

  for (const alert of alerts) {
    const result = await aiMatchJobsToAlert(jobs, alert);
    if (result.matched_jobs.length > 0) {
      results.set(alert.id, result);
      logger.info(
        `AI Alert ${result.alert_id} (${alert.email}): ` +
        `${result.matched_jobs.length} 个岗位匹配`
      );
    }
  }

  return results;
}
