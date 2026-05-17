'use client';

import { useEffect, useState } from 'react';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  text?: string;
}

export function LoadingSpinner({ size = 'medium', color, text }: LoadingSpinnerProps) {
  const sizeMap = {
    small: 24,
    medium: 40,
    large: 56,
  };

  const actualSize = sizeMap[size];

  return (
    <div className="loading-spinner-wrapper">
      <div
        className="loading-orb"
        style={{
          width: actualSize,
          height: actualSize,
          ...(color ? { borderTopColor: color } : {}),
        }}
      />
      {text && <div className="loading-text">{text}</div>}
      <style jsx>{`
        .loading-spinner-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .loading-text {
          margin-top: 12px;
          color: #666;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}

interface LoadingOverlayProps {
  visible: boolean;
  text?: string;
}

export function LoadingOverlay({ visible, text = '加载中...' }: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <LoadingSpinner size="large" />
        <div className="loading-text">{text}</div>
      </div>
      <style jsx>{`
        .loading-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(255, 255, 255, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }
        .loading-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: white;
          padding: 32px 48px;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        }
        .loading-text {
          margin-top: 16px;
          color: #333;
          font-size: 16px;
        }
      `}</style>
    </div>
  );
}

interface SkeletonCardProps {
  count?: number;
}

export function UnifiedSkeletonCard({ count = 3 }: SkeletonCardProps) {
  return (
    <div className="skeleton-card-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="job-card skeleton">
          <div className="skeleton-text" style={{ width: '60%', height: 20 }} />
          <div className="skeleton-text" style={{ width: '80%', marginTop: 10 }} />
          <div className="skeleton-text" style={{ width: '100%', marginTop: 10 }} />
          <div className="skeleton-text" style={{ width: '40%', marginTop: 10 }} />
        </div>
      ))}
    </div>
  );
}

export const SkeletonCard = UnifiedSkeletonCard;

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="skeleton-table-wrapper">
      <div className="skeleton-table">
        <div className="skeleton-header-row">
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} className="skeleton-cell skeleton-header-cell" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="skeleton-row">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div key={colIndex} className="skeleton-cell" />
            ))}
          </div>
        ))}
      </div>
      <style jsx>{`
        .skeleton-table-wrapper {
          width: 100%;
        }
        .skeleton-table {
          width: 100%;
          border: 1px solid #e8e8e8;
          border-radius: 8px;
          overflow: hidden;
        }
        .skeleton-header-row {
          display: flex;
          background: #fafafa;
          border-bottom: 1px solid #e8e8e8;
        }
        .skeleton-row {
          display: flex;
          border-bottom: 1px solid #e8e8e8;
        }
        .skeleton-row:last-child {
          border-bottom: none;
        }
        .skeleton-cell {
          flex: 1;
          height: 40px;
          margin: 12px 16px;
        }
        .skeleton-header-cell {
          height: 16px;
          margin: 12px 16px;
        }
      `}</style>
    </div>
  );
}

export function UnifiedSkeletonMetric({ count = 4 }: { count?: number }) {
  const tones = ['blue', 'emerald', 'amber', 'violet'] as const;

  return (
    <div className="skeleton-metric-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`metric-card tone-${tones[i % tones.length]} skeleton`}>
          <div className="skeleton-text" style={{ width: '40%' }} />
          <div className="skeleton-text" style={{ width: '60%', height: 32, marginTop: 10 }} />
          <div className="skeleton-text" style={{ width: '30%', marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}

export const SkeletonMetric = UnifiedSkeletonMetric;

interface PageLoadingProps {
  delay?: number;
}

export function PageLoading({ delay = 200 }: PageLoadingProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!show) return null;

  return (
    <div className="page-loading">
      <LoadingSpinner size="large" text="页面加载中..." />
      <style jsx>{`
        .page-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 300px;
        }
      `}</style>
    </div>
  );
}
