import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { FilterOption, LocationMapping, EducationMapping, ProvinceWithCities, FilterCache } from '@/types';

const DB_PATH = path.join(process.cwd(), 'data', 'jobs.db');

export const SOURCE_NAME_MAP: Record<string, string> = {
  swufe: '西南财经大学',
  dufe: '东北财经大学',
  sufe: '上海财经大学',
  jxufe: '江西财经大学',
  cufe: '中央财经大学',
  smartedu: '国家智慧教育平台',
  zuel: '中南财经政法大学',
  neu: '东北大学',
  uibe: '对外经济贸易大学',
};

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

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH, { readonly: false, fileMustExist: false });
  }
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
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
