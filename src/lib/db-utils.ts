import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { SOURCE_NAME_MAP } from '@/lib/constants';
import type { FilterOption, LocationMapping, EducationMapping, ProvinceWithCities, FilterCache } from '@/types';

const DB_PATH = path.join(process.cwd(), 'data', 'jobs.db');

export { SOURCE_NAME_MAP };

export const SOURCE_CODE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(SOURCE_NAME_MAP).map(([code, name]) => [name, code])
);

export const SOURCE_PINYIN_MAP: Record<string, { pinyin: string; firstLetter: string }> = {
  '西南财经大学': { pinyin: 'xinancaijingdaxue', firstLetter: 'xcjdx' },
  '东北财经大学': { pinyin: 'dongbeicaijingdaxue', firstLetter: 'dbcjdx' },
  '上海财经大学': { pinyin: 'shanghaicaijingdaxue', firstLetter: 'shcjdx' },
  '江西财经大学': { pinyin: 'jiangxicaijingdaxue', firstLetter: 'jxcjdx' },
  '中央财经大学': { pinyin: 'zhongyangcaijingdaxue', firstLetter: 'zycjdx' },
  '国家智慧教育平台': { pinyin: 'guojiazhihuijiaoyupingtai', firstLetter: 'gjzhjypt' },
  '中南财经政法大学': { pinyin: 'zhongnancaijingzhengfadaxue', firstLetter: 'zncjzfdx' },
  '东北大学': { pinyin: 'dongbeidaxue', firstLetter: 'dbdx' },
  '对外经济贸易大学': { pinyin: 'duiwaijingjimaoyidaxue', firstLetter: 'dwjjmydx' },
};

export function getSourceName(source: string): string {
  return SOURCE_NAME_MAP[source] || source;
}

export function getSourceCode(name: string): string {
  return SOURCE_CODE_MAP[name] || name;
}

const FAKE_URL_PATTERNS = [
  /^https?:\/\/example\.com/,
  /^https?:\/\/localhost/,
  /^https?:\/\/127\.0\.0\.1/,
  /^https?:\/\/\[?::1\]?/,
  /^$/,
  /^http:\/\/test\./,
  /^https?:\/\/fake\./,
  /^\s*$/,
];

const SOURCE_URL_TEMPLATES: Record<string, (id: number) => string> = {
  sufe: (id) => `https://career.sufe.edu.cn/career/zpxx/view/zpxx/${id}`,
  cufe: (id) => `http://scc.cufe.edu.cn/f/recruitmentinfo/ajax_show?id=${id}`,
  dufe: (id) => `http://scc.dufe.edu.cn/f/recruitmentinfo/ajax_show?id=${id}`,
  swufe: (id) => `https://job3.swufe.edu.cn/jobs/jobs-show-${id}`,
  zuel: (id) => `https://jyzx.zuel.edu.cn/api/publicly/recruit/get?id=${id}`,
  uibe: (id) => `https://career.uibe.edu.cn/front/zpxx.jspa?tid=${id}`,
  jxufe: (id) => `https://jxx.jxufe.edu.cn/front/zpxx.jspa?tid=${id}`,
  smartedu: (id) => `https://www.smartedu.cn/job/${id}`,
  neu: (id) => `https://career.neu.edu.cn/job/${id}`,
};

export function isFakeUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return true;
  return FAKE_URL_PATTERNS.some((p) => p.test(url));
}

export function splitMultiDelimiter(value: string | null | undefined | string[]): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(s => String(s).trim()).filter(Boolean);
  return String(value)
    .split(/[,，;；\s、]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

export function resolveSourceUrl(source: string, sourceUrl: string | null | undefined, id: number): string {
  if (sourceUrl && !isFakeUrl(sourceUrl)) return sourceUrl;
  const generator = SOURCE_URL_TEMPLATES[source];
  if (generator) return generator(id);
  return '';
}

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH, { readonly: false, fileMustExist: false });
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('synchronous = NORMAL');
    dbInstance.pragma('busy_timeout = 5000');
  }
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export interface JobQueryFilters {
  keyword?: string;
  location?: string;
  jobType?: string;
  industry?: string;
  education?: string;
  source?: string;
  isFavorite?: boolean | number;
  keywordFields?: string[];
  multiLocation?: string[];
  multiIndustry?: string[];
  multiJobType?: string[];
  /** 筛选最近 N 天内发布的岗位（基于 publish_date 字段） */
  publishDateDays?: number;
}

