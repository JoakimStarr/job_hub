import { getDb } from './db-utils';
import { logger } from './logger';

export interface JobAlert {
  id: number;
  email: string;
  keywords: string[];
  sources: string[];
  locations: string[];
  industries: string[];
  min_salary?: string;
  education?: string;
  enabled: boolean;
  last_notified_at?: string;
  notify_count: number;
  created_at: string;
}

export interface AlertHistory {
  id: number;
  alert_id: number;
  job_ids: number[];
  matched_count: number;
  email_sent: boolean;
  error_message?: string;
  created_at: string;
}

export function initJobAlertsTables(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_job_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      keywords TEXT NOT NULL,
      sources TEXT,
      locations TEXT,
      industries TEXT,
      min_salary TEXT,
      education TEXT,
      enabled INTEGER DEFAULT 1,
      last_notified_at TEXT,
      notify_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS job_alert_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_id INTEGER NOT NULL,
      job_ids TEXT NOT NULL,
      matched_count INTEGER DEFAULT 0,
      email_sent INTEGER DEFAULT 0,
      error_message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_job_alerts_email ON user_job_alerts(email)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_job_alerts_enabled ON user_job_alerts(enabled)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_alert_history_alert_id ON job_alert_history(alert_id)`);

  logger.info('Job alerts tables initialized');
}

export function getAllEnabledAlerts(): JobAlert[] {
  initJobAlertsTables();
  const db = getDb();

  const rows = db.prepare(`
    SELECT id, email, keywords, sources, locations, industries, min_salary, education,
           enabled, last_notified_at, notify_count, created_at
    FROM user_job_alerts
    WHERE enabled = 1
    ORDER BY created_at DESC
  `).all() as Record<string, unknown>[];

  return rows.map(row => ({
    id: row.id as number,
    email: row.email as string,
    keywords: JSON.parse(row.keywords as string || '[]'),
    sources: JSON.parse(row.sources as string || '[]'),
    locations: JSON.parse(row.locations as string || '[]'),
    industries: JSON.parse(row.industries as string || '[]'),
    min_salary: row.min_salary as string | undefined,
    education: row.education as string | undefined,
    enabled: row.enabled === 1,
    last_notified_at: row.last_notified_at as string | undefined,
    notify_count: row.notify_count as number,
    created_at: row.created_at as string,
  }));
}

export function getAllAlerts(): JobAlert[] {
  initJobAlertsTables();
  const db = getDb();

  const rows = db.prepare(`
    SELECT id, email, keywords, sources, locations, industries, min_salary, education,
           enabled, last_notified_at, notify_count, created_at
    FROM user_job_alerts
    ORDER BY created_at DESC
  `).all() as Record<string, unknown>[];

  return rows.map(row => ({
    id: row.id as number,
    email: row.email as string,
    keywords: JSON.parse(row.keywords as string || '[]'),
    sources: JSON.parse(row.sources as string || '[]'),
    locations: JSON.parse(row.locations as string || '[]'),
    industries: JSON.parse(row.industries as string || '[]'),
    min_salary: row.min_salary as string | undefined,
    education: row.education as string | undefined,
    enabled: row.enabled === 1,
    last_notified_at: row.last_notified_at as string | undefined,
    notify_count: row.notify_count as number,
    created_at: row.created_at as string,
  }));
}

export function createAlert(alert: Omit<JobAlert, 'id' | 'notify_count' | 'created_at'>): JobAlert {
  initJobAlertsTables();
  const db = getDb();

  const result = db.prepare(`
    INSERT INTO user_job_alerts (email, keywords, sources, locations, industries, min_salary, education, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    alert.email,
    JSON.stringify(alert.keywords),
    JSON.stringify(alert.sources || []),
    JSON.stringify(alert.locations || []),
    JSON.stringify(alert.industries || []),
    alert.min_salary || null,
    alert.education || null,
    alert.enabled !== false ? 1 : 0
  );

  return {
    id: result.lastInsertRowid as number,
    ...alert,
    notify_count: 0,
    created_at: new Date().toISOString(),
  };
}

