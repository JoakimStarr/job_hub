import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai-service';
import { requireAuthUnified } from '@/lib/auth-server';
import { AuthError } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { logAICall, initAILogTable } from '@/lib/ai-logger';
import { saveRecommendationHistory, initRecommendationHistoryTable } from '@/lib/recommendation-history';

initAILogTable();
initRecommendationHistoryTable();

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const user = await requireAuthUnified(request);

    const body = await request.json();
    const { profile, prompt } = body;

    if (!aiService) {
      return NextResponse.json(
        { error: 'AI服务未配置，请设置AI_API_KEY环境变量' },
        { status: 503 }
      );
    }

    const systemPrompt = `你是一位专业的简历优化顾问，拥有丰富的HR和招聘经验。
你的任务是帮助求职者优化简历，提高简历通过率和面试机会。

优化要点：
1. 简历结构优化
2. 内容表达优化
3. 关键词优化
4. 亮点突出
5. 避免常见错误

请用专业、友好、鼓励的语气回复，提供具体、可操作的建议。`;

    let userPrompt = '';

    if (profile) {
      userPrompt += `求职者简历：\n${profile}\n\n`;
    }

    if (prompt) {
      userPrompt += `用户问题：${prompt}\n`;
    } else {
      userPrompt += `请分析这份简历，指出优点、不足，并提供具体的优化建议。`;
    }

    if (!userPrompt) {
      return NextResponse.json(
        { error: '请提供简历内容或具体问题' },
        { status: 400 }
      );
    }

    const response = await (aiService as NonNullable<typeof aiService>).chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    logAICall({
      sessionId: `resume_advice_${Date.now()}`,
      type: 'resume_advice',
      provider: process.env.AI_PROVIDER || 'unknown',
      model: response.model,
      status: 'success',
      durationMs: Date.now() - startTime,
      inputSummary: userPrompt.slice(0, 200),
      outputSummary: response.content.slice(0, 500),
      userId: user.id,
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
      totalTokens: response.usage?.total_tokens,
    });

    const duration = Date.now() - startTime;
    logger.api('POST', '/api/recommendations/resume-advice', 200, duration);

    saveRecommendationHistory({
      userId: user.id,
      mode: 'resume',
      profileSummary: profile ? profile.slice(0, 200) : undefined,
      prompt: prompt || undefined,
      result: { result: response.content, model: response.model, usage: response.usage },
      model: response.model,
      durationMs: duration,
    });

    return NextResponse.json({
      result: response.content,
      model: response.model,
      usage: response.usage,
    });

  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logAICall({
      sessionId: `resume_advice_${Date.now()}`,
      type: 'resume_advice',
      provider: process.env.AI_PROVIDER || 'unknown',
      model: '',
      status: 'error',
      durationMs: Date.now() - startTime,
      inputSummary: 'resume advice request',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    logger.error('简历建议错误:', error);
    return NextResponse.json(
      { error: '简历建议生成失败，请稍后重试' },
      { status: 500 }
    );
  }
}
