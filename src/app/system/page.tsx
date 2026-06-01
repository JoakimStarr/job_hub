'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, EmptyState, Input, JobCard, MetricCard, SectionCard, Select, Skeleton, TabNav, Textarea } from '@/components/ui';
import { SubscriptionAnalysisPanel } from '@/components/SubscriptionAnalysisPanel';
import { API } from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import type { JobItem, SystemConfig, SystemStatus, SubscriptionItem, AnalysisResult } from '@/lib/types';

type Feedback = { tone: 'success' | 'error'; text: string };
type TabKey = 'config' | 'subscriptions' | 'diagnostics';

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function SubscriptionAnalysisModal(props: {
  subscription: { id: number; name: string } | null;
  analysisResult: AnalysisResult | null;
  loading: boolean;
  onReanalyze?: () => void;
  onViewHistory?: () => void;
  onClose: () => void;
}) {
  const { subscription, analysisResult, loading, onReanalyze, onViewHistory, onClose } = props;

  if (!subscription) return null;

  if (loading) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <section className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 860, width: '100%' }}>
          <div className="modal-head">
            <div>
              <h3>分析中 · {subscription.name}</h3>
              <p>正在分析匹配岗位...</p>
            </div>
            <Button variant="ghost" onClick={onClose}>关闭</Button>
          </div>
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Skeleton type="card" />
          </div>
        </section>
      </div>
    );
  }

  if (!analysisResult) return null;

  return (
    <SubscriptionAnalysisPanel
      subscriptionId={subscription.id}
      subscriptionName={subscription.name}
      analysisResult={analysisResult}
      onReanalyze={onReanalyze}
      onViewHistory={onViewHistory}
      onClose={onClose}
    />
  );
}

