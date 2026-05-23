'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
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

interface FilterState {
  query: string;
  debouncedQuery: string;
  location: string;
  jobType: string;
  industry: string;
  education: string;
  source: string;
  page: number;
  sortField: 'created_at' | 'publish_date' | 'updated_at';
  sortOrder: 'desc' | 'asc';
  selectedJob: JobItem | null;
  statsExpanded: boolean;
  refreshing: boolean;
  viewMode: 'card' | 'list';
  animating: boolean;
}

type FilterAction =
  | { type: 'SET_FIELD'; field: keyof FilterState; value: unknown }
  | { type: 'SET_PAGE'; page: number }
  | { type: 'TOGGLE_SORT_ORDER' }
  | { type: 'TOGGLE_STATS' }
  | { type: 'SET_VIEW_MODE'; mode: 'card' | 'list' }
  | { type: 'SET_SELECTED_JOB'; job: JobItem | null }
  | { type: 'SET_ANIMATING'; animating: boolean }
  | { type: 'CLEAR_FILTERS' };

function createInitialState(): FilterState {
  let savedViewMode: 'card' | 'list' = 'list';
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('job_view_mode');
    if (saved === 'card' || saved === 'list') savedViewMode = saved;
  }
  return {
    query: '',
    debouncedQuery: '',
    location: '',
    jobType: '',
    industry: '',
    education: '',
    source: '',
    page: 1,
    sortField: 'publish_date',
    sortOrder: 'desc',
    selectedJob: null,
    statsExpanded: false,
    refreshing: false,
    viewMode: savedViewMode,
    animating: false,
  };
}

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value as never };
    case 'SET_PAGE':
      return { ...state, page: action.page };
    case 'TOGGLE_SORT_ORDER':
      return { ...state, sortOrder: state.sortOrder === 'desc' ? 'asc' : 'desc' };
    case 'TOGGLE_STATS':
      return { ...state, statsExpanded: !state.statsExpanded };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.mode };
    case 'SET_SELECTED_JOB':
      return { ...state, selectedJob: action.job };
    case 'SET_ANIMATING':
      return { ...state, animating: action.animating };
    case 'CLEAR_FILTERS':
      return {
        ...state,
        query: '',
        debouncedQuery: '',
        location: '',
        jobType: '',
        industry: '',
        education: '',
        source: '',
        sortField: 'publish_date',
        sortOrder: 'desc',
        page: 1,
      };
    default:
      return state;
  }
}

