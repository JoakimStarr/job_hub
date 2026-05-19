'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, EmptyState, Input, SectionCard, Select, Skeleton } from '@/components/ui';
import { useToast } from '@/components/Toast';
import type { UserInfo, UserRole } from './types';
import { ROLE_LABELS, ROLE_COLORS } from './types';
import { fetchWithAuth, handleApiError, debounce, formatDate } from './utils';
import CreateUserModal from './CreateUserModal';
import EditUserModal from './EditUserModal';
import ChangePasswordModal from './ChangePasswordModal';
import UserSessionList from './UserSessionList';
import AuthLogViewer from './AuthLogViewer';

const PAGE_SIZE = 10;

export default function UserManagementPage() {
  const toast = useToast();
  
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserInfo | null>(null);
  const [changingPasswordUser, setChangingPasswordUser] = useState<UserInfo | null>(null);
  const [viewingSessionsUser, setViewingSessionsUser] = useState<UserInfo | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth('/api/auth/users');
      if (!response.ok) await handleApiError(response);
      
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加载用户列表失败');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = !searchQuery || 
        user.username.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' && user.isActive) ||
        (statusFilter === 'inactive' && !user.isActive);
      
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE);
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, currentPage]);

  const debouncedSearch = useMemo(
    () => debounce((value: string) => {
      setSearchQuery(value);
      setCurrentPage(1);
    }, 300),
    []
  );

  async function handleDeleteUser(user: UserInfo) {
    if (!window.confirm(`确定要删除用户 "${user.username}" 吗？此操作不可撤销。`)) return;
    
    setDeletingId(user.id!);
    try {
      const response = await fetchWithAuth(`/api/auth/users?id=${user.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) await handleApiError(response);
      
      toast.success(`用户 "${user.username}" 已删除`);
      void loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除用户失败');
    } finally {
      setDeletingId(null);
    }
  }

  function handleUserCreated() {
    setShowCreateModal(false);
    toast.success('用户创建成功');
    void loadUsers();
  }

  function handleUserUpdated() {
    setEditingUser(null);
    toast.success('用户信息已更新');
    void loadUsers();
  }

  function handlePasswordChanged() {
    setChangingPasswordUser(null);
    toast.success('密码修改成功');
  }

  return (
    <AppShell title="用户管理" description="管理系统用户、权限和会话" requiredPermission="manage_users">
      <SectionCard
        title="用户列表"
        description={`共 ${filteredUsers.length} 个用户`}
        action={
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            + 创建用户
          </Button>
        }
      >
        {/* 搜索和筛选 */}
        <div className={styles.filterBar}>
          <div className={styles.searchBox}>
            <Input
              placeholder="搜索用户名..."
              onChange={(e) => debouncedSearch(e.target.value)}
            />
          </div>
          
          <Select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); }}>
            <option value="all">全部角色</option>
            <option value="admin">管理员</option>
            <option value="operator">操作员</option>
            <option value="viewer">查看者</option>
          </Select>
          
          <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}>
            <option value="all">全部状态</option>
            <option value="active">已激活</option>
            <option value="inactive">已禁用</option>
          </Select>
        </div>

        {/* 用户表格 */}
        {loading ? (
          <Skeleton type="card" />
        ) : paginatedUsers.length === 0 ? (
          <EmptyState
            title="暂无用户"
            description={searchQuery || roleFilter !== 'all' ? '没有找到匹配的用户' : '点击上方按钮创建第一个用户'}
            action={
              <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                创建用户
              </Button>
            }
          />
        ) : (
          <>
            <div className={styles.userTable}>
              <table>
                <thead>
                  <tr>
                    <th>用户名</th>
                    <th>角色</th>
                    <th>状态</th>
                    <th>最后登录</th>
                    <th>失败次数</th>
                    <th>创建时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map((user) => (
                    <tr key={user.id}>
                      <td className={styles.usernameCell}>
                        <strong>{user.username}</strong>
                        <span className={styles.permissionCount}>
                          {user.permissions?.length || 0} 项权限
                        </span>
                      </td>
                      <td>
                        <Badge tone={ROLE_COLORS[user.role as UserRole]}>
                          {ROLE_LABELS[user.role as UserRole]}
                        </Badge>
                      </td>
                      <td>
                        <Badge tone={user.isActive ? 'emerald' : 'rose'}>
                          {user.isActive ? '正常' : '已禁用'}
                        </Badge>
                      </td>
                      <td className={styles.dateCell}>
                        {formatDate(user.lastLoginAt)}
                      </td>
                      <td className={styles.centerCell}>
                        {(user.failedLoginCount || 0) > 0 ? (
                          <Badge tone="amber">{user.failedLoginCount}</Badge>
                        ) : (
                          <span style={{ color: 'var(--muted)' }}>--</span>
                        )}
                      </td>
                      <td className={styles.dateCell}>
                        {formatDate(user.createdAt)}
                      </td>
                      <td className={styles.actionCell}>
                        <div className={styles.actionButtons}>
                          <Button
                            variant="ghost"
                            onClick={() => setEditingUser(user)}
                            title="编辑"
                          >
                            ✏️
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => setChangingPasswordUser(user)}
                            title="修改密码"
                          >
                            🔑
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => setViewingSessionsUser(user)}
                            title="查看会话"
                          >
                            📱
                          </Button>
                          <Button
                            variant="danger"
                            disabled={deletingId === user.id}
                            onClick={() => handleDeleteUser(user)}
                            title="删除"
                          >
                            {deletingId === user.id ? '...' : '🗑️'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <Button
                  variant="secondary"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  上一页
                </Button>
                
                <span className={styles.pageInfo}>
                  第 {currentPage} / {totalPages} 页
                </span>
                
                <Button
                  variant="secondary"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  下一页
                </Button>
              </div>
            )}
          </>
        )}
      </SectionCard>

      {/* 登录日志 */}
      <AuthLogViewer />

      {/* 弹窗组件 */}
      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleUserCreated}
        />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onUpdated={handleUserUpdated}
          onChangePassword={() => {
            setEditingUser(null);
            setChangingPasswordUser(editingUser);
          }}
        />
      )}

      {changingPasswordUser && (
        <ChangePasswordModal
          user={changingPasswordUser}
          onClose={() => setChangingPasswordUser(null)}
          onChanged={handlePasswordChanged}
        />
      )}

      {viewingSessionsUser && (
        <UserSessionList
          userId={viewingSessionsUser.id!}
          username={viewingSessionsUser.username}
          onClose={() => setViewingSessionsUser(null)}
        />
      )}
    </AppShell>
  );
}

const styles = {
  filterBar: 'filter-grid',
  searchBox: '',
  userTable: 'user-table',
  usernameCell: '',
  permissionCount: '',
  dateCell: '',
  centerCell: '',
  actionCell: '',
  actionButtons: '',
  pagination: '',
  pageInfo: '',
};
