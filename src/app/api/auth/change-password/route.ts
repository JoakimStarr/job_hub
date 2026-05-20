import { NextRequest, NextResponse } from 'next/server';
import { getAuthDb } from '@/lib/auth-db';

const rateLimitMap = new Map<string, { count: number; lastAttempt: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now - record.lastAttempt > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(identifier, { count: 1, lastAttempt: now });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    return false;
  }

  record.count++;
  record.lastAttempt = now;
  return true;
}

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: '未登录，请先登录', errorCode: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const authDb = getAuthDb();
    const user = authDb.validateSession(sessionToken);

    if (!user) {
      const response = NextResponse.json(
        { success: false, error: 'Session 已过期，请重新登录', errorCode: 'SESSION_EXPIRED' },
        { status: 401 }
      );

      response.cookies.set('session_token', '', {
        httpOnly: true,
        maxAge: 0,
        path: '/',
      });

      return response;
    }

    if (!checkRateLimit(`change_password_${user.id}`)) {
      return NextResponse.json(
        { success: false, error: '操作过于频繁，请稍后再试', errorCode: 'RATE_LIMITED' },
        { status: 429 }
      );
    }

    let body: ChangePasswordRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: '请求体格式错误', errorCode: 'INVALID_REQUEST_BODY' },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { success: false, error: '所有密码字段都不能为空', errorCode: 'MISSING_FIELDS' },
        { status: 400 }
      );
    }

    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || typeof confirmPassword !== 'string') {
      return NextResponse.json(
        { success: false, error: '密码字段格式无效', errorCode: 'INVALID_FIELD_TYPE' },
        { status: 400 }
      );
    }

    const userRecord = authDb.database
      .prepare('SELECT password_hash, salt FROM users WHERE id = ?')
      .get(user.id) as { password_hash: string; salt: string } | undefined;

    if (!userRecord) {
      return NextResponse.json(
        { success: false, error: '用户不存在', errorCode: 'USER_NOT_FOUND' },
        { status: 404 }
      );
    }

    const isCurrentPasswordValid = getAuthDb().constructor as typeof import('@/lib/auth-db').AuthDatabase;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AuthDbClass = getAuthDb().constructor as any;
    const isValid = AuthDbClass.verifyPassword(currentPassword, userRecord.salt, userRecord.password_hash);

    if (!isValid) {
      console.warn(`⚠️ 密码修改失败 - 当前密码错误: user_id=${user.id}, username=${user.username}`);
      return NextResponse.json(
        { success: false, error: '当前密码错误', errorCode: 'INVALID_CURRENT_PASSWORD' },
        { status: 403 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: '新密码与确认密码不一致', errorCode: 'PASSWORD_MISMATCH' },
        { status: 409 }
      );
    }

    if (newPassword === currentPassword) {
      return NextResponse.json(
        { success: false, error: '新密码不能与当前密码相同', errorCode: 'SAME_PASSWORD' },
        { status: 400 }
      );
    }

    const passwordStrength = evaluatePasswordStrength(newPassword);
    if (passwordStrength.score < 2) {
      return NextResponse.json(
        {
          success: false,
          error: '密码强度不足，请使用更复杂的密码',
          errorCode: 'WEAK_PASSWORD',
          details: passwordStrength.feedback
        },
        { status: 400 }
      );
    }

    const newSalt = AuthDbClass.generateSalt();
    const newPasswordHash = AuthDbClass.hashPassword(newPassword, newSalt);

    authDb.database.prepare(`
      UPDATE users 
      SET password_hash = ?, salt = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newPasswordHash, newSalt, user.id);

    const destroyedCount = authDb.destroyAllUserSessions(user.id);

    const { sessionId: newSessionId, token: newSessionToken } = authDb.createSession(
      user.id,
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      request.headers.get('user-agent') || undefined
    );

    console.log(`✅ 密码修改成功: user_id=${user.id}, username=${user.username}, 销毁旧会话=${destroyedCount}个`);

    const response = NextResponse.json({
      success: true,
      message: '密码修改成功，已自动重新登录',
      data: {
        sessionsDestroyed: destroyedCount,
        passwordStrength: passwordStrength.level
      }
    });

    response.cookies.set('session_token', newSessionToken, {
      httpOnly: true,
      secure: false,  // 允许 HTTP 访问
      sameSite: 'lax',
      maxAge: authDb.SESSION_TIMEOUT_HOURS * 3600,
      path: '/',
    });

    return response;

  } catch (error) {
    console.error('❌ 修改密码失败:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误', errorCode: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

interface PasswordStrengthResult {
  score: number;
  level: 'weak' | 'medium' | 'strong';
  feedback: string[];
}

function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 6) score += 1;
  else feedback.push('密码长度至少为6个字符');

  if (password.length >= 10) score += 1;
  else if (password.length >= 8) score += 0.5;

  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('建议包含小写字母');

  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('建议包含大写字母');

  if (/[0-9]/.test(password)) score += 1;
  else feedback.push('建议包含数字');

  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  else feedback.push('建议包含特殊字符（如 !@#$%等）');

  if (/(.)\1{2,}/.test(password)) {
    score -= 1;
    feedback.push('避免连续重复字符');
  }

  if (/123|234|345|456|567|678|789|abc|bcd|cde|def|qwe|wer|ert|rty/.test(password.toLowerCase())) {
    score -= 0.5;
    feedback.push('避免使用常见连续字符');
  }

  score = Math.max(0, Math.min(5, score));

  let level: 'weak' | 'medium' | 'strong';
  if (score <= 2) level = 'weak';
  else if (score <= 3.5) level = 'medium';
  else level = 'strong';

  return { score, level, feedback };
}
