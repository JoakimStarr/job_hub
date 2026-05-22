import { getDb } from './db-utils';
import type { ResumeProfile, Education, Internship, Project } from '@/types';

export interface UserProfileRecord {
  id: number;
  user_id: number;
  profile_data: string; // JSON string
  source: 'parsed' | 'manual' | 'merged' | 'ai_enhanced';
  version: number;
  file_hash?: string;
  file_name?: string;
  confidence_score: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProfileUpdatePayload {
  name?: string;
  phone?: string;
  email?: string;
  education?: Education[];
  skills?: string[];
  internships?: Internship[];
  projects?: Project[];
  certifications?: string[];
  languages?: string[];
  resumeText?: string;
  targetLocation?: string;
  targetSalary?: string;
  targetIndustry?: string;
  jobTypePreference?: string;
  selfEvaluation?: string;
  availability?: string;
}

export function initUserProfileTables(): void {
  const db = getDb();
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      profile_data TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      version INTEGER DEFAULT 1,
      file_hash TEXT,
      file_name TEXT,
      confidence_score REAL DEFAULT 0,
      is_active BOOLEAN DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_active 
      ON user_profiles(user_id) WHERE is_active = 1;

    CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id 
      ON user_profiles(user_id);

    CREATE INDEX IF NOT EXISTS idx_user_profiles_file_hash 
      ON user_profiles(file_hash);

    CREATE TABLE IF NOT EXISTS pdf_parse_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_hash TEXT NOT NULL UNIQUE,
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      parsed_text TEXT NOT NULL,
      parse_result TEXT NOT NULL,
      used_ocr BOOLEAN DEFAULT 0,
      parse_duration_ms INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_pdf_cache_expires 
      ON pdf_parse_cache(expires_at);
  `);
}

export function getActiveProfile(userId: number): ResumeProfile | null {
  const db = getDb();
  
  const row = db.prepare(`
    SELECT profile_data FROM user_profiles 
    WHERE user_id = ? AND is_active = 1 
    ORDER BY updated_at DESC LIMIT 1
  `).get(userId) as { profile_data: string } | undefined;

  if (!row) return null;

  try {
    return JSON.parse(row.profile_data);
  } catch (e) {
    console.error('解析用户画像数据失败:', e);
    return null;
  }
}

export function createProfile(
  userId: number, 
  profile: ResumeProfile, 
  options?: {
    source?: UserProfileRecord['source'];
    fileHash?: string;
    fileName?: string;
    confidenceScore?: number;
  }
): number {
  const db = getDb();
  
  const latestVersion = db.prepare(`
    SELECT COALESCE(MAX(version), 0) as max_version 
    FROM user_profiles WHERE user_id = ?
  `).get(userId) as { max_version: number };

  const result = db.prepare(`
    INSERT INTO user_profiles (
      user_id, profile_data, source, version, 
      file_hash, file_name, confidence_score, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    userId,
    JSON.stringify(profile),
    options?.source || 'manual',
    (latestVersion?.max_version || 0) + 1,
    options?.fileHash || null,
    options?.fileName || null,
    options?.confidenceScore || 0
  );

  return result.lastInsertRowid as number;
}

export function updateProfile(
  userId: number, 
  updates: ProfileUpdatePayload
): ResumeProfile | null {
  const db = getDb();
  
  const existingProfile = getActiveProfile(userId);
  if (!existingProfile) return null;

  const mergedProfile: ResumeProfile = {
    ...existingProfile,
    ...updates,
  };

  const latestVersion = db.prepare(`
    SELECT COALESCE(MAX(version), 0) as max_version 
    FROM user_profiles WHERE user_id = ?
  `).get(userId) as { max_version: number };

  db.prepare(`
    UPDATE user_profiles SET is_active = 0 
    WHERE user_id = ? AND is_active = 1
  `).run(userId);

  db.prepare(`
    INSERT INTO user_profiles (
      user_id, profile_data, source, version, 
      confidence_score, is_active
    ) VALUES (?, ?, 'manual', ?, ?, 1)
  `).run(
    userId,
    JSON.stringify(mergedProfile),
    (latestVersion?.max_version || 0) + 1,
    calculateConfidenceScore(mergedProfile)
  );

  return mergedProfile;
}

export function saveParsedProfile(
  userId: number,
  profile: ResumeProfile,
  fileHash: string,
  fileName: string,
  confidenceScore: number
): number {
  return createProfile(userId, profile, {
    source: 'parsed',
    fileHash,
    fileName,
    confidenceScore,
  });
}

export function getPdfCache(fileHash: string): {
  parsedText: string;
  parseResult: ResumeProfile;
} | null {
  const db = getDb();
  
  const row = db.prepare(`
    SELECT parsed_text, parse_result FROM pdf_parse_cache
    WHERE file_hash = ? AND expires_at > datetime('now')
  `).get(fileHash) as { parsed_text: string; parse_result: string } | undefined;

  if (!row) return null;

  try {
    return {
      parsedText: row.parsed_text,
      parseResult: JSON.parse(row.parse_result),
    };
  } catch (e) {
    console.error('解析缓存数据失败:', e);
    return null;
  }
}

export function setPdfCache(
  fileHash: string,
  fileName: string,
  fileSize: number,
  parsedText: string,
  parseResult: ResumeProfile,
  usedOcr: boolean,
  durationMs: number,
  ttlHours: number = 24
): void {
  const db = getDb();
  
  db.prepare(`
    INSERT OR REPLACE INTO pdf_parse_cache (
      file_hash, file_name, file_size, parsed_text, 
      parse_result, used_ocr, parse_duration_ms, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '+' || ? || ' hours'))
  `).run(
    fileHash,
    fileName,
    fileSize,
    parsedText,
    JSON.stringify(parseResult),
    usedOcr ? 1 : 0,
    durationMs,
    ttlHours
  );
}

export function cleanupExpiredCache(): number {
  const db = getDb();
  
  const result = db.prepare(`
    DELETE FROM pdf_parse_cache WHERE expires_at <= datetime('now')
  `).run();

  return result.changes;
}

function calculateConfidenceScore(profile: ResumeProfile): number {
  let score = 0;
  const weights = {
    name: 10,
    phone: 10,
    email: 10,
    education: 20,
    skills: 15,
    internships: 15,
    certifications: 10,
    languages: 10,
  };

  if (profile.name?.trim()) score += weights.name;
  if (profile.phone?.trim()) score += weights.phone;
  if (profile.email?.trim()) score += weights.email;
  if (profile.education?.length > 0) score += weights.education;
  if (profile.skills?.length > 0) score += weights.skills;
  if (profile.internships?.length > 0) score += weights.internships;
  if (profile.certifications?.length > 0) score += weights.certifications;
  if (profile.languages?.length > 0) score += weights.languages;

  return Math.min(score, 100);
}

export function getProfileHistory(userId: number, limit: number = 10): UserProfileRecord[] {
  const db = getDb();
  
  const rows = db.prepare(`
    SELECT * FROM user_profiles 
    WHERE user_id = ?
    ORDER BY version DESC LIMIT ?
  `).all(userId, limit) as UserProfileRecord[];

  return rows;
}

export function rollbackProfile(userId: number, targetVersion: number): boolean {
  const db = getDb();
  
  const target = db.prepare(`
    SELECT * FROM user_profiles 
    WHERE user_id = ? AND version = ?
  `).get(userId, targetVersion) as UserProfileRecord | undefined;

  if (!target) return false;

  db.prepare(`
    UPDATE user_profiles SET is_active = 0 
    WHERE user_id = ? AND is_active = 1
  `).run(userId);

  db.prepare(`
    UPDATE user_profiles SET is_active = 1, updated_at = datetime('now')
    WHERE id = ?
  `).run(target.id);

  return true;
}

export function deleteProfile(userId: number): boolean {
  const db = getDb();
  
  const result = db.prepare(`
    DELETE FROM user_profiles WHERE user_id = ?
  `).run(userId);

  return result.changes > 0;
}