export function buildJobWhereClause(filters: JobQueryFilters): { whereClause: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.keyword) {
    const fields = filters.keywordFields || ['title', 'company', 'description'];
    const keywordConditions = fields.map(f => `${f} LIKE ?`).join(' OR ');
    conditions.push(`(${keywordConditions})`);
    fields.forEach(() => params.push(`%${filters.keyword}%`));
  }

  if (filters.location) {
    conditions.push('location LIKE ?');
    params.push(`%${filters.location}%`);
  }

  if (filters.jobType) {
    conditions.push('job_type LIKE ?');
    params.push(`%${filters.jobType}%`);
  }

  if (filters.industry) {
    conditions.push('industry LIKE ?');
    params.push(`%${filters.industry}%`);
  }

  if (filters.education) {
    conditions.push('education LIKE ?');
    params.push(`%${filters.education}%`);
  }

  if (filters.source) {
    const sourceCode = getSourceCode(filters.source);
    conditions.push('source = ?');
    params.push(sourceCode);
  }

  if (filters.isFavorite !== undefined && filters.isFavorite !== null) {
    conditions.push('is_favorite = ?');
    params.push(typeof filters.isFavorite === 'boolean' ? (filters.isFavorite ? 1 : 0) : filters.isFavorite);
  }

  if (filters.publishDateDays && filters.publishDateDays > 0) {
    conditions.push("date(publish_date) >= date('now', ?)");
    params.push(`-${filters.publishDateDays} days`);
  }

  if (filters.multiLocation && filters.multiLocation.length > 0) {
    const multiConditions = filters.multiLocation.map(() => 'location LIKE ?').join(' OR ');
    conditions.push(`(${multiConditions})`);
    params.push(...filters.multiLocation.map(l => `%${l}%`));
  }

  if (filters.multiIndustry && filters.multiIndustry.length > 0) {
    const multiConditions = filters.multiIndustry.map(() => 'industry LIKE ?').join(' OR ');
    conditions.push(`(${multiConditions})`);
    params.push(...filters.multiIndustry.map(i => `%${i}%`));
  }

  if (filters.multiJobType && filters.multiJobType.length > 0) {
    const multiConditions = filters.multiJobType.map(() => 'job_type LIKE ?').join(' OR ');
    conditions.push(`(${multiConditions})`);
    params.push(...filters.multiJobType.map(jt => `%${jt}%`));
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  return { whereClause, params };
}

const CACHE_FILE = path.join(process.cwd(), 'data', 'filter_cache.json');
const CACHE_TTL_MS = 5 * 60 * 1000;

let memoryCache: FilterCache | null = null;

function loadCacheFromFile(): FilterCache | null {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const content = fs.readFileSync(CACHE_FILE, 'utf-8');
      return JSON.parse(content) as FilterCache;
    }
  } catch {
    return null;
  }
  return null;
}

function saveCacheToFile(cache: FilterCache): void {
  try {
    const cacheDir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch {
    // Silently fail - use memory cache only in restricted environments
  }
}

export function splitAndNormalize(values: string[], separators: string[] = [',', '，', '、', '/', '|']): string[] {
  const result = new Set<string>();
  
  for (const value of values) {
    if (!value || value.trim() === '') continue;
    
    let parts = [value];
    for (const sep of separators) {
      parts = parts.flatMap(p => p.split(sep));
    }
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed && trimmed.length >= 2 && trimmed.length <= 20) {
        result.add(trimmed);
      }
    }
  }
  
  return Array.from(result);
}

export function normalizeLocation(location: string): string {
  let normalized = location.trim();
  
  normalized = normalized
    .replace(/省直辖县级行政区划/g, '')
    .replace(/市辖区/g, '')
    .replace(/自治区/g, '')
    .replace(/特别行政区/g, '')
    .replace(/省$/g, '')
    .replace(/市$/g, '')
    .trim();
  
  return normalized;
}

export function cleanLocationData(location: string): string[] {
  const parts = splitAndNormalize([location]);
  return parts.map(normalizeLocation).filter(l => l.length >= 2);
}

function countOccurrences(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    const parts = splitAndNormalize([value]);
    for (const part of parts) {
      const normalized = normalizeLocation(part);
      if (normalized.length >= 2) {
        counts.set(normalized, (counts.get(normalized) || 0) + 1);
      }
    }
  }
  return counts;
}

