import { API, APIError } from '@/lib/api';
import { AUTH_TOKEN_KEY, AUTH_USER_KEY } from '@/lib/constants';
import type { AppUser } from '@/lib/types';

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
