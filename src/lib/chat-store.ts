import Database from 'better-sqlite3';
import path from 'path';
import { getDb } from './db-utils';

const DB_PATH = path.join(process.cwd(), 'data', 'jobs.db');

export interface ChatMessage {
  id?: number;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
}

export interface ChatSession {
  id: number;
  session_id: string;
  user_id?: number;
  title: string;
  job_id?: number;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

export function initChatTables(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT UNIQUE NOT NULL,
      user_id INTEGER,
      title TEXT DEFAULT '新对话',
      job_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id)
    );

    CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);
  `);
}

export function createChatSession(sessionId: string, userId?: number, jobId?: number): ChatSession {
  const db = getDb();
  db.prepare(`
    INSERT INTO chat_sessions (session_id, user_id, job_id)
    VALUES (?, ?, ?)
  `).run(sessionId, userId || null, jobId || null);
  return db.prepare('SELECT * FROM chat_sessions WHERE session_id = ?').get(sessionId) as ChatSession;
}

export function getChatSession(sessionId: string): ChatSession | null {
  const db = getDb();
  const session = db.prepare(`
    SELECT cs.*, COUNT(cm.id) as message_count
    FROM chat_sessions cs
    LEFT JOIN chat_messages cm ON cs.session_id = cm.session_id
    WHERE cs.session_id = ?
    GROUP BY cs.id
  `).get(sessionId) as ChatSession | undefined;
  return session || null;
}

export function getUserChatSessions(userId?: number, limit = 20): ChatSession[] {
  const db = getDb();
  if (userId) {
    return db.prepare(`
      SELECT cs.*, COUNT(cm.id) as message_count
      FROM chat_sessions cs
      LEFT JOIN chat_messages cm ON cs.session_id = cm.session_id
      WHERE cs.user_id = ?
      GROUP BY cs.id
      ORDER BY cs.updated_at DESC
      LIMIT ?
    `).all(userId, limit) as ChatSession[];
  }
  return db.prepare(`
    SELECT cs.*, COUNT(cm.id) as message_count
    FROM chat_sessions cs
    LEFT JOIN chat_messages cm ON cs.session_id = cm.session_id
    GROUP BY cs.id
    ORDER BY cs.updated_at DESC
    LIMIT ?
  `).all(limit) as ChatSession[];
}

export function saveChatMessage(sessionId: string, role: 'user' | 'assistant' | 'system', content: string): ChatMessage {
  const db = getDb();
  db.prepare(`
    INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)
  `).run(sessionId, role, content);
  db.prepare(`UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE session_id = ?`).run(sessionId);
  return db.prepare('SELECT * FROM chat_messages WHERE id = last_insert_rowid()').get() as ChatMessage;
}

export function getChatMessages(sessionId: string, limit = 50): ChatMessage[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM chat_messages
    WHERE session_id = ?
    ORDER BY created_at ASC
    LIMIT ?
  `).all(sessionId, limit) as ChatMessage[];
}

export function updateChatSessionTitle(sessionId: string, title: string): void {
  const db = getDb();
  db.prepare(`UPDATE chat_sessions SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?`)
    .run(title, sessionId);
}

export function deleteChatSession(sessionId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM chat_messages WHERE session_id = ?').run(sessionId);
  db.prepare('DELETE FROM chat_sessions WHERE session_id = ?').run(sessionId);
}

initChatTables();