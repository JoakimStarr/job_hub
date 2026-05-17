'use client';

import { useEffect, useState } from 'react';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  text?: string;
}

export function LoadingSpinner({ size = 'medium', color = '#1890ff', text }: LoadingSpinnerProps) {
  const sizeMap = {
    small: 16,
    medium: 32,
    large: 48,
  };

  const actualSize = sizeMap[size];

  return (
    <div className="loading-spinner-wrapper">
      <div
        className="loading-spinner"
        style={{
          width: actualSize,
          height: actualSize,
          borderColor: `${color} transparent transparent transparent`,
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
        .loading-spinner {
          border: 3px solid transparent;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        .loading-text {
          margin-top: 12px;
          color: #666;
          font-size: 14px;
        }
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
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

export function SkeletonCard({ count = 1 }: SkeletonCardProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton-header">
            <div className="skeleton-title" />
            <div className="skeleton-badge" />
          </div>
          <div className="skeleton-body">
            <div className="skeleton-line skeleton-line-short" />
            <div className="skeleton-line" />
            <div className="skeleton-line skeleton-line-medium" />
          </div>
          <div className="skeleton-footer">
            <div className="skeleton-tag" />
            <div className="skeleton-tag" />
            <div className="skeleton-tag" />
          </div>
          <style jsx>{`
            .skeleton-card {
              background: white;
              border-radius: 8px;
              padding: 16px;
              border: 1px solid #e8e8e8;
              margin-bottom: 12px;
            }
            .skeleton-header {
              display: flex;
              justify-content: space-between;
              margin-bottom: 12px;
            }
            .skeleton-title {
              width: 60%;
              height: 20px;
              background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
              background-size: 200% 100%;
              animation: shimmer 1.5s infinite;
              border-radius: 4px;
            }
            .skeleton-badge {
              width: 60px;
              height: 20px;
              background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
              background-size: 200% 100%;
              animation: shimmer 1.5s infinite;
              border-radius: 4px;
            }
            .skeleton-body {
              margin-bottom: 12px;
            }
            .skeleton-line {
              height: 14px;
              background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
              background-size: 200% 100%;
              animation: shimmer 1.5s infinite;
              border-radius: 4px;
              margin-bottom: 8px;
            }
            .skeleton-line-short {
              width: 40%;
            }
            .skeleton-line-medium {
              width: 70%;
            }
            .skeleton-footer {
              display: flex;
              gap: 8px;
            }
            .skeleton-tag {
              width: 60px;
              height: 24px;
              background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
              background-size: 200% 100%;
              animation: shimmer 1.5s infinite;
              border-radius: 12px;
            }
            @keyframes shimmer {
              0% {
                background-position: 200% 0;
              }
              100% {
                background-position: -200% 0;
              }
            }
          `}</style>
        </div>
      ))}
    </>
  );
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
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
      <style jsx>{`
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
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 4px;
        }
        .skeleton-header-cell {
          height: 16px;
          margin: 12px 16px;
        }
        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </div>
  );
}

export function SkeletonMetric({ count = 4 }: { count?: number }) {
  return (
    <div className="skeleton-metric-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-metric-card">
          <div className="skeleton-metric-value" />
          <div className="skeleton-metric-label" />
          <style jsx>{`
            .skeleton-metric-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 16px;
            }
            .skeleton-metric-card {
              background: white;
              border-radius: 8px;
              padding: 20px;
              border: 1px solid #e8e8e8;
            }
            .skeleton-metric-value {
              width: 60%;
              height: 32px;
              background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
              background-size: 200% 100%;
              animation: shimmer 1.5s infinite;
              border-radius: 4px;
              margin-bottom: 12px;
            }
            .skeleton-metric-label {
              width: 40%;
              height: 14px;
              background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
              background-size: 200% 100%;
              animation: shimmer 1.5s infinite;
              border-radius: 4px;
            }
            @keyframes shimmer {
              0% {
                background-position: 200% 0;
              }
              100% {
                background-position: -200% 0;
              }
            }
          `}</style>
        </div>
      ))}
    </div>
  );
}

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
