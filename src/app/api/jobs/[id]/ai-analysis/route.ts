import { NextRequest, NextResponse } from 'next/server';
import { getDb, getSourceName, resolveSourceUrl, isFakeUrl } from '@/lib/db-utils';
import { aiService, AIMessage, AIStreamChunk } from '@/lib/ai-service';
import { requireAuthUnified } from '@/lib/auth-server';
import { AuthError } from '@/lib/auth';
import { logger } from '@/lib/logger';
import type { ResumeProfile } from '@/lib/resume-types';
import { buildRAGContext, buildRAGPrompt } from '@/lib/embedding-service';
import {
  logAICall,
  initAILogTable,
} from '@/lib/ai-logger';
import { saveRecommendationHistory, initRecommendationHistoryTable } from '@/lib/recommendation-history';

initAILogTable();
initRecommendationHistoryTable();

interface AnalysisResult {
  score: {
    total: number;
    skills: number;
    education: number;
    match_rate: number;
  };
  recommendation: string;
  suggestions: string[];
  risks: string[];
  action_plan: string[];
}

function generateMockAnalysis(job: Record<string, unknown>, profile?: ResumeProfile): AnalysisResult {
  const suggestions: string[] = [];
  const risks: string[] = [];
  let score = 50;

  if (job.salary) score += 15;
  else suggestions.push('职位未标明薪资范围，建议在面试时询问');

  if (job.description && String(job.description).length > 100) score += 20;
  else if (!job.description) suggestions.push('职位描述不完整，建议联系招聘方了解更多详情');

  if (job.requirements && String(job.requirements).length > 50) score += 10;
  if (job.company) score += 5;
  if (job.location) score += 5;

  if (String(job.title || '').includes('高级') || String(job.title || '').includes('资深')) {
    risks.push('该职位要求较高，需要丰富的经验');
  }
  if (!job.education || job.education === '不限') {
    suggestions.push('学历要求宽松，适合各层次求职者');
  }
  if (String(job.description || '').toLowerCase().includes('加班') ||
      String(job.requirements || '').toLowerCase().includes('加班')) {
    risks.push('职位描述中提及可能需要加班');
  }

  if (profile) {
    if (profile.skills.length > 0) {
      score += 5;
      suggestions.push(`你的技能组合包含 ${profile.skills.length} 项技能`);
    }
    if (profile.education && profile.education.length > 0) {
      const highestEdu = profile.education[profile.education.length - 1];
      if (highestEdu.degree === '本科' || highestEdu.degree === '硕士' || highestEdu.degree === '博士') {
        score += 5;
        suggestions.push(`你的学历背景符合大多数职位要求`);
      }
    }
  }

  score = Math.min(100, Math.max(0, score));

  let recommendation: string;
  if (score >= 75) recommendation = '推荐投递';
  else if (score >= 55) recommendation = '可以考虑';
  else recommendation = '竞争激烈';

  return {
    score: {
      total: score,
      skills: Math.min(100, score + Math.floor(Math.random() * 10 - 5)),
      education: Math.min(100, score + Math.floor(Math.random() * 10 - 5)),
      match_rate: Math.min(100, score + Math.floor(Math.random() * 15 - 7)),
    },
    recommendation,
    suggestions: suggestions.length > 0 ? suggestions : ['职位信息完整度较高', '建议准备相关作品集'],
    risks: risks.length > 0 ? risks : ['暂无明显风险因素'],
    action_plan: [
      '仔细阅读职位描述和要求',
      '准备针对性的简历和求职信',
      '了解公司背景和业务',
      '练习常见面试问题',
      '准备展示相关项目经验',
    ],
  };
}

