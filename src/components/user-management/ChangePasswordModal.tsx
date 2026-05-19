'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Input } from '@/components/ui';
import { useToast } from '@/components/Toast';
import type { UserInfo, PasswordFormData } from './types';
import { fetchWithAuth, handleApiError, checkPasswordStrength } from './utils';

interface ChangePasswordModalProps {
  user: UserInfo;
  onClose: () => void;
  onChanged: () => void;
}

export default function ChangePasswordModal({ user, onClose, onChanged }: ChangePasswordModalProps) {
  const toast = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  
  const [formData, setFormData] = useState<PasswordFormData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(checkPasswordStrength(''));

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!modalRef.current) return;
    
    const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableElements = Array.from(modalRef.current.querySelectorAll<HTMLElement>(focusableSelectors));
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    function handleTabKey(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
    
    document.addEventListener('keydown', handleTabKey);
    firstElement?.focus();
    
    return () => {
      document.removeEventListener('keydown', handleTabKey);
    };
  }, []);

  function handleNewPasswordChange(value: string) {
    setFormData(prev => ({ ...prev, newPassword: value }));
    setPasswordStrength(checkPasswordStrength(value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.currentPassword) {
      toast.error('请输入当前密码');
      return;
    }
    
    if (!formData.newPassword) {
      toast.error('请输入新密码');
      return;
    }
    
    if (formData.newPassword.length < 6) {
      toast.error('新密码长度至少 6 个字符');
      return;
    }
    
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('两次输入的密码不一致');
      return;
    }

    if (passwordStrength.score <= 2) {
      toast.warning('建议使用更强的密码');
    }

    setLoading(true);
    try {
      const response = await fetchWithAuth('/api/auth/users', {
        method: 'PUT',
        body: JSON.stringify({
          userId: user.id,
          password: formData.newPassword,
        }),
      });

      if (!response.ok) await handleApiError(response);

      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '修改密码失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={styles.modal}
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
      >
        <div className={styles.header}>
          <div>
            <h2 id="change-password-title">修改密码</h2>
            <p>为用户 {user.username} 设置新密码</p>
          </div>
          <Button variant="ghost" onClick={onClose} aria-label="关闭">
            ✕
          </Button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* 新密码 */}
          <label className={styles.field}>
            <span className={styles.label}>新密码 *</span>
            <div className={styles.inputWrapper}>
              <Input
                type={showNewPassword ? 'text' : 'password'}
                value={formData.newPassword}
                onChange={(e) => handleNewPasswordChange(e.target.value)}
                placeholder="至少6个字符"
                required
                minLength={6}
                autoComplete="new-password"
                autoFocus
              />
              <Button
                type="button"
                variant="ghost"
                className={styles.togglePassword}
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? '🙈' : '👁️'}
              </Button>
            </div>
            
            {/* 密码强度指示器 */}
            {formData.newPassword && (
              <div className={styles.strengthIndicator}>
                <div className={styles.strengthBar}>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div
                      key={level}
                      className={`${styles.strengthSegment} ${
                        level <= passwordStrength.score ? styles.filled : ''
                      }`}
                      style={{
                        backgroundColor:
                          level <= passwordStrength.score
                            ? passwordStrength.color
                            : 'var(--panel-border)',
                      }}
                    />
                  ))}
                </div>
                <span
                  className={styles.strengthLabel}
                  style={{ color: passwordStrength.color }}
                >
                  密码强度: {passwordStrength.label}
                </span>
                
                <div className={styles.strengthChecks}>
                  <div className={!passwordStrength.checks.length ? styles.failed : ''}>
                    ✓ 至少8个字符
                  </div>
                  <div className={!passwordStrength.checks.lowercase ? styles.failed : ''}>
                    ✓ 包含小写字母
                  </div>
                  <div className={!passwordStrength.checks.uppercase ? styles.failed : ''}>
                    ✓ 包含大写字母
                  </div>
                  <div className={!passwordStrength.checks.numbers ? styles.failed : ''}>
                    ✓ 包含数字
                  </div>
                  <div className={!passwordStrength.checks.special ? styles.failed : ''}>
                    ✓ 包含特殊字符
                  </div>
                </div>
              </div>
            )}
          </label>

          {/* 确认密码 */}
          <label className={styles.field}>
            <span className={styles.label}>确认密码 *</span>
            <div className={styles.inputWrapper}>
              <Input
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))
                }
                placeholder="再次输入新密码"
                required
                autoComplete="new-password"
              />
              <Button
                type="button"
                variant="ghost"
                className={styles.togglePassword}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? '🙈' : '👁️'}
              </Button>
            </div>
            
            {formData.confirmPassword && formData.newPassword !== formData.confirmPassword && (
              <span className={styles.mismatch}>两次输入的密码不一致</span>
            )}
            
            {formData.confirmPassword && formData.newPassword === formData.confirmPassword && (
              <span className={styles.match}>✓ 密码匹配</span>
            )}
          </label>

          {/* 密码规则提示 */}
          <div className={styles.rules}>
            <h4>密码规则:</h4>
            <ul>
              <li>长度至少 6 个字符（推荐 8+）</li>
              <li>包含大小写字母、数字和特殊字符更安全</li>
              <li>避免使用常见密码或个人信息</li>
            </ul>
          </div>

          {/* 操作按钮 */}
          <div className={styles.actions}>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={loading}
            >
              取消
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={
                loading ||
                !formData.newPassword ||
                !formData.confirmPassword ||
                formData.newPassword !== formData.confirmPassword
              }
            >
              {loading ? '修改中...' : '确认修改密码'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  modal: 'modal-card change-password-modal',
  header: 'modal-head',
  form: '',
  field: '',
  label: '',
  inputWrapper: '',
  togglePassword: '',
  strengthIndicator: '',
  strengthBar: '',
  strengthSegment: '',
  filled: '',
  strengthLabel: '',
  strengthChecks: '',
  failed: '',
  mismatch: '',
  match: '',
  rules: '',
  actions: '',
};
