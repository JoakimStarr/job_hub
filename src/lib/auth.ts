import { API, APIError } from '@/lib/api';
import { AUTH_TOKEN_KEY, AUTH_USER_KEY } from '@/lib/constants';
import type { AppUser } from '@/lib/types';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

const TOKEN_SALT = process.env.AUTH_SALT || 'finintern-hub-default-salt';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token + TOKEN_SALT).digest('hex');
}

const VALID_TOKENS: Record<string, AppUser> = (() => {
  const tokens: Record<string, AppUser> = {};
  const adminToken = process.env.ADMIN_TOKEN || 'admin-token-default';
  const operatorToken = process.env.OPERATOR_TOKEN || 'operator-token-default';
  const viewerToken = process.env.VIEWER_TOKEN || 'viewer-token-default';

  tokens[hashToken(adminToken)] = {
    id: 1, username: 'admin', role: 'admin',
    permissions: [
      'view_jobs', 'view_stats', 'manage_crawler', 'view_system', 'use_recommendations', 'manage_users',
      'jobs:read', 'jobs:write', 'crawler:read', 'crawler:write',
      'system:read', 'system:write', 'users:read', 'users:write',
      'recommendations:read', 'recommendations:write', 'match:read', 'match:write',
    ],
  };
  tokens[hashToken(operatorToken)] = {
    id: 2, username: 'operator', role: 'operator',
    permissions: [
      'view_jobs', 'view_stats', 'manage_crawler', 'view_system', 'use_recommendations',
      'jobs:read', 'jobs:write', 'crawler:read', 'crawler:write',
      'system:read', 'recommendations:read', 'recommendations:write',
      'match:read', 'match:write',
    ],
  };
  tokens[hashToken(viewerToken)] = {
    id: 3, username: 'viewer', role: 'viewer',
    permissions: [
      'view_jobs', 'view_stats', 'view_system', 'use_recommendations',
      'jobs:read', 'crawler:read', 'system:read',
      'recommendations:read', 'match:read',
    ],
  };
  return tokens;
})();

export function verifyAuth(request: NextRequest): { authorized: boolean; user: AppUser | null } {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, user: null };
  }

  const token = authHeader.slice(7);
  const hashed = hashToken(token);
  const user = VALID_TOKENS[hashed];

  if (!user) {
    return { authorized: false, user: null };
  }

  return { authorized: true, user };
}

export function requireAuth(request: NextRequest): AppUser {
  const result = verifyAuth(request);
  if (!result.authorized || !result.user) {
    throw new AuthError('未授权访问，请先登录');
  }
  return result.user;
}

export function requirePermission(request: NextRequest, permission: string): AppUser {
  const user = requireAuth(request);
  if (!(user.permissions || []).includes(permission)) {
    throw new AuthError('权限不足，无法执行此操作');
  }
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

export function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

export function setSession(token: string, user: AppUser) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

export function getCachedUser() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(AUTH_USER_KEY) || 'null') as AppUser | null;
  } catch {
    return null;
  }
}

export function hasPermission(user: AppUser | null, permission: string) {
  return !!(user && Array.isArray(user.permissions) && user.permissions.includes(permission));
}

export async function loadCurrentUser(force = false) {
  if (typeof window === 'undefined') return null;
  if (!force) {
    const cached = getCachedUser();
    if (cached?.id) return cached;
  }
  if (!getToken()) return null;
  const cached = getCachedUser();
  try {
    const user = await API.getCurrentUser();
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    return user;
  } catch (error) {
    if (error instanceof APIError && error.status === 401) {
      clearSession();
      return null;
    }
    return cached || null;
  }
}
