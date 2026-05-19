import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db-utils';
import { requirePermissionUnified } from '@/lib/auth-server';
import { AuthError } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    requirePermissionUnified(request, 'system:write');

    const body = await request.json();
    const { name, keyword, locations, industries, job_types, education, enabled } = body;

    const db = getDb();

    const updates: string[] = [];
    const values: unknown[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (keyword !== undefined) {
      updates.push('keyword = ?');
      values.push(keyword || null);
    }
    if (locations !== undefined) {
      updates.push('locations = ?');
      values.push(Array.isArray(locations) ? locations.join(',') : (locations || null));
    }
    if (industries !== undefined) {
      updates.push('industries = ?');
      values.push(Array.isArray(industries) ? industries.join(',') : (industries || null));
    }
    if (job_types !== undefined) {
      updates.push('job_types = ?');
      values.push(Array.isArray(job_types) ? job_types.join(',') : (job_types || null));
    }
    if (education !== undefined) {
      updates.push('education = ?');
      values.push(education || null);
    }
    if (enabled !== undefined) {
      updates.push('enabled = ?');
      values.push(enabled ? 1 : 0);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(parseInt(id));

    const sql = `UPDATE subscriptions SET ${updates.join(', ')} WHERE id = ?`;
    const result = db.prepare(sql).run(...values);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to update subscription' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    requirePermissionUnified(request, 'system:write');

    const db = getDb();

    const result = db.prepare('DELETE FROM subscriptions WHERE id = ?').run(parseInt(id));

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to delete subscription' },
      { status: 500 }
    );
  }
}
