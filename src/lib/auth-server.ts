import { getAuthDb } from './auth-db';
import { verifyAuth, AuthError } from './auth';
import type { AppUser } from './types';
import { NextRequest } from 'next/server';

/**
 * 统一认证验证（支持Cookie和Token）
 * 
 * 优先尝试Cookie认证（Session），失败后再尝试Token认证
 * 这是为了兼容旧的Token认证方式，同时支持新的Session认证
 */
export async function verifyAuthUnified(request: NextRequest): Promise<{ 
  authorized: boolean; 
  user: AppUser | null; 
  method: 'cookie' | 'token' | null 
}> {
  // 1. 优先尝试 Cookie 认证（Session方式）
  const sessionToken = request.cookies.get('session_token')?.value;
  if (sessionToken) {
    try {
      const authDb = getAuthDb();
      const user = authDb.validateSession(sessionToken);
      if (user) {
        return { 
          authorized: true, 
          user: user as AppUser, 
          method: 'cookie' 
        };
      }
    } catch (error) {
      console.warn('Cookie认证验证失败:', error);
    }
  }

  // 2. 尝试 Token 认证（新的数据库验证方式）
  const result = await verifyAuth(request);
  if (result.authorized && result.user) {
    return { ...result, method: 'token' };
  }

  return { authorized: false, user: null, method: null };
}

/**
 * 要求用户必须已登录
 */
export async function requireAuthUnified(request: NextRequest): Promise<AppUser> {
  const result = await verifyAuthUnified(request);
  if (!result.authorized || !result.user) {
    throw new AuthError('未授权访问，请先登录');
  }
  return result.user;
}

/**
 * 要求用户必须有特定权限
 */
export async function requirePermissionUnified(request: NextRequest, permission: string): Promise<AppUser> {
  const user = await requireAuthUnified(request);
  if (!(user.permissions || []).includes(permission)) {
    throw new AuthError('权限不足，无法执行此操作');
  }
  return user;
}
