'use client';

import { useState, useEffect, useRef } from 'react';
import { Button, Input, Select } from '@/components/ui';
import { useToast } from '@/components/Toast';
import type { UserRole } from './types';
import { DEFAULT_PERMISSIONS, PERMISSION_LABELS } from './types';
import { fetchWithAuth, handleApiError } from './utils';

interface CreateUserModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateUserModal({ onClose, onCreated }: CreateUserModalProps) {
  const toast = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  const permissionsRef = useRef<string[]>(DEFAULT_PERMISSIONS.viewer);

  const [loading, setLoading] = useState(false);
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

  function setPermissionsForRole(role: UserRole) {
    permissionsRef.current = DEFAULT_PERMISSIONS[role];
    const checkboxes = modalRef.current?.querySelectorAll<HTMLInputElement>('input[name="permissions"]');
    checkboxes?.forEach((cb) => {
      cb.checked = DEFAULT_PERMISSIONS[role].includes(cb.value);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const username = (fd.get('username') as string) || '';
    const password = (fd.get('password') as string) || '';
    const role = (fd.get('role') as string) || 'viewer';
    const permissions = fd.getAll('permissions') as string[];

    if (!username || !password) {
      toast.error('请填写用户名和密码');
      return;
    }

    if (username.length < 3 || username.length > 50) {
      toast.error('用户名长度必须在 3-50 个字符之间');
      return;
    }

    if (password.length < 6) {
      toast.error('密码长度至少 6 个字符');
      return;
    }

    setLoading(true);
    try {
      const response = await fetchWithAuth('/api/auth/users', {
        method: 'POST',
        body: JSON.stringify({
          username,
          password,
          role,
          permissions,
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
          <label className={styles.field}>
            <span className={styles.label}>用户名 *</span>
            <Input
              name="username"
              defaultValue=""
              placeholder="3-50个字符"
              required
              minLength={3}
              maxLength={50}
              autoComplete="username"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>密码 *</span>
            <div className={styles.inputWrapper}>
              <Input
                type={showPassword ? 'text' : 'password'}
                name="password"
                defaultValue=""
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
          </label>

          <label className={styles.field}>
            <span className={styles.label}>角色 *</span>
            <Select
              name="role"
              defaultValue="viewer"
              onChange={(e) => setPermissionsForRole(e.target.value as UserRole)}
            >
              <option value="viewer">查看者 - 只读访问</option>
              <option value="operator">操作员 - 可执行操作</option>
              <option value="admin">管理员 - 完全控制</option>
            </Select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>
              权限
            </span>
            <div className={styles.permissionsGrid}>
              {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                <label key={key} className={styles.permissionItem}>
                  <input
                    type="checkbox"
                    name="permissions"
                    value={key}
                    defaultChecked={DEFAULT_PERMISSIONS.viewer.includes(key)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </label>

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
              disabled={loading}
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
  togglePassword: '',
  permissionsGrid: '',
  permissionItem: '',
  actions: '',
};
