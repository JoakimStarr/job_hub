'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Badge, EmptyState } from '@/components/ui';
import { useToast } from '@/components/Toast';
import type { SessionInfo } from './types';
import { fetchWithAuth, handleApiError, formatDate, formatRelativeTime, extractDeviceInfo } from './utils';

interface UserSessionListProps {
  userId: number;
  username: string;
  onClose: () => void;
}

export default function UserSessionList({ userId, username, onClose }: UserSessionListProps) {
  const toast = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [destroyingId, setDestroyingId] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(`/api/auth/users/${userId}/sessions`);
      
      if (response.status === 404) {
        setSessions([]);
        return;
      }
      
      if (!response.ok) await handleApiError(response);
      
      const data = await response.json();
      const sessionsWithInfo = (data.sessions || []).map((session: SessionInfo) => ({
        ...session,
        deviceInfo: extractDeviceInfo(session.userAgent),
      }));
      
      setSessions(sessionsWithInfo);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加载会话列表失败');
    } finally {
      setLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  async function handleDestroySession(sessionId: string) {
    if (!window.confirm('确定要强制下线该会话吗？用户需要重新登录。')) return;
    
    setDestroyingId(sessionId);
    try {
      const response = await fetchWithAuth(`/api/auth/users/${userId}/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) await handleApiError(response);

      toast.success('会话已销毁');
      void loadSessions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '销毁会话失败');
    } finally {
      setDestroyingId(null);
    }
  }

  async function handleDestroyAllSessions() {
    if (!window.confirm(`确定要强制下线 ${username} 的所有会话吗？该用户将需要重新登录。`)) return;
    
    try {
      const response = await fetchWithAuth(`/api/auth/users/${userId}/sessions`, {
        method: 'DELETE',
      });

      if (!response.ok) await handleApiError(response);

      toast.success(`已销毁 ${username} 的所有会话`);
      void loadSessions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '销毁会话失败');
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
        aria-labelledby="session-list-title"
      >
        <div className={styles.header}>
          <div>
            <h2 id="session-list-title">
              用户会话 - {username}
            </h2>
            <p>当前活跃的登录会话</p>
          </div>
          <Button variant="ghost" onClick={onClose} aria-label="关闭">
            ✕
          </Button>
        </div>

        <div className={styles.content}>
          {/* 会话统计 */}
          <div className={styles.stats}>
            <Badge tone="blue">共 {sessions.length} 个活跃会话</Badge>
            
            {sessions.length > 0 && (
              <Button
                variant="danger"
                onClick={handleDestroyAllSessions}
              >
                🚪 强制全部下线
              </Button>
            )}
          </div>

          {/* 会话列表 */}
          {loading ? (
            <div className={styles.loading}>加载中...</div>
          ) : sessions.length === 0 ? (
            <EmptyState
              title="暂无活跃会话"
              description="该用户当前没有活跃的登录会话"
            />
          ) : (
            <div className={styles.sessionList}>
              {sessions.map((session) => (
                <div key={session.id} className={styles.sessionItem}>
                  <div className={styles.sessionMain}>
                    <div className={styles.sessionInfo}>
                      <div className={styles.deviceIcon}>
                        {session.deviceInfo === 'iPhone' || session.deviceInfo === 'iPad' ? '📱' :
                         session.deviceInfo === 'Android' ? '🤖' :
                         session.deviceInfo === '移动设备' ? '📲' : '💻'}
                      </div>
                      
                      <div className={styles.sessionDetails}>
                        <strong>{session.deviceInfo}</strong>
                        <span>{session.ipAddress || '未知 IP'}</span>
                      </div>
                    </div>

                    <div className={styles.sessionTimes}>
                      <div className={styles.timeItem}>
                        <span className={styles.timeLabel}>登录时间</span>
                        <span>{formatDate(session.createdAt)}</span>
                      </div>
                      <div className={styles.timeItem}>
                        <span className={styles.timeLabel}>过期时间</span>
                        <span>{formatDate(session.expiresAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.sessionActions}>
                    <span className={styles.relativeTime}>
                      登录于 {formatRelativeTime(session.createdAt)}
                    </span>
                    
                    <Button
                      variant="danger"
                      disabled={destroyingId === session.id}
                      onClick={() => handleDestroySession(session.id)}
                      title="强制下线"
                    >
                      {destroyingId === session.id ? '...' : '🚪 强制下线'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  modal: 'modal-card session-modal',
  header: 'modal-head',
  content: '',
  stats: '',
  loading: '',
  sessionList: '',
  sessionItem: '',
  sessionMain: '',
  sessionInfo: '',
  deviceIcon: '',
  sessionDetails: '',
  sessionTimes: '',
  timeItem: '',
  timeLabel: '',
  sessionActions: '',
  relativeTime: '',
};
