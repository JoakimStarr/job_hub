'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, EmptyState, SectionCard } from '@/components/ui';
import { API, APIError } from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import type { CrawlerStatus } from '@/lib/types';

type CrawlerLog = { timestamp?: string; level?: string; message?: string; source?: string };

export default function CrawlerPage() {
  const [headless, setHeadless] = useState(true);
  const [runningAction, setRunningAction] = useState(false);
  const [message, setMessage] = useState('');

  const {
    data: status,
    error: statusError,
    loading: statusLoading,
    mutate: mutateStatus,
  } = useFetch<CrawlerStatus>('/api/crawler/status', () => API.getCrawlerStatus());

  const {
    data: logs,
    error: logsError,
    loading: logsLoading,
    mutate: mutateLogs,
  } = useFetch<CrawlerLog[]>('/api/crawler/logs', () => API.getCrawlerLogs(20) as Promise<CrawlerLog[]>);

  const {
    data: sources,
    error: sourcesError,
    loading: sourcesLoading,
    mutate: mutateSources,
  } = useFetch<Array<{ name?: string; url?: string; enabled?: boolean }>>('/api/crawler/sources', () => API.getCrawlerSources() as Promise<Array<{ name?: string; url?: string; enabled?: boolean }>>);

  const logsList = logs ?? [];
  const sourcesList = sources ?? [];

  const featureUnavailable =
    (statusError?.status === 404) ||
    (logsError?.status === 404) ||
    (sourcesError?.status === 404);

  function reloadAll() {
    mutateStatus();
    mutateLogs();
    mutateSources();
  }

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('crawlerHeadless') : null;
    if (saved !== null) {
      setHeadless(saved !== 'false');
    }
  }, []);

  return (
    <AppShell title="数据采集" description="查看爬虫状态、日志和来源" requiredPermission="manage_crawler">
      {featureUnavailable ? (
        <SectionCard title="功能尚未就绪" description="爬虫服务正在开发中">
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>🚧</div>
            <h3 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>功能开发中</h3>
            <p style={{ fontSize: 16, color: 'var(--muted)', lineHeight: 1.8, maxWidth: 500, margin: '0 auto' }}>
              该功能的后端接口尚未实现，请联系管理员部署爬虫服务。
              <br />
              预计将在后续版本中提供完整的数据采集功能。
            </p>
            <div style={{ marginTop: 24 }}>
              <Button variant="secondary" onClick={reloadAll}>重新检测</Button>
            </div>
          </div>
        </SectionCard>
      ) : (
        <>
      <SectionCard title="爬虫状态" description="与旧版控制台一致的启动、停止与日志概览">
        {statusLoading ? <EmptyState title="正在加载" description="爬虫状态正在拉取。" /> : null}
        {statusError ? <EmptyState title="加载失败" description={statusError.message} action={<Button variant="secondary" onClick={reloadAll}>重试</Button>} /> : null}
        <div className="grid-3">
          <Badge tone={status?.is_running ? 'emerald' : 'slate'}>{status?.is_running ? '运行中' : '已停止'}</Badge>
          <Badge tone="blue">{status?.current_source || '未选择来源'}</Badge>
          <Badge tone="violet">{status?.progress ?? 0}%</Badge>
        </div>
        <div style={{ marginTop: 16, color: 'var(--muted)', lineHeight: 1.8 }}>
          {status?.message || '暂无运行信息'}
        </div>
        <div className="row-gap" style={{ marginTop: 18 }}>
          <label className="badge badge-slate" style={{ cursor: 'pointer', gap: 8 }}>
            <input
              type="checkbox"
              checked={headless}
              onChange={(event) => {
                const checked = event.target.checked;
                setHeadless(checked);
                localStorage.setItem('crawlerHeadless', String(checked));
              }}
            />
            无头模式
          </label>
            <Button
              variant="primary"
              disabled={runningAction || status?.is_running}
              onClick={async () => {
                setRunningAction(true);
                try {
                  await API.startCrawler({ headless });
                  reloadAll();
                  setMessage('爬虫已启动');
                } catch (requestError) {
                  setMessage(requestError instanceof Error ? requestError.message : '启动爬虫失败');
                } finally {
                  setRunningAction(false);
                }
              }}
          >
            启动爬虫
          </Button>
            <Button
              variant="danger"
              disabled={runningAction || !status?.is_running}
              onClick={async () => {
                if (!window.confirm('确定要停止爬虫任务吗？正在采集的数据可能不完整。')) return;
                setRunningAction(true);
                try {
                  await API.stopCrawler();
                  reloadAll();
                  setMessage('爬虫已停止');
                } catch (requestError) {
                  setMessage(requestError instanceof Error ? requestError.message : '停止爬虫失败');
                } finally {
                  setRunningAction(false);
                }
              }}
          >
            停止爬虫
          </Button>
          <Button variant="secondary" onClick={reloadAll}>刷新</Button>
        </div>
        {message ? <div className="notice notice-success" style={{ marginTop: 16 }}>{message}</div> : null}
      </SectionCard>

      <SectionCard title="采集来源" description="来源列表和可用状态">
        {sourcesLoading ? <EmptyState title="正在加载" description="爬虫来源正在拉取。" /> : null}
        {sourcesError ? <EmptyState title="加载失败" description={sourcesError.message} action={<Button variant="secondary" onClick={reloadAll}>重试</Button>} /> : null}
        {!sourcesLoading && !sourcesError && sourcesList.length === 0 ? <EmptyState title="暂无来源" description="当前没有可用的采集来源。" /> : null}
        {sourcesList.length > 0 ? (
          <div className="grid" style={{ gap: 12 }}>
            {sourcesList.map((item, index) => (
              <div key={`${item.name || 'source'}-${index}`} className="glass-card" style={{ padding: 18, borderRadius: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <strong>{item.name || '未命名来源'}</strong>
                  <Badge tone={item.enabled ? 'emerald' : 'slate'}>{item.enabled ? '启用' : '停用'}</Badge>
                </div>
                <div style={{ marginTop: 8, color: 'var(--muted)' }}>{item.url || '无地址'}</div>
              </div>
            ))}
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="最近日志" description="采集运行时的最新日志">
        {logsLoading ? <EmptyState title="正在加载" description="爬虫日志正在拉取。" /> : null}
        {logsError ? <EmptyState title="加载失败" description={logsError.message} action={<Button variant="secondary" onClick={reloadAll}>重试</Button>} /> : null}
        {!logsLoading && !logsError && logsList.length === 0 ? <EmptyState title="暂无日志" description="运行过一次爬虫后这里会出现日志。" /> : null}
        {!logsLoading && !logsError && logsList.length > 0 ? (
          <div className="grid" style={{ gap: 12 }}>
            {logsList.map((item, index) => (
              <div key={`${item.timestamp || index}`} className="glass-card" style={{ padding: 18, borderRadius: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <strong>{item.message || '日志消息'}</strong>
                  <Badge tone={String(item.level || '').toLowerCase().includes('error') ? 'rose' : 'blue'}>{item.level || 'INFO'}</Badge>
                </div>
                <div style={{ marginTop: 8, color: 'var(--muted)', fontSize: 13 }}>
                  {item.timestamp || '--'} {item.source ? `· ${item.source}` : ''}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </SectionCard>
        </>
      )}
    </AppShell>
  );
}
