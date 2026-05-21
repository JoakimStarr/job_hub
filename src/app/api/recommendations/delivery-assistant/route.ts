import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai-service';
import { requireAuthUnified } from '@/lib/auth-server';
import { AuthError } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { logAICall, initAILogTable } from '@/lib/ai-logger';

initAILogTable();

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

    const systemPrompt = `你是一位专业的求职投递顾问，熟悉金融行业的招聘流程和投递策略。
你的任务是帮助求职者制定投递计划，提高投递成功率和面试机会。

指导要点：
1. 投递时机选择
2. 投递渠道推荐
3. 投递策略建议
4. 跟进技巧
5. 面试准备

请用专业、友好、鼓励的语气回复，提供具体、可操作的建议。`;

    let userPrompt = '';

    if (profile) {
      userPrompt += `求职者背景：\n${profile}\n\n`;
    }

    if (prompt) {
      userPrompt += `用户问题：${prompt}\n`;
    } else {
      userPrompt += `请根据我的背景，提供投递策略和建议。`;
    }

    if (!userPrompt) {
      return NextResponse.json(
        { error: '请提供个人背景或具体问题' },
        { status: 400 }
      );
    }

    const response = await (aiService as NonNullable<typeof aiService>).chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    logAICall({
      sessionId: `delivery_${Date.now()}`,
      type: 'delivery',
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
    logger.api('POST', '/api/recommendations/delivery-assistant', 200, duration);

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
      sessionId: `delivery_${Date.now()}`,
      type: 'delivery',
      provider: process.env.AI_PROVIDER || 'unknown',
      model: '',
      status: 'error',
      durationMs: Date.now() - startTime,
      inputSummary: 'delivery assistant request',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    logger.error('投递助手错误:', error);
    return NextResponse.json(
      { error: '投递助手生成失败，请稍后重试' },
      { status: 500 }
    );
  }
}
