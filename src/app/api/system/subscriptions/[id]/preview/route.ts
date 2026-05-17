import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'jobs.db');

function getDb(): Database.Database {
  return new Database(DB_PATH, { readonly: true, fileMustExist: false });
}

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
      db.close();
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }
    
    let whereConditions: string[] = [];
    let params: unknown[] = [];
    
    if (subscription.keyword) {
      whereConditions.push('(title LIKE ? OR description LIKE ?)');
      params.push(`%${subscription.keyword}%`, `%${subscription.keyword}%`);
    }
    
    if (subscription.locations) {
      const locations = subscription.locations.split(',').map(s => s.trim()).filter(Boolean);
      if (locations.length > 0) {
        const locationConditions = locations.map(() => 'location LIKE ?').join(' OR ');
        whereConditions.push(`(${locationConditions})`);
        params.push(...locations.map(l => `%${l}%`));
      }
    }
    
    if (subscription.industries) {
      const industries = subscription.industries.split(',').map(s => s.trim()).filter(Boolean);
      if (industries.length > 0) {
        const industryConditions = industries.map(() => 'industry LIKE ?').join(' OR ');
        whereConditions.push(`(${industryConditions})`);
        params.push(...industries.map(i => `%${i}%`));
      }
    }
    
    if (subscription.job_types) {
      const jobTypes = subscription.job_types.split(',').map(s => s.trim()).filter(Boolean);
      if (jobTypes.length > 0) {
        const jobTypeConditions = jobTypes.map(() => 'job_type LIKE ?').join(' OR ');
        whereConditions.push(`(${jobTypeConditions})`);
        params.push(...jobTypes.map(jt => `%${jt}%`));
      }
    }
    
    if (subscription.education) {
      whereConditions.push('education LIKE ?');
      params.push(`%${subscription.education}%`);
    }
    
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';
    
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
    
    db.close();
    
    return NextResponse.json(jobs);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to preview subscription' },
      { status: 500 }
    );
  }
}
