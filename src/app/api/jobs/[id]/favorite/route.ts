import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db-utils';
import { requireAuthUnified } from '@/lib/auth-server';
import { AuthError } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireAuthUnified(request);

    const db = getDb();
    
    const job = db.prepare('SELECT is_favorite FROM jobs WHERE id = ?').get(parseInt(id)) as { is_favorite: number } | undefined;
    
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    
    const newFavoriteState = job.is_favorite ? 0 : 1;
    
    db.prepare('UPDATE jobs SET is_favorite = ?, updated_at = ? WHERE id = ?').run(newFavoriteState, new Date().toISOString(), parseInt(id));
    
    return NextResponse.json({ 
      success: true, 
      message: 'Favorite status updated',
      data: { is_favorite: newFavoriteState === 1 }
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to toggle favorite' },
      { status: 500 }
    );
  }
}