function getLocationMappingFromDb(): LocationMapping[] {
  const db = getDb();
  try {
    const rows = db.prepare(`
      SELECT name, type, province, pinyin, first_letter
      FROM location_mapping
    `).all() as { name: string; type: string; province: string | null; pinyin: string; first_letter: string }[];
    
    return rows.map(row => ({
      name: row.name,
      type: row.type as 'province' | 'city',
      province: row.province || undefined,
      pinyin: row.pinyin,
      firstLetter: row.first_letter,
    }));
  } catch {
    return [];
  }
}

function getEducationMappingFromDb(): EducationMapping[] {
  const db = getDb();
  try {
    const rows = db.prepare(`
      SELECT name, level, alias
      FROM education_mapping
      ORDER BY level
    `).all() as { name: string; level: number; alias: string | null }[];
    
    return rows.map(row => ({
      name: row.name,
      level: row.level,
      alias: row.alias ? row.alias.split(',').filter(a => a.trim()) : [],
    }));
  } catch {
    return [
      { name: '不限', level: 0, alias: [] },
      { name: '中专', level: 1, alias: ['中技', '职高'] },
      { name: '大专', level: 2, alias: ['专科', '高职'] },
      { name: '本科', level: 3, alias: ['学士', '大学本科'] },
      { name: '硕士', level: 4, alias: ['研究生', '硕士研究生'] },
      { name: '博士', level: 5, alias: ['博士研究生'] },
      { name: '博士后', level: 6, alias: [] },
    ];
  }
}

function getProvinceByCityFromMapping(city: string, mapping: LocationMapping[]): string | undefined {
  const found = mapping.find(m => m.name === city && m.type === 'city');
  return found?.province;
}

