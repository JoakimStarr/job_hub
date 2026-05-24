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

const STORAGE_KEY = 'job_search_history';
const MAX_HISTORY = 10;
const HOT_SEARCHES = ['Python', '数据分析', '产品经理', '远程工作', 'Java', '前端'];

function getSearchHistory(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveSearchHistory(keyword: string): void {
  if (typeof window === 'undefined' || !keyword.trim()) return;
  const history = getSearchHistory();
  const filtered = history.filter(item => item !== keyword);
  filtered.unshift(keyword.trim());
  const trimmed = filtered.slice(0, MAX_HISTORY);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export const SearchBar = memo(function SearchBar({
  onSearch,
  placeholder = '搜索岗位...',
  debounceMs = 150,
  showFilters = false,
  filterContent,
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHistory(getSearchHistory());
  }, []);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  const handleFocus = useCallback(() => {
    if (!query) {
      setHistory(getSearchHistory());
      setShowSuggestions(true);
    }
  }, [query]);

  const handleSuggestionClick = useCallback((keyword: string) => {
    setQuery(keyword);
    setShowSuggestions(false);
    saveSearchHistory(keyword);
    setHistory(getSearchHistory());
    onSearch(keyword);
  }, [onSearch]);

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
      setShowSuggestions(false);
      if (query.trim()) {
        saveSearchHistory(query);
        setHistory(getSearchHistory());
      }
      onSearch(query);
    },
    [onSearch, query]
  );

  const toggleFilters = useCallback(() => {
    setFiltersExpanded((prev) => !prev);
  }, []);

  return (
    <div className="search-bar-wrapper" ref={wrapperRef} role="search" aria-label="搜索栏">
      <form onSubmit={handleSubmit} className="search-form">
        <div className="search-input-group">
          <Input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={handleFocus}
            placeholder={placeholder}
            className="search-input"
            aria-label="搜索关键词"
            autoComplete="off"
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

        {showSuggestions && (
          <div className="search-suggestions-panel">
            {history.length > 0 && (
              <div className="suggestion-section">
                <div className="suggestion-title">🕐 最近搜索</div>
                <div className="suggestion-list">
                  {history.map((item, index) => (
                    <button
                      key={`${item}-${index}`}
                      type="button"
                      className="suggestion-item"
                      onClick={() => handleSuggestionClick(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="suggestion-section">
              <div className="suggestion-title">🔥 热门搜索</div>
              <div className="suggestion-list suggestion-hot">
                {HOT_SEARCHES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="suggestion-item hot-tag"
                    onClick={() => handleSuggestionClick(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

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
