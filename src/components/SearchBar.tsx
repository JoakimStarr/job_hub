'use client';

import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { Input, Button } from './ui';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  debounceMs?: number;
  showFilters?: boolean;
  filterContent?: React.ReactNode;
}

export const SearchBar = memo(function SearchBar({
  onSearch,
  placeholder = '搜索岗位...',
  debounceMs = 300,
  showFilters = false,
  filterContent,
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        onSearch(value);
      }, debounceMs);
    },
    [onSearch, debounceMs]
  );

  const handleClear = useCallback(() => {
    setQuery('');
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    onSearch('');
  }, [onSearch]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      onSearch(query);
    },
    [onSearch, query]
  );

  const toggleFilters = useCallback(() => {
    setFiltersExpanded((prev) => !prev);
  }, []);

  return (
    <div className="search-bar-wrapper" role="search" aria-label="搜索栏">
      <form onSubmit={handleSubmit} className="search-form">
        <div className="search-input-group">
          <Input
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder={placeholder}
            className="search-input"
            aria-label="搜索关键词"
          />
          {query && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleClear}
              className="search-clear-btn"
              aria-label="清空搜索"
            >
              ✕
            </Button>
          )}
          <Button type="submit" variant="primary" className="search-submit-btn">
            搜索
          </Button>
        </div>

        {showFilters && (
          <Button
            type="button"
            variant="secondary"
            onClick={toggleFilters}
            className="search-filter-toggle"
            aria-expanded={filtersExpanded}
            aria-label={filtersExpanded ? '收起筛选器' : '展开筛选器'}
          >
            {filtersExpanded ? '收起筛选' : '展开筛选'}
          </Button>
        )}
      </form>

      {showFilters && filtersExpanded && filterContent && (
        <div className="search-filters-panel" role="region" aria-label="筛选选项">
          {filterContent}
        </div>
      )}
    </div>
  );
});
