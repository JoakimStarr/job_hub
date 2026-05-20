import type { PermissionKey } from '@/lib/types';

export const APP_NAME = 'FinIntern Hub';
export const APP_TAGLINE = '金融实习招聘平台';
export const APP_VERSION = `v${process.env.NEXT_PUBLIC_APP_VERSION || '6.5.0'}`;

export const AUTH_TOKEN_KEY = 'finintern_hub_auth_token';
export const AUTH_USER_KEY = 'finintern_hub_auth_user';
export const AUTH_EXPIRED_EVENT = 'finintern:auth-expired';

export const SOURCE_NAME_MAP: Record<string, string> = {
  swufe: '西南财经大学',
  dufe: '东北财经大学',
  sufe: '上海财经大学',
  jxufe: '江西财经大学',
  cufe: '中央财经大学',
  smartedu: '国家智慧教育平台',
  zuel: '中南财经政法大学',
  neu: '东北大学',
  uibe: '对外经济贸易大学',
};

export interface NavItem {
  key: string;
  label: string;
  href: string;
  description: string;
  emoji?: string;
  permission?: PermissionKey;
  guestVisible?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: '首页', href: '/', description: '平台概览和统计数据', emoji: '🏠', guestVisible: true },
  { key: 'jobs', label: '岗位列表', href: '/jobs', description: '浏览和筛选岗位', emoji: '💼', guestVisible: true },
  { key: 'match', label: '简历匹配', href: '/match', description: '上传简历分析并匹配最佳岗位', emoji: '🎯', permission: 'view_jobs' },
  { key: 'favorites', label: '我的收藏', href: '/favorites', description: '查看收藏岗位', emoji: '⭐' },
  { key: 'crawler', label: '数据采集', href: '/crawler', description: '管理爬虫任务', emoji: '🕷️', permission: 'manage_crawler' },
  { key: 'system', label: '系统状态', href: '/system', description: '配置和健康状态', emoji: '⚙️', permission: 'view_system' },
  { key: 'recommendations', label: '智能推荐', href: '/recommendations', description: 'AI 推荐与咨询', emoji: '🤖', permission: 'use_recommendations' },
  { key: 'users', label: '用户管理', href: '/users', description: '账号与权限管理', emoji: '👥', permission: 'manage_users' },
];

export const ROUTE_TITLES: Record<string, string> = {
  '/': '首页',
  '/jobs': '岗位列表',
  '/match': '简历匹配',
  '/favorites': '我的收藏',
  '/crawler': '数据采集',
  '/system': '系统状态',
  '/recommendations': '智能推荐',
  '/users': '用户管理',
  '/login': '登录',
};

// API 相关
export const DEBOUNCE_MS = 300;
export const DEFAULT_PAGE_SIZE = 12;
export const FAVORITES_PAGE_SIZE = 10;
export const MAX_MATCH_RESULTS = 50;

// 匹配分数阈值
export const SCORE_THRESHOLDS = {
  SPRINT: 85,
  MATCH: 70,
  POTENTIAL: 55,
} as const;

// 诊断分数阈值
export const DIAGNOSIS_SCORE_LEVELS = [
  { min: 80, colorKey: 'green' as const },
  { min: 60, colorKey: 'blue' as const },
  { min: 40, colorKey: 'yellow' as const },
  { min: 0, colorKey: 'red' as const },
] as const;
