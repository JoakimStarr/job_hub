'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: React.ReactNode;
  maxToasts?: number;
}

export function ToastProvider({ children, maxToasts = 5 }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, duration = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      const newToast: Toast = { id, type, message, duration };

      setToasts((prev) => {
        const updated = [...prev, newToast];
        return updated.slice(-maxToasts);
      });
    },
    [maxToasts, removeToast]
  );

  const success = useCallback((message: string, duration?: number) => addToast('success', message, duration), [addToast]);
  const error = useCallback((message: string, duration?: number) => addToast('error', message, duration), [addToast]);
  const warning = useCallback((message: string, duration?: number) => addToast('warning', message, duration), [addToast]);
  const info = useCallback((message: string, duration?: number) => addToast('info', message, duration), [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
      <style jsx>{`
        .toast-container {
          position: fixed;
          top: 16px;
          right: 16px;
          z-index: 10000;
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-width: 400px;
        }
      `}</style>
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onClose: () => void;
}

function ToastItem({ toast, onClose }: ToastItemProps) {
  const typeConfig = {
    success: { icon: '✓', bgColor: '#f6ffed', borderColor: '#b7eb8f', color: '#52c41a' },
    error: { icon: '✕', bgColor: '#fff2f0', borderColor: '#ffccc7', color: '#ff4d4f' },
    warning: { icon: '!', bgColor: '#fffbe6', borderColor: '#ffe58f', color: '#faad14' },
    info: { icon: 'i', bgColor: '#e6f7ff', borderColor: '#91d5ff', color: '#1890ff' },
  };

  const config = typeConfig[toast.type];

  useEffect(() => {
    const timer = setTimeout(onClose, toast.duration || 4000);
    return () => clearTimeout(timer);
  }, [onClose, toast.duration]);

  return (
    <div className="toast-item" style={{ background: config.bgColor, borderColor: config.borderColor }}>
      <div className="toast-icon" style={{ color: config.color }}>
        {config.icon}
      </div>
      <div className="toast-message">{toast.message}</div>
      <button className="toast-close" onClick={onClose}>
        ×
      </button>
      <style jsx>{`
        .toast-item {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          border-radius: 8px;
          border: 1px solid;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          animation: slideIn 0.3s ease;
        }
        .toast-icon {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 12px;
          margin-right: 12px;
          flex-shrink: 0;
        }
        .toast-message {
          flex: 1;
          font-size: 14px;
          color: #333;
          line-height: 1.5;
        }
        .toast-close {
          background: none;
          border: none;
          font-size: 18px;
          color: #999;
          cursor: pointer;
          padding: 0 0 0 12px;
          line-height: 1;
        }
        .toast-close:hover {
          color: #333;
        }
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary">
          <div className="error-icon">⚠️</div>
          <h3>出错了</h3>
          <p>页面遇到了一些问题，请刷新页面重试</p>
          <button onClick={() => window.location.reload()}>刷新页面</button>
          <style jsx>{`
            .error-boundary {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 300px;
              padding: 40px;
              text-align: center;
            }
            .error-icon {
              font-size: 48px;
              margin-bottom: 16px;
            }
            h3 {
              margin: 0 0 8px;
              color: #333;
            }
            p {
              color: #666;
              margin: 0 0 24px;
            }
            button {
              padding: 8px 24px;
              background: #1890ff;
              color: white;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-size: 14px;
            }
            button:hover {
              background: #40a9ff;
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

import React from 'react';

interface ErrorMessageProps {
  title?: string;
  message: string;
  retry?: () => void;
  retryText?: string;
  type?: 'error' | 'warning' | 'info';
}

export function ErrorMessage({
  title = '出错了',
  message,
  retry,
  retryText = '重试',
  type = 'error',
}: ErrorMessageProps) {
  const typeConfig = {
    error: { icon: '❌', bgColor: '#fff2f0', borderColor: '#ffccc7' },
    warning: { icon: '⚠️', bgColor: '#fffbe6', borderColor: '#ffe58f' },
    info: { icon: 'ℹ️', bgColor: '#e6f7ff', borderColor: '#91d5ff' },
  };

  const config = typeConfig[type];

  return (
    <div className="error-message" style={{ background: config.bgColor, borderColor: config.borderColor }}>
      <div className="error-icon">{config.icon}</div>
      <div className="error-content">
        <div className="error-title">{title}</div>
        <div className="error-text">{message}</div>
        {retry && (
          <button className="error-retry" onClick={retry}>
            {retryText}
          </button>
        )}
      </div>
      <style jsx>{`
        .error-message {
          display: flex;
          align-items: flex-start;
          padding: 16px;
          border-radius: 8px;
          border: 1px solid;
        }
        .error-icon {
          font-size: 24px;
          margin-right: 12px;
          flex-shrink: 0;
        }
        .error-content {
          flex: 1;
        }
        .error-title {
          font-weight: 600;
          color: #333;
          margin-bottom: 4px;
        }
        .error-text {
          color: #666;
          font-size: 14px;
          line-height: 1.5;
        }
        .error-retry {
          margin-top: 12px;
          padding: 6px 16px;
          background: #1890ff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
        }
        .error-retry:hover {
          background: #40a9ff;
        }
      `}</style>
    </div>
  );
}

interface ApiErrorProps {
  error: unknown;
  retry?: () => void;
}

export function ApiError({ error, retry }: ApiErrorProps) {
  let message = '请求失败，请稍后重试';

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'object' && error !== null && 'error' in error) {
    message = String((error as { error: string }).error);
  }

  return <ErrorMessage title="请求失败" message={message} retry={retry} />;
}
