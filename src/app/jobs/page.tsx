'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, EmptyState, Input, JobCard, JobDetailModal, SectionCard, Skeleton } from '@/components/ui';
import { Pagination } from '@/components/Pagination';
import { RefreshButton } from '@/components/RefreshButton';
import { HierarchicalFilter } from '@/components/HierarchicalFilter';
import { LoadingSpinner, SkeletonCard, SkeletonMetric } from '@/components/Loading';
import { ErrorMessage, useToast } from '@/components/Toast';
import { API, APIError } from '@/lib/api';
import { DEBOUNCE_MS } from '@/lib/constants';
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

export default function JobsPage() {
  const toast = useToast();
  const [jobs, setJobs] = useState<PagedResponse<JobItem> | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({
    locations: [],
    job_types: [],
    industries: [],
    education: [],
    sources: [],
    provinces: [],
    education_mapping: [],
  });
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [location, setLocation] = useState('');
  const [jobType, setJobType] = useState('');
  const [industry, setIndustry] = useState('');
  const [education, setEducation] = useState('');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobItem | null>(null);
  const [statsExpanded, setStatsExpanded] = useState(false);
  const requestIdRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    sort: 'created_at',
    order: 'desc',
  }), [page, location, jobType, industry, education, source]);

  async function loadJobs(nextLoading = false) {
    const requestId = ++requestIdRef.current;
    nextLoading ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [jobList, filterOptions] = await Promise.all([
        debouncedQuery.trim() ? API.searchJobs(debouncedQuery, filterParams) : API.getJobs(filterParams),
        API.getFilterOptions(),
      ]);
      if (requestId !== requestIdRef.current) return;
      setJobs(jobList);
      setFilters({
        locations: (filterOptions.locations || []) as FilterOption[],
        job_types: (filterOptions.job_types || []) as FilterOption[],
        industries: (filterOptions.industries || []) as FilterOption[],
        education: (filterOptions.education || []) as FilterOption[],
        sources: (filterOptions.sources || []) as FilterOption[],
        provinces: (filterOptions.provinces || []) as ProvinceWithCities[],
        education_mapping: (filterOptions.education_mapping || []) as EducationMapping[],
      });
    } catch (requestError) {
      if (requestId !== requestIdRef.current) return;
      const errorMessage = requestError instanceof Error ? requestError.message : '加载岗位列表失败';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      if (requestId !== requestIdRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadJobs();
  }, [page, debouncedQuery, location, jobType, industry, education, source]);

  const handleToggleFavorite = useCallback(async (job: JobItem) => {
    const newFavoriteState = job.is_favorite ? 0 : 1;

    setJobs((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item) =>
          item.id === job.id ? { ...item, is_favorite: newFavoriteState } : item
        ),
      };
    });
    setSelectedJob((prev) => {
      if (prev && prev.id === job.id) {
        return { ...prev, is_favorite: newFavoriteState };
      }
      return prev;
    });

    try {
      await API.toggleFavorite(job.id);
      toast.success(newFavoriteState ? '已添加到收藏' : '已取消收藏');
    } catch (err) {
      setJobs((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((item) =>
            item.id === job.id ? { ...item, is_favorite: newFavoriteState ? 0 : 1 } : item
          ),
        };
      });
      setSelectedJob((prev) => {
        if (prev && prev.id === job.id) {
          return { ...prev, is_favorite: newFavoriteState ? 0 : 1 };
        }
        return prev;
      });

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
  }, [toast]);

  function handleClearFilters() {
    setQuery('');
    setDebouncedQuery('');
    setLocation('');
    setJobType('');
    setIndustry('');
    setEducation('');
    setSource('');
    setPage(1);
  }

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
        action={<RefreshButton onRefresh={() => void loadJobs(true)} />}
      >
        {loading ? (
          <SkeletonCard count={5} />
        ) : error ? (
          <ErrorMessage title="加载失败" message={error} retry={() => void loadJobs()} />
        ) : items.length === 0 ? (
          <EmptyState title="没有结果" description="当前筛选条件下没有找到岗位。" />
        ) : (
          <div className="grid" style={{ gap: 14 }} role="list" aria-label="岗位列表">
            {items.map((job) => (
              <div key={job.id} role="listitem">
                <JobCard
                  job={job}
                  onClick={(target) => setSelectedJob(target)}
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
          onClose={() => setSelectedJob(null)}
          onToggleFavorite={handleToggleFavorite}
        />
      ) : null}
    </AppShell>
  );
}
