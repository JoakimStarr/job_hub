import { getDb } from './db-utils';
import { aiService, cosineSimilarity } from './ai-service';
import { logger } from './logger';

interface JobEmbedding {
  id: number;
  job_id: number;
  embedding: number[];
  created_at: string;
}

interface JobEmbeddingRow {
  id: number;
  job_id: number;
  embedding: string;
  created_at: string;
}

interface SemanticSearchResult {
  job_id: number;
  title: string;
  company: string;
  description: string;
  requirements: string;
  location: string;
  salary: string;
  score: number;
}

export interface KnowledgeItem {
  type: 'company' | 'industry' | 'position' | 'skill' | 'general';
  title: string;
  content: string;
  source?: string;
}

export function initEmbeddingTables(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS job_embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER UNIQUE NOT NULL,
      embedding TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_job_embeddings_job_id ON job_embeddings(job_id);

    CREATE TABLE IF NOT EXISTS knowledge_base (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'general',
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      source TEXT,
      embedding TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge_base(type);
  `);
}

export async function generateJobEmbedding(job: {
  id: number;
  title: string;
  company: string;
  description: string;
  requirements: string;
  location?: string;
  industry?: string;
}): Promise<boolean> {
  if (!aiService) return false;

  const text = [
    `职位：${job.title}`,
    `公司：${job.company}`,
    job.location ? `地点：${job.location}` : '',
    job.industry ? `行业：${job.industry}` : '',
    `描述：${(job.description || '').slice(0, 1000)}`,
    `要求：${(job.requirements || '').slice(0, 500)}`,
  ].filter(Boolean).join('\n');

  try {
    const result = await aiService.embedding(text);
    const embeddingJson = JSON.stringify(result.embedding);

    const db = getDb();
    db.prepare(`
      INSERT INTO job_embeddings (job_id, embedding)
      VALUES (?, ?)
      ON CONFLICT(job_id) DO UPDATE SET embedding = ?, created_at = CURRENT_TIMESTAMP
    `).run(job.id, embeddingJson, embeddingJson);

    return true;
  } catch (error) {
    logger.error(`生成职位嵌入向量失败 [${job.id}]`, error);
    return false;
  }
}

export async function batchGenerateEmbeddings(limit = 100): Promise<{ success: number; failed: number }> {
  if (!aiService) return { success: 0, failed: 0 };

  const db = getDb();
  const jobs = db.prepare(`
    SELECT j.id, j.title, j.company, j.description, j.requirements, j.location, j.industry
    FROM jobs j
    LEFT JOIN job_embeddings je ON j.id = je.job_id
    WHERE je.id IS NULL
    LIMIT ?
  `).all(limit) as Array<{
    id: number; title: string; company: string;
    description: string; requirements: string;
    location?: string; industry?: string;
  }>;

  let success = 0;
  let failed = 0;

  for (const job of jobs) {
    const ok = await generateJobEmbedding(job);
    if (ok) success++;
    else failed++;
  }

  logger.info(`批量生成嵌入向量: ${success} 成功, ${failed} 失败`);
  return { success, failed };
}

export async function semanticSearch(query: string, topK = 10): Promise<SemanticSearchResult[]> {
  if (!aiService) {
    logger.warn('AI 服务未配置，无法执行语义搜索');
    return [];
  }

  let queryEmbedding: number[];
  try {
    const result = await aiService.embedding(query);
    queryEmbedding = result.embedding;
  } catch (error) {
    logger.error('生成查询嵌入向量失败', error);
    return [];
  }

  const db = getDb();
  const rows = db.prepare(`
    SELECT je.job_id, je.embedding, j.title, j.company, j.description, j.requirements, j.location, j.salary
    FROM job_embeddings je
    JOIN jobs j ON je.job_id = j.id
  `).all() as Array<{
    job_id: number;
    embedding: string;
    title: string;
    company: string;
    description: string;
    requirements: string;
    location: string;
    salary: string;
  }>;

  const scored: Array<SemanticSearchResult & { score: number }> = [];

  for (const row of rows) {
    try {
      const embedding: number[] = JSON.parse(row.embedding);
      const score = cosineSimilarity(queryEmbedding, embedding);
      if (score > 0.3) {
        scored.push({
          job_id: row.job_id,
          title: row.title,
          company: row.company,
          description: row.description,
          requirements: row.requirements,
          location: row.location,
          salary: row.salary,
          score: Math.round(score * 1000) / 1000,
        });
      }
    } catch {
      continue;
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, topK);
}

export function buildRAGContext(jobId?: number, query?: string): KnowledgeItem[] {
  const items: KnowledgeItem[] = [];
  const db = getDb();

  if (jobId) {
    const job = db.prepare(`
      SELECT title, company, description, requirements, location, salary, industry, job_type, education, experience
      FROM jobs WHERE id = ?
    `).get(jobId) as Record<string, string> | undefined;

    if (job) {
      items.push({
        type: 'position',
        title: `${job.company} - ${job.title}`,
        content: [
          `公司：${job.company}`,
          `职位：${job.title}`,
          `地点：${job.location || '未知'}`,
          `薪资：${job.salary || '面议'}`,
          `行业：${job.industry || '未知'}`,
          `类型：${job.job_type || '未知'}`,
          `学历要求：${job.education || '不限'}`,
          `经验要求：${job.experience || '不限'}`,
          `\n职位描述：\n${job.description || '无'}`,
          `\n任职要求：\n${job.requirements || '无'}`,
        ].join('\n'),
      });

      if (job.company) {
        const companyJobs = db.prepare(`
          SELECT COUNT(*) as count FROM jobs WHERE company = ?
        `).get(job.company) as { count: number };
        items.push({
          type: 'company',
          title: `公司概况：${job.company}`,
          content: `${job.company} 在本平台共有 ${companyJobs.count} 个在招岗位。`,
        });
      }

      if (job.industry) {
        const industryJobs = db.prepare(`
          SELECT COUNT(*) as count FROM jobs WHERE industry LIKE ?
        `).get(`%${job.industry}%`) as { count: number };
        items.push({
          type: 'industry',
          title: `行业概况：${job.industry}`,
          content: `${job.industry}行业在本平台共有 ${industryJobs.count} 个在招岗位。`,
        });
      }
    }
  }

  if (query) {
    const allJobs = db.prepare(`
      SELECT COUNT(*) as count FROM jobs
    `).get() as { count: number };
    items.push({
      type: 'general',
      title: '平台概况',
      content: `本平台现有 ${allJobs.count} 个金融实习/招聘岗位，数据来源于国内知名财经院校就业信息网。`,
    });
  }

  return items;
}

export function buildRAGPrompt(items: KnowledgeItem[]): string {
  if (items.length === 0) return '';
  return items.map(item => 
    `【${item.type === 'company' ? '企业信息' : item.type === 'industry' ? '行业信息' : item.type === 'position' ? '职位详情' : '平台信息'}】${item.title}\n${item.content}`
  ).join('\n\n');
}

initEmbeddingTables();