import { NextRequest, NextResponse } from 'next/server';
import { getAuthDb } from '@/lib/auth-db';

/**
 * POST /api/auth/login
 * 用户登录 - Session + Cookie 认证
 *
 * 请求体:
 * {
 *   "username": "admin",
 *   "password": "root"
 * }
 *
 * 响应:
 * 成功:
 * {
 *   "success": true,
 *   "user": { id, username, role, permissions },
 *   "message": "登录成功"
 * }
 * 失败:
 * {
 *   "success": false,
 *   "error": "错误信息",
 *   "errorCode": "ERROR_CODE"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    // 参数验证
    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: '用户名和密码不能为空', errorCode: 'MISSING_CREDENTIALS' },
        { status: 400 }
      );
    }

    // 获取客户端信息
    const ipAddress = request.headers.get('x-forwarded-for') || 
                       request.headers.get('x-real-ip') || 
                       'unknown';
    const userAgent = request.headers.get('user-agent') || undefined;

    // 调用认证
    const authDb = getAuthDb();
    const result = authDb.authenticate(
      { username, password },
      ipAddress,
      userAgent
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          errorCode: result.errorCode
        },
        { status: 401 }
      );
    }

    // 设置 HttpOnly Cookie (安全最佳实践)
    const response = NextResponse.json({
      success: true,
      user: result.user,
      message: `欢迎回来，${result.user!.username}！`
    });

    // 设置 Session Cookie
    response.cookies.set('session_token', result.sessionToken!, {
      httpOnly: true,        // 防止 XSS 攻击
      secure: false,  // 允许 HTTP 访问
      sameSite: 'lax',       // CSRF 防护
      maxAge: authDb.SESSION_TIMEOUT_HOURS * 3600,   // 过期时间（秒）
      path: '/',             // 全站可用
    });

    console.log(`✅ 登录成功: ${username} (${result.user?.role})`);
    return response;

  } catch (error) {
    console.error('❌ 登录失败:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误', errorCode: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
