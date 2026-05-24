import { NextRequest, NextResponse } from 'next/server';
import { getDb, splitMultiDelimiter } from '@/lib/db-utils';
import { requirePermissionUnified } from '@/lib/auth-server';
import { AuthError } from '@/lib/auth';
import { logger } from '@/lib/logger';

function initSubscriptionsTable(db: ReturnType<typeof getDb>) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      keyword TEXT,
      locations TEXT,
      industries TEXT,
      job_types TEXT,
      education TEXT,
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function GET() {
  try {
    const db = getDb();
    initSubscriptionsTable(db);

    const subscriptions = db.prepare(`
      SELECT id, name, keyword, locations, industries, job_types, education, enabled
      FROM subscriptions
      ORDER BY created_at DESC
    `).all() as {
      id: number;
      name: string;
      keyword: string | null;
      locations: string | null;
      industries: string | null;
      job_types: string | null;
      education: string | null;
      enabled: number;
    }[];

    const result = subscriptions.map(item => ({
      id: item.id,
      name: item.name,
      keyword: item.keyword || undefined,
      locations: splitMultiDelimiter(item.locations),
      industries: splitMultiDelimiter(item.industries),
      job_types: splitMultiDelimiter(item.job_types),
      education: item.education || undefined,
      enabled: item.enabled === 1,
    }));

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermissionUnified(request, 'system:write');

    const body = await request.json();
    const { name, keyword, locations, industries, job_types, education, enabled } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const db = getDb();
    initSubscriptionsTable(db);

    const result = db.prepare(`
      INSERT INTO subscriptions (name, keyword, locations, industries, job_types, education, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      keyword || null,
      Array.isArray(locations) ? locations.join(',') : (locations || null),
      Array.isArray(industries) ? industries.join(',') : (industries || null),
      Array.isArray(job_types) ? job_types.join(',') : (job_types || null),
      education || null,
      enabled !== false ? 1 : 0
    );

    const newId = result.lastInsertRowid;

    return NextResponse.json({
      id: newId,
      name,
      keyword,
      locations: splitMultiDelimiter(locations),
      industries: splitMultiDelimiter(industries),
      job_types: splitMultiDelimiter(job_types),
      education,
      enabled: enabled !== false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}
