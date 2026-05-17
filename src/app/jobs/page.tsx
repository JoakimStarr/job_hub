'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, EmptyState, Input, JobCard, JobDetailModal, SectionCard, Skeleton } from '@/components/ui';
import { HierarchicalFilter } from '@/components/HierarchicalFilter';
import { LoadingSpinner, SkeletonCard, SkeletonMetric } from '@/components/Loading';
import { ErrorMessage, useToast } from '@/components/Toast';
import { API } from '@/lib/api';
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

const DEBOUNCE_MS = 300;

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

  const filterParams = {
    page,
    page_size: 12,
    location,
    job_type: jobType,
    industry,
    education,
    source,
  };

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
    } catch {
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
      toast.error('操作失败，请重试');
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
        action={<Button variant="secondary" onClick={() => void loadJobs(true)}>{refreshing ? '刷新中...' : '刷新数据'}</Button>}
      >
        <div className="filter-grid">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索岗位或公司（支持拼音）" />
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
        <div className="grid-4">
          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-card-title">来源分布</div>
              <Badge tone="blue">TOP 5</Badge>
            </div>
            <div className="stat-card-list">
              {(filters.sources || []).slice(0, 5).map((item) => (
                <div key={item.name} className="stat-card-item">
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
                <div key={item.name} className="stat-card-item">
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
                <div key={item.name} className="stat-card-item">
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
                <div key={item.name} className="stat-card-item">
                  <span className="stat-card-item-name">{item.name}</span>
                  <span className="stat-card-item-count">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <SectionCard title="岗位结果" description="点击卡片查看详情，点击星星切换收藏状态">
        {loading ? (
          <SkeletonCard count={5} />
        ) : error ? (
          <ErrorMessage title="加载失败" message={error} retry={() => void loadJobs()} />
        ) : items.length === 0 ? (
          <EmptyState title="没有结果" description="当前筛选条件下没有找到岗位。" />
        ) : (
          <div className="grid" style={{ gap: 14 }}>
            {items.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onClick={(target) => setSelectedJob(target)}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
          </div>
        )}
        {jobs?.pages ? (
          <div className="row-gap" style={{ marginTop: 18, justifyContent: 'space-between' }}>
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</Button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Badge tone="slate">第 {page} / {jobs.pages} 页</Badge>
            </div>
            <Button variant="secondary" disabled={page >= jobs.pages} onClick={() => setPage((value) => value + 1)}>下一页</Button>
          </div>
        ) : null}
      </SectionCard>

      {selectedJob ? (
        <JobDetailModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onToggleFavorite={handleToggleFavorite}
        />
      ) : null}

      <style jsx>{`
        .filter-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }
      `}</style>
    </AppShell>
  );
}
