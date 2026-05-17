import { NextRequest, NextResponse } from 'next/server';
import type { AppUser } from '@/lib/types';
import { logger } from '@/lib/logger';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin-token-default';
const OPERATOR_TOKEN = process.env.OPERATOR_TOKEN || 'operator-token-default';
const VIEWER_TOKEN = process.env.VIEWER_TOKEN || 'viewer-token-default';

const USER_MAP: Record<string, { token: string; user: AppUser }> = {
  admin: {
    token: ADMIN_TOKEN,
    user: {
      id: 1,
      username: 'admin',
      role: 'admin',
      permissions: [
        'view_jobs', 'view_stats', 'manage_crawler', 'view_system', 'use_recommendations', 'manage_users',
        'jobs:read', 'jobs:write', 'crawler:read', 'crawler:write',
        'system:read', 'system:write', 'users:read', 'users:write',
        'recommendations:read', 'recommendations:write', 'match:read', 'match:write',
      ],
    },
  },
  operator: {
    token: OPERATOR_TOKEN,
    user: {
      id: 2,
      username: 'operator',
      role: 'operator',
      permissions: [
        'view_jobs', 'view_stats', 'manage_crawler', 'view_system', 'use_recommendations',
        'jobs:read', 'jobs:write', 'crawler:read', 'crawler:write',
        'system:read', 'recommendations:read', 'recommendations:write',
        'match:read', 'match:write',
      ],
    },
  },
  viewer: {
    token: VIEWER_TOKEN,
    user: {
      id: 3,
      username: 'viewer',
      role: 'viewer',
      permissions: [
        'view_jobs', 'view_stats', 'view_system', 'use_recommendations',
        'jobs:read', 'crawler:read', 'system:read',
        'recommendations:read', 'match:read',
      ],
    },
  },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: '用户名和密码不能为空' },
        { status: 400 }
      );
    }

    const entry = USER_MAP[username];
    if (!entry || entry.token !== password) {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      access_token: password,
      user: entry.user,
    });
  } catch (error) {
    logger.error('登录失败', error, { path: '/api/auth/login' });
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
