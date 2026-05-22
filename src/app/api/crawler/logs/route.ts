import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { requirePermissionUnified } from '@/lib/auth-server';
import { AuthError } from '@/lib/auth';
import { logger } from '@/lib/logger';
import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'log');

interface LogEntry {
  time: string;
  timestamp: string;
  level: string;
  message: string;
  source?: string;
}

export async function GET(request: Request) {
  const startTime = Date.now();
  const apiPath = '/api/crawler/logs';

  try {
    await requirePermissionUnified(request as any, 'crawler:read');

    const { searchParams } = new URL(request.url);
    const rawLimit = searchParams.get('limit');
    const limit = Math.min(Math.max(parseInt(rawLimit || '50', 10) || 50, 1), 200);

    if (!fs.existsSync(LOG_DIR)) {
      logger.api('GET', apiPath, 200, Date.now() - startTime, { logCount: 0 });
      return NextResponse.json([]);
    }

    const files = fs
      .readdirSync(LOG_DIR)
      .filter((f) => f.endsWith('.log'))
      .map((f) => ({
        name: f,
        mtime: fs.statSync(path.join(LOG_DIR, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length === 0) {
      logger.api('GET', apiPath, 200, Date.now() - startTime, { logCount: 0 });
      return NextResponse.json([]);
    }

    const latestFile = path.join(LOG_DIR, files[0].name);
    const content = fs.readFileSync(latestFile, 'utf-8');
    const lines = content.split('\n').filter((l) => l.trim());

    const logPattern = /^\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})\]?\s*[\|]?\s*\[(\w+)\]\s*[\|]?\s*(.+)$/;
    const altPattern = /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})\s*[\|]\s*(\w+)\s*[\|]\s*(.+)$/;

    const entries: LogEntry[] = [];

    for (let i = lines.length - 1; i >= 0 && entries.length < limit; i--) {
      const line = lines[i].trim();
      if (!line) continue;

      const match = line.match(logPattern) || line.match(altPattern);
      if (match) {
        entries.unshift({
          time: match[1],
          timestamp: match[1],
          level: match[2].toUpperCase(),
          message: match[3],
          source: files[0].name,
        });
      }
    }

    logger.api('GET', apiPath, 200, Date.now() - startTime, { logCount: entries.length });

    return NextResponse.json(entries);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('Failed to read crawler logs', error, { path: apiPath });
    return handleApiError(error, { path: apiPath });
  }
}
