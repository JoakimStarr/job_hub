import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db-utils';
import { requirePermission, AuthError } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    requirePermission(request, 'system:write');

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '500');

    const db = getDb();

    const countResult = db.prepare('SELECT COUNT(*) as count FROM jobs').get() as { count: number };
    const totalBefore = countResult.count;

    const result = db.prepare(`
      DELETE FROM jobs 
      WHERE id IN (
        SELECT id FROM jobs 
        ORDER BY created_at ASC 
        LIMIT ?
      )
    `).run(limit);

    const countAfter = db.prepare('SELECT COUNT(*) as count FROM jobs').get() as { count: number };

    return NextResponse.json({
      success: true,
      deleted: result.changes,
      total_before: totalBefore,
      total_after: countAfter.count,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to clean historical data' },
      { status: 500 }
    );
  }
}
