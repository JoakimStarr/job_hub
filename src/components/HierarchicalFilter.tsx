'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import type { FilterOption, ProvinceWithCities, EducationMapping } from '@/types';
import { Input } from '@/components/ui';
import styles from './hierarchical-filter.module.css';

interface HierarchicalFilterProps {
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  provinces?: ProvinceWithCities[];
  educationMapping?: EducationMapping[];
  mode?: 'flat' | 'hierarchical' | 'education';
}

export function HierarchicalFilter({
  label,
  options,
  value,
  onChange,
  placeholder = '全部',
  provinces = [],
  educationMapping = [],
  mode = 'flat',
}: HierarchicalFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProvinces, setExpandedProvinces] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(
      (opt) =>
        opt.name.toLowerCase().includes(query) ||
        (opt.pinyin && opt.pinyin.includes(query)) ||
        (opt.firstLetter && opt.firstLetter.includes(query))
    );
  }, [options, searchQuery]);

  const filteredProvinces = useMemo(() => {
    if (!searchQuery) return provinces;
    const query = searchQuery.toLowerCase();
    return provinces
      .map((province) => ({
        ...province,
        cities: province.cities.filter(
          (city) =>
            city.name.toLowerCase().includes(query) ||
            (city.pinyin && city.pinyin.includes(query)) ||
            (city.firstLetter && city.firstLetter.includes(query))
        ),
      }))
      .filter((province) => province.cities.length > 0);
  }, [provinces, searchQuery]);

  const educationLevels = useMemo(() => {
    if (!educationMapping.length) return [];
    const grouped: Record<number, FilterOption[]> = {};
    educationMapping.forEach((mapping) => {
      if (!grouped[mapping.level]) {
        grouped[mapping.level] = [];
      }
      const opt = options.find((o) => o.name === mapping.name);
      if (opt) {
        grouped[mapping.level].push(opt);
      }
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([level, opts]) => ({
        level: Number(level),
        name: opts[0]?.name || `Level ${level}`,
        options: opts,
      }));
  }, [educationMapping, options]);

  const toggleProvince = (provinceName: string) => {
    setExpandedProvinces((prev) => {
      const next = new Set(prev);
      if (next.has(provinceName)) {
        next.delete(provinceName);
      } else {
        next.add(provinceName);
      }
      return next;
    });
  };

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue === value ? '' : selectedValue);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
    setSearchQuery('');
  };

  const selectedOption = options.find((opt) => opt.name === value);

  return (
    <div className={styles.hierarchicalFilter} ref={containerRef}>
      <label className={styles.filterLabel}>{label}</label>
      <div className={styles.filterTrigger} onClick={() => setIsOpen(!isOpen)}>
        <span className={value ? styles.filterValue : styles.filterPlaceholder}>
          {selectedOption ? `${selectedOption.name} (${selectedOption.count})` : placeholder}
        </span>
        {value && (
          <button className={styles.filterClear} onClick={handleClear}>
            ×
          </button>
        )}
        <span className={styles.filterArrow}>{isOpen ? '▲' : '▼'}</span>
      </div>

      {isOpen && (
        <div className={styles.filterDropdown}>
          <div style={{ position: 'relative' }}>
            <Input
              type="text"
              className={styles.filterSearch}
              placeholder="搜索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                className={`${styles.searchClearBtn} ${styles.visible}`}
                onClick={() => setSearchQuery('')}
                aria-label="清除搜索"
              >
                ×
              </button>
            )}
          </div>

          <div className={styles.filterOption} onClick={() => handleSelect('')}>
            <span className={styles.filterOptionName}>{placeholder}</span>
          </div>

          {mode === 'hierarchical' && filteredProvinces.length > 0 ? (
            <div className={styles.filterHierarchical}>
              {filteredProvinces.map((province) => (
                <div key={province.province} className={styles.filterGroupHeader} onClick={() => toggleProvince(province.province)}>
                  <span className={styles.filterExpandIcon}>
                    {expandedProvinces.has(province.province) ? '▼' : '▶'}
                  </span>
                  <span className={styles.filterGroupName}>{province.province}</span>
                  <span className={styles.filterGroupCount}>({province.count})</span>
                  {expandedProvinces.has(province.province) && (
                    <div className={styles.filterGroupItems}>
                      {province.cities.map((city) => (
                        <div
                          key={city.name}
                          className={`${styles.filterOption} ${styles.filterOptionChild} ${value === city.name ? styles.filterOptionSelected : ''}`}
                          onClick={() => handleSelect(city.name)}
                        >
                          <span className={styles.filterOptionName}>{city.name}</span>
                          <span className={styles.filterOptionCount}>({city.count})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : mode === 'education' && educationLevels.length > 0 ? (
            <div className={styles.filterHierarchical}>
              {educationLevels.map((level) => (
                <div key={level.level} className={styles.filterOption} onClick={() => handleSelect(level.name)}>
                  <span className={styles.filterOptionName}>{level.name}</span>
                  <span className={styles.filterOptionCount}>
                    ({level.options.reduce((sum, o) => sum + o.count, 0)})
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.filterHierarchical}>
              {filteredOptions.slice(0, 50).map((option) => (
                <div
                  key={option.name}
                  className={`${styles.filterOption} ${value === option.name ? styles.filterOptionSelected : ''}`}
                  onClick={() => handleSelect(option.name)}
                >
                  <span className={styles.filterOptionName}>{option.name}</span>
                  <span className={styles.filterOptionCount}>({option.count})</span>
                </div>
              ))}
              {filteredOptions.length > 50 && (
                <div className={styles.filterMore}>还有 {filteredOptions.length - 50} 个选项，请输入关键词搜索</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
