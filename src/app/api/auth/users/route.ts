import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { AuthError } from '@/lib/auth';
import { handleApiError } from '@/lib/api-response';
import type { AppUser } from '@/lib/types';
import { logger } from '@/lib/logger';

const USERS: AppUser[] = [
  {
    id: 1,
    username: 'admin',
    role: 'admin',
    permissions: [
      'jobs:read', 'jobs:write', 'crawler:read', 'crawler:write',
      'system:read', 'system:write', 'users:read', 'users:write',
      'recommendations:read', 'recommendations:write', 'match:read', 'match:write',
    ],
  },
  {
    id: 2,
    username: 'operator',
    role: 'operator',
    permissions: [
      'jobs:read', 'jobs:write', 'crawler:read', 'crawler:write',
      'system:read', 'recommendations:read', 'recommendations:write',
      'match:read', 'match:write',
    ],
  },
  {
    id: 3,
    username: 'viewer',
    role: 'viewer',
    permissions: [
      'jobs:read', 'crawler:read', 'system:read',
      'recommendations:read', 'match:read',
    ],
  },
];

export async function GET(request: NextRequest) {
  try {
    requirePermission(request, 'users:read');

    return NextResponse.json(USERS);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('获取用户列表失败', error, { path: '/api/auth/users' });
    return handleApiError(error, { path: '/api/auth/users' });
  }
}
