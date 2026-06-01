'use client';

import { useState, useCallback, memo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Badge } from './ui';

interface PaginationProps {
  current: number;
  total: number;
  onChange: (page: number) => void;
}

export const Pagination = memo(function Pagination({ current, total, onChange }: PaginationProps) {
  const [inputVisible, setInputVisible] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowLeft' && current > 1) {
        e.preventDefault();
        handleChange(current - 1);
      }
      if (e.key === 'ArrowRight' && current < total) {
        e.preventDefault();
        handleChange(current + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [current, total]);

  const handleChange = useCallback((page: number) => {
    onChange(page);

    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    router.push(`?${params.toString()}`, { scroll: false });
  }, [onChange, router, searchParams]);

  return (
    <nav className="pagination-wrapper" aria-label="分页导航">
      <Button
        variant="secondary"
        disabled={current <= 1}
        onClick={() => handleChange(current - 1)}
        aria-label="上一页"
      >
        上一页
      </Button>

      {!inputVisible ? (
        <button
          className="pagination-page-display"
          onClick={() => setInputVisible(true)}
          aria-label={`当前第 ${current} 页，共 ${total} 页`}
          aria-current="page"
        >
          第 <Badge tone="slate">{current}</Badge> / {total} 页
        </button>
      ) : (
        <div className="pagination-input-group">
          <span>跳转到</span>
          <form style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }} onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const page = parseInt((fd.get('page') as string) || '', 10);
            if (!isNaN(page) && page >= 1 && page <= total) {
              handleChange(page);
            }
            setInputVisible(false);
          }}>
            <input
              type="number"
              name="page"
              min={1}
              max={total}
              defaultValue={current}
              className="pagination-page-input"
              aria-label={`输入目标页码，范围 1 到 ${total}`}
              autoFocus
            />
            <span>/ {total} 页</span>
            <Button
              type="submit"
              variant="primary"
              aria-label={`跳转到指定页`}
            >
              跳转
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setInputVisible(false)}
              aria-label="取消跳转"
            >
              取消
            </Button>
          </form>
        </div>
      )}

      <Button
        variant="secondary"
        disabled={current >= total}
        onClick={() => handleChange(current + 1)}
        aria-label="下一页"
      >
        下一页
      </Button>

      <div style={{
        marginLeft: 'auto',
        fontSize: 12,
        color: '#6b7280',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span>⌨️ 键盘快捷键:</span>
        <kbd style={{
          padding: '2px 6px',
          background: '#f3f4f6',
          border: '1px solid #d1d5db',
          borderRadius: 4,
          fontSize: 11,
          fontFamily: 'monospace',
        }}>←</kbd>
        <span>上一页</span>
        <kbd style={{
          padding: '2px 6px',
          background: '#f3f4f6',
          border: '1px solid #d1d5db',
          borderRadius: 4,
          fontSize: 11,
          fontFamily: 'monospace',
        }}>→</kbd>
        <span>下一页</span>
      </div>
    </nav>
  );
});