export default function SystemPage() {
  const [configText, setConfigText] = useState('{}');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('config');
  const [savingConfig, setSavingConfig] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [analysisModal, setAnalysisModal] = useState<{
    subscription: { id: number; name: string } | null;
    analysisResult: AnalysisResult | null;
    loading: boolean;
  }>({ subscription: null, analysisResult: null, loading: false });

  const {
    data: status,
    loading: statusLoading,
    mutate: mutateStatus,
  } = useFetch<SystemStatus>('/api/system/status', () => API.getSystemStatus());

  const {
    data: config,
    loading: configLoading,
    mutate: mutateConfig,
  } = useFetch<SystemConfig>('/api/system/config', () => API.getSystemConfig());

  const {
    data: subscriptions,
    loading: subscriptionsLoading,
    mutate: mutateSubscriptions,
  } = useFetch<SubscriptionItem[]>('/api/system/subscriptions', () => API.getSubscriptions());

  const subscriptionsList = subscriptions ?? [];
  const loading = statusLoading || configLoading || subscriptionsLoading;

  useEffect(() => {
    if (config) {
      setConfigText(JSON.stringify(config, null, 2));
    }
  }, [config]);

  function reloadAll(): Promise<boolean> {
    mutateStatus();
    mutateConfig();
    mutateSubscriptions();
    return Promise.resolve(true);
  }

  const version = status?.app?.version || config?.app?.version || '--';

  const diagnostics = useMemo(() => Object.entries(status?.crawler_diagnostics || {}), [status]);

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'config', label: '配置中心' },
    { key: 'subscriptions', label: '订阅管理' },
    { key: 'diagnostics', label: '诊断日志' },
  ];

  async function handleSaveConfigWithText(text: string) {
    const parsed = safeJsonParse(text);
    if (!parsed) {
      setFeedback({ tone: 'error', text: '配置 JSON 格式不正确' });
      return;
    }
    setSavingConfig(true);
    try {
      await API.updateSystemConfig(parsed);
      const refreshed = await reloadAll();
      if (refreshed) {
        setFeedback({ tone: 'success', text: '配置已保存' });
      }
    } catch (requestError) {
      setFeedback({ tone: 'error', text: requestError instanceof Error ? requestError.message : '保存配置失败' });
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleCleanHistory() {
    if (!window.confirm(`确定要清洗历史岗位数据吗？这将清除约 ${status?.database?.total_jobs ?? 0} 条记录，且不可撤销。`)) return;
    setCleaning(true);
    try {
      await API.cleanHistoricalData(500);
      const refreshed = await reloadAll();
      if (refreshed) {
        setFeedback({ tone: 'success', text: '历史岗位已清洗' });
      }
    } catch (requestError) {
      setFeedback({ tone: 'error', text: requestError instanceof Error ? requestError.message : '清洗历史岗位失败' });
    } finally {
      setCleaning(false);
    }
  }

  return (
    <AppShell title="系统状态" description="统一配置中心、数据库状态和订阅提醒" requiredPermission="view_system">
      <SectionCard title="系统概览" description="后端、数据库、爬虫与 AI 运行指标">
        {loading ? (
          <Skeleton type="metric" />
        ) : (
          <div className="grid-4">
            <MetricCard label="应用版本" value={version} hint="当前运行版本号" tone="blue" />
            <MetricCard label="岗位总数" value={status?.database?.total_jobs ?? 0} hint="结构化入库岗位总量" tone="emerald" />
            <MetricCard label="今日新增" value={status?.today_jobs ?? 0} hint="最近 24 小时新增岗位" tone="amber" />
            <MetricCard label="采集成功率" value={`${status?.crawler_success_rate ?? 0}%`} hint="爬虫采集成功率" tone="violet" />
          </div>
        )}
      </SectionCard>

      {feedback ? (
        <div className={`notice notice-${feedback.tone}`} style={{ marginBottom: 16 }}>
          {feedback.text}
        </div>
      ) : null}

      <SectionCard
        title="系统管理"
        description="配置中心、订阅管理和诊断日志"
        action={
          <Button variant="secondary" onClick={reloadAll}>
            刷新
          </Button>
        }
      >
        <TabNav tabs={tabs} active={activeTab} onChange={(key) => { setActiveTab(key); setFeedback(null); }} />

        {activeTab === 'config' && (
          loading ? <Skeleton type="card" /> : (
            <div id="panel-config" role="tabpanel" aria-labelledby="tab-config" style={{ marginTop: 10 }}>
              <form className="grid-2" style={{ gap: 24 }} onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const text = (fd.get('config') as string) || '';
                void handleSaveConfigWithText(text);
              }}>
                <label>
                  <div style={{ marginBottom: 8, fontWeight: 700 }}>配置 JSON</div>
                  <Textarea
                    name="config"
                    rows={18}
                    defaultValue={configText}
                    style={{ fontFamily: 'monospace', fontSize: 13 }}
                  />
                </label>
                <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
                  <div className="panel" style={{ padding: 20 }}>
                    <div style={{ fontWeight: 700, marginBottom: 12 }}>操作</div>
                    <div style={{ display: 'grid', gap: 12 }}>
                      <Button
                        variant="primary"
                        type="submit"
                        disabled={savingConfig}
                      >
                        {savingConfig ? '保存中...' : '保存配置'}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={cleaning}
                        onClick={() => { void handleCleanHistory(); }}
                      >
                        {cleaning ? '清洗中...' : '清洗历史岗位'}
                      </Button>
                    </div>
                  </div>
                  <div className="panel" style={{ padding: 20 }}>
                    <div style={{ fontWeight: 700, marginBottom: 12 }}>诊断摘要</div>
                    <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>AI 超时率</span>
                        <span style={{ fontWeight: 600 }}>{status?.ai_runtime?.timeout_rate ?? 0}%</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>缓存命中</span>
                        <span style={{ fontWeight: 600 }}>{status?.ai_runtime?.cache_hit_rate ?? 0}%</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>日预算</span>
                        <span style={{ fontWeight: 600 }}>{status?.ai_runtime?.daily_budget ?? 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          )
        )}

        {activeTab === 'subscriptions' && (
          loading ? <Skeleton type="card" /> : (
            <div id="panel-subscriptions" role="tabpanel" aria-labelledby="tab-subscriptions" style={{ marginTop: 10 }}>
              <SubscriptionPanel
                subscriptions={subscriptionsList}
                reload={reloadAll}
                onPreview={async (subscription) => {
                  setAnalysisModal({ subscription, analysisResult: { analysis_id: 0, status: 'running', summary: null, results: [] }, loading: false });

                  let response: Response;
                  try {
                    response = await API.previewSubscriptionAnalysisStream(subscription.id);
                  } catch {
                    setAnalysisModal({ subscription: null, analysisResult: null, loading: false });
                    setFeedback({ tone: 'error', text: '无法连接到分析服务' });
                    return;
                  }
                  const reader = response.body?.getReader();
                  if (!reader) {
                    setAnalysisModal({ subscription: null, analysisResult: null, loading: false });
                    setFeedback({ tone: 'error', text: '无法连接到分析服务' });
                    return;
                  }

                  const decoder = new TextDecoder();
                  let buffer = '';

                  const readStream = (): void => {
                    reader.read().then(({ done, value }) => {
                      if (done) {
                        setAnalysisModal((prev) => ({ ...prev, loading: false }));
                        return;
                      }
                      buffer += decoder.decode(value, { stream: true });
                      const lines = buffer.split('\n');
                      buffer = lines.pop() || '';

                      for (const line of lines) {
                        if (line.startsWith('data: ')) {
                          try {
                            const data = JSON.parse(line.slice(6));
                            if (data.type === 'complete') {
                              setAnalysisModal((prev) => ({
                                ...prev,
                                analysisResult: {
                                  analysis_id: data.analysis_id,
                                  status: 'completed',
                                  summary: data.summary,
                                  results: data.results || [],
                                  cached_at: undefined,
                                },
                                loading: false,
                              }));
                            } else if (data.type === 'error') {
                              setAnalysisModal({ subscription: null, analysisResult: null, loading: false });
                              setFeedback({ tone: 'error', text: data.message || '分析失败' });
                            }
                          } catch { /* 忽略非JSON数据 */ }
                        }
                      }
                      readStream();
                    }).catch(() => {
                      setAnalysisModal({ subscription: null, analysisResult: null, loading: false });
                      setFeedback({ tone: 'error', text: '分析连接中断' });
                    });
                  };
                  readStream();
                }}
              />
            </div>
          )
        )}

        {activeTab === 'diagnostics' && (
          loading ? <Skeleton type="card" /> : (
            <div id="panel-diagnostics" role="tabpanel" aria-labelledby="tab-diagnostics" className="grid-2" style={{ marginTop: 10 }}>
              <div className="glass-card" style={{ padding: 18, borderRadius: 22 }}>
                <div style={{ fontWeight: 800, marginBottom: 12 }}>最近错误</div>
                {(status?.recent_errors || []).length === 0 ? (
                  <EmptyState title="暂无错误" description="最近运行稳定。" />
                ) : (
                  <div className="grid" style={{ gap: 10 }}>
                    {(status?.recent_errors || []).map((item, index) => (
                      <div key={`${item.time || index}`} className="glass-card" style={{ padding: 14, borderRadius: 18 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                          <strong>{item.source || 'unknown'}</strong>
                          <Badge tone="rose">{item.status || 'error'}</Badge>
                        </div>
                        <div style={{ marginTop: 8, color: 'var(--muted)' }}>{item.message || '运行异常'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="glass-card" style={{ padding: 18, borderRadius: 22 }}>
                <div style={{ fontWeight: 800, marginBottom: 12 }}>爬虫诊断</div>
                {diagnostics.length === 0 ? (
                  <EmptyState title="暂无诊断" description="运行过一次爬虫后会显示各来源抓取统计。" />
                ) : (
                  <div className="grid" style={{ gap: 10 }}>
                    {diagnostics.map(([name, value]) => (
                      <div key={name} className="glass-card" style={{ padding: 14, borderRadius: 18 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                          <strong>{name}</strong>
                          <span style={{ color: 'var(--muted)' }}>运行 {value.runs || 0} 次</span>
                        </div>
                        <div style={{ marginTop: 8, color: 'var(--muted)' }}>
                          抓取 {value.fetched || 0} · 保存 {value.saved || 0} · 重复 {value.duplicates || 0} · 失败 {value.failed || 0}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        )}
      </SectionCard>

      {analysisModal.subscription && (
        <SubscriptionAnalysisModal
          subscription={analysisModal.subscription}
          analysisResult={analysisModal.analysisResult}
          loading={analysisModal.loading}
          onReanalyze={async () => {
            if (!analysisModal.subscription) return;
            setAnalysisModal((prev) => ({ ...prev, analysisResult: { analysis_id: 0, status: 'running', summary: null, results: [] }, loading: false }));

            let response: Response;
            try {
              response = await API.previewSubscriptionAnalysisStream(analysisModal.subscription.id, true);
            } catch {
              setAnalysisModal({ subscription: null, analysisResult: null, loading: false });
              setFeedback({ tone: 'error', text: '无法连接到分析服务' });
              return;
            }
            const reader = response.body?.getReader();
            if (!reader) {
              setAnalysisModal({ subscription: null, analysisResult: null, loading: false });
              setFeedback({ tone: 'error', text: '无法连接到分析服务' });
              return;
            }

            const decoder = new TextDecoder();
            let buffer = '';

            const readStream = (): void => {
              reader.read().then(({ done, value }) => {
                if (done) {
                  setAnalysisModal((prev) => ({ ...prev, loading: false }));
                  return;
                }
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    try {
                      const data = JSON.parse(line.slice(6));
                      if (data.type === 'complete') {
                        setAnalysisModal((prev) => ({
                          ...prev,
                          analysisResult: {
                            analysis_id: data.analysis_id,
                            status: 'completed',
                            summary: data.summary,
                            results: data.results || [],
                            cached_at: undefined,
                          },
                          loading: false,
                        }));
                      } else if (data.type === 'error') {
                        setAnalysisModal({ subscription: null, analysisResult: null, loading: false });
                        setFeedback({ tone: 'error', text: data.message || '重新分析失败' });
                      }
                    } catch { /* 忽略 */ }
                  }
                }
                readStream();
              }).catch(() => {
                setAnalysisModal({ subscription: null, analysisResult: null, loading: false });
                setFeedback({ tone: 'error', text: '分析连接中断' });
              });
            };
            readStream();
          }}
          onViewHistory={() => {
            console.log('查看历史记录 - 功能开发中');
          }}
          onClose={() => setAnalysisModal({ subscription: null, analysisResult: null, loading: false })}
        />
      )}
    </AppShell>
  );
}

function SubscriptionPanel({
  subscriptions,
  reload,
  onPreview,
}: {
  subscriptions: SubscriptionItem[];
  reload: () => Promise<boolean>;
  onPreview: (subscription: { id: number; name: string }) => void;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  function resetForm() {
    setEditingId(null);
    setFeedback(null);
  }

  function editSubscription(item: SubscriptionItem) {
    setEditingId(item.id);
    setFeedback(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = (fd.get('name') as string).trim();
    const keyword = (fd.get('keyword') as string).trim();
    const locationsStr = (fd.get('locations') as string || '').trim();
    const industriesStr = (fd.get('industries') as string || '').trim();
    const jobTypesStr = (fd.get('jobTypes') as string || '').trim();
    const education = (fd.get('education') as string || '').trim();
    const enabled = fd.get('enabled') === 'on';

    if (!name) { setFeedback({ tone: 'error', text: '请输入订阅名称' }); return; }
    if (!keyword) { setFeedback({ tone: 'error', text: '请输入关键词' }); return; }

    const locations = locationsStr ? locationsStr.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [];
    const industries = industriesStr ? industriesStr.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [];
    const jobTypes = jobTypesStr ? jobTypesStr.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [];

    setSaving(true);
    setFeedback(null);
    try {
      const payload = { name, keyword, locations, industries, job_types: jobTypes, education, enabled };
      if (editingId) {
        await API.updateSubscription(editingId, payload);
      } else {
        await API.saveSubscription(payload);
      }
      resetForm();
      const refreshed = await reload();
      if (refreshed) {
        setFeedback({ tone: 'success', text: editingId ? '订阅已更新' : '订阅已保存' });
      }
    } catch (requestError) {
      setFeedback({ tone: 'error', text: requestError instanceof Error ? requestError.message : '保存订阅失败' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: SubscriptionItem) {
    if (!window.confirm('确定要删除此订阅配置吗？此操作不可撤销。')) return;
    setDeletingId(item.id);
    try {
      await API.deleteSubscription(item.id);
      const refreshed = await reload();
      if (refreshed) {
        setFeedback({ tone: 'success', text: `订阅「${item.name}」已删除` });
      }
    } catch (requestError) {
      setFeedback({ tone: 'error', text: requestError instanceof Error ? requestError.message : '删除订阅失败' });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggle(item: SubscriptionItem) {
    setTogglingId(item.id);
    try {
      await API.updateSubscription(item.id, { enabled: !item.enabled } as Record<string, unknown>);
      const refreshed = await reload();
      if (refreshed) {
        setFeedback({ tone: 'success', text: `订阅「${item.name}」已${item.enabled ? '停用' : '启用'}` });
      }
    } catch (requestError) {
      setFeedback({ tone: 'error', text: requestError instanceof Error ? requestError.message : '切换订阅状态失败' });
    } finally {
      setTogglingId(null);
    }
  }

  const editingItem = editingId ? subscriptions.find(s => s.id === editingId) : null;

  return (
    <form className="grid-2" key={editingId || 'new'} onSubmit={handleSubmit}>
      <div>
        <div className="grid-2">
          <label>
            <div style={{ marginBottom: 8, fontWeight: 700 }}>订阅名称</div>
            <Input name="name" defaultValue={editingItem?.name || ''} placeholder="例如：上海基金实习" />
          </label>
          <label>
            <div style={{ marginBottom: 8, fontWeight: 700 }}>关键词</div>
            <Input name="keyword" defaultValue={editingItem?.keyword || ''} placeholder="例如：投研 / 量化" />
          </label>
          <label>
            <div style={{ marginBottom: 8, fontWeight: 700 }}>地点</div>
            <Input name="locations" defaultValue={(editingItem?.locations || []).join(', ') || ''} placeholder="逗号分隔" />
          </label>
          <label>
            <div style={{ marginBottom: 8, fontWeight: 700 }}>行业</div>
            <Input name="industries" defaultValue={(editingItem?.industries || []).join(', ') || ''} placeholder="逗号分隔" />
          </label>
          <label>
            <div style={{ marginBottom: 8, fontWeight: 700 }}>类型</div>
            <Input name="jobTypes" defaultValue={(editingItem?.job_types || []).join(', ') || ''} placeholder="逗号分隔" />
          </label>
          <label>
            <div style={{ marginBottom: 8, fontWeight: 700 }}>学历</div>
            <Input name="education" defaultValue={editingItem?.education || ''} placeholder="例如：硕士" />
          </label>
        </div>
        <div className="row-gap" style={{ marginTop: 16 }}>
          <label className="badge badge-slate" style={{ cursor: 'pointer', gap: 8 }}>
            <input type="checkbox" name="enabled" defaultChecked={editingItem?.enabled ?? true} />
            启用该订阅
          </label>
          <Button
            variant="primary"
            type="submit"
            disabled={saving}
          >
            {saving ? (editingId ? '更新中...' : '保存中...') : (editingId ? '更新订阅' : '保存订阅')}
          </Button>
          {editingId ? (
            <Button variant="secondary" onClick={resetForm}>
              取消编辑
            </Button>
          ) : null}
        </div>
        {feedback ? (
          <div className={`notice notice-${feedback.tone}`} style={{ marginTop: 16 }}>
            {feedback.text}
          </div>
        ) : null}
      </div>
      <div className="grid" style={{ gap: 10 }}>
        {subscriptions.length === 0 ? (
          <EmptyState title="暂无订阅" description="创建一个订阅后，这里会列出全部规则。" />
        ) : (
          subscriptions.map((item) => (
            <div key={item.id} className="glass-card" style={{ padding: 16, borderRadius: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <strong>{item.name}</strong>
                <Badge tone={item.enabled ? 'emerald' : 'slate'}>
                  {item.enabled ? '启用' : '停用'}
                </Badge>
              </div>
              <div style={{ marginTop: 8, color: 'var(--muted)', lineHeight: 1.7 }}>
                {item.keyword || '无关键词'}
                <br />
                {(item.locations || []).join('、') || '无地点'}
              </div>
              <div className="row-gap" style={{ marginTop: 12 }}>
                <Button
                  variant="secondary"
                  onClick={() => onPreview({ id: item.id, name: item.name })}
                >
                  预览分析
                </Button>
                <Button variant="secondary" onClick={() => editSubscription(item)}>
                  编辑
                </Button>
                <Button
                  variant="secondary"
                  disabled={togglingId === item.id}
                  onClick={() => { void handleToggle(item); }}
                >
                  {togglingId === item.id ? '切换中...' : (item.enabled ? '停用' : '启用')}
                </Button>
                <Button
                  variant="danger"
                  disabled={deletingId === item.id}
                  onClick={() => { void handleDelete(item); }}
                >
                  {deletingId === item.id ? '删除中...' : '删除'}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </form>
  );
}