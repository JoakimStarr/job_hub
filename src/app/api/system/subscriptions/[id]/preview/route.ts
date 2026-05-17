import { NextRequest, NextResponse } from 'next/server';
import { getDb, buildJobWhereClause } from '@/lib/db-utils';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const db = getDb();

    const subscription = db.prepare(`
      SELECT id, name, keyword, locations, industries, job_types, education
      FROM subscriptions
      WHERE id = ?
    `).get(parseInt(id)) as {
      id: number;
      name: string;
      keyword: string | null;
      locations: string | null;
      industries: string | null;
      job_types: string | null;
      education: string | null;
    } | undefined;

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    const { whereClause, params } = buildJobWhereClause({
      keyword: subscription.keyword || undefined,
      keywordFields: ['title', 'description'],
      multiLocation: subscription.locations ? subscription.locations.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      multiIndustry: subscription.industries ? subscription.industries.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      multiJobType: subscription.job_types ? subscription.job_types.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      education: subscription.education || undefined,
    });

    const jobs = db.prepare(`
      SELECT
        id, title, company, location, salary, description, requirements,
        job_type, industry, education, experience, source, university,
        source_url, apply_url, publish_date, deadline, category, tags,
        is_favorite, is_read, created_at, updated_at
      FROM jobs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT 20
    `).all(...params) as Record<string, unknown>[];

    return NextResponse.json(jobs);
  } catch (error) {
    logger.error('Subscription preview error:', error);
    return NextResponse.json(
      { error: 'Failed to preview subscription' },
      { status: 500 }
    );
  }
}
