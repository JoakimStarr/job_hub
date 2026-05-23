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

  return (
    <SWRConfig
      value={{
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        shouldRetryOnError: true,
        dedupingInterval: 3000,
        onError: (error) => {
          if (error?.status === 401) return;
          console.error('SWR 请求错误:', error?.message || error);
        },
      }}
    >
      <ToastProvider>{children}</ToastProvider>
    </SWRConfig>
  );
}
