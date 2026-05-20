import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js 中间件 - 服务端路由守卫
 *
 * 在页面渲染前检查认证状态，避免未认证用户看到页面内容闪烁。
 * 仅检查 session_token Cookie 是否存在，完整的认证验证由 AppShell 在客户端执行。
 *
 * 策略：
 * - /login 路径始终放行
 * - /api/* 路径始终放行（API 自行处理认证）
 * - 静态资源始终放行
 * - 其他路径检查 session_token Cookie，不存在则重定向到 /login
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // 登录页始终放行
  if (pathname === '/login') {
    return NextResponse.next();
  }

  // API 路由始终放行
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // 静态资源始终放行
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') // 文件扩展名（图片、字体等）
  ) {
    return NextResponse.next();
  }

  // 游客可访问路径（无需登录）
  const GUEST_PATHS = ['/', '/jobs'];
  if (GUEST_PATHS.some(guestPath => pathname === guestPath || pathname.startsWith(guestPath + '/'))) {
    return NextResponse.next();
  }

  // 检查 session_token Cookie
  const sessionToken = request.cookies.get('session_token')?.value;

  if (!sessionToken) {
    // 无 Cookie，重定向到登录页
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', encodeURIComponent(pathname + search));
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // 匹配所有路径，排除静态资源和 API
  matcher: [
    /*
     * 匹配所有路径，除了：
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico (网站图标)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
