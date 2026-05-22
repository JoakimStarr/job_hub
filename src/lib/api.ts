import type {
  AppUser,
  CrawlerStatus,
  JobItem,
  PagedResponse,
  ParseResult,
  RoleItem,
  StatsOverview,
  SubscriptionItem,
  SystemConfig,
  SystemStatus,
  FilterOption,
  ProvinceWithCities,
  EducationMapping,
} from '@/lib/types';
import { AUTH_EXPIRED_EVENT, AUTH_TOKEN_KEY, AUTH_USER_KEY } from '@/lib/constants';

const REQUEST_TIMEOUT_MS = 30_000;
const AI_REQUEST_TIMEOUT_MS = 120_000;

export class APIError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown = null) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
  }
}

function getApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (!configured || configured === '/' || configured === '/api') return '';
  return configured;
}

function buildQuery(params: Record<string, unknown> = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    if (Array.isArray(value) && !value.length) continue;
    if (Array.isArray(value)) {
      query.set(key, value.join(','));
      continue;
    }
    query.set(key, String(value));
  }
  return query.toString();
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs?: number): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : '';
  const headers = new Headers(init.headers || {});
  headers.set('Accept', 'application/json');
  if (!(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const effectiveTimeout = timeoutMs || REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
    signal: controller.signal,
  }).catch((error) => {
    if (controller.signal.aborted) {
      throw new APIError(`请求超时（${Math.round(effectiveTimeout / 1000)}秒），请稍后重试`, 408, error);
    }
    throw error;
  }).finally(() => {
    clearTimeout(timeoutId);
  });

  if (!response.ok) {
    let errorData: unknown = null;
    try {
      errorData = await response.json();
    } catch {
      errorData = null;
    }
    const payload = errorData as { detail?: string; message?: string; error?: string } | null;
    const message = payload?.detail || payload?.message || payload?.error || `HTTP ${response.status}: ${response.statusText}`;
    if (response.status === 401 && typeof window !== 'undefined' && path !== '/api/auth/login') {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    throw new APIError(message, response.status, errorData);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json() as Promise<T>;
  }
  return response.text() as Promise<T>;
}

