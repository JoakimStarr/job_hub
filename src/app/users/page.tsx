'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, EmptyState, Input, SectionCard, Select } from '@/components/ui';
import { API } from '@/lib/api';
import type { AppUser } from '@/lib/types';

type UserActionMode = 'edit' | 'reset';

export default function UsersPage() {
  const [roles, setRoles] = useState<Array<{ id: string; name?: string }>>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [dialogMode, setDialogMode] = useState<UserActionMode | null>(null);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const [roleResponse, userResponse] = await Promise.all([API.getRoles(), API.getUsers()]);
      const rolesArray = Array.isArray(roleResponse) ? roleResponse : (roleResponse.roles || []);
      setRoles(rolesArray);
      const rawResponse = userResponse as Record<string, unknown> | AppUser[];
      let usersData: AppUser[] = [];
      if (Array.isArray(rawResponse)) {
        usersData = rawResponse as AppUser[];
      } else if (rawResponse && typeof rawResponse === 'object' && 'users' in rawResponse && Array.isArray(rawResponse.users)) {
        usersData = rawResponse.users as AppUser[];
      }
      setUsers(usersData);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '加载用户失败');
    } finally {
      setLoadingUsers(false);
    }
  }

  function openEditDialog(user: AppUser) {
    setSelectedUser(user);
    setDialogMode('edit');
  }

  function openResetDialog(user: AppUser) {
    setSelectedUser(user);
    setDialogMode('reset');
  }

  function closeDialog() {
    setDialogMode(null);
    setSelectedUser(null);
  }

  async function handleCreateUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const username = (fd.get('username') as string).trim();
    const displayName = (fd.get('displayName') as string).trim();
    const password = fd.get('password') as string;
    const role = fd.get('role') as string;
    const active = fd.get('active') === 'on';

    if (!username || !password) {
      setMessage('用户名和密码不能为空');
      return;
    }

    setSaving(true);
    try {
      await API.createUser({ username, display_name: displayName || username, role, password, is_active: active });
      form.reset();
      setMessage('');
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '创建用户失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleDialogSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedUser) return;
    setSaving(true);
    try {
      const fd = new FormData(e.currentTarget);
      if (dialogMode === 'edit') {
        if (!selectedUser.id) throw new Error('用户 ID 缺失');
        await API.updateUser(selectedUser.id, {
          display_name: (fd.get('displayName') as string) || selectedUser.username,
          role: fd.get('role') as string,
          is_active: fd.get('active') === 'on',
        });
        await loadUsers();
      } else if (dialogMode === 'reset') {
        if (!selectedUser.id) throw new Error('用户 ID 缺失');
        await API.resetUserPassword(selectedUser.id, { password: fd.get('password') as string });
        setMessage('密码已重置');
      }
      closeDialog();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  return (
    <AppShell title="用户管理" description="管理账号、角色权限与密码重置" requiredPermission="manage_users">
      {message ? <div className="notice notice-error">{message}</div> : null}
      <div className="grid-2">
        <SectionCard title="新建用户" description="管理员可以在这里创建新账号">
          <form className="grid" style={{ gap: 14 }} onSubmit={handleCreateUser}>
            <label><div style={{ marginBottom: 8, fontWeight: 700 }}>用户名</div><Input type="text" name="username" defaultValue="" placeholder="例如 analyst01" required /></label>
            <label><div style={{ marginBottom: 8, fontWeight: 700 }}>显示名称</div><Input type="text" name="displayName" defaultValue="" placeholder="例如 数据分析同学" /></label>
            <label><div style={{ marginBottom: 8, fontWeight: 700 }}>角色</div><Select name="role" defaultValue={roles[0]?.id || ''} key={roles.length}>{roles.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}</Select></label>
            <label><div style={{ marginBottom: 8, fontWeight: 700 }}>初始密码</div><Input name="password" defaultValue="" type="password" placeholder="至少 8 位" required /></label>
            <label className="badge badge-slate" style={{ cursor: 'pointer', gap: 8 }}>
              <input type="checkbox" name="active" defaultChecked />
              创建后启用账号
            </label>
            <Button
              type="submit"
              variant="primary"
              disabled={saving}
            >
              {saving ? '提交中...' : '创建用户'}
            </Button>
          </form>
        </SectionCard>

        <SectionCard title="用户列表" description="可修改角色、重置密码和删除用户">
          {loadingUsers ? <EmptyState title="正在加载" description="用户列表正在拉取。" /> : null}
          {!loadingUsers && users.length === 0 ? <EmptyState title="暂无用户" description="当前没有可显示的用户。" /> : (
            <div className="grid" style={{ gap: 12 }}>
              {users.map((user) => (
                <div key={user.id || user.username} className="user-card">
                  <div className="user-card-header">
                    <div className="user-card-avatar-initials">
                      {(user.display_name || user.username).charAt(0).toUpperCase()}
                    </div>
                    <div className="user-card-info">
                      <div className="user-card-name">{user.display_name || user.username}</div>
                      <div className="user-card-username">用户名：{user.username}</div>
                    </div>
                    <Badge tone={user.is_active ? 'emerald' : 'slate'}>{user.is_active ? '启用' : '停用'}</Badge>
                  </div>
                  <div className="user-card-badges">
                    <Badge tone="blue">{user.role || 'guest'}</Badge>
                    {(user.permissions || []).slice(0, 3).map((item) => <Badge key={item} tone="slate">{item}</Badge>)}
                    {(user.permissions || []).length > 3 && <Badge tone="slate">+{(user.permissions || []).length - 3}</Badge>}
                  </div>
                  <div className="user-card-actions">
                    <Button
                      variant="secondary"
                      onClick={() => openEditDialog(user)}
                    >
                      编辑
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => openResetDialog(user)}
                    >
                      重置密码
                    </Button>
                    {user.username !== 'admin' ? (
                      <Button
                        variant="danger"
                        disabled={deletingUserId === user.id}
                        onClick={async () => {
                          if (!window.confirm('确认删除该用户吗？')) return;
                          if (!user.id) return;
                          setDeletingUserId(user.id);
                          try {
                            await API.deleteUser(user.id);
                            await loadUsers();
                          } catch (error) {
                            setMessage(error instanceof Error ? error.message : '删除用户失败');
                          } finally {
                            setDeletingUserId(null);
                          }
                        }}
                      >
                        {deletingUserId === user.id ? '删除中...' : '删除'}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {dialogMode && selectedUser ? (
        <div
          className="modal-backdrop"
          onClick={() => {
            const form = document.querySelector('#dialog-form') as HTMLFormElement;
            if (!form) { closeDialog(); return; }
            const fd = new FormData(form);
            const dirty = dialogMode === 'edit'
              ? (fd.get('displayName') !== (selectedUser.display_name || selectedUser.username)
                  || fd.get('role') !== (selectedUser.role || roles[0]?.id || 'viewer')
                  || (fd.get('active') === 'on') !== (selectedUser.is_active ?? true))
              : (fd.get('password') as string)?.trim().length > 0;
            if (dirty && !window.confirm('关闭后会丢失未保存的更改，是否继续？')) return;
            closeDialog();
          }}
        >
          <section className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3>{dialogMode === 'edit' ? '编辑用户' : '重置密码'}</h3>
                <p>{selectedUser.username}</p>
              </div>
              <Button variant="ghost" onClick={closeDialog}>关闭</Button>
            </div>
            <form id="dialog-form" className="grid" style={{ gap: 14, marginTop: 18 }} onSubmit={handleDialogSubmit}>
              {dialogMode === 'edit' ? (
                <>
                  <label><div style={{ marginBottom: 8, fontWeight: 700 }}>显示名称</div><Input name="displayName" defaultValue={selectedUser.display_name || selectedUser.username} /></label>
                  <label><div style={{ marginBottom: 8, fontWeight: 700 }}>角色</div><Select name="role" defaultValue={selectedUser.role || roles[0]?.id || 'viewer'}>{roles.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}</Select></label>
                  <label className="badge badge-slate" style={{ cursor: 'pointer', gap: 8 }}>
                    <input type="checkbox" name="active" defaultChecked={selectedUser.is_active ?? true} />
                    启用账号
                  </label>
                </>
              ) : (
                <label><div style={{ marginBottom: 8, fontWeight: 700 }}>新密码</div><Input name="password" defaultValue="" type="password" placeholder="请输入新密码" /></label>
              )}
              <div className="row-gap" style={{ marginTop: 6 }}>
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? '保存中...' : '确认'}
                </Button>
                <Button variant="secondary" onClick={closeDialog}>取消</Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}