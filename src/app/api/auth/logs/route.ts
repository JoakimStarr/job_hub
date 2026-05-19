import { NextRequest, NextResponse } from 'next/server';
import { getAuthDb } from '@/lib/auth-db';

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;
    
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: '未授权访问', errorCode: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const authDb = getAuthDb();
    const user = authDb.validateSession(sessionToken);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Session 已过期，请重新登录', errorCode: 'SESSION_EXPIRED' },
        { status: 401 }
      );
    }

    // 检查权限 - 只有 admin 和 operator 可以查看日志
    if (user.role !== 'admin' && user.role !== 'operator') {
      return NextResponse.json(
        { success: false, error: '权限不足', errorCode: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const action = searchParams.get('action');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    
    // 非管理员只能查看自己的日志
    const effectiveUserId = user.role === 'admin' 
      ? (userId ? parseInt(userId, 10) : undefined)
      : user.id;

    // 构建查询参数
    const queryParams: any = {
      page,
      limit,
    };

    if (effectiveUserId) {
      queryParams.userId = effectiveUserId;
    }

    if (action && ['login_success', 'login_failed', 'logout', 'password_changed'].includes(action)) {
      queryParams.action = action;
    }

    if (startDate) {
      queryParams.startDate = startDate;
    }

    if (endDate) {
      queryParams.endDate = endDate;
    }

    // 获取统计数据
    const statistics = authDb.getLoginLogStatistics({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });

    // 获取日志列表
    const { logs, total } = authDb.getLoginLogs(queryParams);

    return NextResponse.json({
      success: true,
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      statistics,
    });

  } catch (error) {
    console.error('❌ 获取登录日志失败:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误', errorCode: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
