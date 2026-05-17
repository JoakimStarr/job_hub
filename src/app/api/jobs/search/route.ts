import { NextRequest, NextResponse } from 'next/server';
import { getDb, getSourceName, getSourceCode } from '@/lib/db-utils';

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

  try {
    const db = getDb();
    
    let whereConditions: string[] = [];
    let params: any[] = [];
    
    if (q) {
      whereConditions.push('(title LIKE ? OR company LIKE ? OR description LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    
    if (location) {
      whereConditions.push('location LIKE ?');
      params.push(`%${location}%`);
    }
    
    if (jobType) {
      whereConditions.push('job_type LIKE ?');
      params.push(`%${jobType}%`);
    }
    
    if (industry) {
      whereConditions.push('industry LIKE ?');
      params.push(`%${industry}%`);
    }
    
    if (education) {
      whereConditions.push('education LIKE ?');
      params.push(`%${education}%`);
    }
    
    if (sourceParam) {
      const sourceCode = getSourceCode(sourceParam);
      whereConditions.push('source = ?');
      params.push(sourceCode);
    }
    
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';
    
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
      ORDER BY created_at DESC
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
      { error: 'Failed to search jobs' },
      { status: 500 }
    );
  }
}
