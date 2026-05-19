'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { SectionCard, Button, Badge, EmptyState, Select } from '@/components/ui';
import { useToast } from '@/components/Toast';
import type { AuthLogEntry } from './types';
import { fetchWithAuth, handleApiError, formatDate, formatRelativeTime, exportToCSV } from './utils';

type TimeFilter = 'today' | 'week' | 'month' | 'all';

export default function AuthLogViewer() {
  const toast = useToast();
  
  const [logs, setLogs] = useState<AuthLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const [showFailedOnly, setShowFailedOnly] = useState(false);

  useEffect(() => {
    void loadLogs();
  }, []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth('/api/auth/users/logs');
      
      if (response.status === 404) {
        setLogs([]);
        return;
      }
      
      if (!response.ok) await handleApiError(response);
      
      const data = await response.json();
      setLogs(data.logs || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加载登录日志失败');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const filteredLogs = useMemo(() => {
    let filtered = [...logs];
    
    if (showFailedOnly) {
      filtered = filtered.filter(log => !log.success);
    }

    if (timeFilter !== 'all') {
      const now = new Date();
      let startDate: Date;
      
      switch (timeFilter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = new Date(0);
      }
      
      filtered = filtered.filter(log => new Date(log.timestamp) >= startDate);
    }

    return filtered.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [logs, timeFilter, showFailedOnly]);

  const stats = useMemo(() => {
    const total = filteredLogs.length;
    const successCount = filteredLogs.filter(l => l.success).length;
    const failedCount = total - successCount;
    
    return { total, success: successCount, failed: failedCount };
  }, [filteredLogs]);

  function handleExportCSV() {
    if (filteredLogs.length === 0) {
      toast.warning('没有可导出的数据');
      return;
    }

    const exportData = filteredLogs.map(log => ({
      时间: formatDate(log.timestamp),
      用户名: log.username,
      IP地址: log.ipAddress,
      地理位置: log.location || '--',
      设备: log.userAgent?.substring(0, 50) || '--',
      结果: log.success ? '成功' : `失败 - ${log.errorMessage || ''}`,
    }));

    exportToCSV(exportData, 'auth_logs');
    toast.success(`已导出 ${filteredLogs.length} 条日志`);
  }

  return (
    <SectionCard
      title="登录日志"
      description="查看用户登录记录和安全事件"
      action={
        <div className={styles.actions}>
          <Button
            variant="secondary"
            onClick={() => void loadLogs()}
          >
            🔄 刷新
          </Button>
          
          <Button
            variant="secondary"
            onClick={handleExportCSV}
            disabled={filteredLogs.length === 0}
          >
            📥 导出 CSV
          </Button>
        </div>
      }
    >
      {/* 筛选栏 */}
      <div className={styles.filterBar}>
        <Select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}>
          <option value="today">今天</option>
          <option value="week">本周</option>
          <option value="month">本月</option>
          <option value="all">全部</option>
        </Select>

        <label className={styles.filterToggle}>
          <input
            type="checkbox"
            checked={showFailedOnly}
            onChange={(e) => setShowFailedOnly(e.target.checked)}
          />
          <span>仅显示失败</span>
        </label>
      </div>

      {/* 统计信息 */}
      <div className={styles.stats}>
        <Badge tone="blue">共 {stats.total} 条</Badge>
        <Badge tone="emerald">成功 {stats.success}</Badge>
        {stats.failed > 0 && (
          <Badge tone="rose">失败 {stats.failed}</Badge>
        )}
      </div>

      {/* 日志列表 */}
      {loading ? (
        <div className={styles.loading}>加载中...</div>
      ) : filteredLogs.length === 0 ? (
        <EmptyState
          title="暂无登录记录"
          description={
            showFailedOnly
              ? '所选时间段内没有失败的登录尝试'
              : '暂无登录记录'
          }
        />
      ) : (
        <div className={styles.logList}>
          {filteredLogs.map((log) => (
            <div key={log.id} className={`${styles.logItem} ${!log.success ? styles.failedLog : ''}`}>
              <div className={styles.logStatus}>
                <Badge tone={log.success ? 'emerald' : 'rose'}>
                  {log.success ? '✓ 成功' : '✕ 失败'}
                </Badge>
              </div>

              <div className={styles.logMain}>
                <div className={styles.logHeader}>
                  <strong>{log.username}</strong>
                  <span className={styles.logTime}>
                    {formatRelativeTime(log.timestamp)}
                  </span>
                </div>

                <div className={styles.logDetails}>
                  <span>📍 {log.ipAddress}</span>
                  {log.location && (
                    <span>{log.location}</span>
                  )}
                </div>

                {!log.success && log.errorMessage && (
                  <div className={styles.errorMsg}>
                    ⚠️ {log.errorMessage}
                  </div>
                )}
              </div>

              <div className={styles.logMeta}>
                <span className={styles.fullTime}>
                  {formatDate(log.timestamp)}
                </span>
                
                {log.userAgent && (
                  <span className={styles.deviceInfo} title={log.userAgent}>
                    🖥️ {log.userAgent.substring(0, 30)}...
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

const styles = {
  actions: '',
  filterBar: '',
  filterToggle: '',
  stats: '',
  loading: '',
  logList: '',
  logItem: '',
  failedLog: '',
  logStatus: '',
  logMain: '',
  logHeader: '',
  logTime: '',
  logDetails: '',
  errorMsg: '',
  logMeta: '',
  fullTime: '',
  deviceInfo: '',
};