export function getFilterOptions(useCache = true): FilterCache {
  if (useCache && memoryCache) {
    const now = Date.now();
    if (now - memoryCache.updated_at < CACHE_TTL_MS) {
      return memoryCache;
    }
  }
  
  if (useCache) {
    const fileCache = loadCacheFromFile();
    if (fileCache) {
      const now = Date.now();
      if (now - fileCache.updated_at < CACHE_TTL_MS) {
        memoryCache = fileCache;
        return fileCache;
      }
    }
  }
  
  const db = getDb();
  const locationMapping = getLocationMappingFromDb();
  const educationMapping = getEducationMappingFromDb();
  
  const locations = db.prepare(`
    SELECT location 
    FROM jobs 
    WHERE location IS NOT NULL AND location != ''
  `).all() as { location: string }[];
  
  const jobTypes = db.prepare(`
    SELECT job_type 
    FROM jobs 
    WHERE job_type IS NOT NULL AND job_type != ''
  `).all() as { job_type: string }[];
  
  const industries = db.prepare(`
    SELECT industry 
    FROM jobs 
    WHERE industry IS NOT NULL AND industry != ''
  `).all() as { industry: string }[];
  
  const education = db.prepare(`
    SELECT education 
    FROM jobs 
    WHERE education IS NOT NULL AND education != ''
  `).all() as { education: string }[];
  
  const sources = db.prepare(`
    SELECT source, COUNT(*) as count
    FROM jobs 
    WHERE source IS NOT NULL AND source != ''
    GROUP BY source
    ORDER BY count DESC
  `).all() as { source: string; count: number }[];
  
  const locationCounts = countOccurrences(locations.map(item => item.location));
  const jobTypeCounts = countOccurrences(jobTypes.map(item => item.job_type));
  const industryCounts = countOccurrences(industries.map(item => item.industry));
  const educationCounts = countOccurrences(education.map(item => item.education));
  
  const locationList: FilterOption[] = Array.from(locationCounts.entries())
    .map(([name, count]) => {
      const mapping = locationMapping.find(m => m.name === name);
      return {
        name,
        count,
        pinyin: mapping?.pinyin,
        firstLetter: mapping?.firstLetter,
      };
    })
    .sort((a, b) => b.count - a.count);
  
  const jobTypeList: FilterOption[] = Array.from(jobTypeCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  
  const industryList: FilterOption[] = Array.from(industryCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  
  const educationList: FilterOption[] = Array.from(educationCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  
  const sourceList: FilterOption[] = sources.map(item => {
    const pinyinData = SOURCE_PINYIN_MAP[SOURCE_NAME_MAP[item.source]];
    return {
      name: getSourceName(item.source),
      count: item.count,
      pinyin: pinyinData?.pinyin,
      firstLetter: pinyinData?.firstLetter,
    };
  });
  
  const provinceMap = new Map<string, { cities: string[]; count: number }>();
  
  for (const mapping of locationMapping) {
    if (mapping.type === 'province') {
      const count = locationCounts.get(mapping.name) || 0;
      if (!provinceMap.has(mapping.name)) {
        provinceMap.set(mapping.name, { cities: [], count: 0 });
      }
      provinceMap.get(mapping.name)!.count += count;
    }
  }
  
  for (const [name, count] of locationCounts.entries()) {
    const province = getProvinceByCityFromMapping(name, locationMapping);
    if (province) {
      if (!provinceMap.has(province)) {
        provinceMap.set(province, { cities: [], count: 0 });
      }
      const data = provinceMap.get(province)!;
      data.cities.push(name);
      data.count += count;
    }
  }
  
  const provinces: ProvinceWithCities[] = Array.from(provinceMap.entries())
    .map(([province, data]) => ({
      province,
      cities: data.cities
        .map(city => locationList.find(l => l.name === city))
        .filter((item): item is FilterOption => item !== undefined),
      count: data.count,
    }))
    .filter(p => p.cities.length > 0 || p.count > 0)
    .sort((a, b) => b.count - a.count);
  
  const cache: FilterCache = {
    locations: locationList,
    job_types: jobTypeList,
    industries: industryList,
    education: educationList,
    sources: sourceList,
    provinces,
    locationMapping,
    educationMapping,
    updated_at: Date.now(),
  };
  
  memoryCache = cache;
  saveCacheToFile(cache);
  
  return cache;
}

export function searchFilterOptions(query: string, type?: string): Record<string, FilterOption[]> {
  const cache = getFilterOptions();
  const lowerQuery = query.toLowerCase();
  
  const searchInList = (list: FilterOption[]): FilterOption[] => {
    return list.filter(item => {
      if (item.name.toLowerCase().includes(lowerQuery)) return true;
      if (item.pinyin && item.pinyin.includes(lowerQuery)) return true;
      if (item.firstLetter && item.firstLetter.includes(lowerQuery)) return true;
      return false;
    });
  };
  
  if (type) {
    switch (type) {
      case 'locations':
        return { locations: searchInList(cache.locations) };
      case 'job_types':
        return { job_types: searchInList(cache.job_types) };
      case 'industries':
        return { industries: searchInList(cache.industries) };
      case 'education':
        return { education: searchInList(cache.education) };
      case 'sources':
        return { sources: searchInList(cache.sources) };
      default:
        return {};
    }
  }
  
  return {
    locations: searchInList(cache.locations).slice(0, 10),
    job_types: searchInList(cache.job_types).slice(0, 10),
    industries: searchInList(cache.industries).slice(0, 10),
    education: searchInList(cache.education).slice(0, 10),
    sources: searchInList(cache.sources).slice(0, 10),
  };
}

export function searchLocationsByProvince(province: string): FilterOption[] {
  const cache = getFilterOptions();
  const provinceData = cache.provinces.find(p => p.province === province);
  
  if (!provinceData) {
    return [];
  }
  
  return provinceData.cities;
}

export function getSuggestions(query: string, limit = 10): FilterOption[] {
  const cache = getFilterOptions();
  const lowerQuery = query.toLowerCase();
  
  const allOptions: FilterOption[] = [
    ...cache.locations,
    ...cache.sources,
    ...cache.job_types,
    ...cache.industries,
    ...cache.education,
  ];
  
  const scored = allOptions.map(item => {
    let score = 0;
    
    if (item.name.toLowerCase().startsWith(lowerQuery)) {
      score = 100;
    } else if (item.name.toLowerCase().includes(lowerQuery)) {
      score = 80;
    } else if (item.firstLetter && item.firstLetter === lowerQuery) {
      score = 90;
    } else if (item.firstLetter && item.firstLetter.startsWith(lowerQuery)) {
      score = 70;
    } else if (item.pinyin && item.pinyin.startsWith(lowerQuery)) {
      score = 60;
    } else if (item.pinyin && item.pinyin.includes(lowerQuery)) {
      score = 40;
    }
    
    return { item, score };
  });
  
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.item.count - a.item.count;
    })
    .slice(0, limit)
    .map(s => s.item);
}

export function refreshFilterCache(): void {
  memoryCache = null;
  getFilterOptions(false);
}

export function getEducationLevel(name: string): number {
  const cache = getFilterOptions();
  const mapping = cache.educationMapping.find(m => 
    m.name === name || m.alias.includes(name)
  );
  return mapping?.level ?? 99;
}

export function normalizeEducationName(name: string): string {
  const cache = getFilterOptions();
  const mapping = cache.educationMapping.find(m => 
    m.name === name || m.alias.includes(name)
  );
  return mapping?.name ?? name;
}

// ==================== 订阅分析相关表 ====================

const MAX_ANALYSIS_HISTORY = 40;

export function initSubscriptionAnalysisTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscription_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscription_id INTEGER NOT NULL,
      analyzed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      total_jobs_scanned INTEGER DEFAULT 0,
      new_jobs_count INTEGER DEFAULT 0,
      filtered_count INTEGER DEFAULT 0,
      matched_jobs_count INTEGER DEFAULT 0,
      last_job_id_analyzed INTEGER DEFAULT 0,
      analysis_hash TEXT,
      ai_summary TEXT,
      ai_model TEXT,
      tokens_used INTEGER,
      status TEXT DEFAULT 'pending',
      error_message TEXT,
      FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
    )
  `);

  try {
    db.exec(`ALTER TABLE subscription_analyses ADD COLUMN filtered_count INTEGER DEFAULT 0`);
  } catch { /* 列已存在 */ }

  db.exec(`
    CREATE TABLE IF NOT EXISTS subscription_analysis_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      analysis_id INTEGER NOT NULL,
      job_id INTEGER NOT NULL,
      match_score REAL DEFAULT 0,
      skill_match REAL DEFAULT 0,
      education_match REAL DEFAULT 0,
      location_match REAL DEFAULT 0,
      ai_reasoning TEXT,
      ai_suggestions TEXT,
      is_read INTEGER DEFAULT 0,
      is_interested INTEGER DEFAULT 0,
      applied_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(analysis_id, job_id),
      FOREIGN KEY (analysis_id) REFERENCES subscription_analyses(id),
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    )
  `);

  // 索引
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sa_subscription ON subscription_analyses(subscription_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sa_status ON subscription_analyses(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sar_analysis ON subscription_analysis_results(analysis_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sar_job ON subscription_analysis_results(job_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sar_score ON subscription_analysis_results(match_score DESC)`);
}

