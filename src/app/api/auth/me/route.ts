import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const result = verifyAuth(request);

    if (!result.authorized || !result.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    return NextResponse.json(result.user);
  } catch (error) {
    logger.error('获取当前用户信息失败', error, { path: '/api/auth/me' });
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
