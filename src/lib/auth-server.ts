import { getAuthDb } from './auth-db';
import { verifyAuth, AuthError } from './auth';
import type { AppUser } from './types';
import { NextRequest } from 'next/server';

export function verifyAuthUnified(request: NextRequest): { authorized: boolean; user: AppUser | null; method: 'cookie' | 'token' | null } {
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

  const result = verifyAuth(request);
  if (result.authorized && result.user) {
    return { ...result, method: 'token' };
  }

  return { authorized: false, user: null, method: null };
}

export function requireAuthUnified(request: NextRequest): AppUser {
  const result = verifyAuthUnified(request);
  if (!result.authorized || !result.user) {
    throw new AuthError('未授权访问，请先登录');
  }
  return result.user;
}

export function requirePermissionUnified(request: NextRequest, permission: string): AppUser {
  const user = requireAuthUnified(request);
  if (!(user.permissions || []).includes(permission)) {
    throw new AuthError('权限不足，无法执行此操作');
  }
  return user;
}
