'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, EmptyState, Input, JobCard, JobDetailModal, MetricCard, SectionCard, Skeleton, StarButton } from '@/components/ui';
import { Pagination } from '@/components/Pagination';
import { API, APIError } from '@/lib/api';
import type { JobItem, PagedResponse } from '@/lib/types';
import { useToast } from '@/components/Toast';

export default function FavoritesPage() {
  const router = useRouter();
  const toast = useToast();
  const [favorites, setFavorites] = useState<PagedResponse<JobItem> | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedJob, setSelectedJob] = useState<JobItem | null>(null);
  const requestIdRef = useRef(0);

  const loadFavorites = useCallback(async (nextPage: number, nextQuery: string) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    try {
      const result = await API.getFavorites({ page: nextPage, page_size: 10, keyword: nextQuery });
      if (requestId !== requestIdRef.current) return;
      setFavorites(result);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : '加载收藏失败');
    } finally {
      if (requestId !== requestIdRef.current) return;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFavorites(1, '');
  }, [loadFavorites]);

  const handleSearch = useCallback(async () => {
    setPage(1);
    await loadFavorites(1, query);
  }, [query, loadFavorites]);

  const handleClear = useCallback(() => {
    setQuery('');
    setPage(1);
    void loadFavorites(1, '');
  }, [loadFavorites]);

  const handleToggleFavorite = useCallback(async (job: JobItem, source?: 'list' | 'detail') => {
    const newFavoriteState = job.is_favorite ? 0 : 1;

    setFavorites((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.filter((item) => item.id !== job.id),
        total: Math.max(0, prev.total - 1),
      };
    });

    if (source === 'detail') {
      setSelectedJob((prev) =>
        prev && prev.id === job.id ? { ...prev, is_favorite: newFavoriteState } : null
      );
    }

    try {
      await API.toggleFavorite(job.id);
      toast.success(newFavoriteState ? '已添加到收藏' : '已取消收藏');
    } catch (err) {
      void loadFavorites(page, query);
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
  }, [page, query, loadFavorites, toast]);

  const handleJobClick = useCallback((job: JobItem) => {
    setSelectedJob(job);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedJob(null);
  }, []);

  const items = favorites?.items || [];
  const statsLoading = loading && !favorites;

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
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch(); }}
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'end', gap: 10 }}>
            <StarButton active size="md" onClick={() => void handleSearch()} />
            <Button variant="secondary" onClick={handleClear}>清除</Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="收藏列表" description="管理已收藏的岗位">
        {error ? (
          <EmptyState
            title="加载失败"
            description={error}
            action={<Button variant="secondary" onClick={() => void loadFavorites(page, query)}>重试</Button>}
          />
        ) : null}

        {!error && loading && !favorites ? (
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
                onChange={(p) => { setPage(p); void loadFavorites(p, query); }}
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