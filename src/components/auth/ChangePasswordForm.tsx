'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button, Input, SectionCard } from '@/components/ui';

interface PasswordStrength {
  score: number;
  level: 'weak' | 'medium' | 'strong';
  feedback: string[];
}

interface ChangePasswordFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function ChangePasswordForm({ onSuccess, onCancel }: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null);
  const [touched, setTouched] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });

  useEffect(() => {
    if (newPassword && touched.newPassword) {
      setPasswordStrength(evaluatePasswordStrength(newPassword));
    } else {
      setPasswordStrength(null);
    }
  }, [newPassword, touched.newPassword]);

  const handleBlur = useCallback((field: keyof typeof touched) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  const validateForm = useCallback((): string | null => {
    if (!currentPassword) return '请输入当前密码';
    if (!newPassword) return '请输入新密码';
    if (!confirmPassword) return '请确认新密码';
    if (newPassword.length < 6) return '新密码长度至少为6个字符';
    if (newPassword !== confirmPassword) return '两次输入的密码不一致';
    if (newPassword === currentPassword) return '新密码不能与当前密码相同';
    if (passwordStrength && passwordStrength.score < 2) return '密码强度不足，请使用更复杂的密码';
    return null;
  }, [currentPassword, newPassword, confirmPassword, passwordStrength]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setIsError(false);

    const validationError = validateForm();
    if (validationError) {
      setIsError(true);
      setMessage(validationError);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      if (data.success) {
        setIsError(false);
        setMessage(data.message || '密码修改成功！');

        setTimeout(() => {
          onSuccess?.();
        }, 1500);
      } else {
        throw new Error(data.error || '修改失败');
      }

    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : '修改密码失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [currentPassword, newPassword, confirmPassword, validateForm, onSuccess]);

  const getStrengthColor = (level: string) => {
    switch (level) {
      case 'weak': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'strong': return '#10b981';
      default: return '#94a3b8';
    }
  };

  const getStrengthLabel = (level: string) => {
    switch (level) {
      case 'weak': return '弱';
      case 'medium': return '中';
      case 'strong': return '强';
      default: return '';
    }
  };

  return (
    <SectionCard
      title="修改密码"
      description="定期更换密码可以提高账户安全性"
    >
      <form onSubmit={handleSubmit} className="change-password-form" noValidate>
        <div className="form-group">
          <label htmlFor="current-password">
            <span className="label-text">当前密码</span>
            {touched.currentPassword && !currentPassword && (
              <span className="field-error">请输入当前密码</span>
            )}
          </label>
          <div className="password-input-wrapper">
            <Input
              id="current-password"
              type={showCurrentPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              onBlur={() => handleBlur('currentPassword')}
              placeholder="请输入当前密码"
              autoComplete="current-password"
              disabled={loading}
              style={{ paddingRight: '48px' }}
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              tabIndex={-1}
              aria-label={showCurrentPassword ? '隐藏密码' : '显示密码'}
            >
              {showCurrentPassword ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="new-password">
            <span className="label-text">新密码</span>
            {touched.newPassword && !newPassword && (
              <span className="field-error">请输入新密码</span>
            )}
          </label>
          <div className="password-input-wrapper">
            <Input
              id="new-password"
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onBlur={() => handleBlur('newPassword')}
              placeholder="请输入新密码（至少6个字符）"
              autoComplete="new-password"
              disabled={loading}
              style={{ paddingRight: '48px' }}
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowNewPassword(!showNewPassword)}
              tabIndex={-1}
              aria-label={showNewPassword ? '隐藏密码' : '显示密码'}
            >
              {showNewPassword ? '🙈' : '👁️'}
            </button>
          </div>

          {passwordStrength && (
            <div className="password-strength-indicator">
              <div className="strength-bar-container">
                <div
                  className="strength-bar-fill"
                  style={{
                    width: `${(passwordStrength.score / 5) * 100}%`,
                    backgroundColor: getStrengthColor(passwordStrength.level),
                  }}
                />
              </div>
              <div className="strength-info">
                <span
                  className="strength-level"
                  style={{ color: getStrengthColor(passwordStrength.level) }}
                >
                  密码强度：{getStrengthLabel(passwordStrength.level)}
                </span>
                {passwordStrength.feedback.length > 0 && (
                  <ul className="strength-feedback">
                    {passwordStrength.feedback.map((tip, index) => (
                      <li key={index}>{tip}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="confirm-password">
            <span className="label-text">确认新密码</span>
            {touched.confirmPassword && !confirmPassword && (
              <span className="field-error">请确认新密码</span>
            )}
            {touched.confirmPassword && confirmPassword && newPassword !== confirmPassword && (
              <span className="field-error">两次输入的密码不一致</span>
            )}
          </label>
          <div className="password-input-wrapper">
            <Input
              id="confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={() => handleBlur('confirmPassword')}
              placeholder="请再次输入新密码"
              autoComplete="new-password"
              disabled={loading}
              style={{ paddingRight: '48px' }}
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              tabIndex={-1}
              aria-label={showConfirmPassword ? '隐藏密码' : '显示密码'}
            >
              {showConfirmPassword ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        {message ? (
          <div className={`notice ${isError ? 'notice-error' : 'notice-success'}`}>
            {message}
          </div>
        ) : null}

        <div className="form-actions">
          {onCancel && (
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              disabled={loading}
            >
              取消
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? '正在修改...' : '确认修改'}
          </Button>
        </div>

        <div className="password-tips">
          <h4>密码安全建议：</h4>
          <ul>
            <li>长度至少 6 个字符，建议 10 个以上</li>
            <li>包含大小写字母、数字和特殊字符</li>
            <li>避免使用生日、手机号等易猜测信息</li>
            <li>不要与其他网站使用相同密码</li>
            <li>建议定期更换密码（如每3个月）</li>
          </ul>
        </div>
      </form>

      <style jsx>{`
        .change-password-form {
          max-width: 480px;
          padding: 20px 0;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .label-text {
          display: block;
          margin-bottom: 8px;
          font-weight: 700;
          font-size: 14px;
          color: var(--foreground);
        }

        .field-error {
          display: inline-block;
          margin-left: 12px;
          font-size: 13px;
          color: #ef4444;
          font-weight: 500;
        }

        .password-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .password-input-wrapper :global(.input) {
          width: 100%;
          padding-right: 48px !important;
        }

        .password-toggle-btn {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          font-size: 18px;
          padding: 4px 8px;
          border-radius: 4px;
          transition: background-color 0.2s;
          line-height: 1;
        }

        .password-toggle-btn:hover {
          background-color: var(--panel);
        }

        .password-strength-indicator {
          margin-top: 12px;
          animation: fadeIn 0.2s ease-in;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .strength-bar-container {
          width: 100%;
          height: 6px;
          background-color: var(--border);
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .strength-bar-fill {
          height: 100%;
          border-radius: 3px;
          transition: all 0.3s ease-out;
        }

        .strength-info {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .strength-level {
          font-size: 13px;
          font-weight: 600;
        }

        .strength-feedback {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .strength-feedback li {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: var(--muted);
          padding: 2px 8px;
          background-color: var(--panel);
          border-radius: 4px;
        }

        .strength-feedback li::before {
          content: '•';
          color: #f59e0b;
        }

        .form-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid var(--border);
        }

        .password-tips {
          margin-top: 24px;
          padding: 16px;
          background-color: var(--panel);
          border-radius: 8px;
          border-left: 3px solid var(--primary);
        }

        .password-tips h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--primary);
        }

        .password-tips ul {
          margin: 0;
          padding-left: 20px;
          font-size: 13px;
          color: var(--muted);
          line-height: 1.8;
        }

        .password-tips li {
          margin-bottom: 4px;
        }

        .notice {
          padding: 12px 16px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 16px;
          animation: fadeIn 0.2s ease-in;
        }

        .notice-success {
          background-color: #f0fdf4;
          color: #166534;
          border: 1px solid #bbf7d0;
        }

        .notice-error {
          background-color: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        @media (max-width: 768px) {
          .change-password-form {
            max-width: 100%;
          }

          .form-actions {
            flex-direction: column-reverse;
          }

          .form-actions button {
            width: 100%;
          }
        }
      `}</style>
    </SectionCard>
  );
}

function evaluatePasswordStrength(password: string): PasswordStrength {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 6) score += 1;
  else feedback.push('长度至少6位');

  if (password.length >= 10) score += 1;
  else if (password.length >= 8) score += 0.5;

  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('包含小写字母');

  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('包含大写字母');

  if (/[0-9]/.test(password)) score += 1;
  else feedback.push('包含数字');

  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  else feedback.push('包含特殊字符');

  if (/(.)\1{2,}/.test(password)) {
    score -= 1;
    feedback.push('避免连续重复');
  }

  score = Math.max(0, Math.min(5, score));

  let level: 'weak' | 'medium' | 'strong';
  if (score <= 2) level = 'weak';
  else if (score <= 3.5) level = 'medium';
  else level = 'strong';

  return { score, level, feedback };
}
