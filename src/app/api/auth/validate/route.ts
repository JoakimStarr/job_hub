import { NextRequest, NextResponse } from 'next/server';
import { getAuthDb } from '@/lib/auth-db';

/**
 * POST /api/auth/validate
 * 验证 Session Token 是否有效
 *
 * 请求体:
 * {
 *   "token": "session_token_here"
 * }
 *
 * 响应:
 * 成功:
 * {
 *   "success": true,
 *   "user": { id, username, role, permissions }
 * }
 * 失败:
 * {
 *   "success": false,
 *   "error": "无效的会话"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { success: false, error: '缺少会话令牌' },
        { status: 400 }
      );
    }

    const authDb = getAuthDb();
    const user = authDb.validateSession(token);

    if (!user) {
      return NextResponse.json(
        { success: false, error: '会话已过期或无效' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user,
    });

  } catch (error) {
    console.error('验证会话失败:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
