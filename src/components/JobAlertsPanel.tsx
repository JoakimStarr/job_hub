'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, EmptyState, Input, SectionCard, Skeleton, Textarea } from '@/components/ui';
import { API } from '@/lib/api';

interface JobAlert {
  id: number;
  email: string;
  keywords: string[];
  sources: string[];
  locations: string[];
  industries: string[];
  education?: string;
  min_notify_interval?: number;
  enabled: boolean;
  last_notified_at?: string;
  notify_count: number;
  created_at: string;
}

interface AlertHistory {
  id: number;
  alert_id: number;
  job_ids: number[];
  matched_count: number;
  email_sent: boolean;
  error_message?: string;
  created_at: string;
}

interface PreviewJob {
  id: number;
  title: string;
  company?: string;
  location?: string;
  salary?: string;
  university?: string;
  source_url?: string;
  matchedKeywords: string[];
  matchScore: number;
  reason?: string;
}

const SOURCE_OPTIONS = [
  { value: 'sufe', label: '上海财经大学' },
  { value: 'zuel', label: '中南财经政法大学' },
  { value: 'cufe', label: '中央财经大学' },
  { value: 'dufe', label: '东北财经大学' },
  { value: 'swufe', label: '西南财经大学' },
];

export default function JobAlertsPanel() {
  const [alerts, setAlerts] = useState<JobAlert[]>([]);
  const [history, setHistory] = useState<AlertHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailConfigured, setEmailConfigured] = useState(true);
  const [message, setMessage] = useState('');
  const [showDisabled, setShowDisabled] = useState(false);
  
  const [editingAlert, setEditingAlert] = useState<JobAlert | null>(null);

  const [previewModal, setPreviewModal] = useState<{
    open: boolean;
    alert: JobAlert | null;
    jobs: PreviewJob[];
    totalJobs: number;
    matchedCount: number;
    loading: boolean;
  }>({
    open: false,
    alert: null,
    jobs: [],
    totalJobs: 0,
    matchedCount: 0,
    loading: false,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [alertsRes, historyRes] = await Promise.all([
        API.getJobAlerts(showDisabled),
        API.getAlertHistory(),
      ]);
      
      if (alertsRes.success) {
        setAlerts((alertsRes.data || []) as JobAlert[]);
        setEmailConfigured(alertsRes.emailConfigured ?? true);
      }
      
      if (historyRes.success) {
        setHistory((historyRes.data || []) as AlertHistory[]);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [showDisabled]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handlePreview = async (alert: JobAlert) => {
    setPreviewModal({
      open: true,
      alert,
      jobs: [],
      totalJobs: 0,
      matchedCount: 0,
      loading: true,
    });

    try {
      const res = await API.previewJobAlert(alert.id);
      if (res.success && res.data) {
        setPreviewModal(prev => ({
          ...prev,
          jobs: res.data.matched_jobs as PreviewJob[],
          totalJobs: res.data.total_jobs,
          matchedCount: res.data.matched_count,
          loading: false,
        }));
      } else {
        setPreviewModal(prev => ({
          ...prev,
          loading: false,
        }));
        setMessage(res.error || '预览失败');
      }
    } catch (error) {
      setPreviewModal(prev => ({
        ...prev,
        loading: false,
      }));
      setMessage(error instanceof Error ? error.message : '预览失败');
    }
  };

  const handleReEnable = async (alertId: number) => {
    try {
      const res = await API.enableJobAlert(alertId);
      if (res.success) {
        setMessage('订阅已重新启用');
        void fetchData();
      } else {
        setMessage(res.error || '启用失败');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '启用失败');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = (fd.get('email') as string).trim();
    const keywordsRaw = (fd.get('keywords') as string || '').trim();
    const locations = (fd.get('locations') as string || '').trim();
    const industries = (fd.get('industries') as string || '').trim();
    const education = (fd.get('education') as string) || null;
    const minNotifyInterval = parseInt(fd.get('min_notify_interval') as string) || 0;
    const sources = fd.getAll('sources') as string[];

    if (!email) { setMessage('请输入接收邮箱'); return; }
    if (!keywordsRaw) { setMessage('请输入至少一个关键词'); return; }

    const keywords = keywordsRaw.split(/[,，]/).map(k => k.trim()).filter(Boolean);
    
    if (keywords.length === 0) {
      setMessage('请至少输入一个关键词');
      return;
    }

    try {
      if (editingAlert) {
        const res = await API.updateJobAlert(editingAlert.id, {
          email,
          keywords,
          sources,
          locations: locations.split(/[,，]/).map(l => l.trim()).filter(Boolean),
          industries: industries.split(/[,，]/).map(i => i.trim()).filter(Boolean),
          education: education || undefined,
          min_notify_interval: minNotifyInterval,
        });

        if (res.success) {
          setMessage('更新成功');
          setEditingAlert(null);
          resetForm();
          void fetchData();
        } else {
          setMessage(res.error || '更新失败');
        }
      } else {
        const res = await API.createJobAlert({
          email,
          keywords,
          sources,
          locations: locations.split(/[,，]/).map(l => l.trim()).filter(Boolean),
          industries: industries.split(/[,，]/).map(i => i.trim()).filter(Boolean),
          education: education || undefined,
          min_notify_interval: minNotifyInterval,
        });
        
        if (res.success) {
          setMessage('创建成功');
          resetForm();
          void fetchData();
        } else {
          setMessage(res.error || '创建失败');
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败');
    }
  };

  const handleEdit = (alert: JobAlert) => {
    setEditingAlert(alert);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个订阅吗？')) return;
    
    try {
      const res = await API.deleteJobAlert(id);
      if (res.success) {
        setMessage('删除成功');
        void fetchData();
      } else {
        setMessage(res.error || '删除失败');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '删除失败');
    }
  };

  const handleToggle = async (alert: JobAlert) => {
    try {
      const res = await API.updateJobAlert(alert.id, { enabled: !alert.enabled });
      if (res.success) {
        void fetchData();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败');
    }
  };

  const handleTestEmail = async () => {
    const emailInput = document.getElementById('alert-email') as HTMLInputElement | null;
    const email = emailInput?.value?.trim();
    if (!email) {
      setMessage('请先填写邮箱');
      return;
    }
    
    try {
      const res = await API.sendTestEmail(email);
      if (res.success) {
        setMessage('测试邮件已发送，请检查收件箱');
      } else {
        setMessage(res.error || '发送失败');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '发送失败');
    }
  };

  const resetForm = () => {
    setEditingAlert(null);
  };

  if (loading) {
    return <Skeleton type="card" />;
  }

  const enabledCount = alerts.filter(a => a.enabled).length;
  const disabledCount = alerts.filter(a => !a.enabled).length;

  return (
    <div>
      {!emailConfigured ? (
        <div className="notice notice-warning" style={{ marginBottom: 20 }}>
          邮件服务未配置，请联系管理员设置 SMTP 环境变量
        </div>
      ) : null}
      
      {message ? (
        <div className="notice notice-info" style={{ marginBottom: 20 }}>
          {message}
        </div>
      ) : null}

      {previewModal.open && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => setPreviewModal(prev => ({ ...prev, open: false }))}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 12,
              maxWidth: 700,
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: 20, borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>预览匹配岗位</h3>
                <button
                  onClick={() => setPreviewModal(prev => ({ ...prev, open: false }))}
                  style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#6b7280' }}
                >
                  ×
                </button>
              </div>
              {previewModal.alert && (
                <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280' }}>
                  关键词：{previewModal.alert.keywords.join('、')}
                </div>
              )}
            </div>
            
            <div style={{ padding: 20 }}>
              {previewModal.loading ? (
                <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
              ) : (
                <>
                  <div style={{ marginBottom: 16, fontSize: 14, color: '#4b5563' }}>
                    AI 从最近 {previewModal.totalJobs} 个岗位中匹配到 <strong>{previewModal.matchedCount}</strong> 个岗位
                  </div>
                  
                  {previewModal.jobs.length === 0 ? (
                    <EmptyState title="暂无匹配岗位" description="当前没有匹配该订阅条件的岗位" />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {previewModal.jobs.map(job => (
                        <div
                          key={job.id}
                          style={{
                            padding: 16,
                            borderRadius: 8,
                            border: '1px solid #e5e7eb',
                            background: '#fff',
                            borderLeft: `4px solid ${job.matchScore >= 80 ? '#10b981' : job.matchScore >= 60 ? '#3b82f6' : '#f59e0b'}`,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                              <a
                                href={job.source_url || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ fontSize: 15, fontWeight: 600, color: '#3b82f6', textDecoration: 'none' }}
                              >
                                {job.title}
                              </a>
                              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                                {job.company ? `${job.company} · ` : ''}
                                {job.location ? `${job.location} · ` : ''}
                                {job.salary || '面议'}
                              </div>
                              <div style={{ fontSize: 12, color: '#3b82f6', marginTop: 6 }}>
                                匹配关键词：{job.matchedKeywords.join('、')}
                              </div>
                              {job.reason ? (
                                <div style={{ fontSize: 12, color: '#059669', marginTop: 8, padding: '8px 12px', background: '#ecfdf5', borderRadius: 6, fontStyle: 'italic' }}>
                                  AI推荐：{job.reason}
                                </div>
                              ) : null}
                            </div>
                            <Badge tone={job.matchScore >= 80 ? 'emerald' : job.matchScore >= 60 ? 'blue' : 'amber'}>{job.matchScore}%</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <SectionCard title={editingAlert ? '编辑订阅' : '新建订阅'} description="设置关键词，当有新岗位匹配时自动邮件通知">
          <form style={{ display: 'flex', flexDirection: 'column', gap: 16 }} onSubmit={handleSubmit}>
            <label>
              <div style={{ marginBottom: 6, fontWeight: 600 }}>接收邮箱 *</div>
              <Input
                type="email"
                name="email"
                id="alert-email"
                defaultValue={editingAlert ? editingAlert.email : ''}
                placeholder="your@email.com"
              />
            </label>

            <label>
              <div style={{ marginBottom: 6, fontWeight: 600 }}>关键词 *（OR 匹配，多个用逗号分隔）</div>
              <Textarea name="keywords" defaultValue={editingAlert ? editingAlert.keywords.join(', ') : ''} rows={3} placeholder="例如：Python, 数据分析, 实习（任一命中即推送，匹配多的排前面）" />
            </label>

            <div>
              <div style={{ marginBottom: 6, fontWeight: 600 }}>数据源（可多选，不选默认全部）</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SOURCE_OPTIONS.map(opt => (
                  <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      name="sources"
                      value={opt.value}
                      defaultChecked={editingAlert ? editingAlert.sources.includes(opt.value) : false}
                    />
                    <span style={{ fontSize: 13 }}>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <label>
              <div style={{ marginBottom: 6, fontWeight: 600 }}>期望地点（不选不限）</div>
              <Input
                name="locations"
                defaultValue={editingAlert ? editingAlert.locations.join(', ') : ''}
                placeholder="例如：上海, 北京（留空则匹配所有地点）"
              />
            </label>

            <label>
              <div style={{ marginBottom: 6, fontWeight: 600 }}>期望行业（不选不限）</div>
              <Input
                name="industries"
                defaultValue={editingAlert ? editingAlert.industries.join(', ') : ''}
                placeholder="例如：金融, 互联网（留空则匹配所有行业）"
              />
            </label>

            <div style={{ display: 'flex', gap: 12 }}>
              <label style={{ flex: 1 }}>
                <div style={{ marginBottom: 6, fontWeight: 600 }}>学历要求</div>
                <select
                  className="select"
                  name="education"
                  defaultValue={editingAlert ? editingAlert.education || '' : ''}
                >
                  <option value="">不限</option>
                  <option value="大专">大专</option>
                  <option value="本科">本科</option>
                  <option value="硕士">硕士</option>
                  <option value="博士">博士</option>
                </select>
              </label>
              <label style={{ flex: 1 }}>
                <div style={{ marginBottom: 6, fontWeight: 600 }}>推送间隔（分钟）</div>
                <Input
                  type="number"
                  name="min_notify_interval"
                  defaultValue={editingAlert ? String(editingAlert.min_notify_interval) : '0'}
                  placeholder="0=不限"
                  min="0"
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <Button variant="primary" type="submit">
                {editingAlert ? '更新订阅' : '创建订阅'}
              </Button>
              {editingAlert ? (
                <Button variant="secondary" onClick={() => { resetForm(); }}>
                  取消编辑
                </Button>
              ) : null}
              <Button variant="secondary" onClick={handleTestEmail} disabled={!emailConfigured}>
                发送测试邮件
              </Button>
            </div>
          </form>
        </SectionCard>

        <div>
          <SectionCard 
            title="我的订阅" 
            description={`共 ${alerts.length} 个订阅（${enabledCount} 启用，${disabledCount} 禁用）`}
          >
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={showDisabled}
                  onChange={e => setShowDisabled(e.target.checked)}
                />
                显示已禁用的订阅
              </label>
            </div>
            
            {alerts.length === 0 ? (
              <EmptyState title="暂无订阅" description="创建订阅后，当有新岗位匹配时会自动邮件通知您" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {alerts.map(alert => (
                  <div
                    key={alert.id}
                    style={{
                      padding: 16,
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      background: alert.enabled ? '#fff' : '#f9fafb',
                      opacity: alert.enabled ? 1 : 0.7,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{alert.email}</div>
                      <Badge tone={alert.enabled ? 'emerald' : 'slate'}>
                        {alert.enabled ? '已启用' : '已禁用'}
                      </Badge>
                    </div>
                    <div style={{ fontSize: 13, color: '#4b5563', marginBottom: 6 }}>
                      关键词：{alert.keywords.join('、')}
                    </div>
                    {alert.sources && alert.sources.length > 0 ? (
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                        数据源：{alert.sources.map(s => SOURCE_OPTIONS.find(o => o.value === s)?.label || s).join('、')}
                      </div>
                    ) : null}
                    {alert.locations && alert.locations.length > 0 ? (
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                        地点：{alert.locations.join('、')}
                      </div>
                    ) : null}
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
                      已推送 {alert.notify_count} 次
                      {alert.last_notified_at ? ` · 上次：${new Date(alert.last_notified_at).toLocaleString('zh-CN')}` : ''}
                      {alert.min_notify_interval && alert.min_notify_interval > 0 ? ` · 间隔≥${alert.min_notify_interval}分钟` : ''}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      <Button variant="secondary" onClick={() => handlePreview(alert)}>
                        预览
                      </Button>
                      {alert.enabled ? (
                        <>
                          <Button variant="secondary" onClick={() => handleEdit(alert)}>
                            编辑
                          </Button>
                          <Button variant="secondary" onClick={() => handleToggle(alert)}>
                            禁用
                          </Button>
                          <Button variant="secondary" onClick={() => handleDelete(alert.id)}>
                            删除
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="primary" onClick={() => handleReEnable(alert.id)}>
                            重新启用
                          </Button>
                          <Button variant="secondary" onClick={() => handleDelete(alert.id)}>
                            删除
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <div style={{ marginTop: 20 }}>
            <SectionCard title="推送历史" description={`共 ${history.length} 条记录`}>
              {history.length === 0 ? (
                <EmptyState title="暂无推送记录" description="当有新岗位匹配时会自动推送邮件通知" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {history.slice(0, 10).map(h => (
                    <div
                      key={h.id}
                      style={{
                        padding: 12,
                        borderRadius: 6,
                        background: '#f9fafb',
                        fontSize: 13,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>匹配 {h.matched_count} 个岗位</span>
                        <Badge tone={h.email_sent ? 'emerald' : 'rose'}>
                          {h.email_sent ? '已发送' : '发送失败'}
                        </Badge>
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                        {new Date(h.created_at).toLocaleString('zh-CN')}
                      </div>
                      {h.error_message ? (
                        <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
                          {h.error_message}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
