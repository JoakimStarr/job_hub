export type PermissionKey =
  | 'view_jobs'
  | 'view_stats'
  | 'manage_crawler'
  | 'view_system'
  | 'use_recommendations'
  | 'manage_users';

export interface AppUser {
  id?: number;
  username: string;
  display_name?: string;
  role?: string;
  permissions?: string[];
  is_active?: boolean;
  last_login_at?: string | null;
}

export interface JobItem {
  id: number;
  title: string;
  company?: string;
  location?: string;
  salary?: string;
  description?: string;
  requirements?: string;
  job_type?: string;
  industry?: string;
  education?: string;
  experience?: string;
  source?: string;
  university?: string;
  source_url?: string;
  apply_url?: string;
  publish_date?: string;
  deadline?: string;
  category?: string;
  tags?: string;
  is_favorite?: number;
  is_read?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface StatsOverview {
  overview?: {
    total_jobs?: number;
    favorite_jobs?: number;
    today_jobs?: number;
    sources_count?: number;
  };
  by_source?: Array<{ source: string; count: number; percentage: number }>;
  hot_keywords?: Array<{ keyword: string; count: number }>;
  latest_jobs?: JobItem[];
}

export interface CrawlerStatus {
  is_running?: boolean;
  status?: string;
  progress?: number;
  message?: string;
  current_source?: string;
  elapsed_seconds?: number;
}

export interface SystemConfig {
  app?: {
    name?: string;
    version?: string;
  };
  crawler?: Record<string, unknown>;
  ai?: Record<string, unknown>;
}

export interface SystemStatus {
  app?: { version?: string };
  database?: { total_jobs?: number };
  today_jobs?: number;
  crawler_success_rate?: number;
  ai_runtime?: {
    timeout_rate?: number;
    cache_hit_rate?: number;
    daily_budget?: number;
    daily_tokens?: number;
    recent_failures?: Array<{ model?: string; time?: string; message?: string }>;
  };
  task_center?: Array<{ name: string; status: string; summary?: string; meta?: string[] }>;
  progress_summary?: Array<{ status: string; count: number }>;
  recent_errors?: Array<{ source?: string; time?: string; status?: string; message?: string }>;
  crawler_diagnostics?: Record<string, { runs?: number; fetched?: number; saved?: number; duplicates?: number; failed?: number; write_failures?: number }>;
}

export interface SubscriptionItem {
  id: number;
  name: string;
  keyword?: string;
  locations?: string[];
  industries?: string[];
  job_types?: string[];
  education?: string;
  enabled?: boolean;
}

export interface RoleItem {
  id: string;
  name?: string;
}

export interface FilterOption {
  name: string;
  count: number;
  pinyin?: string;
  firstLetter?: string;
}

export interface LocationMapping {
  name: string;
  type: 'province' | 'city';
  province?: string;
  pinyin: string;
  firstLetter: string;
}

export interface EducationMapping {
  name: string;
  level: number;
  alias: string[];
}

export interface ProvinceWithCities {
  province: string;
  cities: FilterOption[];
  count: number;
}

export interface FilterCache {
  locations: FilterOption[];
  job_types: FilterOption[];
  industries: FilterOption[];
  education: FilterOption[];
  sources: FilterOption[];
  provinces: ProvinceWithCities[];
  locationMapping: LocationMapping[];
  educationMapping: EducationMapping[];
  updated_at: number;
}

export interface ResumeProfile {
  name: string;
  phone: string;
  email: string;
  education: Education[];
  skills: string[];
  internships: Internship[];
  projects: Project[];
  certifications: string[];
  languages: string[];
  resumeText: string;
}

export interface Education {
  school: string;
  major: string;
  degree: string;
  graduationYear: number | null;
  startDate: string;
  endDate: string;
}

export interface Internship {
  company: string;
  position: string;
  duration: string;
  description: string;
  startDate: string;
  endDate: string;
}

export interface Project {
  name: string;
  role: string;
  description: string;
}

export interface MatchScore {
  total: number;
  breakdown: {
    skills: number;
    education: number;
    major: number;
    location: number;
    experience: number;
    industry: number;
  };
  matchedFields: string[];
  gaps: string[];
  risks: string[];
}

export interface MatchResult {
  job: JobItem;
  score: MatchScore;
  rank: number;
}

export interface ResumeDiagnosis {
  score: number;
  highlights: string[];
  risks: string[];
  gaps: string[];
  suggestions: string[];
}

export interface ParseResult {
  profile: ResumeProfile;
  confidence: number;
  warnings: string[];
}

export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
  timestamp: string;
  path?: string;
}

export interface ApiSuccessResponse<T = unknown> {
  data: T;
  timestamp: string;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
