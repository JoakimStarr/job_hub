'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, EmptyState, JobCard, JobDetailModal, MetricCard, SectionCard, Skeleton, ViewToggle } from '@/components/ui';
import { Pagination } from '@/components/Pagination';
import { API } from '@/lib/api';
import { useAppStore } from '@/store';
import { useFetch } from '@/hooks/useFetch';
import type { JobItem, StatsOverview, PagedResponse } from '@/types';

const LATEST_DAYS = 7;
const PAGE_SIZE = 8;

export default function HomePage() {
  const router = useRouter();
  const [selectedJob, setSelectedJob] = useState<JobItem | null>(null);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('job_view_mode');
      return saved === 'card' || saved === 'list' ? saved : 'list';
    }
    return 'list';
  });
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    localStorage.setItem('job_view_mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    setAnimating(true);
    const timer = setTimeout(() => setAnimating(false), 300);
    return () => clearTimeout(timer);
  }, [viewMode]);

  const { data: stats, error: statsError, loading: statsLoading, mutate: mutateStats } = useFetch<StatsOverview>(
    '/api/stats/overview',
    () => API.getStatsOverview(),
  );

  const jobsKey = `/api/jobs?page=${page}&page_size=${PAGE_SIZE}&days=${LATEST_DAYS}&sort=publish_date&order=desc`;
  const { data: latestResult, error: jobsError, loading: jobsLoading, mutate: mutateJobs } = useFetch<PagedResponse<JobItem>>(
    jobsKey,
    () => API.getJobs({ page, page_size: PAGE_SIZE, days: LATEST_DAYS, sort: 'publish_date', order: 'desc' }),
  );

  const loading = statsLoading || jobsLoading;
  const error = statsError?.message || jobsError?.message || '';
  const jobs = latestResult?.items || [];
  const totalPages = latestResult?.pages || 0;
  const overview = stats?.overview || {};

  const handleRefresh = useCallback(() => {
    setPage(1);
    mutateStats();
    mutateJobs();
  }, [mutateStats, mutateJobs]);

  async function handleToggleFavorite(job: JobItem) {
    if (useAppStore.getState().isGuest) {
      alert('请登录后收藏岗位');
      return;
    }
    await API.toggleFavorite(job.id);
    mutateStats();
    mutateJobs();
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

          <SectionCard
            title="最新岗位"
            description="最近一周的岗位数据"
            action={
              <ViewToggle mode={viewMode} onToggle={() => setViewMode((m) => m === 'card' ? 'list' : 'card')} />
            }
          >
            {jobs.length === 0 ? (
              <EmptyState title="暂无岗位" description="当前数据库里还没有可展示的岗位。" />
            ) : (
              <>
                <div className={`job-view-container ${viewMode === 'list' ? 'job-list' : 'grid'} ${animating ? 'view-animating' : ''}`} style={{ gap: viewMode === 'list' ? 0 : 14 }} role="list">
                  {jobs.map((job) => (
                    <div key={job.id} role="listitem">
                      <JobCard job={job} viewMode={viewMode} onToggleFavorite={() => handleToggleFavorite(job)} onClick={(target) => setSelectedJob(target)} onTagClick={handleTagClick} />
                    </div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <Pagination current={page} total={totalPages} onChange={(p) => setPage(p)} />
                )}
              </>
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
