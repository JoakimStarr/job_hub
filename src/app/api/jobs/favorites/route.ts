import { NextRequest, NextResponse } from 'next/server';
import { getDb, getSourceName } from '@/lib/db-utils';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('page_size') || '12');
  const keyword = searchParams.get('keyword') || '';

  try {
    const db = getDb();
    
    let whereClause = 'WHERE is_favorite = 1';
    let params: any[] = [];
    
    if (keyword) {
      whereClause += ' AND (title LIKE ? OR company LIKE ? OR description LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    
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
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const jobs = db.prepare(dataSql).all(...params, pageSize, offset) as Record<string, unknown>[];
    
    const jobsWithSourceName = jobs.map(job => ({
      ...job,
      source: getSourceName(String(job.source || '')),
    }));
    
    return NextResponse.json({
      items: jobsWithSourceName,
      total,
      page,
      page_size: pageSize,
      pages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch favorite jobs' },
      { status: 500 }
    );
  }
}
