'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Input, Select, Badge } from '@/components/ui';
import { useToast } from '@/components/Toast';
import type { UserInfo, EditUserFormData, UserRole } from './types';
import { ROLE_LABELS, PERMISSION_LABELS } from './types';
import { fetchWithAuth, handleApiError, formatDate } from './utils';

interface EditUserModalProps {
  user: UserInfo;
  onClose: () => void;
  onUpdated: () => void;
  onChangePassword: () => void;
}

export default function EditUserModal({ user, onClose, onUpdated, onChangePassword }: EditUserModalProps) {
  const toast = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const username = (fd.get('username') as string) || '';
    const role = (fd.get('role') as string) || 'viewer';
    const permissions = fd.getAll('permissions') as string[];

    if (!username.trim()) {
      toast.error('用户名不能为空');
      return;
    }

    setLoading(true);
    try {
      const response = await fetchWithAuth('/api/auth/users', {
        method: 'PUT',
        body: JSON.stringify({
          userId: user.id,
          username,
          role,
          permissions,
        }),
      });

      if (!response.ok) await handleApiError(response);
      onUpdated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新用户失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus() {
    setTogglingStatus(true);
    try {
      const newStatus = !user.isActive;

      const response = await fetchWithAuth('/api/auth/users', {
        method: 'PUT',
        body: JSON.stringify({
          userId: user.id,
          isActive: newStatus,
        }),
      });

      if (!response.ok) await handleApiError(response);

      toast.success(`账户已${newStatus ? '启用' : '禁用'}`);
      onUpdated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '切换状态失败');
    } finally {
      setTogglingStatus(false);
    }
  }

  async function handleLockAccount() {
    if (!window.confirm(`确定要${user.failedLoginCount ? '解锁' : '锁定'}该账户吗？`)) return;
    
    try {
      const response = await fetchWithAuth('/api/auth/users', {
        method: 'PUT',
        body: JSON.stringify({
          userId: user.id,
          isActive: user.failedLoginCount ? true : false,
        }),
      });

      if (!response.ok) await handleApiError(response);

      toast.success(`账户已${user.failedLoginCount ? '解锁' : '锁定'}`);
      onUpdated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作失败');
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
        aria-labelledby="edit-user-title"
      >
        <div className={styles.header}>
          <div>
            <h2 id="edit-user-title">编辑用户</h2>
            <p>修改用户信息和权限设置</p>
          </div>
          <Button variant="ghost" onClick={onClose} aria-label="关闭">
            ✕
          </Button>
        </div>

        {/* 用户信息摘要 */}
        <div className={styles.userInfo}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>用户ID</span>
            <span>{user.id}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>创建时间</span>
            <span>{formatDate(user.createdAt)}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>最后登录</span>
            <span>{formatDate(user.lastLoginAt)}</span>
          </div>
          {(user.failedLoginCount ?? 0) > 0 && (
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>失败登录次数</span>
              <Badge tone="amber">{user.failedLoginCount}</Badge>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* 用户名 */}
          <label className={styles.field}>
            <span className={styles.label}>用户名 *</span>
            <Input
              name="username"
              defaultValue={user.username}
              required
              autoComplete="username"
            />
          </label>

          {/* 角色 */}
          <label className={styles.field}>
            <span className={styles.label}>角色 *</span>
            <Select
              name="role"
              defaultValue={user.role}
            >
              <option value="viewer">查看者 - 只读访问</option>
              <option value="operator">操作员 - 可执行操作</option>
              <option value="admin">管理员 - 完全控制</option>
            </Select>
          </label>

          {/* 权限多选 */}
          <label className={styles.field}>
            <span className={styles.label}>
              权限 ({user.permissions?.length || 0} 项已选)
            </span>
            <div className={styles.permissionsGrid}>
              {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                <label key={key} className={styles.permissionItem}>
                  <input
                    type="checkbox"
                    name="permissions"
                    value={key}
                    defaultChecked={user.permissions?.includes(key)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </label>

          {/* 账户状态 */}
          <div className={styles.statusSection}>
            <h3>账户状态</h3>
            
            <div className={styles.statusRow}>
              <span>当前状态:</span>
              <Badge tone={user.isActive ? 'emerald' : 'rose'}>
                {user.isActive ? '正常' : '已禁用'}
              </Badge>
              
              <Button
                variant={user.isActive ? 'danger' : 'primary'}
                disabled={togglingStatus}
                onClick={handleToggleStatus}
              >
                {togglingStatus ? '处理中...' : (user.isActive ? '禁用账户' : '启用账户')}
              </Button>
            </div>

            {(user.failedLoginCount ?? 0) > 0 && (
              <Button
                variant="secondary"
                onClick={handleLockAccount}
                style={{ marginTop: 8 }}
              >
                🔓 解锁账户 (重置失败计数)
              </Button>
            )}
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
              type="button"
              variant="secondary"
              onClick={() => { onClose(); onChangePassword(); }}
              disabled={loading}
            >
              🔑 修改密码
            </Button>
            
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
            >
              {loading ? '保存中...' : '保存更改'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  modal: 'modal-card edit-user-modal',
  header: 'modal-head',
  userInfo: '',
  infoItem: '',
  infoLabel: '',
  form: '',
  field: '',
  label: '',
  permissionsGrid: '',
  permissionItem: '',
  statusSection: '',
  statusRow: '',
  actions: '',
};
