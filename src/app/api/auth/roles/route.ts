import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { AuthError } from '@/lib/auth';
import { handleApiError } from '@/lib/api-response';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    requirePermission(request, 'users:read');

    const roles = [
      { id: 'admin', name: '管理员' },
      { id: 'operator', name: '运营者' },
      { id: 'viewer', name: '访客' },
    ];

    return NextResponse.json(roles);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('获取角色列表失败', error, { path: '/api/auth/roles' });
    return handleApiError(error, { path: '/api/auth/roles' });
  }
}
