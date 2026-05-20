import { NextRequest, NextResponse } from 'next/server';
import { getDb, getSourceName, buildJobWhereClause, resolveSourceUrl, isFakeUrl } from '@/lib/db-utils';
import { logger } from '@/lib/logger';
import { requireAuthUnified } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  try {
    await requireAuthUnified(request);
  } catch {
    return NextResponse.json({ error: '未授权访问，请先登录' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('page_size') || '12');
  const keyword = searchParams.get('keyword') || '';

  try {
    const db = getDb();
    
    const { whereClause, params } = buildJobWhereClause({
      isFavorite: 1,
      keyword: keyword || undefined,
    });
    
    const countSql = `SELECT COUNT(*) as total FROM jobs ${whereClause}`;
    const countResult = db.prepare(countSql).get(...params) as { total: number };
    const total = countResult.total;
    
    const offset = (page - 1) * pageSize;
    const dataSql = `
      SELECT 
        id, title, company, location, salary, description, requirements,
        job_type, industry, education, experience, source, university,
        source_url, apply_url, publish_date, deadline, category, tags,
        is_favorite, is_read, created_at, updated_at
      FROM jobs 
      ${whereClause}
      ORDER BY publish_date DESC, updated_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const jobs = db.prepare(dataSql).all(...params, pageSize, offset) as Record<string, unknown>[];
    
    const jobsWithSourceName = jobs.map(job => ({
      ...job,
      source: getSourceName(String(job.source || '')),
      source_url: resolveSourceUrl(String(job.source || ''), job.source_url as string, job.id as number),
      apply_url: (!job.apply_url || isFakeUrl(job.apply_url as string)) ? resolveSourceUrl(String(job.source || ''), job.source_url as string, job.id as number) : job.apply_url,
    }));
    
    return NextResponse.json({
      items: jobsWithSourceName,
      total,
      page,
      page_size: pageSize,
      pages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    logger.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch favorite jobs' },
      { status: 500 }
    );
  }
}
