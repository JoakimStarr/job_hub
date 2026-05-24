import { getDb, initSubscriptionAnalysisTables, cleanupOldAnalyses, computeSubscriptionHash, getLastAnalysis, getMaxJobId } from './db-utils';
import { matchEngine } from './match-engine';
import { scoreEngine } from './score-engine';
import type { ResumeProfile, JobItem } from './resume-types';
import type { AIMessage, AIResponse } from './ai-service';

export interface SubscriptionCondition {
  id: number;
  name: string;
  keyword?: string | null;
  locations?: string[] | null;
  industries?: string[] | null;
  job_types?: string[] | null;
  education?: string | null;
}

export interface AnalysisResult {
  analysis_id: number;
  status: 'completed' | 'running' | 'failed' | 'cached';
  summary: {
    total_scanned: number;
    new_jobs: number;
    matched: number;
    ai_summary?: string;
  };
  results: AnalysisJobResult[];
  cached_at?: string;
}

export interface AnalysisJobResult {
  job_id: number;
  title: string;
  company: string;
  location: string;
  salary: string;
  education: string;
  match_score: number;
  skill_match: number;
  education_match: number;
  location_match: number;
  ai_reasoning?: string;
  ai_suggestions?: string;
  is_new: boolean;
}

export interface SubscriptionAnalyzerConfig {
  aiService: {
    chat(messages: AIMessage[]): Promise<AIResponse>;
  } | null;
  maxJobsPerAnalysis?: number;
}

const DEFAULT_CONFIG: Required<Pick<SubscriptionAnalyzerConfig, 'maxJobsPerAnalysis'>> = {
  maxJobsPerAnalysis: 500,
};

export class SubscriptionAnalyzer {
  private config: SubscriptionAnalyzerConfig;

  constructor(config: SubscriptionAnalyzerConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async preview(subscription: SubscriptionCondition, forceRefresh = false): Promise<AnalysisResult> {
    const db = getDb();
    initSubscriptionAnalysisTables(db);

    const currentHash = computeSubscriptionHash(subscription);
    const lastAnalysis = getLastAnalysis(db, subscription.id);
    const maxJobId = getMaxJobId(db);

    // 检查是否可以使用缓存
    if (!forceRefresh && lastAnalysis && lastAnalysis.status === 'completed') {
      if (lastAnalysis.analysis_hash === currentHash && maxJobId <= (lastAnalysis.last_job_id_analyzed || 0)) {
        // 条件未变且无新数据，返回缓存
        return this.getCachedResults(db, lastAnalysis.id);
      }
    }

    // 创建新的分析记录
    const analysisId = this.createAnalysisRecord(db, subscription.id, currentHash);

    try {
      // 更新状态为 running
      db.prepare('UPDATE subscription_analyses SET status = ? WHERE id = ?').run('running', analysisId);

      // 确定扫描范围
      let startJobId = 0;
      if (!forceRefresh && lastAnalysis && lastAnalysis.analysis_hash === currentHash) {
        startJobId = lastAnalysis.last_job_id_analyzed || 0;
      }

      // 获取待分析的岗位
      const jobsToAnalyze = this.getJobsToAnalyze(db, subscription, startJobId);

      // 统计信息
      const totalScanned = jobsToAnalyze.length;
      const newJobsCount = startJobId > 0 ? jobsToAnalyze.length : totalScanned;

      // 执行匹配和分析
      const matchedResults = await this.analyzeJobs(jobsToAnalyze, subscription);

      // 存储结果
      this.storeResults(db, analysisId, matchedResults);

      // AI 摘要生成
      let aiSummary = '';
      let aiModel = '';
      let tokensUsed = 0;

      if (this.config.aiService && matchedResults.length > 0) {
        try {
          const summaryResult = await this.generateAISummary(matchedResults.slice(0, 10), subscription);
          aiSummary = summaryResult.content;
          aiModel = summaryResult.model;
          tokensUsed = summaryResult.usage?.total_tokens || 0;
        } catch (e) {
          console.error('AI摘要生成失败:', e);
        }
      }

      // 更新分析记录
      db.prepare(`
        UPDATE subscription_analyses SET 
          status = ?, 
          analyzed_at = CURRENT_TIMESTAMP,
          total_jobs_scanned = ?,
          new_jobs_count = ?,
          matched_jobs_count = ?,
          last_job_id_analyzed = ?,
          ai_summary = ?,
          ai_model = ?,
          tokens_used = ?
        WHERE id = ?
      `).run(
        'completed',
        totalScanned,
        newJobsCount,
        matchedResults.length,
        maxJobId,
        aiSummary,
        aiModel,
        tokensUsed,
        analysisId
      );

      // 清理过期历史
      cleanupOldAnalyses(db, subscription.id);

      return {
        analysis_id: analysisId,
        status: 'completed',
        summary: {
          total_scanned: totalScanned,
          new_jobs: newJobsCount,
          matched: matchedResults.length,
          ai_summary: aiSummary || undefined,
        },
        results: matchedResults.map(r => ({ ...r, is_new: r.job_id > (startJobId || 0) })),
      };

    } catch (error) {
      db.prepare('UPDATE subscription_analyses SET status = ?, error_message = ? WHERE id = ?')
        .run('failed', error instanceof Error ? error.message : String(error), analysisId);

      throw error;
    }
  }

  private createAnalysisRecord(db: ReturnType<typeof getDb>, subscriptionId: number, hash: string): number {
    const result = db.prepare(
      'INSERT INTO subscription_analyses (subscription_id, analysis_hash, status) VALUES (?, ?, ?)'
    ).run(subscriptionId, hash, 'pending');
    return result.lastInsertRowid as number;
  }

  private getJobsToAnalyze(db: ReturnType<typeof getDb>, subscription: SubscriptionCondition, startJobId: number): JobItem[] {
    const conditions: string[] = [];
    const params: any[] = [];

    if (startJobId > 0) {
      conditions.push('j.id > ?');
      params.push(startJobId);
    }

    // 关键词搜索
    if (subscription.keyword) {
      conditions.push('(j.title LIKE ? OR j.company LIKE ? OR j.description LIKE ? OR j.requirements LIKE ?)');
      const kw = `%${subscription.keyword}%`;
      params.push(kw, kw, kw, kw);
    }

    // 地点筛选
    if (subscription.locations && subscription.locations.length > 0) {
      const locConditions = subscription.locations.map(() => 'j.location LIKE ?').join(' OR ');
      conditions.push(`(${locConditions})`);
      subscription.locations.forEach(loc => params.push(`%${loc}%`));
    }

    // 行业筛选
    if (subscription.industries && subscription.industries.length > 0) {
      const indConditions = subscription.industries.map(() => 'j.industry LIKE ?').join(' OR ');
      conditions.push(`(${indConditions})`);
      subscription.industries.forEach(ind => params.push(`%${ind}%`));
    }

    // 学历筛选
    if (subscription.education) {
      conditions.push('(j.education LIKE ? OR j.education IS NULL)');
      params.push(`%${subscription.education}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT j.* FROM jobs j ${whereClause}
      ORDER BY j.publish_date DESC, j.id DESC
      LIMIT ?
    `;
    params.push(this.config.maxJobsPerAnalysis!);

    return db.prepare(sql).all(...params) as JobItem[];
  }

  private async analyzeJobs(jobs: JobItem[], subscription: SubscriptionCondition): Promise<AnalysisJobResult[]> {
    // 将订阅条件转换为伪简历画像用于匹配
    const profile = this.subscriptionToProfile(subscription);

    const results: AnalysisJobResult[] = [];

    for (const job of jobs) {
      try {
        // 本地规则匹配
        const matchScore = matchEngine.match(profile, job);
        
        // 只保留匹配度 > 30 的岗位（有基本相关性）
        if (matchScore.total < 30) continue;

        results.push({
          job_id: job.id!,
          title: job.title,
          company: job.company,
          location: job.location || '',
          salary: job.salary || '面议',
          education: job.education || '',
          match_score: matchScore.total,
          skill_match: matchScore.breakdown.skills,
          education_match: matchScore.breakdown.education,
          location_match: matchScore.breakdown.location,
        });
      } catch (e) {
        console.error(`分析岗位 ${job.id} 失败:`, e);
      }
    }

    // 按 match_score 降序排序
    results.sort((a, b) => b.match_score - a.match_score);

    // AI 深度分析 Top 结果
    if (this.config.aiService && results.length > 0) {
      const topResults = results.slice(0, Math.min(results.length, 20));
      
      for (let i = 0; i < topResults.length; i++) {
        try {
          const aiAnalysis = await this.analyzeSingleJob(topResults[i], subscription);
          topResults[i].ai_reasoning = aiAnalysis.reasoning;
          topResults[i].ai_suggestions = aiAnalysis.suggestions;
        } catch (e) {
          console.error(`AI分析岗位 ${topResults[i].job_id} 失败:`, e);
        }
      }
    }

    return results;
  }

  private subscriptionToProfile(subscription: SubscriptionCondition): ResumeProfile {
    const skills: string[] = [];
    
    // 从关键词提取技能
    if (subscription.keyword) {
      const knownSkills = ['Python', 'Excel', 'SQL', '数据分析', '财务分析', 'CFA', 'CPA', 
                           'Java', 'JavaScript', '机器学习', '深度学习', '金融', '会计'];
      skills.push(...knownSkills.filter(s => 
        subscription.keyword.toLowerCase().includes(s.toLowerCase())
      ));
    }

    return {
      name: '',
      phone: '',
      email: '',
      education: subscription.education ? [{
        school: '',
        major: subscription.keyword || '',
        degree: subscription.education,
        graduationYear: null,
        startDate: '',
        endDate: '',
      }] : [],
      skills,
      internships: [],
      projects: [],
      certifications: [],
      languages: [],
      resumeText: `求职意向: ${subscription.keyword || ''}; 地点: ${(subscription.locations || []).join(',')}; 行业: ${(subscription.industries || []).join(',')}`,
    };
  }

  private async analyzeSingleJob(result: AnalysisJobResult, subscription: SubscriptionCondition): Promise<{
    reasoning: string;
    suggestions: string;
  }> {
    if (!this.config.aiService) {
      return { reasoning: '', suggestions: '' };
    }

    const prompt = `
请分析以下岗位与用户订阅条件的匹配度：

【订阅条件】
- 关键词/意向: ${subscription.keyword || '不限'}
- 地点: ${(subscription.locations || []).join(', ') || '不限'}
- 行业: ${(subscription.industries || []).join(', ') || '不限'}
- 学历要求: ${subscription.education || '不限'}

【岗位信息】
- 岗位: ${result.title}
- 公司: ${result.company}
- 地点: ${result.location}
- 薪资: ${result.salary}
- 匹配分数: ${result.match_score}/100

请用简洁的中文回答：
1. 匹配理由（1-2句话）
2. 建议（1条）

请按以下JSON格式返回：
{"reasoning": "...", "suggestions": "..."}
`;

    try {
      const response = await this.config.aiService.chat([
        { role: 'system', content: '你是专业的求职顾问，请简洁地分析岗位匹配度。只返回JSON格式结果。' },
        { role: 'user', content: prompt },
      ]);

      const content = response.content.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          reasoning: parsed.reasoning || '',
          suggestions: parsed.suggestions || '',
        };
      }

      return { reasoning: content, suggestions: '' };
    } catch (e) {
      console.error('AI分析失败:', e);
      return { reasoning: '', suggestions: '' };
    }
  }

  private async generateAISummary(topResults: AnalysisJobResult[], subscription: SubscriptionCondition): Promise<AIResponse> {
    if (!this.config.aiService) {
      throw new Error('AI服务未配置');
    }

    const jobsSummary = topResults.map((r, i) => 
      `${i + 1}. [${r.match_score}分] ${r.title} - ${r.company} (${r.location}, ${r.salary})`
    ).join('\n');

    const prompt = `
根据以下订阅条件和匹配结果，生成一段简洁的分析摘要：

【订阅条件】
名称: ${subscription.name}
关键词: ${subscription.keyword || '无'}
地点: ${(subscription.locations || []).join(', ') || '无'}
行业: ${(subscription.industries || []).join(', ') || '无'}
学历: ${subscription.education || '无'}

【Top 匹配岗位】
${jobsSummary}

请用2-3句话总结本次分析结果，包括：匹配数量、整体情况、建议。
`;

    return this.config.aiService.chat([
      { role: 'system', content: '你是专业的求职顾问，请用友好的中文撰写分析摘要。' },
      { role: 'user', content: prompt },
    ]);
  }

  private storeResults(db: ReturnType<typeof getDb>, analysisId: number, results: AnalysisJobResult[]): void {
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO subscription_analysis_results 
      (analysis_id, job_id, match_score, skill_match, education_match, location_match, ai_reasoning, ai_suggestions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const result of results) {
      insertStmt.run(
        analysisId,
        result.job_id,
        result.match_score,
        result.skill_match,
        result.education_match,
        result.location_match,
        result.ai_reasoning || null,
        result.ai_suggestions || null
      );
    }
  }

  private getCachedResults(db: ReturnType<typeof getDb>, analysisId: number): AnalysisResult {
    const analysis = db.prepare('SELECT * FROM subscription_analyses WHERE id = ?').get(analysisId) as any;

    const results = db.prepare(`
      SELECT sar.*, j.title, j.company, j.location, j.salary, j.education
      FROM subscription_analysis_results sar
      JOIN jobs j ON sar.job_id = j.id
      WHERE sar.analysis_id = ?
      ORDER BY sar.match_score DESC
    `).all(analysisId) as any[];

    return {
      analysis_id: analysisId,
      status: 'cached',
      summary: {
        total_scanned: analysis.total_jobs_scanned,
        new_jobs: analysis.new_jobs_count,
        matched: analysis.matched_jobs_count,
        ai_summary: analysis.ai_summary || undefined,
      },
      results: results.map(r => ({
        job_id: r.job_id,
        title: r.title,
        company: r.company,
        location: r.location || '',
        salary: r.salary || '面议',
        education: r.education || '',
        match_score: r.match_score,
        skill_match: r.skill_match,
        education_match: r.education_match,
        location_match: r.location_match,
        ai_reasoning: r.ai_reasoning || undefined,
        ai_suggestions: r.ai_suggestions || undefined,
        is_new: false,
      })),
      cached_at: analysis.analyzed_at,
    };
  }

  getAnalysisHistory(db: ReturnType<typeof getDb>, subscriptionId: number, limit = 40): any[] {
    initSubscriptionAnalysisTables(db);
    
    return db.prepare(`
      SELECT id, analyzed_at, status, total_jobs_scanned, new_jobs_count, matched_jobs_count, ai_summary
      FROM subscription_analyses
      WHERE subscription_id = ?
      ORDER BY analyzed_at DESC
      LIMIT ?
    `).all(subscriptionId, limit);
  }

  getAnalysisResults(db: ReturnType<typeof getDb>, analysisId: number, page = 1, limit = 20): {
    results: AnalysisJobResult[];
    total: number;
    page: number;
    totalPages: number;
  } {
    initSubscriptionAnalysisTables(db);

    const count = db.prepare(
      'SELECT COUNT(*) as cnt FROM subscription_analysis_results WHERE analysis_id = ?'
    ).get(analysisId) as { cnt: number };

    const offset = (page - 1) * limit;
    const totalPages = Math.ceil(count.cnt / limit);

    const results = db.prepare(`
      SELECT sar.*, j.title, j.company, j.location, j.salary, j.education
      FROM subscription_analysis_results sar
      JOIN jobs j ON sar.job_id = j.id
      WHERE sar.analysis_id = ?
      ORDER BY sar.match_score DESC
      LIMIT ? OFFSET ?
    `).all(analysisId, limit, offset) as any[];

    return {
      results: results.map(r => ({
        job_id: r.job_id,
        title: r.title,
        company: r.company,
        location: r.location || '',
        salary: r.salary || '面议',
        education: r.education || '',
        match_score: r.match_score,
        skill_match: r.skill_match,
        education_match: r.education_match,
        location_match: r.location_match,
        ai_reasoning: r.ai_reasoning || undefined,
        ai_suggestions: r.ai_suggestions || undefined,
        is_new: false,
      })),
      total: count.cnt,
      page,
      totalPages,
    };
  }
}

// 单例实例
let analyzerInstance: SubscriptionAnalyzer | null = null;

export function getSubscriptionAnalyzer(config?: SubscriptionAnalyzerConfig): SubscriptionAnalyzer {
  if (!analyzerInstance) {
    analyzerInstance = new SubscriptionAnalyzer(config || { aiService: null });
  }
  return analyzerInstance;
}
