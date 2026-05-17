'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, EmptyState, JobCard, MetricCard, SectionCard, Skeleton } from '@/components/ui';
import { API } from '@/lib/api';
import type { JobItem, StatsOverview } from '@/lib/types';

export default function HomePage() {
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [overview, latestResult] = await Promise.all([
        API.getStatsOverview(),
        API.getJobs({ page: 1, page_size: 6 }),
      ]);
      setStats(overview);
      setJobs(latestResult.items || []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '加载首页数据失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const overview = stats?.overview || {};

  async function handleToggleFavorite(job: JobItem) {
    await API.toggleFavorite(job.id);
    await loadData();
  }

  return (
    <AppShell title="首页" description="平台概览、热门关键词和最新岗位" requiredPermission="view_stats">
      {loading ? (
        <>
          <Skeleton type="metric" />
          <Skeleton type="card" />
        </>
      ) : error ? (
        <EmptyState title="加载失败" description={error} action={<Button variant="secondary" onClick={loadData}>重试</Button>} />
      ) : (
        <>
          <div className="grid-4">
            <MetricCard label="总岗位数" value={overview.total_jobs ?? '--'} hint="结构化入库岗位总量" tone="blue" />
            <MetricCard label="收藏岗位" value={overview.favorite_jobs ?? '--'} hint="当前用户收藏数量" tone="violet" />
            <MetricCard label="今日新增" value={overview.today_jobs ?? '--'} hint="最近 24 小时新增岗位" tone="emerald" />
            <MetricCard label="数据来源" value={overview.sources_count ?? '--'} hint="接入的采集来源数量" tone="amber" />
          </div>

          <SectionCard
            title="热门关键词"
            description="来自历史岗位与推荐画像的高频关键词"
            action={<Button variant="secondary" onClick={loadData}>刷新数据</Button>}
          >
            {(stats?.hot_keywords || []).length ? (
              <div className="job-tags">
                {stats?.hot_keywords?.map((item) => (
                  <Badge key={item.keyword} tone="blue">{item.keyword} &middot; {item.count}</Badge>
                ))}
              </div>
            ) : (
              <EmptyState title="暂无关键词" description="当前还没有热门关键词数据。" />
            )}
          </SectionCard>

          <SectionCard title="最新岗位" description="按照采集时间排序的最新数据">
            {jobs.length === 0 ? (
              <EmptyState title="暂无岗位" description="当前数据库里还没有可展示的岗位。" />
            ) : (
              <div className="grid" style={{ gap: '14px' }}>
                {jobs.map((job) => (
                  <JobCard key={job.id} job={job} onToggleFavorite={() => handleToggleFavorite(job)} />
                ))}
              </div>
            )}
          </SectionCard>
        </>
      )}
    </AppShell>
  );
}