export const API = {
  buildQuery,
  request,
  login: (data: Record<string, unknown> = {}) => request<{ access_token: string; user: AppUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),
  getCurrentUser: () => request<AppUser>('/api/auth/me'),
  getRoles: () => request<{ roles: RoleItem[] }>('/api/auth/roles'),
  getUsers: () => request<AppUser[]>('/api/auth/users'),
  createUser: (data: Record<string, unknown>) => request('/api/auth/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: number, data: Record<string, unknown>) => request(`/api/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  resetUserPassword: (id: number, data: Record<string, unknown>) => request(`/api/auth/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify(data) }),
  deleteUser: (id: number) => request(`/api/auth/users/${id}`, { method: 'DELETE' }),

  getStatsOverview: () => request<StatsOverview>('/api/stats/overview'),
  getSourceStats: () => request('/api/stats/sources'),
  getTrends: (days = 7) => request(`/api/stats/trends?days=${days}`),

  getJobs: (params: Record<string, unknown> = {}) => request<PagedResponse<JobItem>>(`/api/jobs?${buildQuery(params)}`),
  searchJobs: (keyword: string, params: Record<string, unknown> = {}) => request<PagedResponse<JobItem>>(`/api/jobs/search?${buildQuery({ q: keyword, ...params })}`),
  getFavorites: (params: Record<string, unknown> = {}) => request<PagedResponse<JobItem>>(`/api/jobs/favorites?${buildQuery(params)}`),
  toggleFavorite: (id: number) => request(`/api/jobs/${id}/favorite`, { method: 'POST' }),
  getFilterOptions: () => request<{
    locations: FilterOption[];
    job_types: FilterOption[];
    industries: FilterOption[];
    education: FilterOption[];
    sources: FilterOption[];
    provinces: ProvinceWithCities[];
    education_mapping: EducationMapping[];
  }>('/api/jobs/filters'),
  getFilterSuggestions: (query: string, limit = 10) => request<{ suggestions: { name: string; count: number }[] }>(`/api/jobs/filters?suggest=${encodeURIComponent(query)}&limit=${limit}`),
  searchFilters: (query: string, type?: string) => request<Record<string, unknown>>(`/api/jobs/filters?q=${encodeURIComponent(query)}${type ? `&type=${type}` : ''}`),
  getJobDetail: (id: number) => request<JobItem>(`/api/jobs/${id}`),
  getJobTimeline: (id: number) => request(`/api/jobs/${id}/timeline`),
  addJobTimeline: (id: number, data: Record<string, unknown>) => request(`/api/jobs/${id}/timeline`, { method: 'POST', body: JSON.stringify(data) }),
  generateInterviewQuestions: (id: number) => request(`/api/jobs/${id}/interview-questions`, { method: 'POST' }, AI_REQUEST_TIMEOUT_MS),
  analyzeJob: (id: number, data: Record<string, unknown> = {}) => request(`/api/jobs/${id}/ai-analysis`, { method: 'POST', body: JSON.stringify(data) }, AI_REQUEST_TIMEOUT_MS),

  getCrawlerStatus: () => request<CrawlerStatus>('/api/crawler/status'),
  startCrawler: (data: Record<string, unknown> = {}) => request('/api/crawler/start', { method: 'POST', body: JSON.stringify(data) }),
  stopCrawler: () => request('/api/crawler/stop', { method: 'POST' }),
  getCrawlerLogs: (limit = 50) => request(`/api/crawler/logs?limit=${limit}`),
  getCrawlerSources: () => request('/api/crawler/sources'),

  getSystemStatus: () => request<SystemStatus>('/api/system/status'),
  getSystemConfig: () => request<SystemConfig>('/api/system/config'),
  updateSystemConfig: (data: Record<string, unknown>) => request('/api/system/config', { method: 'PUT', body: JSON.stringify(data) }),
  cleanHistoricalData: (limit = 500) => request(`/api/system/maintenance/clean-history?limit=${limit}`, { method: 'POST' }),
  getSubscriptions: () => request<SubscriptionItem[]>('/api/system/subscriptions'),
  saveSubscription: (data: Record<string, unknown>) => request('/api/system/subscriptions', { method: 'POST', body: JSON.stringify(data) }),
  updateSubscription: (id: number, data: Record<string, unknown>) => request(`/api/system/subscriptions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSubscription: (id: number) => request(`/api/system/subscriptions/${id}`, { method: 'DELETE' }),
  previewSubscription: (id: number) => request<JobItem[]>(`/api/system/subscriptions/${id}/preview`),

  getRecommendations: (data: Record<string, unknown> = {}) => request('/api/recommendations/analyze', { method: 'POST', body: JSON.stringify(data) }, AI_REQUEST_TIMEOUT_MS),
  getRecommendationChat: (data: Record<string, unknown> = {}) => request('/api/recommendations/chat', { method: 'POST', body: JSON.stringify(data) }, AI_REQUEST_TIMEOUT_MS),
  getRecommendationChatStream: (data: Record<string, unknown> = {}) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : '';
    return fetch('/api/recommendations/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ ...data, stream: true }),
    });
  },
  getResumeAdvice: (data: Record<string, unknown> = {}) => request('/api/recommendations/resume-advice', { method: 'POST', body: JSON.stringify(data) }, AI_REQUEST_TIMEOUT_MS),
  getDeliveryAssistant: (data: Record<string, unknown> = {}) => request('/api/recommendations/delivery-assistant', { method: 'POST', body: JSON.stringify(data) }, AI_REQUEST_TIMEOUT_MS),
  getRecommendationHistory: (limit = 10, filters: { mode?: string; jobId?: number } = {}) => {
    const query = new URLSearchParams();
    query.set('limit', String(limit));
    if (filters.mode) query.set('mode', filters.mode);
    if (filters.jobId) query.set('jobId', String(filters.jobId));
    return request(`/api/recommendations/history?${query.toString()}`);
  },
  parseResumeText: (text: string) => request<ParseResult>('/api/resume/parse', { method: 'POST', body: JSON.stringify({ text }) }, AI_REQUEST_TIMEOUT_MS),
  parseResumeFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<ParseResult>('/api/resume/parse', { method: 'POST', body: formData }, AI_REQUEST_TIMEOUT_MS);
  },
  getRecommendationQualityDashboard: () => request('/api/recommendations/quality-dashboard'),
  reportRecommendationImpression: (data: Record<string, unknown>) => request('/api/recommendations/metrics/impression', { method: 'POST', body: JSON.stringify(data) }),
  reportRecommendationClick: (data: Record<string, unknown>) => request('/api/recommendations/metrics/click', { method: 'POST', body: JSON.stringify(data) }),
  reportRecommendationDelivery: (data: Record<string, unknown>) => request('/api/recommendations/metrics/delivery', { method: 'POST', body: JSON.stringify(data) }),
  reportRecommendationFeedback: (data: Record<string, unknown>) => request('/api/recommendations/feedback', { method: 'POST', body: JSON.stringify(data) }),

  getChatSessions: (limit = 10) => request('/api/recommendations/chat', { method: 'GET' }),
  getChatSession: (sessionId: string) => request(`/api/recommendations/chat?session_id=${sessionId}`),
  deleteChatSession: (sessionId: string) => request(`/api/recommendations/chat?session_id=${sessionId}`, { method: 'DELETE' }),

  semanticSearch: (params: Record<string, unknown> = {}) => {
    const query = new URLSearchParams();
    if (params.q) query.set('q', String(params.q));
    if (params.top_k) query.set('top_k', String(params.top_k));
    return request(`/api/jobs/semantic-search?${query.toString()}`);
  },
  generateJobEmbeddings: (limit = 100) => request('/api/jobs/semantic-search', {
    method: 'POST',
    body: JSON.stringify({ action: 'generate_embeddings', limit }),
  }),
  
  // Job Alerts APIs
  getJobAlerts: () => request<{ success: boolean; data: unknown[]; emailConfigured?: boolean }>('/api/alerts'),
  createJobAlert: (data: Record<string, unknown>) => request<{ success: boolean; data: unknown; error?: string }>('/api/alerts', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateJobAlert: (id: number, data: Record<string, unknown>) => request<{ success: boolean; data: unknown; error?: string }>(`/api/alerts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteJobAlert: (id: number) => request<{ success: boolean; error?: string }>(`/api/alerts/${id}`, {
    method: 'DELETE',
  }),
  sendTestEmail: (email: string) => request<{ success: boolean; error?: string }>('/api/alerts/test-email', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }),
  getAlertHistory: (alertId?: number, limit = 50) => {
    const query = new URLSearchParams();
    if (alertId) query.set('alert_id', String(alertId));
    query.set('limit', String(limit));
    return request<{ success: boolean; data: unknown[]; error?: string }>(`/api/alerts/history?${query.toString()}`);
  },
  triggerAlerts: (data: Record<string, unknown>) => request<{ success: boolean; message?: string; jobs_processed?: number; alerts_triggered?: number; results?: unknown[]; error?: string }>('/api/alerts/trigger', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};
