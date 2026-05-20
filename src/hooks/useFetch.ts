'use client';

import useSWR, { mutate } from 'swr';
import { APIError } from '@/lib/api';

export interface FetchResult<T> {
  data: T | null;
  error: APIError | null;
  loading: boolean;
  mutate: () => void;
}

/**
 * 通用数据获取 Hook，基于 SWR 封装
 *
 * 特性：
 * - 自动缓存和请求去重
 * - 可配置重新验证策略
 * - 统一的 loading/error 状态
 * - 支持 mutate 手动刷新
 */
export function useFetch<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options?: {
    revalidateOnFocus?: boolean;
    dedupingInterval?: number;
    refreshInterval?: number;
  },
): FetchResult<T> {
  const { data, error, isLoading, mutate: swrMutate } = useSWR<T>(
    key,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      shouldRetryOnError: false,
      ...options,
    },
  );

  return {
    data: data ?? null,
    error: error
      ? error instanceof APIError
        ? error
        : new APIError(
            error instanceof Error ? error.message : '请求失败',
            0,
          )
      : null,
    loading: isLoading,
    mutate: () => {
      void swrMutate();
    },
  };
}

/**
 * 全局刷新指定 key 的缓存
 */
export function revalidateKey(key: string) {
  void mutate(key);
}

/**
 * 全局刷新匹配 pattern 的所有缓存
 */
export function revalidateMatching(pattern: RegExp) {
  void mutate(
    (key) => typeof key === 'string' && pattern.test(key),
    undefined,
    { revalidate: true },
  );
}
