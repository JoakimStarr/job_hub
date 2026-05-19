import { NextRequest, NextResponse } from 'next/server';
import { getAuthDb } from '@/lib/auth-db';

/**
 * 用户管理 API
 *
 * GET /api/auth/users - 获取所有用户列表 (需要 admin 权限)
 * POST /api/auth/users - 创建新用户 (需要 admin 权限)
 * PUT /api/auth/users/:id - 更新用户信息 (需要 admin 权限)
 * DELETE /api/auth/users/:id - 删除用户 (需要 admin 权限)
 */

// ==================== GET: 用户列表 ====================

export async function GET(request: NextRequest) {
  try {
    // 验证管理员权限
    const sessionToken = request.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: '未登录', errorCode: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const authDb = getAuthDb();
    const currentUser = authDb.validateSession(sessionToken);

    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '需要管理员权限', errorCode: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const users = authDb.getAllUsers();

    return NextResponse.json({
      success: true,
      users,
      count: users.length,
      message: `共 ${users.length} 个用户`
    });

  } catch (error) {
    console.error('❌ 获取用户列表失败:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

// ==================== POST: 创建用户 ====================

export async function POST(request: NextRequest) {
  try {
    // 验证管理员权限
    const sessionToken = request.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: '未登录', errorCode: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const authDb = getAuthDb();
    const currentUser = authDb.validateSession(sessionToken);

    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '只有管理员可以创建用户', errorCode: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { username, password, role = 'viewer', permissions } = body;

    // 参数验证
    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: '用户名和密码不能为空', errorCode: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    if (username.length < 3 || username.length > 50) {
      return NextResponse.json(
        { success: false, error: '用户名长度必须在 3-50 个字符之间', errorCode: 'INVALID_USERNAME' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: '密码长度至少 6 个字符', errorCode: 'WEAK_PASSWORD' },
        { status: 400 }
      );
    }

    if (!['admin', 'operator', 'viewer'].includes(role)) {
      return NextResponse.json(
        { success: false, error: '无效的角色，必须是 admin/operator/viewer', errorCode: 'INVALID_ROLE' },
        { status: 400 }
      );
    }

    try {
      const user = authDb.createUser(username, password, role, permissions);

      console.log(`✅ 管理员 ${currentUser.username} 创建了新用户: ${username} (${role})`);

      return NextResponse.json({
        success: true,
        user,
        message: `用户 "${username}" 创建成功`
      });

    } catch (error: any) {
      if (error.message?.includes('已存在')) {
        return NextResponse.json(
          { success: false, error: error.message, errorCode: 'USER_EXISTS' },
          { status: 409 }
        );
      }

      throw error;
    }

  } catch (error) {
    console.error('❌ 创建用户失败:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

// ==================== PUT: 更新用户 ====================

export async function PUT(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: '未登录', errorCode: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const authDb = getAuthDb();
    const currentUser = authDb.validateSession(sessionToken);

    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '需要管理员权限', errorCode: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId, ...updates } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: '缺少 userId 参数', errorCode: 'MISSING_USER_ID' },
        { status: 400 }
      );
    }

    const updatedUser = authDb.updateUser(userId, updates);

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, error: '用户不存在', errorCode: 'USER_NOT_FOUND' },
        { status: 404 }
      );
    }

    console.log(`✅ 管理员 ${currentUser.username} 更新了用户 ID=${userId}`);

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: '用户更新成功'
    });

  } catch (error) {
    console.error('❌ 更新用户失败:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

// ==================== DELETE: 删除用户 ====================

export async function DELETE(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: '未登录', errorCode: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const authDb = getAuthDb();
    const currentUser = authDb.validateSession(sessionToken);

    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '需要管理员权限', errorCode: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = parseInt(searchParams.get('id') || '');

    if (!userId || isNaN(userId)) {
      return NextResponse.json(
        { success: false, error: '缺少或无效的 userId 参数', errorCode: 'INVALID_USER_ID' },
        { status: 400 }
      );
    }

    // 防止删除自己
    if (userId === currentUser.id) {
      return NextResponse.json(
        { success: false, error: '不能删除自己的账户', errorCode: 'SELF_DELETE' },
        { status: 400 }
      );
    }

    const deleted = authDb.deleteUser(userId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: '用户不存在或已被删除', errorCode: 'USER_NOT_FOUND' },
        { status: 404 }
      );
    }

    console.log(`✅ 管理员 ${currentUser.username} 删除了用户 ID=${userId}`);

    return NextResponse.json({
      success: true,
      message: '用户已删除'
    });

  } catch (error) {
    console.error('❌ 删除用户失败:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
