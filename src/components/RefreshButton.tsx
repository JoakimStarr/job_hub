'use client';

import { memo, useState, useCallback } from 'react';

interface RefreshButtonProps {
  onRefresh: () => void;
  size?: number;
}

export const RefreshButton = memo(function RefreshButton({ onRefresh, size = 16 }: RefreshButtonProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleClick = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  }, [onRefresh]);

  return (
    <button
      className={`btn btn-secondary refresh-btn ${refreshing ? 'refreshing' : ''}`}
      onClick={handleClick}
      disabled={refreshing}
      aria-label="刷新数据"
      title="刷新数据"
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={refreshing ? 'spin-icon' : ''}>
        <path d="M23 4v6h-6"></path>
        <path d="M1 20v-6h6"></path>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
      </svg>
    </button>
  );
});