function buildAnalysisPrompt(job: Record<string, unknown>, profile?: ResumeProfile): string {
  let prompt = `请分析以下职位信息，并提供详细的评估报告：

职位标题：${job.title || '未知'}
公司名称：${job.company || '未知'}
工作地点：${job.location || '未知'}
薪资范围：${job.salary || '未提供'}
职位类型：${job.job_type || '未知'}
行业：${job.industry || '未知'}
学历要求：${job.education || '不限'}
经验要求：${job.experience || '未说明'}

职位描述：
${job.description || '无详细描述'}

任职要求：
${job.requirements || '无具体要求'}`;

  const ragItems = buildRAGContext(job.id as number | undefined);
  if (ragItems.length > 0) {
    prompt += `\n\n【参考信息】\n${buildRAGPrompt(ragItems)}`;
  }

  if (profile) {
    prompt += `

求职者简历信息：
姓名：${profile.name}
邮箱：${profile.email}
电话：${profile.phone}
技能：${profile.skills.join(', ') || '无'}
教育背景：${profile.education.map(e => `${e.school} - ${e.major} (${e.degree})`).join('; ') || '无'}
实习经历：${profile.internships.map(i => `${i.company} - ${i.position}`).join('; ') || '无'}
项目经验：${profile.projects.map(p => p.name).join(', ') || '无'}
证书：${profile.certifications.join(', ') || '无'}
语言能力：${profile.languages.join(', ') || '无'}`;
  }

  prompt += `

请以JSON格式返回分析结果，包含以下字段：
{
  "score": {
    "total": 数字（0-100）,
    "skills": 数字（0-100）,
    "education": 数字（0-100）,
    "match_rate": 数字（0-100）
  },
  "recommendation": "推荐投递/可以考虑/竞争激烈",
  "suggestions": ["建议1", "建议2", ...],
  "risks": ["风险1", "风险2", ...],
  "action_plan": ["行动1", "行动2", ...]
}`;

  return prompt;
}

