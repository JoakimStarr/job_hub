import type { JobItem } from './types';
import type { JobAlert } from './job-alerts-db';
import { aiService } from './ai-service';
import { getNotifiedJobIds } from './job-alerts-db';
import { matchJobsToAlert, type MatchedJob as RuleMatchedJob } from './job-matcher';
import { logger } from './logger';

const FALLBACK_MODELS = [
  'glm-4.7-flash',           // Primary (fastest, cheapest)
  'glm-4-flash-250414',      // Fallback 1
  'glm-4.5-air',             // Fallback 2
  'glm-4.7',                 // Fallback 3
  'glm-4.6v-flash',          // Fallback 4 (vision model, still works for text)
  'glm-4.1v-thinking-flash', // Fallback 5
  'glm-4.6v',                // Fallback 6
];

async function chatWithFallback(
  messages: import('./ai-service').AIMessage[],
  primaryModel?: string,
): Promise<import('./ai-service').AIResponse> {
  const models = primaryModel && !FALLBACK_MODELS.includes(primaryModel)
    ? [primaryModel, ...FALLBACK_MODELS]
    : FALLBACK_MODELS;

  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const { AIService } = await import('./ai-service');
      const provider = (process.env.AI_PROVIDER || 'zhipu') as 'openai' | 'zhipu' | 'siliconflow' | 'deepseek' | 'custom';
      const apiKey = process.env.ZHIPU_API_KEY || process.env.AI_API_KEY || '';
      const baseUrl = process.env.AI_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';

      if (!apiKey) {
        throw new Error('AI API Key not configured');
      }

      const tempService = new AIService({
        provider,
        apiKey,
        baseUrl,
        model,
        temperature: 0.3,
        maxTokens: 8192,
      });

      const response = await tempService.chat(messages);
      if (model !== models[0]) {
        logger.info(`AI fallback: 使用备用模型 ${model} 成功 (主模型 ${models[0]} 不可用)`);
      }
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const is429 = lastError.message.includes('429') || lastError.message.includes('rate');
      if (is429) {
        logger.warn(`AI模型 ${model} 限流(429)，尝试下一个模型...`);
      } else {
        logger.warn(`AI模型 ${model} 调用失败: ${lastError.message}，尝试下一个模型...`);
      }
      continue;
    }
  }

  throw lastError || new Error('All AI models failed');
}

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

function jobToLLMInput(job: JobItem, maxDescLen: number = 200, maxReqLen: number = 150): LLMJobInput {
  return {
    id: job.id,
    title: job.title || '',
    company: job.company || '',
    location: job.location || '',
    salary: job.salary || '面议',
    description: (job.description || '').slice(0, maxDescLen),
    requirements: (job.requirements || '').slice(0, maxReqLen),
    job_type: job.job_type || '全职',
    industry: job.industry || '',
    education: job.education || '',
    source: job.source || '',
    university: job.university || '',
  };
}

function preFilterByKeywords(jobs: JobItem[], alert: JobAlert, notifiedJobIds: Set<number>): JobItem[] {
  const keywords = alert.keywords || [];
  if (keywords.length === 0) {
    // No keywords = match all (but still exclude notified)
    return jobs.filter(j => !notifiedJobIds.has(j.id));
  }

  const normalizeText = (text: string): string => text.toLowerCase().replace(/[\s\-_]/g, '');

  return jobs.filter(job => {
    if (notifiedJobIds.has(job.id)) return false;

    const searchText = normalizeText([
      job.title,
      job.company,
      job.tags,
      job.industry,
      (job.description || '').slice(0, 200),
      (job.requirements || '').slice(0, 100),
    ].filter(Boolean).join(' '));

    // OR logic: any keyword matches
    return keywords.some(kw => {
      const normalized = normalizeText(kw);
      return normalized && searchText.includes(normalized);
    });
  });
}

