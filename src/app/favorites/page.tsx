'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { mutate } from 'swr';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, EmptyState, Input, JobCard, JobDetailModal, MetricCard, SectionCard, Skeleton, StarButton } from '@/components/ui';
import { Pagination } from '@/components/Pagination';
import { API, APIError } from '@/lib/api';
import { useAppStore } from '@/store';
import type { JobItem, PagedResponse } from '@/lib/types';
import { useToast } from '@/components/Toast';
import { useFetch } from '@/hooks/useFetch';

export default function FavoritesPage() {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedJob, setSelectedJob] = useState<JobItem | null>(null);

  const favoritesKey = `/api/jobs/favorites?page=${page}&keyword=${query}`;

  const { data: favorites, error: fetchError, loading, mutate: mutateFavorites } = useFetch<PagedResponse<JobItem>>(
    favoritesKey,
    () => API.getFavorites({ page, page_size: 10, keyword: query }),
  );

  const handleSearch = useCallback(() => {
    setPage(1);
  }, []);

  const handleClear = useCallback(() => {
    setQuery('');
    setPage(1);
  }, []);

  const handleToggleFavorite = useCallback(async (job: JobItem, source?: 'list' | 'detail') => {
    if (useAppStore.getState().isGuest) {
      alert('请登录后收藏岗位');
      return;
    }
    const newFavoriteState = job.is_favorite ? 0 : 1;

    // 乐观更新：从收藏列表中移除
    mutate(
      favoritesKey,
      (current: PagedResponse<JobItem> | undefined) => {
        if (!current) return current;
        return {
          ...current,
          items: current.items.filter((item) => item.id !== job.id),
          total: Math.max(0, current.total - 1),
        };
      },
      { revalidate: false },
    );

    if (source === 'detail') {
      setSelectedJob((prev) =>
        prev && prev.id === job.id ? { ...prev, is_favorite: newFavoriteState } : null
      );
    }

    try {
      await API.toggleFavorite(job.id);
      toast.success(newFavoriteState ? '已添加到收藏' : '已取消收藏');
    } catch (err) {
      // 回滚：重新获取数据
      mutate(favoritesKey);
      const errorMsg = err instanceof Error ? err.message : '操作失败';
      if (err instanceof APIError && err.status === 404) {
        toast.error('收藏接口不存在，请检查后端服务');
      } else if (err instanceof APIError && err.status === 500) {
        toast.error('服务器内部错误，收藏操作失败');
      } else if (err instanceof APIError && err.status === 401) {
        toast.error('登录已过期，请重新登录');
      } else {
        toast.error(errorMsg);
      }
    }
  }, [favoritesKey, toast]);

  const handleJobClick = useCallback((job: JobItem) => {
    setSelectedJob(job);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedJob(null);
  }, []);

  const items = favorites?.items || [];
  const statsLoading = loading && !favorites;
  const error = fetchError?.message || '';

  return (
    <AppShell title="我的收藏" description="查看、检索并取消收藏岗位" requiredPermission="view_jobs">
      <div className="grid-3">
        <MetricCard label="收藏总数" value={favorites?.total ?? 0} tone="amber" />
        <MetricCard label="当前页" value={favorites?.page ?? page} tone="blue" />
        <MetricCard label="总页数" value={favorites?.pages ?? '--'} tone="violet" />
      </div>

      <SectionCard title="收藏筛选" description="按关键词快速定位收藏的岗位">
        <div className="grid-2">
          <label>
            <div style={{ marginBottom: 8, fontWeight: 700 }}>搜索关键词</div>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索收藏岗位"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'end', gap: 10 }}>
            <StarButton active size="md" onClick={handleSearch} />
            <Button variant="secondary" onClick={handleClear}>清除</Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="收藏列表" description="管理已收藏的岗位">
        {error ? (
          <EmptyState
            title="加载失败"
            description={error}
            action={<Button variant="secondary" onClick={() => mutateFavorites()}>重试</Button>}
          />
        ) : null}

        {!error && statsLoading ? (
          <Skeleton type="card" />
        ) : null}

        {!error && !loading && items.length === 0 ? (
          <EmptyState
            title="暂无收藏"
            description="你还没有收藏任何岗位，去浏览岗位并添加收藏吧。"
            action={<Button variant="secondary" onClick={() => router.push('/jobs')}>浏览岗位</Button>}
          />
        ) : null}

        {!error && items.length > 0 ? (
          <>
            <div className="grid" style={{ gap: 14 }}>
              {items.map((job) => (
                <JobCard
                  key={job.id}
                  job={{ ...job, is_favorite: 1 }}
                  onToggleFavorite={handleToggleFavorite}
                  onClick={handleJobClick}
                />
              ))}
            </div>

            {favorites?.pages ? (
              <Pagination
                current={page}
                total={favorites.pages}
                onChange={(p) => setPage(p)}
              />
            ) : null}
          </>
        ) : null}
      </SectionCard>

      {selectedJob ? (
        <JobDetailModal
          job={selectedJob}
          onClose={handleCloseDetail}
          onToggleFavorite={(job) => handleToggleFavorite(job, 'detail')}
        />
      ) : null}
    </AppShell>
  );
}
