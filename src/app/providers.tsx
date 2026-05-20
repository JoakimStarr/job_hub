'use client';

import { useEffect, useState } from 'react';
import { SWRConfig } from 'swr';
import { ToastProvider } from '@/components/Toast';

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('theme');
    if (stored) {
      document.documentElement.setAttribute('data-theme', stored);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        shouldRetryOnError: false,
        dedupingInterval: 5000,
        onError: (error) => {
          // 401 错误由 API 层统一处理，这里不重复处理
          if (error?.status === 401) return;
          console.error('SWR 请求错误:', error?.message || error);
        },
      }}
    >
      <ToastProvider>{children}</ToastProvider>
    </SWRConfig>
  );
}
