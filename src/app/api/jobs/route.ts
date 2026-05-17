import { NextRequest, NextResponse } from 'next/server';
import { getDb, getSourceName, getSourceCode } from '@/lib/db-utils';
import { createErrorResponse, handleApiError, validatePagination } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import type { JobItem, PagedResponse } from '@/types';

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 12;

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const searchParams = request.nextUrl.searchParams;
  const path = '/api/jobs';
  
  try {
    const rawPage = parseInt(searchParams.get('page') || '1');
    const rawPageSize = parseInt(searchParams.get('page_size') || String(DEFAULT_PAGE_SIZE));
    const { page, pageSize } = validatePagination(rawPage, rawPageSize, MAX_PAGE_SIZE);
    
    const location = searchParams.get('location') || '';
    const keyword = searchParams.get('keyword') || '';
    const jobType = searchParams.get('job_type') || '';
    const industry = searchParams.get('industry') || '';
    const education = searchParams.get('education') || '';
    const sourceParam = searchParams.get('source') || '';
    const isFavorite = searchParams.get('is_favorite');

    const db = getDb();
    
    try {
      let whereConditions: string[] = [];
      let params: unknown[] = [];
      
      if (location) {
        whereConditions.push('location LIKE ?');
        params.push(`%${location}%`);
      }
      
      if (keyword) {
        whereConditions.push('(title LIKE ? OR company LIKE ? OR description LIKE ?)');
        params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
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
      
      if (isFavorite !== null && isFavorite !== '') {
        whereConditions.push('is_favorite = ?');
        params.push(parseInt(isFavorite));
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
      
      const jobs = db.prepare(dataSql).all(...params, pageSize, offset) as JobItem[];
      
      const jobsWithSourceName = jobs.map(job => ({
        ...job,
        source: getSourceName(String(job.source || '')),
      }));
      
      const response: PagedResponse<JobItem> = {
        items: jobsWithSourceName,
        total,
        page,
        page_size: pageSize,
        pages: Math.ceil(total / pageSize),
      };
      
      logger.api('GET', path, 200, Date.now() - startTime, {
        total,
        page,
        pageSize,
        filters: { location, keyword, jobType, industry, education, source: sourceParam },
      });
      
      return NextResponse.json(response);
    } finally {
      // Database connection is managed by singleton, no need to close
    }
  } catch (error) {
    logger.error('Failed to fetch jobs', error, { path });
    return handleApiError(error, { path });
  }
}
