import { NextRequest, NextResponse } from 'next/server';
import { parseResumeText } from '@/lib/resume-parser';
import { requireAuthUnified } from '@/lib/auth-server';
import { AuthError } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    await requireAuthUnified(request);

    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: '缺少简历文本内容' },
        { status: 400 }
      );
    }

    if (text.length < 50) {
      return NextResponse.json(
        { error: '简历文本内容过短，请提供完整的简历内容' },
        { status: 400 }
      );
    }

    if (text.length > 100000) {
      return NextResponse.json(
        { error: '简历文本内容过长，请控制在100KB以内' },
        { status: 400 }
      );
    }

    const result = parseResumeText(text);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('简历解析错误:', error);
    return NextResponse.json(
      { error: '简历解析失败，请检查格式是否正确' },
      { status: 500 }
    );
  }
}
