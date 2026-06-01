'use client';

import { useState, useCallback } from 'react';
import { Button, Input, SectionCard } from '@/components/ui';

interface ChangePasswordFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function ChangePasswordForm({ onSuccess, onCancel }: ChangePasswordFormProps) {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setIsError(false);

    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const currentPassword = (fd.get('currentPassword') as string) || '';
    const newPassword = (fd.get('newPassword') as string) || '';
    const confirmPassword = (fd.get('confirmPassword') as string) || '';

    if (!currentPassword) { setIsError(true); setMessage('请输入当前密码'); setLoading(false); return; }
    if (!newPassword) { setIsError(true); setMessage('请输入新密码'); setLoading(false); return; }
    if (!confirmPassword) { setIsError(true); setMessage('请确认新密码'); setLoading(false); return; }
    if (newPassword.length < 6) { setIsError(true); setMessage('新密码长度至少为6个字符'); setLoading(false); return; }
    if (newPassword !== confirmPassword) { setIsError(true); setMessage('两次输入的密码不一致'); setLoading(false); return; }
    if (newPassword === currentPassword) { setIsError(true); setMessage('新密码不能与当前密码相同'); setLoading(false); return; }

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      if (data.success) {
        setIsError(false);
        setMessage(data.message || '密码修改成功！');
        setTimeout(() => { onSuccess?.(); }, 1500);
      } else {
        throw new Error(data.error || '修改失败');
      }
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : '修改密码失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);

  return (
    <SectionCard
      title="修改密码"
      description="定期更换密码可以提高账户安全性"
    >
      <form onSubmit={handleSubmit} className="change-password-form" noValidate>
        <div className="form-group">
          <label htmlFor="current-password">
            <span className="label-text">当前密码</span>
          </label>
          <div className="password-input-wrapper">
            <Input
              id="current-password"
              type={showCurrentPassword ? 'text' : 'password'}
              name="currentPassword"
              defaultValue=""
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
          </label>
          <div className="password-input-wrapper">
            <Input
              id="new-password"
              type={showNewPassword ? 'text' : 'password'}
              name="newPassword"
              defaultValue=""
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
        </div>

        <div className="form-group">
          <label htmlFor="confirm-password">
            <span className="label-text">确认新密码</span>
          </label>
          <div className="password-input-wrapper">
            <Input
              id="confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              name="confirmPassword"
              defaultValue=""
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

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
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
