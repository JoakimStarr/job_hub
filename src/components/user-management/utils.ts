import type { PasswordStrength } from './types';

export function checkPasswordStrength(password: string): PasswordStrength {
  const checks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    numbers: /[0-9]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };

  const passedCount = Object.values(checks).filter(Boolean).length;

  let score: number;
  let label: string;
  let color: string;

  if (passedCount <= 1) {
    score = 1;
    label = '弱';
    color = 'var(--danger)';
  } else if (passedCount <= 2) {
    score = 2;
    label = '较弱';
    color = 'var(--warning)';
  } else if (passedCount <= 3) {
    score = 3;
    label = '中等';
    color = '#f59e0b';
  } else if (passedCount <= 4) {
    score = 4;
    label = '强';
    color = 'var(--success)';
  } else {
    score = 5;
    label = '非常强';
    color = '#10b981';
  }

  return { score, label, color, checks };
}

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '--';
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return '刚刚';
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} 周前`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} 个月前`;
  return `${Math.floor(diffDays / 365)} 年前`;
}

export function extractDeviceInfo(userAgent?: string): string {
  if (!userAgent) return '未知设备';
  
  if (/Mobile|Android|iP(hone|od|ad)/i.test(userAgent)) {
    if (/iPad/i.test(userAgent)) return 'iPad';
    if (/iPhone/i.test(userAgent)) return 'iPhone';
    if (/Android/i.test(userAgent)) return 'Android';
    return '移动设备';
  }
  
  if (/Windows/i.test(userAgent)) return 'Windows';
  if (/Mac/i.test(userAgent)) return 'macOS';
  if (/Linux/i.test(userAgent)) return 'Linux';
  
  return '桌面设备';
}

export async function fetchWithAuth(url: string, options?: RequestInit): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (response.status === 401) {
    throw new Error('登录已过期，请重新登录');
  }
  
  if (response.status === 403) {
    throw new Error('没有权限执行此操作');
  }

  return response;
}

export async function handleApiError(response: Response): Promise<never> {
  const errorData = await response.json().catch(() => ({ error: '请求失败' }));
  
  switch (response.status) {
    case 400:
      throw new Error(errorData.error || '请求参数错误');
    case 404:
      throw new Error(errorData.error || '资源不存在');
    case 409:
      throw new Error(errorData.error || '资源冲突');
    case 500:
      throw new Error(errorData.error || '服务器内部错误');
    default:
      throw new Error(errorData.error || `请求失败 (${response.status})`);
  }
}

export function exportToCSV(data: Record<string, unknown>[], filename: string): void {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        const strValue = String(value ?? '');
        if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
          return `"${strValue.replace(/"/g, '""')}"`;
        }
        return strValue;
      }).join(',')
    ),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
