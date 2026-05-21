'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, EmptyState, JobCard, JobDetailModal, MetricCard, SectionCard, Skeleton } from '@/components/ui';
import { API } from '@/lib/api';
import { useAppStore } from '@/store';
import { useFetch } from '@/hooks/useFetch';
import type { JobItem, StatsOverview } from '@/lib/types';

export default function HomePage() {
  const router = useRouter();
  const [selectedJob, setSelectedJob] = useState<JobItem | null>(null);

  const { data: stats, error: statsError, loading: statsLoading, mutate: mutateStats } = useFetch<StatsOverview>(
    '/api/stats/overview',
    () => API.getStatsOverview(),
  );

  const { data: latestResult, error: jobsError, loading: jobsLoading, mutate: mutateJobs } = useFetch<{ items: JobItem[] }>(
    '/api/jobs?home_latest',
    () => API.getJobs({ page: 1, page_size: 6, days: 7, sort: 'created_at', order: 'desc' }),
  );

  const loading = statsLoading || jobsLoading;
  const error = statsError?.message || jobsError?.message || '';
  const jobs = latestResult?.items || [];
  const overview = stats?.overview || {};

  const handleRefresh = useCallback(() => {
    mutateStats();
    mutateJobs();
  }, [mutateStats, mutateJobs]);

  async function handleToggleFavorite(job: JobItem) {
    if (useAppStore.getState().isGuest) {
      alert('请登录后收藏岗位');
      return;
    }
    await API.toggleFavorite(job.id);
    handleRefresh();
  }

  function handleKeywordClick(keyword: string) {
    router.push('/jobs?q=' + encodeURIComponent(keyword));
  }

  function handleTagClick(type: string, value: string) {
    router.push('/jobs?' + type + '=' + encodeURIComponent(value));
  }

  return (
    <AppShell title="首页" description="平台概览、热门关键词和最新岗位" requiredPermission="view_stats">
      {loading ? (
        <>
          <Skeleton type="metric" />
          <Skeleton type="card" />
        </>
      ) : error ? (
        <EmptyState title="加载失败" description={error} action={<Button variant="secondary" onClick={handleRefresh}>重试</Button>} />
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
            action={<Button variant="secondary" onClick={handleRefresh}>刷新数据</Button>}
          >
            {(stats?.hot_keywords || []).length ? (
              <div className="job-tags">
                {stats?.hot_keywords?.map((item) => (
                  <Badge key={item.keyword} tone="blue" style={{ cursor: 'pointer' }} onClick={() => handleKeywordClick(item.keyword)}>{item.keyword} &middot; {item.count}</Badge>
                ))}
              </div>
            ) : (
              <EmptyState title="暂无关键词" description="当前还没有热门关键词数据。" />
            )}
          </SectionCard>

          <SectionCard title="最新岗位" description="最近一周的岗位数据">
            {jobs.length === 0 ? (
              <EmptyState title="暂无岗位" description="当前数据库里还没有可展示的岗位。" />
            ) : (
              <div className="grid" style={{ gap: '14px' }}>
                {jobs.map((job) => (
                  <JobCard key={job.id} job={job} onToggleFavorite={() => handleToggleFavorite(job)} onClick={(target) => setSelectedJob(target)} onTagClick={handleTagClick} />
                ))}
              </div>
            )}
          </SectionCard>

          {selectedJob && (
            <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} onToggleFavorite={(job) => handleToggleFavorite(job)} />
          )}
        </>
      )}
    </AppShell>
  );
}
