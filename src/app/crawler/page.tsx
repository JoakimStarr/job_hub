'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, EmptyState, SectionCard } from '@/components/ui';
import { API } from '@/lib/api';
import type { CrawlerStatus } from '@/lib/types';

type CrawlerLog = { timestamp?: string; level?: string; message?: string; source?: string };

export default function CrawlerPage() {
  const [status, setStatus] = useState<CrawlerStatus | null>(null);
  const [logs, setLogs] = useState<CrawlerLog[]>([]);
  const [sources, setSources] = useState<Array<{ name?: string; url?: string; enabled?: boolean }>>([]);
  const [statusLoading, setStatusLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [headless, setHeadless] = useState(true);
  const [runningAction, setRunningAction] = useState(false);
  const [message, setMessage] = useState('');
  const [statusError, setStatusError] = useState('');
  const [logsError, setLogsError] = useState('');
  const [sourcesError, setSourcesError] = useState('');

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('crawlerHeadless') : null;
    if (saved !== null) {
      setHeadless(saved !== 'false');
    }
  }, []);

  async function loadCrawlerData() {
    setStatusLoading(true);
    setLogsLoading(true);
    setSourcesLoading(true);
    setStatusError('');
    setLogsError('');
    setSourcesError('');

    const [nextStatus, nextLogs, nextSources] = await Promise.allSettled([
      API.getCrawlerStatus(),
      API.getCrawlerLogs(20),
      API.getCrawlerSources(),
    ]);

    if (nextStatus.status === 'fulfilled') {
      setStatus(nextStatus.value);
    } else {
      setStatusError(nextStatus.reason instanceof Error ? nextStatus.reason.message : '加载爬虫状态失败');
    }

    if (nextLogs.status === 'fulfilled') {
      setLogs(Array.isArray(nextLogs.value) ? nextLogs.value : []);
    } else {
      setLogsError(nextLogs.reason instanceof Error ? nextLogs.reason.message : '加载日志失败');
    }

    if (nextSources.status === 'fulfilled') {
      setSources(Array.isArray(nextSources.value) ? nextSources.value : []);
    } else {
      setSourcesError(nextSources.reason instanceof Error ? nextSources.reason.message : '加载来源失败');
    }

    setStatusLoading(false);
    setLogsLoading(false);
    setSourcesLoading(false);
  }

  useEffect(() => {
    void loadCrawlerData();
  }, []);

  return (
    <AppShell title="数据采集" description="查看爬虫状态、日志和来源" requiredPermission="manage_crawler">
      <SectionCard title="爬虫状态" description="与旧版控制台一致的启动、停止与日志概览">
        {statusLoading ? <EmptyState title="正在加载" description="爬虫状态正在拉取。" /> : null}
        {statusError ? <EmptyState title="加载失败" description={statusError} action={<Button variant="secondary" onClick={loadCrawlerData}>重试</Button>} /> : null}
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
                  await loadCrawlerData();
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
                setRunningAction(true);
                try {
                  await API.stopCrawler();
                  await loadCrawlerData();
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
          <Button variant="secondary" onClick={() => void loadCrawlerData()}>刷新</Button>
        </div>
        {message ? <div className="notice notice-success" style={{ marginTop: 16 }}>{message}</div> : null}
      </SectionCard>

      <SectionCard title="采集来源" description="来源列表和可用状态">
        {sourcesLoading ? <EmptyState title="正在加载" description="爬虫来源正在拉取。" /> : null}
        {sourcesError ? <EmptyState title="加载失败" description={sourcesError} action={<Button variant="secondary" onClick={loadCrawlerData}>重试</Button>} /> : null}
        {!sourcesLoading && !sourcesError && sources.length === 0 ? <EmptyState title="暂无来源" description="当前没有可用的采集来源。" /> : null}
        {sources.length > 0 ? (
          <div className="grid" style={{ gap: 12 }}>
            {sources.map((item, index) => (
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
        {logsError ? <EmptyState title="加载失败" description={logsError} action={<Button variant="secondary" onClick={loadCrawlerData}>重试</Button>} /> : null}
        {!logsLoading && !logsError && logs.length === 0 ? <EmptyState title="暂无日志" description="运行过一次爬虫后这里会出现日志。" /> : null}
        {!logsLoading && !logsError && logs.length > 0 ? (
          <div className="grid" style={{ gap: 12 }}>
            {logs.map((item, index) => (
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
    </AppShell>
  );
}
