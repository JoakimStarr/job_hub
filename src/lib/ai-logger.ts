import { getDb } from './db-utils';
import { logger } from './logger';

export interface AILogEntry {
  id: number;
  session_id: string;
  type: 'analysis' | 'chat' | 'resume_advice' | 'delivery' | 'interview_questions' | 'embedding' | 'semantic_search';
  provider: string;
  model: string;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  duration_ms: number;
  status: 'success' | 'error' | 'fallback';
  input_summary: string;
  output_summary: string;
  error_message?: string;
  job_id?: number;
  user_id?: number;
  created_at: string;
}

export function initAILogTable(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'analysis',
      provider TEXT NOT NULL,
      model TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      total_tokens INTEGER,
      duration_ms INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('success', 'error', 'fallback')),
      input_summary TEXT NOT NULL,
      output_summary TEXT,
      error_message TEXT,
      job_id INTEGER,
      user_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_ai_logs_session ON ai_logs(session_id);
    CREATE INDEX IF NOT EXISTS idx_ai_logs_type ON ai_logs(type);
    CREATE INDEX IF NOT EXISTS idx_ai_logs_created ON ai_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_ai_logs_job_id ON ai_logs(job_id);
  `);
}

function truncate(text: string, maxLen = 500): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}

export function logAICall(params: {
  sessionId: string;
  type: AILogEntry['type'];
  provider: string;
  model: string;
  status: AILogEntry['status'];
  durationMs: number;
  inputSummary: string;
  outputSummary?: string;
  errorMessage?: string;
  jobId?: number;
  userId?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}): void {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO ai_logs (
        session_id, type, provider, model,
        input_tokens, output_tokens, total_tokens,
        duration_ms, status, input_summary, output_summary,
        error_message, job_id, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.sessionId,
      params.type,
      params.provider,
      params.model,
      params.inputTokens || null,
      params.outputTokens || null,
      params.totalTokens || null,
      params.durationMs,
      params.status,
      truncate(params.inputSummary),
      params.outputSummary ? truncate(params.outputSummary) : null,
      params.errorMessage || null,
      params.jobId || null,
      params.userId || null,
    );
  } catch (err) {
    logger.error('写入AI日志失败:', err);
  }
}

export function getAILogs(filters?: {
  type?: string;
  limit?: number;
  offset?: number;
  jobId?: number;
}): AILogEntry[] {
  const db = getDb();
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;

  let sql = `
    SELECT * FROM ai_logs WHERE 1=1
  `;
  const conditions: unknown[] = [];

  if (filters?.type) {
    sql += ' AND type = ?';
    conditions.push(filters.type);
  }

  if (filters?.jobId) {
    sql += ' AND job_id = ?';
    conditions.push(filters.jobId);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  conditions.push(limit, offset);

  return db.prepare(sql).all(...conditions) as AILogEntry[];
}

export function getAISummary(): {
  totalCalls: number;
  successRate: number;
  avgDuration: number;
  avgTokens: number;
  byType: Record<string, number>;
} {
  const db = getDb();

  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
      AVG(duration_ms) as avg_duration,
      COALESCE(AVG(total_tokens), 0) as avg_tokens
    FROM ai_logs
  `).get() as { total: number; success_count: number; avg_duration: number; avg_tokens: number };

  const byTypeRows = db.prepare(`
    SELECT type, COUNT(*) as count FROM ai_logs GROUP BY type
  `).all() as Array<{ type: string; count: number }>;

  const byType: Record<string, number> = {};
  for (const row of byTypeRows) {
    byType[row.type] = row.count;
  }

  return {
      totalCalls: stats.total,
      successRate: stats.total > 0 ? Math.round((stats.success_count / stats.total) * 10000) / 100 : 0,
    avgDuration: Math.round(stats.avg_duration || 0),
    avgTokens: Math.round(stats.avg_tokens),
    byType,
  };
}

initAILogTable();