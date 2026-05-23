'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, EmptyState, Input, JobCard, JobDetailModal, SectionCard, ViewToggle } from '@/components/ui';
import { Pagination } from '@/components/Pagination';
import { RefreshButton } from '@/components/RefreshButton';
import { HierarchicalFilter } from '@/components/HierarchicalFilter';
import { SkeletonCard, SkeletonMetric } from '@/components/Loading';
import { ErrorMessage, useToast } from '@/components/Toast';
import { API, APIError } from '@/lib/api';
import { useAppStore } from '@/store';
import { DEBOUNCE_MS } from '@/lib/constants';
import { useFetch } from '@/hooks/useFetch';
import type { JobItem, PagedResponse, FilterOption, ProvinceWithCities, EducationMapping } from '@/types';

interface FilterOptions {
  locations: FilterOption[];
  job_types: FilterOption[];
  industries: FilterOption[];
  education: FilterOption[];
  sources: FilterOption[];
  provinces: ProvinceWithCities[];
  education_mapping: EducationMapping[];
}

const EMPTY_FILTERS: FilterOptions = {
  locations: [],
  job_types: [],
  industries: [],
  education: [],
  sources: [],
  provinces: [],
  education_mapping: [],
};

export default function JobsPage() {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [location, setLocation] = useState('');
  const [jobType, setJobType] = useState('');
  const [industry, setIndustry] = useState('');
  const [education, setEducation] = useState('');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<'created_at' | 'publish_date' | 'updated_at'>('publish_date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedJob, setSelectedJob] = useState<JobItem | null>(null);
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)');
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
      if (e.matches) setViewMode('list');
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastToggleRef = useRef(0);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query]);

  const filterParams = useMemo(() => ({
    page,
    page_size: 12,
    location,
    job_type: jobType,
    industry,
    education,
    source,
    sort: sortField,
    order: sortOrder,
  }), [page, location, jobType, industry, education, source, sortField, sortOrder]);

  // 筛选选项独立缓存，60秒内不重复请求
  const { data: filterOptions, mutate: mutateFilters } = useFetch<FilterOptions>(
    '/api/jobs/filters',
    () => API.getFilterOptions(),
    { dedupingInterval: 60000 },
  );

  const filters = filterOptions ?? EMPTY_FILTERS;

  // 岗位列表根据筛选条件动态请求
  const jobsKey = debouncedQuery.trim()
    ? `/api/jobs/search?q=${debouncedQuery}&${API.buildQuery(filterParams)}`
    : `/api/jobs?${API.buildQuery(filterParams)}`;

  const { data: jobs, error: jobsError, loading: jobsLoading, mutate: mutateJobs } = useFetch<PagedResponse<JobItem>>(
    jobsKey,
    () => debouncedQuery.trim()
      ? API.searchJobs(debouncedQuery, filterParams)
      : API.getJobs(filterParams),
  );

  const loading = jobsLoading && !jobs;
  const error = jobsError?.message || null;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([mutateJobs(), mutateFilters()]);
    setRefreshing(false);
  }, [mutateJobs, mutateFilters]);

  const handleToggleFavorite = useCallback(async (job: JobItem) => {
    const now = Date.now();
    if (now - lastToggleRef.current < 500) return; // 防抖 500ms
    lastToggleRef.current = now;

    if (useAppStore.getState().isGuest) {
      alert('请登录后收藏岗位');
      return;
    }
    const newFavoriteState = job.is_favorite ? 0 : 1;

    // 乐观更新：先更新 UI
    mutateJobs(
      (current) => {
        if (!current) return current;
        return {
          ...current,
          items: current.items.map((item) =>
            item.id === job.id ? { ...item, is_favorite: newFavoriteState } : item
          ),
        };
      },
      { revalidate: false },
    );

    setSelectedJob((prev) => {
      if (prev && prev.id === job.id) {
        return { ...prev, is_favorite: newFavoriteState };
      }
      return prev;
    });

    try {
      await API.toggleFavorite(job.id);
      toastRef.current.success(newFavoriteState ? '已添加到收藏' : '已取消收藏');
    } catch (err) {
      // 回滚
      mutateJobs(
        (current) => {
          if (!current) return current;
          return {
            ...current,
            items: current.items.map((item) =>
              item.id === job.id ? { ...item, is_favorite: newFavoriteState ? 0 : 1 } : item
            ),
          };
        },
        { revalidate: false },
      );
      setSelectedJob((prev) => {
        if (prev && prev.id === job.id) {
          return { ...prev, is_favorite: newFavoriteState ? 0 : 1 };
        }
        return prev;
      });

      const errorMsg = err instanceof Error ? err.message : '操作失败';
      if (err instanceof APIError && err.status === 404) {
        toastRef.current.error('收藏接口不存在，请检查后端服务');
      } else if (err instanceof APIError && err.status === 500) {
        toastRef.current.error('服务器内部错误，收藏操作失败');
      } else if (err instanceof APIError && err.status === 401) {
        toastRef.current.error('登录已过期，请重新登录');
      } else {
        toastRef.current.error(errorMsg);
      }
    }
  }, [mutateJobs]);

  const handleCloseDetail = useCallback(() => setSelectedJob(null), []);

  const handleJobClick = useCallback((job: JobItem) => setSelectedJob(job), []);

  function handleClearFilters() {
    setQuery('');
    setDebouncedQuery('');
    setLocation('');
    setJobType('');
    setIndustry('');
    setEducation('');
    setSource('');
    setSortField('publish_date');
    setSortOrder('desc');
    setPage(1);
  }

  const SORT_OPTIONS = [
    { value: 'created_at', label: '采集时间' },
    { value: 'publish_date', label: '发布时间' },
    { value: 'updated_at', label: '更新时间' },
  ] as const;

  const items = jobs?.items || [];

  return (
    <AppShell title="岗位列表" description="搜索、筛选和收藏金融实习岗位" requiredPermission="view_jobs">
      <SectionCard
        title="筛选条件"
        description="按关键词、地点、类型、行业、学历和来源筛选岗位"
      >
        <div className="filter-grid" role="search" aria-label="岗位筛选">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索岗位或公司" />
          <HierarchicalFilter
            label="地点"
            options={filters.locations}
            value={location}
            onChange={setLocation}
            placeholder="全部地点"
            provinces={filters.provinces}
            mode="hierarchical"
          />
          <HierarchicalFilter
            label="岗位类型"
            options={filters.job_types}
            value={jobType}
            onChange={setJobType}
            placeholder="全部类型"
          />
          <HierarchicalFilter
            label="行业"
            options={filters.industries}
            value={industry}
            onChange={setIndustry}
            placeholder="全部行业"
          />
          <HierarchicalFilter
            label="学历"
            options={filters.education}
            value={education}
            onChange={setEducation}
            placeholder="全部学历"
            educationMapping={filters.education_mapping}
            mode="education"
          />
          <HierarchicalFilter
            label="来源"
            options={filters.sources}
            value={source}
            onChange={setSource}
            placeholder="全部来源"
          />
        </div>
        <div className="row-gap" style={{ marginTop: 16 }}>
          {query || location || jobType || industry || education || source ? (
            <Button variant="secondary" onClick={handleClearFilters}>清除筛选</Button>
          ) : null}
          <Badge tone="slate">共 {jobs?.total ?? 0} 条</Badge>
        </div>
      </SectionCard>

      {loading ? (
        <SkeletonMetric count={4} />
      ) : (
        <SectionCard
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>数据概览</span>
              <button
                onClick={() => setStatsExpanded((v) => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 12 }}
                aria-label={statsExpanded ? '收起统计面板' : '展开统计面板'}
              >
                {statsExpanded ? '▲ 收起' : '▼ 展开'}
              </button>
            </div>
          }
        >
          {statsExpanded ? (
            <div className="grid-4">
              <div className="stat-card">
                <div className="stat-card-header">
                  <div className="stat-card-title">来源分布</div>
                  <Badge tone="blue">TOP 5</Badge>
                </div>
                <div className="stat-card-list">
                  {(filters.sources || []).slice(0, 5).map((item) => (
                    <div
                      key={item.name}
                      className="stat-card-item"
                      style={{ cursor: 'pointer' }}
                      onClick={() => { setSource(item.name); setPage(1); }}
                    >
                      <span className="stat-card-item-name">{item.name}</span>
                      <span className="stat-card-item-count">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card-header">
                  <div className="stat-card-title">岗位类型</div>
                  <Badge tone="emerald">TOP 5</Badge>
                </div>
                <div className="stat-card-list">
                  {(filters.job_types || []).slice(0, 5).map((item) => (
                    <div
                      key={item.name}
                      className="stat-card-item"
                      style={{ cursor: 'pointer' }}
                      onClick={() => { setJobType(item.name); setPage(1); }}
                    >
                      <span className="stat-card-item-name">{item.name}</span>
                      <span className="stat-card-item-count">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card-header">
                  <div className="stat-card-title">地点热度</div>
                  <Badge tone="amber">TOP 5</Badge>
                </div>
                <div className="stat-card-list">
                  {(filters.locations || []).slice(0, 5).map((item) => (
                    <div
                      key={item.name}
                      className="stat-card-item"
                      style={{ cursor: 'pointer' }}
                      onClick={() => { setLocation(item.name); setPage(1); }}
                    >
                      <span className="stat-card-item-name">{item.name}</span>
                      <span className="stat-card-item-count">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card-header">
                  <div className="stat-card-title">行业分布</div>
                  <Badge tone="violet">TOP 5</Badge>
                </div>
                <div className="stat-card-list">
                  {(filters.industries || []).slice(0, 5).map((item) => (
                    <div
                      key={item.name}
                      className="stat-card-item"
                      style={{ cursor: 'pointer' }}
                      onClick={() => { setIndustry(item.name); setPage(1); }}
                    >
                      <span className="stat-card-item-name">{item.name}</span>
                      <span className="stat-card-item-count">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              数据概览面板已折叠 · 共 {(filters.sources || []).length} 个来源 · {(filters.job_types || []).length} 个类型 · {(filters.locations || []).length} 个地点 · {(filters.industries || []).length} 个行业
            </div>
          )}
        </SectionCard>
      )}

      <SectionCard
        title="岗位结果"
        description="点击卡片查看详情，点击星星切换收藏状态"
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ViewToggle mode={viewMode} onToggle={() => setViewMode((m) => m === 'card' ? 'list' : 'card')} />
            <div className="sort-controls">
              <select
                className="sort-field-select"
                value={sortField}
                onChange={(e) => { setSortField(e.target.value as typeof sortField); setPage(1); }}
                aria-label="排序字段"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button
                className="sort-dir-btn"
                onClick={() => { setSortOrder((o) => o === 'desc' ? 'asc' : 'desc'); setPage(1); }}
                title={sortOrder === 'desc' ? '切换为升序（旧到新）' : '切换为降序（新到旧）'}
                aria-label={sortOrder === 'desc' ? '切换为升序' : '切换为降序'}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  {sortOrder === 'desc' ? (
                    <>
                      <path d="M8 3L13 8H3L8 3Z" fill="currentColor" opacity="0.35"/>
                      <path d="M8 13L3 8H13L8 13Z" fill="currentColor"/>
                    </>
                  ) : (
                    <>
                      <path d="M8 3L13 8H3L8 3Z" fill="currentColor"/>
                      <path d="M8 13L3 8H13L8 13Z" fill="currentColor" opacity="0.35"/>
                    </>
                  )}
                </svg>
              </button>
            </div>
            <RefreshButton onRefresh={handleRefresh} />
          </div>
        }
      >
        {loading ? (
          <SkeletonCard count={5} />
        ) : error ? (
          <ErrorMessage title="加载失败" message={error} retry={handleRefresh} />
        ) : items.length === 0 ? (
          <EmptyState title="没有结果" description="当前筛选条件下没有找到岗位。" />
        ) : (
          <div className={`job-view-container ${viewMode === 'list' ? 'job-list' : 'grid'} ${animating ? 'view-animating' : ''}`} style={{ gap: viewMode === 'list' ? 0 : 14 }} role="list" aria-label="岗位列表">
            {items.map((job) => (
              <div key={job.id} role="listitem" style={viewMode === 'list' ? undefined : undefined}>
                <JobCard
                  job={job}
                  viewMode={viewMode}
                  onClick={handleJobClick}
                  onToggleFavorite={handleToggleFavorite}
                />
              </div>
            ))}
          </div>
        )}
        {jobs?.pages ? (
          <Pagination current={page} total={jobs.pages} onChange={(p) => setPage(p)} />
        ) : null}
      </SectionCard>

      {selectedJob ? (
        <JobDetailModal
          job={selectedJob}
          onClose={handleCloseDetail}
          onToggleFavorite={handleToggleFavorite}
        />
      ) : null}
    </AppShell>
  );
}
