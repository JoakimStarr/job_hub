'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import type { FilterOption, ProvinceWithCities, EducationMapping } from '@/types';

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
    <div className="hierarchical-filter" ref={containerRef}>
      <label className="filter-label">{label}</label>
      <div className="filter-trigger" onClick={() => setIsOpen(!isOpen)}>
        <span className={value ? 'filter-value' : 'filter-placeholder'}>
          {selectedOption ? `${selectedOption.name} (${selectedOption.count})` : placeholder}
        </span>
        {value && (
          <button className="filter-clear" onClick={handleClear}>
            ×
          </button>
        )}
        <span className="filter-arrow">{isOpen ? '▲' : '▼'}</span>
      </div>

      {isOpen && (
        <div className="filter-dropdown">
          <input
            type="text"
            className="filter-search"
            placeholder="搜索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />

          <div className="filter-option" onClick={() => handleSelect('')}>
            <span className="filter-option-name">{placeholder}</span>
          </div>

          {mode === 'hierarchical' && filteredProvinces.length > 0 ? (
            <div className="filter-hierarchical">
              {filteredProvinces.map((province) => (
                <div key={province.province} className="filter-group">
                  <div
                    className="filter-group-header"
                    onClick={() => toggleProvince(province.province)}
                  >
                    <span className="filter-expand-icon">
                      {expandedProvinces.has(province.province) ? '▼' : '▶'}
                    </span>
                    <span className="filter-group-name">{province.province}</span>
                    <span className="filter-group-count">({province.count})</span>
                  </div>
                  {expandedProvinces.has(province.province) && (
                    <div className="filter-group-items">
                      {province.cities.map((city) => (
                        <div
                          key={city.name}
                          className={`filter-option filter-option-child ${value === city.name ? 'selected' : ''}`}
                          onClick={() => handleSelect(city.name)}
                        >
                          <span className="filter-option-name">{city.name}</span>
                          <span className="filter-option-count">({city.count})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : mode === 'education' && educationLevels.length > 0 ? (
            <div className="filter-education">
              {educationLevels.map((level) => (
                <div key={level.level} className="filter-option" onClick={() => handleSelect(level.name)}>
                  <span className="filter-option-name">{level.name}</span>
                  <span className="filter-option-count">
                    ({level.options.reduce((sum, o) => sum + o.count, 0)})
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="filter-list">
              {filteredOptions.slice(0, 50).map((option) => (
                <div
                  key={option.name}
                  className={`filter-option ${value === option.name ? 'selected' : ''}`}
                  onClick={() => handleSelect(option.name)}
                >
                  <span className="filter-option-name">{option.name}</span>
                  <span className="filter-option-count">({option.count})</span>
                </div>
              ))}
              {filteredOptions.length > 50 && (
                <div className="filter-more">还有 {filteredOptions.length - 50} 个选项，请输入关键词搜索</div>
              )}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .hierarchical-filter {
          position: relative;
          min-width: 180px;
        }
        .filter-label {
          display: block;
          font-size: 12px;
          color: #666;
          margin-bottom: 4px;
        }
        .filter-trigger {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          background: white;
          cursor: pointer;
          min-height: 38px;
        }
        .filter-trigger:hover {
          border-color: #1890ff;
        }
        .filter-value {
          flex: 1;
          color: #333;
        }
        .filter-placeholder {
          flex: 1;
          color: #999;
        }
        .filter-clear {
          background: none;
          border: none;
          color: #999;
          cursor: pointer;
          padding: 0 4px;
          font-size: 16px;
        }
        .filter-clear:hover {
          color: #ff4d4f;
        }
        .filter-arrow {
          color: #999;
          font-size: 10px;
          margin-left: 8px;
        }
        .filter-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          margin-top: 4px;
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          z-index: 1000;
          max-height: 320px;
          overflow-y: auto;
        }
        .filter-search {
          width: 100%;
          padding: 8px 12px;
          border: none;
          border-bottom: 1px solid #e0e0e0;
          outline: none;
          font-size: 14px;
        }
        .filter-option {
          display: flex;
          justify-content: space-between;
          padding: 8px 12px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .filter-option:hover {
          background: #f5f5f5;
        }
        .filter-option.selected {
          background: #e6f7ff;
          color: #1890ff;
        }
        .filter-option-name {
          flex: 1;
        }
        .filter-option-count {
          color: #999;
          font-size: 12px;
        }
        .filter-hierarchical {
          max-height: 280px;
          overflow-y: auto;
        }
        .filter-group-header {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          background: #fafafa;
          cursor: pointer;
          font-weight: 500;
        }
        .filter-group-header:hover {
          background: #f0f0f0;
        }
        .filter-expand-icon {
          width: 16px;
          font-size: 10px;
          color: #999;
        }
        .filter-group-name {
          flex: 1;
        }
        .filter-group-count {
          color: #999;
          font-size: 12px;
        }
        .filter-group-items {
          padding-left: 16px;
        }
        .filter-option-child {
          padding-left: 24px;
        }
        .filter-more {
          padding: 8px 12px;
          color: #999;
          font-size: 12px;
          text-align: center;
          background: #fafafa;
        }
      `}</style>
    </div>
  );
}
