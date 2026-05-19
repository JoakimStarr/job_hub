import { NextRequest, NextResponse } from 'next/server';
import { getAuthDb } from '@/lib/auth-db';

/**
 * GET /api/auth/me
 * 获取当前登录用户信息
 *
 * 通过 Cookie 中的 session_token 验证身份并返回用户信息
 *
 * 响应:
 * 已登录:
 * {
 *   "authenticated": true,
 *   "user": { id, username, role, permissions, ... }
 * }
 * 未登录:
 * {
 *   "authenticated": false,
 *   "user": null
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({
        authenticated: false,
        user: null,
        message: '未登录'
      });
    }

    const authDb = getAuthDb();
    const user = authDb.validateSession(sessionToken);

    if (!user) {
      // Session 无效或过期，返回提示前端清除 cookie
      const response = NextResponse.json({
        authenticated: false,
        user: null,
        message: 'Session 已过期，请重新登录'
      });

      // 清除无效的 Cookie
      response.cookies.set('session_token', '', {
        httpOnly: true,
        maxAge: 0,
        path: '/',
      });

      return response;
    }

    return NextResponse.json({
      authenticated: true,
      user,
      message: `当前用户: ${user.username}`
    });

  } catch (error) {
    console.error('❌ 获取用户信息失败:', error);
    return NextResponse.json(
      { authenticated: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