export function updateAlert(id: number, updates: Partial<JobAlert>): boolean {
  initJobAlertsTables();
  const db = getDb();

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.email !== undefined) {
    fields.push('email = ?');
    values.push(updates.email);
  }
  if (updates.keywords !== undefined) {
    fields.push('keywords = ?');
    values.push(JSON.stringify(updates.keywords));
  }
  if (updates.sources !== undefined) {
    fields.push('sources = ?');
    values.push(JSON.stringify(updates.sources));
  }
  if (updates.locations !== undefined) {
    fields.push('locations = ?');
    values.push(JSON.stringify(updates.locations));
  }
  if (updates.industries !== undefined) {
    fields.push('industries = ?');
    values.push(JSON.stringify(updates.industries));
  }
  if (updates.min_salary !== undefined) {
    fields.push('min_salary = ?');
    values.push(updates.min_salary);
  }
  if (updates.education !== undefined) {
    fields.push('education = ?');
    values.push(updates.education);
  }
  if (updates.enabled !== undefined) {
    fields.push('enabled = ?');
    values.push(updates.enabled ? 1 : 0);
  }

  if (fields.length === 0) return false;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  const result = db.prepare(`UPDATE user_job_alerts SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return result.changes > 0;
}

export function deleteAlert(id: number): boolean {
  initJobAlertsTables();
  const db = getDb();
  const result = db.prepare('DELETE FROM user_job_alerts WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getAlertById(id: number): JobAlert | null {
  initJobAlertsTables();
  const db = getDb();

  const row = db.prepare(`
    SELECT id, email, keywords, sources, locations, industries, min_salary, education,
           enabled, last_notified_at, notify_count, created_at
    FROM user_job_alerts
    WHERE id = ?
  `).get(id) as Record<string, unknown> | undefined;

  if (!row) return null;

  return {
    id: row.id as number,
    email: row.email as string,
    keywords: JSON.parse(row.keywords as string || '[]'),
    sources: JSON.parse(row.sources as string || '[]'),
    locations: JSON.parse(row.locations as string || '[]'),
    industries: JSON.parse(row.industries as string || '[]'),
    min_salary: row.min_salary as string | undefined,
    education: row.education as string | undefined,
    enabled: row.enabled === 1,
    last_notified_at: row.last_notified_at as string | undefined,
    notify_count: row.notify_count as number,
    created_at: row.created_at as string,
  };
}

export function disableAlert(id: number): boolean {
  initJobAlertsTables();
  const db = getDb();
  
  const result = db.prepare(`
    UPDATE user_job_alerts 
    SET enabled = 0, updated_at = datetime('now')
    WHERE id = ?
  `).run(id);
  
  return result.changes > 0;
}

export function enableAlert(id: number): boolean {
  initJobAlertsTables();
  const db = getDb();
  
  const result = db.prepare(`
    UPDATE user_job_alerts 
    SET enabled = 1, updated_at = datetime('now')
    WHERE id = ?
  `).run(id);
  
  return result.changes > 0;
}

export function recordAlertHistory(alertId: number, jobIds: number[], emailSent: boolean, errorMessage?: string): void {
  initJobAlertsTables();
  const db = getDb();

  db.prepare(`
    INSERT INTO job_alert_history (alert_id, job_ids, matched_count, email_sent, error_message)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    alertId,
    JSON.stringify(jobIds),
    jobIds.length,
    emailSent ? 1 : 0,
    errorMessage || null
  );

  db.prepare(`
    UPDATE user_job_alerts
    SET last_notified_at = datetime('now'), notify_count = notify_count + 1
    WHERE id = ?
  `).run(alertId);
}

export function getAlertHistory(alertId?: number, limit: number = 50): AlertHistory[] {
  initJobAlertsTables();
  const db = getDb();

  const query = alertId
    ? `SELECT * FROM job_alert_history WHERE alert_id = ? ORDER BY created_at DESC LIMIT ?`
    : `SELECT * FROM job_alert_history ORDER BY created_at DESC LIMIT ?`;

  const params = alertId ? [alertId, limit] : [limit];

  const rows = db.prepare(query).all(...params) as Record<string, unknown>[];

  return rows.map(row => ({
    id: row.id as number,
    alert_id: row.alert_id as number,
    job_ids: JSON.parse(row.job_ids as string || '[]'),
    matched_count: row.matched_count as number,
    email_sent: row.email_sent === 1,
    error_message: row.error_message as string | undefined,
    created_at: row.created_at as string,
  }));
}
