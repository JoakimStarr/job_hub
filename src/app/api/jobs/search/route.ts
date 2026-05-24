import { NextRequest, NextResponse } from 'next/server';
import { getDb, getSourceName, buildJobWhereClause, resolveSourceUrl, isFakeUrl } from '@/lib/db-utils';
import { logger } from '@/lib/logger';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function highlightKeyword(text: string, keyword: string): string {
  if (!keyword || !text) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const escapedKeyword = escapeHtml(keyword);
  try {
    const regex = new RegExp(`(${escapedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escaped.replace(regex, '<mark>$1</mark>');
  } catch {
    return escaped;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('page_size') || '12');
  const location = searchParams.get('location') || '';
  const jobType = searchParams.get('job_type') || '';
  const industry = searchParams.get('industry') || '';
  const education = searchParams.get('education') || '';
  const sourceParam = searchParams.get('source') || '';
  const sort = searchParams.get('sort') || 'created_at';
  const order = searchParams.get('order') || 'desc';

  try {
    const db = getDb();

    const { whereClause, params } = buildJobWhereClause({
      keyword: q || undefined,
      location: location || undefined,
      jobType: jobType || undefined,
      industry: industry || undefined,
      education: education || undefined,
      source: sourceParam || undefined,
    });
    
    const countSql = `SELECT COUNT(*) as total FROM jobs ${whereClause}`;
    const countResult = db.prepare(countSql).get(...params) as { total: number };
    const total = countResult.total;
    
    const offset = (page - 1) * pageSize;

    const allowedSortFields = ['created_at', 'publish_date', 'updated_at', 'salary'];
    const allowedOrderDirections = ['asc', 'desc'];

    const safeSortField = allowedSortFields.includes(sort) ? sort : 'created_at';
    const safeOrderDirection = allowedOrderDirections.includes(order.toLowerCase()) ? order.toLowerCase() : 'desc';

    const dataSql = `
      SELECT
        id, title, company, location, salary, description, requirements,
        job_type, industry, education, experience, source, university,
        source_url, apply_url, publish_date, deadline, category, tags,
        is_favorite, is_read, created_at, updated_at
      FROM jobs
      ${whereClause}
      ORDER BY ${safeSortField} ${safeOrderDirection}
      LIMIT ? OFFSET ?
    `;
    
    const jobs = db.prepare(dataSql).all(...params, pageSize, offset) as Record<string, unknown>[];
    
    const jobsWithSourceName = jobs.map(job => ({
      ...job,
      source: getSourceName(String(job.source || '')),
      source_url: resolveSourceUrl(String(job.source || ''), job.source_url as string, job.id as number),
      apply_url: (!job.apply_url || isFakeUrl(job.apply_url as string)) ? resolveSourceUrl(String(job.source || ''), job.source_url as string, job.id as number) : job.apply_url,
      title_highlighted: highlightKeyword(String(job.title || ''), q),
      description_highlighted: highlightKeyword(String(job.description || '').slice(0, 200), q),
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
      { error: 'Failed to search jobs' },
      { status: 500 }
    );
  }
}
