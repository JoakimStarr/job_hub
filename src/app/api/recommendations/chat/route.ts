import { NextRequest, NextResponse } from 'next/server';
import { aiService, AIMessage } from '@/lib/ai-service';
import { requireAuthUnified } from '@/lib/auth-server';
import { AuthError } from '@/lib/auth';
import { logger } from '@/lib/logger';
import {
  createChatSession, getChatSession, getChatMessages,
  saveChatMessage, updateChatSessionTitle, getUserChatSessions,
} from '@/lib/chat-store';
import { getDb } from '@/lib/db-utils';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const user = await requireAuthUnified(request);
    const body = await request.json();
    const { session_id, job_id, message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: '请提供消息内容' }, { status: 400 });
    }

    if (!aiService) {
      return NextResponse.json(
        { error: 'AI服务未配置，请设置AI_API_KEY环境变量' },
        { status: 503 }
      );
    }

    const sessionId = session_id || `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const isNewSession = !session_id;

    if (isNewSession) {
      const db = getDb();
      let title = '新对话';
      if (job_id) {
        const job = db.prepare('SELECT title, company FROM jobs WHERE id = ?').get(job_id) as { title: string; company: string } | undefined;
        if (job) {
          title = `${job.company} - ${job.title}`;
        }
      }
      createChatSession(sessionId, user.id, job_id ? parseInt(job_id) : undefined);
      updateChatSessionTitle(sessionId, title);
    } else {
      const existing = getChatSession(sessionId);
      if (!existing) {
        return NextResponse.json({ error: '会话不存在' }, { status: 404 });
      }
    }

    saveChatMessage(sessionId, 'user', message);

    const history = getChatMessages(sessionId);
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `你是一位专业的金融行业求职顾问，拥有丰富的招聘和职业规划经验。
你的任务是帮助求职者分析岗位、优化简历、准备面试、制定求职策略。
请用专业、友好、鼓励的语气回复，提供具体、可操作的建议。
当前时间：${new Date().toLocaleString('zh-CN')}`,
      },
    ];

    for (const msg of history) {
      if (msg.role === 'system') continue;
      messages.push({ role: msg.role, content: msg.content });
    }

    const accept = request.headers.get('accept') || '';
    const wantsStream = accept.includes('text/event-stream') || body.stream === true;

    if (wantsStream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          let fullContent = '';
          try {
            for await (const chunk of (aiService as NonNullable<typeof aiService>).chatStream(messages)) {
              if (chunk.done) {
                if (fullContent) {
                  saveChatMessage(sessionId, 'assistant', fullContent);
                  if (isNewSession && fullContent.length > 10) {
                    const title = fullContent.slice(0, 40) + (fullContent.length > 40 ? '...' : '');
                    updateChatSessionTitle(sessionId, title);
                  }
                }
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, session_id: sessionId })}\n\n`));
                controller.close();
                return;
              }

              fullContent += chunk.content;
              const payload = {
                content: chunk.content,
                reasoning_content: chunk.reasoning_content,
                done: false,
                session_id: sessionId,
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'AI响应失败';
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMsg, done: true, session_id: sessionId })}\n\n`));
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

    const response = await (aiService as NonNullable<typeof aiService>).chat(messages);
    saveChatMessage(sessionId, 'assistant', response.content);

    if (isNewSession && response.content.length > 10) {
      const title = response.content.slice(0, 40) + (response.content.length > 40 ? '...' : '');
      updateChatSessionTitle(sessionId, title);
    }

    const duration = Date.now() - startTime;
    logger.api('POST', '/api/recommendations/chat', 200, duration);

    return NextResponse.json({
      result: response.content,
      session_id: sessionId,
      model: response.model,
      usage: response.usage,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const duration = Date.now() - startTime;
    logger.error('AI聊天失败:', error);
    logger.api('POST', '/api/recommendations/chat', 500, duration);
    return NextResponse.json({ error: 'AI聊天失败，请稍后重试' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthUnified(request);
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('session_id');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (sessionId) {
      const session = getChatSession(sessionId);
      if (!session) {
        return NextResponse.json({ error: '会话不存在' }, { status: 404 });
      }
      const messages = getChatMessages(sessionId);
      return NextResponse.json({ session, messages });
    }

    const sessions = getUserChatSessions(user.id, limit);
    return NextResponse.json({ sessions });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('获取聊天记录失败:', error);
    return NextResponse.json({ error: '获取聊天记录失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAuthUnified(request);
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json({ error: '请提供会话ID' }, { status: 400 });
    }

    const { deleteChatSession } = await import('@/lib/chat-store');
    deleteChatSession(sessionId);

    return NextResponse.json({ success: true, message: '会话已删除' });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('删除聊天会话失败:', error);
    return NextResponse.json({ error: '删除聊天会话失败' }, { status: 500 });
  }
}