function parseAIResponse(content: string): AnalysisResult | null {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/s);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (
        parsed.score?.total !== undefined &&
        parsed.recommendation &&
        Array.isArray(parsed.suggestions)
      ) {
        return parsed as AnalysisResult;
      }
    }
    throw new Error('AI响应缺少必要字段');
  } catch {
    return null;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id } = await params;

  try {
    const user = await requireAuthUnified(request);

    const body = await request.json();
    const { profile, message, session_id, stream } = body;

    const db = getDb();
    const job = db.prepare(`
      SELECT 
        id, title, company, location, salary, description, requirements,
        job_type, industry, education, experience, source, university,
        source_url, apply_url, publish_date, deadline, category, tags
      FROM jobs WHERE id = ?
    `).get(parseInt(id)) as Record<string, unknown> | undefined;

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    job.source_url = resolveSourceUrl(String(job.source || ''), job.source_url as string, parseInt(id));
    if (!job.apply_url || isFakeUrl(job.apply_url as string)) {
      job.apply_url = resolveSourceUrl(String(job.source || ''), job.source_url as string, parseInt(id));
    }

    if (!aiService) {
      logger.warn('AI服务未配置，使用Mock数据');
      const mockResult = generateMockAnalysis(job, profile);
      logAICall({
        sessionId: session_id || `analysis_${id}_${Date.now()}`,
        type: 'analysis',
        provider: 'none',
        model: 'mock',
        status: 'fallback',
        durationMs: Date.now() - startTime,
        inputSummary: `Job ID: ${id}, hasProfile: ${!!profile}`,
        outputSummary: JSON.stringify(mockResult),
        jobId: parseInt(id),
        userId: user.id,
      });
      return NextResponse.json(mockResult);
    }

    const sessionId = session_id || `analysis_${id}_${Date.now()}`;
    const systemContent = `你是一位专业的金融行业职业分析师，擅长评估职位信息和匹配度。
请始终以JSON格式返回结果。如果用户追问，可以用Markdown格式自由回答，不必拘泥于JSON格式。
当前时间：${new Date().toLocaleString('zh-CN')}`;

    if (message && typeof message === 'string') {
      const accept = request.headers.get('accept') || '';
      const wantsStream = accept.includes('text/event-stream') || stream === true;

      const messages: AIMessage[] = [
        { role: 'system', content: systemContent },
        { role: 'user', content: buildAnalysisPrompt(job, profile) },
        { role: 'assistant', content: JSON.stringify(generateMockAnalysis(job, profile)) },
        { role: 'user', content: message },
      ];

      if (wantsStream) {
        return handleStreamResponse(messages, sessionId, user.id ?? 0, Number(id) || 0, startTime);
      }

      return handleChatResponse(messages, sessionId, user.id ?? 0, Number(id) || 0, startTime);
    }

    const analysisMessages: AIMessage[] = [
      { role: 'system', content: systemContent },
      { role: 'user', content: buildAnalysisPrompt(job, profile) },
    ];

    const response = await aiService.chat(analysisMessages);
    let result = parseAIResponse(response.content);

    if (!result) {
      logger.warn('AI响应解析失败，使用Mock数据');
      result = generateMockAnalysis(job, profile);
      logAICall({
        sessionId,
        type: 'analysis',
        provider: process.env.AI_PROVIDER || 'unknown',
        model: response.model,
        status: 'error',
        durationMs: Date.now() - startTime,
        inputSummary: `Job: ${job.title} at ${job.company}`,
        outputSummary: response.content.slice(0, 500),
        errorMessage: 'AI响应解析失败',
        jobId: parseInt(id),
        userId: user.id,
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens,
      });
    } else {
      logAICall({
        sessionId,
        type: 'analysis',
        provider: process.env.AI_PROVIDER || 'unknown',
        model: response.model,
        status: 'success',
        durationMs: Date.now() - startTime,
        inputSummary: `Job: ${job.title} at ${job.company}`,
        outputSummary: JSON.stringify(result),
        jobId: parseInt(id),
        userId: user.id,
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens,
      });
    }

    const duration = Date.now() - startTime;
    logger.api('POST', `/api/jobs/${id}/ai-analysis`, 200, duration);

    saveRecommendationHistory({
      userId: user.id,
      mode: 'ai_analysis',
      jobId: parseInt(id),
      profileSummary: profile ? `姓名:${profile.name} 技能:${profile.skills.join(',')}` : undefined,
      prompt: body.prompt || undefined,
      result: { ...result, _meta: { session_id: sessionId, model: response.model, usage: response.usage, duration_ms: duration } },
      sessionId,
      model: response.model,
      durationMs: duration,
    });

    return NextResponse.json({
      ...result,
      _meta: {
        session_id: sessionId,
        model: response.model,
        usage: response.usage,
        duration_ms: duration,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const duration = Date.now() - startTime;
    logger.error('AI analysis error:', error);
    logAICall({
      sessionId: `analysis_${id}_${Date.now()}`,
      type: 'analysis',
      provider: process.env.AI_PROVIDER || 'unknown',
      model: '',
      status: 'error',
      durationMs: duration,
      inputSummary: `Job ID: ${id}`,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      jobId: parseInt(id),
    });
    logger.api('POST', `/api/jobs/${id}/ai-analysis`, 500, duration);
    return NextResponse.json({ error: 'Failed to analyze job' }, { status: 500 });
  }
}

async function handleChatResponse(
  messages: AIMessage[],
  sessionId: string,
  userId: number,
  jobId: number,
  startTime: number
): Promise<NextResponse> {
  const response = await (aiService as NonNullable<typeof aiService>).chat(messages);

  logAICall({
    sessionId,
    type: 'analysis',
    provider: process.env.AI_PROVIDER || 'unknown',
    model: response.model,
    status: 'success',
    durationMs: Date.now() - startTime,
    inputSummary: messages[messages.length - 1].content.slice(0, 200),
    outputSummary: response.content.slice(0, 500),
    jobId,
    userId,
    inputTokens: response.usage?.prompt_tokens,
    outputTokens: response.usage?.completion_tokens,
    totalTokens: response.usage?.total_tokens,
  });

  return NextResponse.json({
    result: response.content,
    session_id: sessionId,
    model: response.model,
    usage: response.usage,
    chat_mode: true,
  });
}

async function handleStreamResponse(
  messages: AIMessage[],
  sessionId: string,
  userId: number,
  jobId: number,
  startTime: number
): Promise<Response> {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let fullContent = '';
      try {
        for await (const chunk of (aiService as NonNullable<typeof aiService>).chatStream(messages)) {
          if (chunk.done) {
            logAICall({
              sessionId,
              type: 'analysis',
              provider: process.env.AI_PROVIDER || 'unknown',
              model: chunk.model || '',
              status: 'success',
              durationMs: Date.now() - startTime,
              inputSummary: messages[messages.length - 1].content.slice(0, 200),
              outputSummary: fullContent.slice(0, 500),
              jobId,
              userId,
            });
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ done: true, session_id: sessionId })}\n\n`
            ));
            controller.close();
            return;
          }

          fullContent += chunk.content;
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({
              content: chunk.content,
              reasoning_content: chunk.reasoning_content,
              done: false,
              session_id: sessionId,
            })}\n\n`
          ));
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'AI响应失败';
        logAICall({
          sessionId,
          type: 'analysis',
          provider: process.env.AI_PROVIDER || 'unknown',
          model: '',
          status: 'error',
          durationMs: Date.now() - startTime,
          inputSummary: messages[messages.length - 1].content.slice(0, 200),
          errorMessage: errorMsg,
          jobId,
          userId,
        });
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ error: errorMsg, done: true, session_id: sessionId })}\n\n`
        ));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}