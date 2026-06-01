'use client';

import { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, EmptyState, Input, SectionCard, Select } from '@/components/ui';

interface LoginLog {
  id: number;
  userId?: number;
  username: string;
  action: 'login_success' | 'login_failed' | 'logout' | 'password_changed';
  ipAddress?: string;
  userAgent?: string;
  deviceType?: string;
  browser?: string;
  os?: string;
  success: number;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
}

interface LoginLogStatistics {
  totalLogins: number;
  successfulLogins: number;
  failedLogins: number;
  uniqueUsers: number;
  topIPs: Array<{ ip: string; count: number }>;
  loginByHour: number[];
}

interface LogsResponse {
  success: boolean;
  logs: LoginLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  statistics: LoginLogStatistics;
  error?: string;
}

type TimeRange = 'today' | '7days' | '30days' | 'custom';
type ActionType = 'all' | 'login_success' | 'login_failed' | 'logout' | 'password_changed';

export default function LogsPage() {
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [statistics, setStatistics] = useState<LoginLogStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // 筛选状态
  const [timeRange, setTimeRange] = useState<TimeRange>('7days');
  const [actionFilter, setActionFilter] = useState<ActionType>('all');
  const [usernameFilter, setUsernameFilter] = useState('');
  const [ipFilter, setIpFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // 分页状态
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);

  // 展开详情
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const getDateRange = useCallback((range: TimeRange) => {
    const now = new Date();
    switch (range) {
      case 'today':
        return {
          start: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(),
          end: now.toISOString(),
        };
      case '7days': {
        const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { start: start.toISOString(), end: now.toISOString() };
      }
      case '30days': {
        const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return { start: start.toISOString(), end: now.toISOString() };
      }
      default:
        return { start: startDate || undefined, end: endDate || undefined };
    }
  }, [startDate, endDate]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const { start, end } = getDateRange(timeRange);
      const params = new URLSearchParams();
      
      if (start) params.set('startDate', start);
      if (end) params.set('endDate', end);
      if (actionFilter !== 'all') params.set('action', actionFilter);
      if (usernameFilter) params.set('userId', usernameFilter);
      if (ipFilter) params.set('ipAddress', ipFilter);
      params.set('page', page.toString());
      params.set('limit', limit.toString());

      const response = await fetch(`/api/auth/logs?${params.toString()}`);
      const data: LogsResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '加载日志失败');
      }

      setLogs(data.logs);
      setStatistics(data.statistics);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [timeRange, actionFilter, usernameFilter, ipFilter, page, limit, getDateRange]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const exportToCSV = () => {
    if (logs.length === 0) return;

    const headers = ['时间', '用户名', '事件类型', 'IP地址', '设备类型', '浏览器', '操作系统', '状态', '错误码', '错误信息'];
    const rows = logs.map(log => [
      log.createdAt,
      log.username,
      log.action,
      log.ipAddress || '',
      log.deviceType || '',
      log.browser || '',
      log.os || '',
      log.success === 1 ? '成功' : '失败',
      log.errorCode || '',
      log.errorMessage || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `login_logs_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const printReport = () => {
    window.print();
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'login_success':
        return <Badge tone="emerald">登录成功</Badge>;
      case 'login_failed':
        return <Badge tone="rose">登录失败</Badge>;
      case 'logout':
        return <Badge tone="blue">登出</Badge>;
      case 'password_changed':
        return <Badge tone="amber">修改密码</Badge>;
      default:
        return <Badge>{action}</Badge>;
    }
  };

  const getDeviceIcon = (deviceType?: string) => {
    switch (deviceType) {
      case 'mobile': return '📱';
      case 'tablet': return '📋';
      default: return '🖥️';
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getSuccessRate = () => {
    if (!statistics || statistics.totalLogins === 0) return 0;
    return ((statistics.successfulLogins / statistics.totalLogins) * 100).toFixed(1);
  };

  const checkSuspiciousActivity = (log: LoginLog) => {
    // 检查连续失败次数
    const recentFailures = logs.filter(
      l => l.username === log.username && 
           l.action === 'login_failed' && 
           new Date(l.createdAt).getTime() > new Date(log.createdAt).getTime() - 15 * 60000
    );
    
    return recentFailures.length >= 5;
  };

  return (
    <AppShell title="登录日志" description="查看和分析用户登录活动记录">
      {error && <div className="notice notice-error">{error}</div>}

      {/* 统计仪表板 */}
      {statistics && (
        <div className="grid-4" style={{ marginBottom: 24 }}>
          <SectionCard title="总登录次数">
            <div className="stat-card">
              <div className="stat-value">{statistics.totalLogins}</div>
              <div className="stat-label">总登录次数</div>
            </div>
          </SectionCard>
          <SectionCard title="成功登录">
            <div className="stat-card stat-success">
              <div className="stat-value">{statistics.successfulLogins}</div>
              <div className="stat-label">成功登录</div>
            </div>
          </SectionCard>
          <SectionCard title="失败登录">
            <div className="stat-card stat-danger">
              <div className="stat-value">{statistics.failedLogins}</div>
              <div className="stat-label">失败登录</div>
            </div>
          </SectionCard>
          <SectionCard title="成功率">
            <div className="stat-card">
              <div className="stat-value">{getSuccessRate()}%</div>
              <div className="stat-label">成功率</div>
            </div>
          </SectionCard>
        </div>
      )}

      {/* 24小时趋势图 */}
      {statistics && (
        <div style={{ marginBottom: 24 }}>
          <SectionCard title="24小时登录趋势">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
            {statistics.loginByHour.map((count, hour) => {
              const maxCount = Math.max(...statistics.loginByHour, 1);
              const height = (count / maxCount) * 100;
              const isCurrentHour = new Date().getHours() === hour;
              
              return (
                <div
                  key={hour}
                  style={{
                    flex: 1,
                    background: isCurrentHour ? '#3b82f6' : count > 0 ? '#93c5fd' : '#e5e7eb',
                    height: `${Math.max(height, 2)}%`,
                    borderRadius: '2px',
                    position: 'relative',
                    cursor: 'pointer',
                  }}
                  title={`${hour}:00 - ${count} 次`}
                >
                  {(hour % 6 === 0 || isCurrentHour) && (
                    <span style={{ 
                      position: 'absolute', 
                      bottom: -20, 
                      left: '50%', 
                      transform: 'translateX(-50%)',
                      fontSize: 11,
                      color: '#6b7280'
                    }}>
                      {hour}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
        </div>
      )}

      {/* 筛选器 */}
      <div style={{ marginBottom: 24 }}>
        <SectionCard title="筛选条件">
        <form style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }} onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setUsernameFilter((fd.get('usernameFilter') as string) || '');
          setIpFilter((fd.get('ipFilter') as string) || '');
          setPage(1);
        }}>
          <label>
            <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 13 }}>时间范围</div>
            <Select value={timeRange} onChange={(e) => { setTimeRange(e.target.value as TimeRange); setPage(1); }}>
              <option value="today">今天</option>
              <option value="7days">最近 7 天</option>
              <option value="30days">最近 30 天</option>
              <option value="custom">自定义</option>
            </Select>
          </label>

          {timeRange === 'custom' && (
            <>
              <label>
                <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 13 }}>开始日期</div>
                <Input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </label>
              <label>
                <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 13 }}>结束日期</div>
                <Input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </label>
            </>
          )}

          <label>
            <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 13 }}>事件类型</div>
            <Select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value as ActionType); setPage(1); }}>
              <option value="all">全部</option>
              <option value="login_success">登录成功</option>
              <option value="login_failed">登录失败</option>
              <option value="logout">登出</option>
              <option value="password_changed">修改密码</option>
            </Select>
          </label>

          <label>
            <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 13 }}>用户搜索</div>
            <Input 
              name="usernameFilter"
              defaultValue={usernameFilter}
              placeholder="用户ID或用户名"
            />
          </label>

          <label>
            <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 13 }}>IP 过滤</div>
            <Input 
              name="ipFilter"
              defaultValue={ipFilter}
              placeholder="IP 地址"
            />
          </label>

          <Button type="submit" variant="primary">
            搜索
          </Button>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={exportToCSV}>
              导出 CSV
            </Button>
            <Button variant="secondary" onClick={printReport}>
              打印报表
            </Button>
          </div>
        </form>
      </SectionCard>
      </div>

      {/* 日志表格 */}
      <SectionCard title={`登录日志 (${total} 条记录)`}>
        {loading ? (
          <EmptyState title="正在加载" description="日志数据正在拉取..." />
        ) : logs.length === 0 ? (
          <EmptyState title="暂无日志" description="当前筛选条件下没有找到日志记录。" />
        ) : (
          <>
            <div className="table-container" style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, color: '#374151' }}>时间</th>
                    <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, color: '#374151' }}>用户</th>
                    <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, color: '#374151' }}>事件</th>
                    <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, color: '#374151' }}>IP 地址</th>
                    <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, color: '#374151' }}>设备</th>
                    <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, color: '#374151' }}>浏览器</th>
                    <th style={{ padding: 12, textAlign: 'center', fontWeight: 600, color: '#374151' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const isSuspicious = checkSuspiciousActivity(log);
                    
                    return (
                      <React.Fragment key={log.id}>
                        <tr 
                          style={{ 
                            borderBottom: '1px solid #f3f4f6',
                            background: isSuspicious ? '#fef2f2' : undefined,
                          }}
                        >
                          <td style={{ padding: 12, fontSize: 13, whiteSpace: 'nowrap' }}>
                            {formatDateTime(log.createdAt)}
                          </td>
                          <td style={{ padding: 12, fontSize: 13 }}>{log.username}</td>
                          <td style={{ padding: 12 }}>{getActionBadge(log.action)}</td>
                          <td style={{ padding: 12, fontSize: 13, fontFamily: 'monospace' }}>
                            {log.ipAddress || '-'}
                            {isSuspicious && <Badge tone="rose" style={{ marginLeft: 8 }}>⚠️ 可疑</Badge>}
                          </td>
                          <td style={{ padding: 12, fontSize: 14 }}>
                            {getDeviceIcon(log.deviceType)} {log.deviceType || '-'}
                          </td>
                          <td style={{ padding: 12, fontSize: 13 }}>{log.browser || '-'}</td>
                          <td style={{ padding: 12, textAlign: 'center' }}>
                            <Button
                              variant="ghost"
                              onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                            >
                              {expandedRow === log.id ? '收起' : '详情'}
                            </Button>
                          </td>
                        </tr>
                        
                        {expandedRow === log.id && (
                          <tr style={{ background: '#f9fafb' }}>
                            <td colSpan={7} style={{ padding: 16 }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                                <div>
                                  <div style={{ fontWeight: 600, color: '#6b7280', fontSize: 12, marginBottom: 4 }}>操作系统</div>
                                  <div style={{ fontSize: 14 }}>{log.os || '-'}</div>
                                </div>
                                <div>
                                  <div style={{ fontWeight: 600, color: '#6b7280', fontSize: 12, marginBottom: 4 }}>完整 User-Agent</div>
                                  <div style={{ fontSize: 12, wordBreak: 'break-all', fontFamily: 'monospace', background: '#fff', padding: 8, borderRadius: 4 }}>
                                    {log.userAgent || '-'}
                                  </div>
                                </div>
                                {log.errorCode && (
                                  <div>
                                    <div style={{ fontWeight: 600, color: '#6b7280', fontSize: 12, marginBottom: 4 }}>错误代码</div>
                                    <div><Badge tone="rose">{log.errorCode}</Badge></div>
                                  </div>
                                )}
                                {log.errorMessage && (
                                  <div>
                                    <div style={{ fontWeight: 600, color: '#6b7280', fontSize: 12, marginBottom: 4 }}>错误信息</div>
                                    <div style={{ color: '#dc2626', fontSize: 13 }}>{log.errorMessage}</div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: 13, color: '#6b7280' }}>
                  共 {total} 条记录，第 {page}/{totalPages} 页
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Button
                    variant="secondary"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    上一页
                  </Button>
                  
                  <select
                    value={limit}
                    onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db' }}
                  >
                    <option value={10}>10条/页</option>
                    <option value={20}>20条/页</option>
                    <option value={50}>50条/页</option>
                    <option value={100}>100条/页</option>
                  </select>
                  
                  <Button
                    variant="secondary"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </SectionCard>

      {/* Top IP 统计 */}
      {statistics?.topIPs && statistics.topIPs.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <SectionCard title="Top IP 地址">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
            {statistics.topIPs.map((item, index) => (
              <div key={item.ip} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '10px 14px',
                background: index < 3 ? '#fef3c7' : '#f9fafb',
                borderRadius: 8,
                borderLeft: `3px solid ${index === 0 ? '#f59e0b' : index === 1 ? '#fbbf24' : '#fcd34d'}`
              }}>
                <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{item.ip}</span>
                <Badge tone={index === 0 ? 'amber' : 'slate'}>{item.count} 次</Badge>
              </div>
            ))}
          </div>
        </SectionCard>
        </div>
      )}

      <style jsx global>{`
        .stat-card {
          text-align: center;
          padding: 16px;
        }
        
        .stat-card .stat-value {
          font-size: 32px;
          font-weight: 700;
          color: #1f2937;
          line-height: 1.2;
        }
        
        .stat-card.stat-success .stat-value {
          color: #059669;
        }
        
        .stat-card.stat-danger .stat-value {
          color: #dc2626;
        }
        
        .stat-card .stat-label {
          margin-top: 8px;
          font-size: 13px;
          color: #6b7280;
          font-weight: 500;
        }
        
        @media print {
          body * {
            visibility: hidden;
          }
          
          .app-shell-content,
          .app-shell-content * {
            visibility: visible;
          }
          
          .app-shell-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          
          button, select, input {
            display: none !important;
          }
        }
        
        .grid-4 {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        
        @media (max-width: 1024px) {
          .grid-4 {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        
        @media (max-width: 640px) {
          .grid-4 {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </AppShell>
  );
}

import React from 'react';
