import type { User, Session } from '@/lib/auth-db';

export interface UserInfo extends User {
  failedLoginCount?: number;
}

export interface UserFormData {
  username: string;
  password: string;
  role: 'admin' | 'operator' | 'viewer';
  permissions: string[];
}

export interface EditUserFormData {
  username: string;
  role: 'admin' | 'operator' | 'viewer';
  permissions: string[];
  isActive: boolean;
}

export interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface SessionInfo extends Session {
  deviceInfo?: string;
  location?: string;
}

export interface AuthLogEntry {
  id: number;
  userId: number;
  username: string;
  ipAddress: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  timestamp: string;
  location?: string;
}

export interface PasswordStrength {
  score: number;
  label: string;
  color: string;
  checks: {
    length: boolean;
    lowercase: boolean;
    uppercase: boolean;
    numbers: boolean;
    special: boolean;
  };
}

export type UserRole = 'admin' | 'operator' | 'viewer';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: '管理员',
  operator: '操作员',
  viewer: '查看者',
};

export const ROLE_COLORS: Record<UserRole, 'rose' | 'amber' | 'slate'> = {
  admin: 'rose',
  operator: 'amber',
  viewer: 'slate',
};

export const DEFAULT_PERMISSIONS: Record<UserRole, string[]> = {
  admin: [
    'view_jobs', 'view_stats', 'manage_crawler', 'view_system',
    'use_recommendations', 'manage_users',
    'jobs:read', 'jobs:write', 'crawler:read', 'crawler:write',
    'system:read', 'system:write', 'users:read', 'users:write',
    'recommendations:read', 'recommendations:write',
    'match:read', 'match:write',
  ],
  operator: [
    'view_jobs', 'view_stats', 'manage_crawler', 'view_system',
    'use_recommendations',
    'jobs:read', 'jobs:write', 'crawler:read', 'crawler:write',
    'system:read', 'recommendations:read', 'recommendations:write',
    'match:read', 'match:write',
  ],
  viewer: [
    'view_jobs', 'view_stats', 'view_system', 'use_recommendations',
    'jobs:read', 'crawler:read', 'system:read',
    'recommendations:read', 'match:read',
  ],
};

export const PERMISSION_LABELS: Record<string, string> = {
  view_jobs: '查看岗位',
  view_stats: '查看统计',
  manage_crawler: '管理爬虫',
  view_system: '查看系统',
  use_recommendations: '使用推荐',
  manage_users: '用户管理',
  'jobs:read': '岗位-读',
  'jobs:write': '岗位-写',
  'crawler:read': '爬虫-读',
  'crawler:write': '爬虫-写',
  'system:read': '系统-读',
  'system:write': '系统-写',
  'users:read': '用户-读',
  'users:write': '用户-写',
  'recommendations:read': '推荐-读',
  'recommendations:write': '推荐-写',
  'match:read': '匹配-读',
  'match:write': '匹配-写',
};
