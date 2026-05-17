import { NextRequest, NextResponse } from 'next/server';
import { getDb, getSourceName } from '@/lib/db-utils';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const db = getDb();
    const job = db.prepare(`
      SELECT 
        id, title, company, location, salary, description, requirements,
        job_type, industry, education, experience, source, university,
        source_url, apply_url, publish_date, deadline, category, tags,
        is_favorite, is_read, created_at, updated_at
      FROM jobs 
      WHERE id = ?
    `).get(parseInt(id)) as Record<string, unknown> | undefined;
    
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      ...job,
      source: getSourceName(String(job.source || '')),
    });
  } catch (error) {
    logger.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { is_favorite, is_read } = body;
    
    const db = getDb();
    
    const updates: string[] = [];
    const values: any[] = [];
    
    if (is_favorite !== undefined) {
      updates.push('is_favorite = ?');
      values.push(is_favorite ? 1 : 0);
    }
    
    if (is_read !== undefined) {
      updates.push('is_read = ?');
      values.push(is_read ? 1 : 0);
    }
    
    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }
    
    values.push(parseInt(id));
    
    const sql = `UPDATE jobs SET ${updates.join(', ')} WHERE id = ?`;
    const result = db.prepare(sql).run(...values);
    
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to update job' },
      { status: 500 }
    );
  }
}
