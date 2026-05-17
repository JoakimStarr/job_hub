'use client';

import { useState, useCallback, memo } from 'react';
import { Button, Badge } from './ui';

interface PaginationProps {
  current: number;
  total: number;
  onChange: (page: number) => void;
}

export const Pagination = memo(function Pagination({ current, total, onChange }: PaginationProps) {
  const [inputValue, setInputValue] = useState('');
  const [inputVisible, setInputVisible] = useState(false);

  const handleJump = useCallback(() => {
    const page = parseInt(inputValue, 10);
    if (!isNaN(page) && page >= 1 && page <= total) {
      onChange(page);
    }
    setInputValue('');
    setInputVisible(false);
  }, [inputValue, total, onChange]);

  return (
    <div className="pagination-wrapper" role="navigation" aria-label="分页导航">
      <Button
        variant="secondary"
        disabled={current <= 1}
        onClick={() => onChange(current - 1)}
        aria-label="上一页"
      >
        上一页
      </Button>

      {!inputVisible ? (
        <button
          className="pagination-page-display"
          onClick={() => { setInputValue(String(current)); setInputVisible(true); }}
          aria-label="点击输入页码"
        >
          第 <Badge tone="slate">{current}</Badge> / {total} 页
        </button>
      ) : (
        <div className="pagination-input-group">
          <span>跳转到</span>
          <input
            type="number"
            min={1}
            max={total}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleJump(); }}
            className="pagination-page-input"
            aria-label="输入目标页码"
            autoFocus
          />
          <span>/ {total} 页</span>
          <Button variant="primary" size="sm" onClick={handleJump}>跳转</Button>
          <Button variant="ghost" size="sm" onClick={() => { setInputVisible(false); setInputValue(''); }}>取消</Button>
        </div>
      )}

      <Button
        variant="secondary"
        disabled={current >= total}
        onClick={() => onChange(current + 1)}
        aria-label="下一页"
      >
        下一页
      </Button>
    </div>
  );
});