export default function JobsPage() {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const [state, dispatch] = useReducer(filterReducer, null, createInitialState);
  const [isMobile, setIsMobile] = useState(false);
  const [processingFavoriteId, setProcessingFavoriteId] = useState<number | null>(null);

  useEffect(() => {
    localStorage.setItem('job_view_mode', state.viewMode);
  }, [state.viewMode]);

  useEffect(() => {
    dispatch({ type: 'SET_ANIMATING', animating: true });
    const timer = setTimeout(() => dispatch({ type: 'SET_ANIMATING', animating: false }), 300);
    return () => clearTimeout(timer);
  }, [state.viewMode]);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)');
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
      if (e.matches) dispatch({ type: 'SET_VIEW_MODE', mode: 'list' });
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
      dispatch({ type: 'SET_FIELD', field: 'debouncedQuery', value: state.query });
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [state.query]);

  const filterParams = useMemo(() => ({
    page: state.page,
    page_size: 12,
    location: state.location,
    job_type: state.jobType,
    industry: state.industry,
    education: state.education,
    source: state.source,
    sort: state.sortField,
    order: state.sortOrder,
  }), [state.page, state.location, state.jobType, state.industry, state.education, state.source, state.sortField, state.sortOrder]);

  // 筛选选项独立缓存，60秒内不重复请求
  const { data: filterOptions, mutate: mutateFilters } = useFetch<FilterOptions>(
    '/api/jobs/filters',
    () => API.getFilterOptions(),
    { dedupingInterval: 60000 },
  );

  const filters = filterOptions ?? EMPTY_FILTERS;

  // 岗位列表根据筛选条件动态请求
  const jobsKey = state.debouncedQuery.trim()
    ? `/api/jobs/search?q=${state.debouncedQuery}&${API.buildQuery(filterParams)}`
    : `/api/jobs?${API.buildQuery(filterParams)}`;

  const { data: jobs, error: jobsError, loading: jobsLoading, mutate: mutateJobs } = useFetch<PagedResponse<JobItem>>(
    jobsKey,
    () => state.debouncedQuery.trim()
      ? API.searchJobs(state.debouncedQuery, filterParams)
      : API.getJobs(filterParams),
  );

  const loading = jobsLoading && !jobs;
  const error = jobsError?.message || null;

  const handleRefresh = useCallback(async () => {
    dispatch({ type: 'SET_FIELD', field: 'refreshing', value: true });
    await Promise.all([mutateJobs(), mutateFilters()]);
    dispatch({ type: 'SET_FIELD', field: 'refreshing', value: false });
  }, [mutateJobs, mutateFilters]);

  const handleToggleFavorite = useCallback(async (job: JobItem) => {
    const now = Date.now();
    if (now - lastToggleRef.current < 500) return;
    lastToggleRef.current = now;

    if (useAppStore.getState().isGuest) {
      alert('请登录后收藏岗位');
      return;
    }
    const newFavoriteState = job.is_favorite ? 0 : 1;

    setProcessingFavoriteId(job.id);

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

    if (state.selectedJob?.id === job.id) {
      dispatch({
        type: 'SET_SELECTED_JOB',
        job: { ...state.selectedJob, is_favorite: newFavoriteState },
      });
    }

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
      if (state.selectedJob?.id === job.id) {
        dispatch({
          type: 'SET_SELECTED_JOB',
          job: { ...state.selectedJob, is_favorite: newFavoriteState ? 0 : 1 },
        });
      }

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
    } finally {
      setProcessingFavoriteId(null);
    }
  }, [mutateJobs, state.selectedJob]);

  const handleCloseDetail = useCallback(() => dispatch({ type: 'SET_SELECTED_JOB', job: null }), []);

  const handleJobClick = useCallback((job: JobItem) => dispatch({ type: 'SET_SELECTED_JOB', job }), []);

  function handleClearFilters() {
    dispatch({ type: 'CLEAR_FILTERS' });
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
          <Input value={state.query} onChange={(event) => dispatch({ type: 'SET_FIELD', field: 'query', value: event.target.value })} placeholder="搜索岗位或公司" />
          <HierarchicalFilter
            label="地点"
            options={filters.locations}
            value={state.location}
            onChange={(v) => dispatch({ type: 'SET_FIELD', field: 'location', value: v })}
            placeholder="全部地点"
            provinces={filters.provinces}
            mode="hierarchical"
          />
          <HierarchicalFilter
            label="岗位类型"
            options={filters.job_types}
            value={state.jobType}
            onChange={(v) => dispatch({ type: 'SET_FIELD', field: 'jobType', value: v })}
            placeholder="全部类型"
          />
          <HierarchicalFilter
            label="行业"
            options={filters.industries}
            value={state.industry}
            onChange={(v) => dispatch({ type: 'SET_FIELD', field: 'industry', value: v })}
            placeholder="全部行业"
          />
          <HierarchicalFilter
            label="学历"
            options={filters.education}
            value={state.education}
            onChange={(v) => dispatch({ type: 'SET_FIELD', field: 'education', value: v })}
            placeholder="全部学历"
            educationMapping={filters.education_mapping}
            mode="education"
          />
          <HierarchicalFilter
            label="来源"
            options={filters.sources}
            value={state.source}
            onChange={(v) => dispatch({ type: 'SET_FIELD', field: 'source', value: v })}
            placeholder="全部来源"
          />
        </div>
        <div className="row-gap" style={{ marginTop: 16 }}>
          {state.query || state.location || state.jobType || state.industry || state.education || state.source ? (
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
                type="button"
                onClick={() => dispatch({ type: 'TOGGLE_STATS' })}
                className="stats-toggle-btn"
                aria-label={state.statsExpanded ? '收起统计面板' : '展开统计面板'}
              >
                <span className="stats-toggle-icon">{state.statsExpanded ? '▲' : '▼'}</span>
                <span>{state.statsExpanded ? '收起' : '展开'}</span>
              </button>
            </div>
          }
        >
          {state.statsExpanded ? (
            <div className="grid-4" style={{ transition: 'all var(--duration-normal) var(--ease-out)' }}>
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
                      onClick={() => { dispatch({ type: 'SET_FIELD', field: 'source', value: item.name }); dispatch({ type: 'SET_PAGE', page: 1 }); }}
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
                      onClick={() => { dispatch({ type: 'SET_FIELD', field: 'jobType', value: item.name }); dispatch({ type: 'SET_PAGE', page: 1 }); }}
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
                      onClick={() => { dispatch({ type: 'SET_FIELD', field: 'location', value: item.name }); dispatch({ type: 'SET_PAGE', page: 1 }); }}
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
                      onClick={() => { dispatch({ type: 'SET_FIELD', field: 'industry', value: item.name }); dispatch({ type: 'SET_PAGE', page: 1 }); }}
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
            <ViewToggle
              mode={state.viewMode}
              onToggle={() => {
                const next = state.viewMode === 'card' ? 'list' : 'card';
                dispatch({ type: 'SET_VIEW_MODE', mode: next });
              }}
            />
            <div className="sort-controls">
              <select
                className="sort-field-select"
                value={state.sortField}
                onChange={(e) => { dispatch({ type: 'SET_FIELD', field: 'sortField', value: e.target.value as 'created_at' | 'publish_date' | 'updated_at' }); dispatch({ type: 'SET_PAGE', page: 1 }); }}
                aria-label="排序字段"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button
                className="sort-dir-btn"
                onClick={() => { dispatch({ type: 'TOGGLE_SORT_ORDER' }); dispatch({ type: 'SET_PAGE', page: 1 }); }}
                title={state.sortOrder === 'desc' ? '切换为升序（旧到新）' : '切换为降序（新到旧）'}
                aria-label={state.sortOrder === 'desc' ? '切换为升序' : '切换为降序'}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  {state.sortOrder === 'desc' ? (
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
          <div className={`job-view-container ${state.viewMode === 'list' ? 'job-list' : 'grid'} ${state.animating ? 'view-animating' : ''}`} style={{ gap: state.viewMode === 'list' ? 0 : 14 }} role="list" aria-label="岗位列表">
            {items.map((job) => (
              <div
                key={job.id}
                role="listitem"
                className={processingFavoriteId === job.id ? 'processing-favorite' : ''}
                style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                onClick={() => handleJobClick(job)}
              >
                <JobCard
                  job={job}
                  viewMode={state.viewMode}
                  onClick={handleJobClick}
                  onToggleFavorite={handleToggleFavorite}
                />
              </div>
            ))}
          </div>
        )}
        {jobs?.pages ? (
          <Pagination current={state.page} total={jobs.pages} onChange={(p) => dispatch({ type: 'SET_PAGE', page: p })} />
        ) : null}
      </SectionCard>

      {state.selectedJob ? (
        <JobDetailModal
          job={state.selectedJob}
          onClose={handleCloseDetail}
          onToggleFavorite={handleToggleFavorite}
        />
      ) : null}
    </AppShell>
  );
}
