import { API, APIError } from '@/lib/api';
import { AUTH_TOKEN_KEY, AUTH_USER_KEY } from '@/lib/constants';
import type { AppUser } from '@/lib/types';
import { NextRequest } from 'next/server';

/**
 * 认证错误类
 */
export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

/**
 * 从请求中提取 Session Token
 * 优先从 Cookie 获取，其次从 Authorization Header
 */
function extractSessionToken(request: NextRequest): string | null {
  // 1. 优先从 Cookie 获取 (更安全的 HttpOnly Cookie)
  const sessionCookie = request.cookies.get('session_token');
  if (sessionCookie?.value) {
    return sessionCookie.value;
  }

  // 2. 从 Authorization Header 获取 (向后兼容)
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
}

/**
 * 验证用户认证状态
 * 通过调用数据库验证 Session Token
 */
export async function verifyAuth(request: NextRequest): Promise<{ authorized: boolean; user: AppUser | null }> {
  const token = extractSessionToken(request);

  if (!token) {
    return { authorized: false, user: null };
  }

  try {
    // 调用数据库验证 Session
    const response = await fetch(`${request.nextUrl.origin}/api/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      return { authorized: false, user: null };
    }

    const data = await response.json();

    if (!data.success || !data.user) {
      return { authorized: false, user: null };
    }

    return { authorized: true, user: data.user };
  } catch (error) {
    console.error('验证认证失败:', error);
    return { authorized: false, user: null };
  }
}

/**
 * 要求用户必须已登录
 * 未登录时抛出 AuthError
 */
export async function requireAuth(request: NextRequest): Promise<AppUser> {
  const result = await verifyAuth(request);
  if (!result.authorized || !result.user) {
    throw new AuthError('未授权访问，请先登录');
  }
  return result.user;
}

/**
 * 要求用户必须有特定权限
 */
export async function requirePermission(request: NextRequest, permission: string): Promise<AppUser> {
  const user = await requireAuth(request);
  if (!(user.permissions || []).includes(permission)) {
    throw new AuthError('权限不足，无法执行此操作');
  }
  return user;
}

// ==================== 客户端工具函数 ====================

/**
 * 获取存储的 Token
 */
export function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

/**
 * 设置会话信息
 */
export function setSession(token: string, user: AppUser): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

/**
 * 清除会话信息
 */
export function clearSession(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

/**
 * 获取缓存的用户信息
 */
export function getCachedUser(): AppUser | null {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(AUTH_USER_KEY) || 'null') as AppUser | null;
  } catch {
    return null;
  }
}

/**
 * 检查用户是否有特定权限
 */
export function hasPermission(user: AppUser | null, permission: string): boolean {
  return !!(user && Array.isArray(user.permissions) && user.permissions.includes(permission));
}

/**
 * 加载当前用户信息
 */
export async function loadCurrentUser(force = false): Promise<AppUser | null> {
  if (typeof window === 'undefined') return null;

  if (!force) {
    const cached = getCachedUser();
    if (cached?.id) return cached;
  }

  if (!getToken()) return null;

  try {
    const user = await API.getCurrentUser();
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    return user;
  } catch (error) {
    if (error instanceof APIError && error.status === 401) {
      clearSession();
      return null;
    }
    return getCachedUser() || null;
  }
}
