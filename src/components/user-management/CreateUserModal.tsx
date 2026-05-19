'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button, Input, Select } from '@/components/ui';
import { useToast } from '@/components/Toast';
import type { UserFormData, UserRole } from './types';
import { DEFAULT_PERMISSIONS, PERMISSION_LABELS } from './types';
import { fetchWithAuth, handleApiError, checkPasswordStrength, debounce } from './utils';

interface CreateUserModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateUserModal({ onClose, onCreated }: CreateUserModalProps) {
  const toast = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    password: '',
    role: 'viewer',
    permissions: [],
  });
  
  const [loading, setLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [passwordStrength, setPasswordStrength] = useState(checkPasswordStrength(''));
  const [showPassword, setShowPassword] = useState(false);

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
    
    function handleTabKey(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      
      const lastElement = focusableElements[focusableElements.length - 1];
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

  useEffect(() => {
    setPermissionsForRole(formData.role);
  }, [formData.role]);

  const debouncedCheckUsername = useMemo(
    () => debounce(async (username: string) => {
      if (username.length < 3) {
        setUsernameAvailable(null);
        return;
      }
      
      setCheckingUsername(true);
      try {
        const response = await fetchWithAuth('/api/auth/users');
        if (!response.ok) return;
        
        const data = await response.json();
        const exists = data.users?.some((u: { username: string }) => 
          u.username.toLowerCase() === username.toLowerCase()
        );
        
        setUsernameAvailable(!exists);
      } catch {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 500),
    []
  );

  function setPermissionsForRole(role: UserRole) {
    setFormData(prev => ({
      ...prev,
      role,
      permissions: DEFAULT_PERMISSIONS[role],
    }));
  }

  function handleUsernameChange(value: string) {
    setFormData(prev => ({ ...prev, username: value }));
    debouncedCheckUsername(value);
  }

  function handlePasswordChange(value: string) {
    setFormData(prev => ({ ...prev, password: value }));
    setPasswordStrength(checkPasswordStrength(value));
  }

  function togglePermission(perm: string) {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.username || !formData.password) {
      toast.error('请填写用户名和密码');
      return;
    }
    
    if (formData.username.length < 3 || formData.username.length > 50) {
      toast.error('用户名长度必须在 3-50 个字符之间');
      return;
    }
    
    if (formData.password.length < 6) {
      toast.error('密码长度至少 6 个字符');
      return;
    }
    
    if (usernameAvailable === false) {
      toast.error('该用户名已被使用');
      return;
    }

    setLoading(true);
    try {
      const response = await fetchWithAuth('/api/auth/users', {
        method: 'POST',
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          role: formData.role,
          permissions: formData.permissions,
        }),
      });

      if (!response.ok) await handleApiError(response);

      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创建用户失败');
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
        aria-labelledby="create-user-title"
      >
        <div className={styles.header}>
          <div>
            <h2 id="create-user-title">创建新用户</h2>
            <p>填写用户信息并设置权限</p>
          </div>
          <Button variant="ghost" onClick={onClose} aria-label="关闭">
            ✕
          </Button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* 用户名 */}
          <label className={styles.field}>
            <span className={styles.label}>用户名 *</span>
            <div className={styles.inputWrapper}>
              <Input
                value={formData.username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="3-50个字符"
                required
                minLength={3}
                maxLength={50}
                autoComplete="username"
              />
              {checkingUsername && (
                <span className={styles.checking}>检查中...</span>
              )}
              {!checkingUsername && formData.username.length >= 3 && (
                <span className={`${styles.availability} ${usernameAvailable ? styles.available : styles.unavailable}`}>
                  {usernameAvailable ? '✓ 可用' : '✕ 已占用'}
                </span>
              )}
            </div>
          </label>

          {/* 密码 */}
          <label className={styles.field}>
            <span className={styles.label}>密码 *</span>
            <div className={styles.inputWrapper}>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                placeholder="至少6个字符"
                required
                minLength={6}
                autoComplete="new-password"
              />
              <Button
                type="button"
                variant="ghost"
                className={styles.togglePassword}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? '🙈' : '👁️'}
              </Button>
            </div>
            
            {/* 密码强度指示器 */}
            {formData.password && (
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
                    至少8个字符
                  </div>
                  <div className={!passwordStrength.checks.lowercase ? styles.failed : ''}>
                    包含小写字母
                  </div>
                  <div className={!passwordStrength.checks.uppercase ? styles.failed : ''}>
                    包含大写字母
                  </div>
                  <div className={!passwordStrength.checks.numbers ? styles.failed : ''}>
                    包含数字
                  </div>
                  <div className={!passwordStrength.checks.special ? styles.failed : ''}>
                    包含特殊字符
                  </div>
                </div>
              </div>
            )}
          </label>

          {/* 角色 */}
          <label className={styles.field}>
            <span className={styles.label}>角色 *</span>
            <Select
              value={formData.role}
              onChange={(e) => setPermissionsForRole(e.target.value as UserRole)}
            >
              <option value="viewer">查看者 - 只读访问</option>
              <option value="operator">操作员 - 可执行操作</option>
              <option value="admin">管理员 - 完全控制</option>
            </Select>
          </label>

          {/* 权限多选 */}
          <label className={styles.field}>
            <span className={styles.label}>
              权限 ({formData.permissions.length} 项已选)
            </span>
            <div className={styles.permissionsGrid}>
              {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                <label key={key} className={styles.permissionItem}>
                  <input
                    type="checkbox"
                    checked={formData.permissions.includes(key)}
                    onChange={() => togglePermission(key)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </label>

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
              disabled={loading || usernameAvailable === false || checkingUsername}
            >
              {loading ? '创建中...' : '创建用户'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  modal: 'modal-card create-user-modal',
  header: 'modal-head',
  form: '',
  field: '',
  label: '',
  inputWrapper: '',
  checking: '',
  availability: '',
  available: '',
  unavailable: '',
  togglePassword: '',
  strengthIndicator: '',
  strengthBar: '',
  strengthSegment: '',
  filled: '',
  strengthLabel: '',
  strengthChecks: '',
  failed: '',
  permissionsGrid: '',
  permissionItem: '',
  actions: '',
};
