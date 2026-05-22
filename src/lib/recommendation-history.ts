import { getDb } from './db-utils';
import { logger } from './logger';

export interface RecommendationHistoryItem {
  id: number;
  user_id?: number;
  mode: 'analyze' | 'resume' | 'delivery' | 'chat' | 'interview_questions' | 'ai_analysis';
  job_id?: number;
  profile_summary?: string;
  prompt?: string;
  result: Record<string, unknown>;
  session_id?: string;
  model?: string;
  duration_ms?: number;
  status: 'success' | 'error';
  created_at: string;
}

export function initRecommendationHistoryTable(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS recommendation_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      mode TEXT NOT NULL DEFAULT 'analyze',
      job_id INTEGER,
      profile_summary TEXT,
      prompt TEXT,
      result TEXT NOT NULL DEFAULT '{}',
      session_id TEXT,
      model TEXT,
      duration_ms INTEGER,
      status TEXT NOT NULL DEFAULT 'success',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_rec_hist_user ON recommendation_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_rec_hist_mode ON recommendation_history(mode);
    CREATE INDEX IF NOT EXISTS idx_rec_hist_created ON recommendation_history(created_at);
  `);
}

export function saveRecommendationHistory(params: {
  userId?: number;
  mode: RecommendationHistoryItem['mode'];
  jobId?: number;
  profileSummary?: string;
  prompt?: string;
  result: Record<string, unknown>;
  sessionId?: string;
  model?: string;
  durationMs?: number;
  status?: 'success' | 'error';
}): RecommendationHistoryItem {
  const db = getDb();

  const result = db.prepare(`
    INSERT INTO recommendation_history (
      user_id, mode, job_id, profile_summary, prompt,
      result, session_id, model, duration_ms, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.userId || null,
    params.mode,
    params.jobId || null,
    params.profileSummary ? params.profileSummary.slice(0, 500) : null,
    params.prompt ? params.prompt.slice(0, 500) : null,
    JSON.stringify(params.result),
    params.sessionId || null,
    params.model || null,
    params.durationMs || null,
    params.status || 'success',
  );

  const saved = db.prepare('SELECT * FROM recommendation_history WHERE id = ?').get(result.lastInsertRowid) as RecommendationHistoryItem;

  logger.info('推荐历史已保存', {
    mode: params.mode,
    jobId: params.jobId,
    historyId: saved.id,
  });

  return saved;
}

export function getRecommendationHistory(filters?: {
  userId?: number;
  mode?: string;
  limit?: number;
}): RecommendationHistoryItem[] {
  const db = getDb();
  const limit = filters?.limit || 20;

  let sql = `
    SELECT * FROM recommendation_history WHERE 1=1
  `;
  const conditions: unknown[] = [];

  if (filters?.userId) {
    sql += ' AND user_id = ?';
    conditions.push(filters.userId);
  }

  if (filters?.mode) {
    sql += ' AND mode = ?';
    conditions.push(filters.mode);
  }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  conditions.push(limit);

  return db.prepare(sql).all(...conditions) as RecommendationHistoryItem[];
}

initRecommendationHistoryTable();