function buildMatchPrompt(
  alert: JobAlert,
  jobs: LLMJobInput[],
): { messages: Array<{ role: string; content: string }> } {
  const userPreferences = [
    `关键词（OR逻辑，任一匹配即推送）：${alert.keywords.join('、')}`,
    alert.sources?.length ? `数据源筛选：${alert.sources.join('、')}` : null,
    alert.locations?.length ? `期望地点：${alert.locations.join('、')}` : null,
    alert.industries?.length ? `期望行业：${alert.industries.join('、')}` : null,
    alert.education ? `最低学历要求：${alert.education}` : null,
    alert.exclude_keywords?.length ? `排除关键词（包含这些词的岗位必须排除）：${alert.exclude_keywords.join('、')}` : null,
  ].filter(Boolean).join('\n');

  const jobsText = jobs.map((job, idx) => `
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
4. 以下岗位已经过关键词预筛选，请进行语义分析和精准排序
5. 每个匹配的岗位必须给出简洁的推荐理由（一句话）
6. 排除关键词：如果用户设置了排除关键词，包含这些词的岗位必须排除，不计入匹配`,
    },
    {
      role: 'user',
      content: `## 用户订阅偏好
${userPreferences}

## 待筛选的候选岗位（共 ${jobs.length} 个，已过关键词预筛选）
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
  const notifiedJobIds = getNotifiedJobIds(alert.id);

  if (!aiService) {
    logger.warn(`AI服务未配置，Alert ${alert.id} 降级到规则匹配`);
    return ruleBasedFallback(jobs, alert, notifiedJobIds);
  }

  // Stage 1: 规则预筛选 - 用关键词OR逻辑快速过滤出候选岗位
  const candidates = preFilterByKeywords(jobs, alert, notifiedJobIds);

  if (candidates.length === 0) {
    logger.info(`AI Alert ${alert.id}: 预筛选后无候选岗位 (从 ${jobs.length} 个中筛选)`);
    return {
      alert_id: alert.id,
      matched_jobs: [],
      total_candidates: jobs.length,
      model_used: 'pre-filter-empty',
    };
  }

  // Stage 2: AI精排 - 只把候选岗位发给AI进行语义分析和排序
  // 限制最大候选数，避免上下文过长
  const MAX_AI_CANDIDATES = 50;
  const aiCandidates = candidates.slice(0, MAX_AI_CANDIDATES);

  // 截断过长描述，控制上下文长度
  const llmJobs = aiCandidates.map(j => jobToLLMInput(j, 200, 150));
  const { messages } = buildMatchPrompt(alert, llmJobs);

  try {
    const primaryModel = process.env.ZHIPU_MODEL || 'glm-4.7-flash';
    const response = await chatWithFallback(messages as import('./ai-service').AIMessage[], primaryModel);
    const matchedJobs = parseLLMResponse(response.content);

    matchedJobs.sort((a, b) => b.relevance_score - a.relevance_score);

    logger.info(
      `AI Alert ${alert.id}: 预筛选 ${candidates.length}/${jobs.length} → AI匹配 ${matchedJobs.length}, ` +
      `model=${response.model}`
    );

    return {
      alert_id: alert.id,
      matched_jobs: matchedJobs,
      total_candidates: jobs.length,
      model_used: response.model,
    };
  } catch (error) {
    logger.error(
      `AI匹配失败 Alert ${alert.id}: ${error instanceof Error ? error.message : String(error)}, 降级到规则匹配`
    );
    return ruleBasedFallback(jobs, alert, notifiedJobIds);
  }
}

function ruleBasedFallback(
  jobs: JobItem[],
  alert: JobAlert,
  notifiedJobIds: Set<number>,
): AIMatchResult {
  const ruleResults: RuleMatchedJob[] = matchJobsToAlert(jobs, alert);

  const matchedJobs: AIMatchedJob[] = ruleResults.map(r => ({
    job_id: r.job.id,
    matched_keywords: r.matchedKeywords,
    reason: `关键词「${r.matchedKeywords.join('、')}」${r.matchScore >= 80 ? '高度匹配' : r.matchScore >= 60 ? '较好匹配' : '基本匹配'}，匹配度 ${r.matchScore}%`,
    relevance_score: r.matchScore,
  }));

  logger.info(
    `Rule Alert ${alert.id}: ${matchedJobs.length}/${jobs.length} 匹配 (fallback模式), ` +
    `排除 ${notifiedJobIds.size} 已推送`
  );

  return {
    alert_id: alert.id,
    matched_jobs: matchedJobs,
    total_candidates: jobs.length,
    model_used: 'rule-fallback',
  };
}

export async function aiMatchJobsToAllAlerts(
  jobs: JobItem[],
  alerts: JobAlert[],
): Promise<Map<number, AIMatchResult>> {
  const results = new Map<number, AIMatchResult>();

  const CONCURRENCY_LIMIT = 5;
  const chunks: JobAlert[][] = [];

  for (let i = 0; i < alerts.length; i += CONCURRENCY_LIMIT) {
    chunks.push(alerts.slice(i, i + CONCURRENCY_LIMIT));
  }

  for (const chunk of chunks) {
    const chunkResults = await Promise.allSettled(
      chunk.map(alert => aiMatchJobsToAlert(jobs, alert))
    );

    for (let i = 0; i < chunk.length; i++) {
      const alert = chunk[i];
      const result = chunkResults[i];

      if (result.status === 'fulfilled') {
        const matchResult = result.value;
        if (matchResult.matched_jobs.length > 0) {
          results.set(alert.id, matchResult);
          const mode = matchResult.model_used === 'rule-fallback' ? '规则匹配(fallback)' : `AI匹配(${matchResult.model_used})`;
          logger.info(
            `[${mode}] Alert ${matchResult.alert_id} (${alert.email}): ` +
            `${matchResult.matched_jobs.length} 个岗位匹配`
          );
        } else if (matchResult.model_used) {
          const mode = matchResult.model_used === 'rule-fallback' ? '规则匹配' : 'AI匹配';
          logger.debug(
            `[${mode}] Alert ${matchResult.alert_id} (${alert.email}): 无匹配`
          );
        }
      } else {
        logger.error(`[ERROR] Alert ${alert.id} (${alert.email}) 匹配失败: ${result.reason}`);
      }
    }
  }

  return results;
}