export function cleanupOldAnalyses(db: Database.Database, subscriptionId: number): void {
  const count = db.prepare(
    'SELECT COUNT(*) as cnt FROM subscription_analyses WHERE subscription_id = ?'
  ).get(subscriptionId) as { cnt: number };

  if (count.cnt > MAX_ANALYSIS_HISTORY) {
    const toDelete = count.cnt - MAX_ANALYSIS_HISTORY;
    const oldIds = db.prepare(
      'SELECT id FROM subscription_analyses WHERE subscription_id = ? ORDER BY analyzed_at ASC LIMIT ?'
    ).all(subscriptionId, toDelete) as { id: number }[];

    for (const row of oldIds) {
      db.prepare('DELETE FROM subscription_analysis_results WHERE analysis_id = ?').run(row.id);
    }
    
    const idList = oldIds.map(r => r.id).join(',');
    db.prepare(`DELETE FROM subscription_analyses WHERE id IN (${idList})`).run();
  }
}

export function computeSubscriptionHash(subscription: {
  keyword?: string | null;
  locations?: string[] | null;
  industries?: string[] | null;
  job_types?: string[] | null;
  education?: string | null;
}): string {
  const data = JSON.stringify({
    k: subscription.keyword || '',
    l: (subscription.locations || []).sort().join(','),
    i: (subscription.industries || []).sort().join(','),
    j: (subscription.job_types || []).sort().join(','),
    e: subscription.education || '',
  });
  
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export interface SubscriptionAnalysisRecord {
  id: number;
  subscription_id: number;
  analyzed_at: string;
  total_jobs_scanned: number;
  new_jobs_count: number;
  matched_jobs_count: number;
  last_job_id_analyzed: number;
  analysis_hash: string | null;
  ai_summary: string | null;
  ai_model: string | null;
  tokens_used: number | null;
  status: string;
  error_message: string | null;
}

export function getLastAnalysis(db: Database.Database, subscriptionId: number): SubscriptionAnalysisRecord | null {
  return db.prepare(
    'SELECT * FROM subscription_analyses WHERE subscription_id = ? ORDER BY analyzed_at DESC LIMIT 1'
  ).get(subscriptionId) as SubscriptionAnalysisRecord | null;
}

export function getMaxJobId(db: Database.Database): number {
  const result = db.prepare('SELECT MAX(id) as max_id FROM jobs').get() as { max_id: number | null };
  return result?.max_id ?? 0;
}
