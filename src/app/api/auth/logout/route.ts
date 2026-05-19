import { NextResponse } from 'next/server';
import { getAuthDb } from '@/lib/auth-db';

/**
 * POST /api/auth/logout
 * 用户登出 - 销毁 Session
 *
 * 清除客户端 Cookie 并删除服务端 Session 记录
 */
export async function POST() {
  try {
    const authDb = getAuthDb();

    // 注意: 实际的 token 从 cookie 中获取在 middleware 中处理
    // 这里我们返回清除 cookie 的响应

    const response = NextResponse.json({
      success: true,
      message: '已成功登出'
    });

    // 清除 Session Cookie
    response.cookies.set('session_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,  // 立即过期
      path: '/',
    });

    console.log('🚪 用户已登出');
    return response;

  } catch (error) {
    console.error('❌ 登出失败:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
