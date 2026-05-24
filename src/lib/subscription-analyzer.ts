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

export type AnalysisPhase = 'scanning' | 'matching' | 'ai_analyzing' | 'completed' | 'failed';

export interface AnalysisProgress {
  phase: AnalysisPhase;
  phaseLabel: string;
  current: number;
  total: number;
  message: string;
}

export interface AnalysisResult {
  analysis_id: number;
  status: 'completed' | 'running' | 'failed' | 'cached';
  summary: {
    total_scanned: number;
    filtered_count: number;
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
  onProgress?: (progress: AnalysisProgress) => void;
}

const DEFAULT_CONFIG: Required<Pick<SubscriptionAnalyzerConfig, 'maxJobsPerAnalysis'>> = {
  maxJobsPerAnalysis: 500,
};

const PHASE_LABELS: Record<AnalysisPhase, string> = {
  scanning: '扫描岗位数据',
  matching: '本地规则匹配',
  ai_analyzing: 'AI 深度分析',
  completed: '分析完成',
  failed: '分析失败',
};

export class SubscriptionAnalyzer {
  private config: SubscriptionAnalyzerConfig;

  constructor(config: SubscriptionAnalyzerConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private emitProgress(phase: AnalysisPhase, current: number, total: number, message: string): void {
    if (this.config.onProgress) {
      this.config.onProgress({
        phase,
        phaseLabel: PHASE_LABELS[phase],
        current,
        total,
        message,
      });
    }
  }

  async preview(subscription: SubscriptionCondition, forceRefresh = false): Promise<AnalysisResult> {
    const db = getDb();
    initSubscriptionAnalysisTables(db);

    const currentHash = computeSubscriptionHash(subscription);
    const lastAnalysis = getLastAnalysis(db, subscription.id);
    const maxJobId = getMaxJobId(db);

    // 缓存检查
    if (!forceRefresh && lastAnalysis && lastAnalysis.status === 'completed') {
      if (lastAnalysis.analysis_hash === currentHash && maxJobId <= (lastAnalysis.last_job_id_analyzed || 0)) {
        return this.getCachedResults(db, lastAnalysis.id);
      }
    }

    const analysisId = this.createAnalysisRecord(db, subscription.id, currentHash);

    try {
      db.prepare('UPDATE subscription_analyses SET status = ? WHERE id = ?').run('running', analysisId);

      let startJobId = 0;
      if (!forceRefresh && lastAnalysis && lastAnalysis.analysis_hash === currentHash) {
        startJobId = lastAnalysis.last_job_id_analyzed || 0;
      }

      // ===== 阶段1: 关键词筛选 =====
      this.emitProgress('scanning', 0, 100, '正在从数据库筛选匹配岗位...');
      const allJobs = this.keywordFilterJobs(db, subscription, startJobId);
      this.emitProgress('scanning', allJobs.length, allJobs.length, `筛选完成，共 ${allJobs.length} 个候选岗位`);

      // ===== 阶段2: 本地匹配评分 =====
      this.emitProgress('matching', 0, allJobs.length, '正在进行本地规则匹配评分...');
      const matchedResults = await this.scoreMatchJobs(allJobs, subscription, (curr, total) => {
        this.emitProgress('matching', curr, total, `已匹配 ${curr}/${total} 个岗位`);
      });
      this.emitProgress('matching', matchedResults.length, matchedResults.length, `匹配完成，${matchedResults.length} 个岗位通过`);

      // ===== 阶段3: AI 深度分析（Top-N） =====
      let aiSummary = '';
      let aiModel = '';
      let tokensUsed = 0;

      if (this.config.aiService && matchedResults.length > 0) {
        const totalToAnalyze = matchedResults.length;
        this.emitProgress('ai_analyzing', 0, totalToAnalyze, `正在对全部 ${totalToAnalyze} 个匹配岗位进行 AI 深度分析...`);

        for (let i = 0; i < totalToAnalyze; i++) {
          try {
            const aiAnalysis = await this.analyzeSingleJob(matchedResults[i], subscription);
            matchedResults[i].ai_reasoning = aiAnalysis.reasoning;
            matchedResults[i].ai_suggestions = aiAnalysis.suggestions;
          } catch (e) {
            console.error(`AI分析岗位 ${matchedResults[i].job_id} 失败:`, e);
          }
          this.emitProgress('ai_analyzing', i + 1, totalToAnalyze, `AI 分析进度 ${i + 1}/${totalToAnalyze}`);
        }

        try {
          const summaryTopN = Math.min(10, matchedResults.length);
          const summaryResult = await this.generateAISummary(matchedResults.slice(0, summaryTopN), subscription);
          aiSummary = summaryResult.content;
          aiModel = summaryResult.model;
          tokensUsed = summaryResult.usage?.total_tokens || 0;
        } catch (e) {
          console.error('AI摘要生成失败:', e);
        }
      }

      this.storeResults(db, analysisId, matchedResults);

      const totalScanned = allJobs.length;
      const newJobsCount = startJobId > 0 ? allJobs.length : totalScanned;

      db.prepare(`
        UPDATE subscription_analyses SET 
          status = ?, 
          analyzed_at = CURRENT_TIMESTAMP,
          total_jobs_scanned = ?,
          new_jobs_count = ?,
          filtered_count = ?,
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
        allJobs.length,
        matchedResults.length,
        maxJobId,
        aiSummary,
        aiModel,
        tokensUsed,
        analysisId
      );

      cleanupOldAnalyses(db, subscription.id);

      this.emitProgress('completed', matchedResults.length, matchedResults.length, '分析完成');

      return {
        analysis_id: analysisId,
        status: 'completed',
        summary: {
          total_scanned: totalScanned,
          filtered_count: allJobs.length,
          new_jobs: newJobsCount,
          matched: matchedResults.length,
          ai_summary: aiSummary || undefined,
        },
        results: matchedResults.map(r => ({ ...r, is_new: r.job_id > (startJobId || 0) })),
      };

    } catch (error) {
      db.prepare('UPDATE subscription_analyses SET status = ?, error_message = ? WHERE id = ?')
        .run('failed', error instanceof Error ? error.message : String(error), analysisId);
      this.emitProgress('failed', 0, 0, error instanceof Error ? error.message : '未知错误');
      throw error;
    }
  }

  private createAnalysisRecord(db: ReturnType<typeof getDb>, subscriptionId: number, hash: string): number {
    const result = db.prepare(
      'INSERT INTO subscription_analyses (subscription_id, analysis_hash, status) VALUES (?, ?, ?)'
    ).run(subscriptionId, hash, 'pending');
    return result.lastInsertRowid as number;
  }

  /**
   * 阶段1: 关键词筛选 - 从全量数据库中按订阅条件过滤岗位
   */
  private keywordFilterJobs(db: ReturnType<typeof getDb>, subscription: SubscriptionCondition, startJobId: number): JobItem[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (startJobId > 0) {
      conditions.push('j.id > ?');
      params.push(startJobId);
    }

    // 关键词搜索（支持多关键词，OR逻辑）
    if (subscription.keyword) {
      const keywords = String(subscription.keyword)
        .split(/[,，;；\s、]+/)
        .map(k => k.trim())
        .filter(k => k.length > 0);

      if (keywords.length > 0) {
        const kwConditions: string[] = [];
        for (const kw of keywords) {
          const pattern = `%${kw}%`;
          kwConditions.push('(j.title LIKE ? OR j.company LIKE ? OR j.description LIKE ? OR j.requirements LIKE ?)');
          params.push(pattern, pattern, pattern, pattern);
        }
        conditions.push(`(${kwConditions.join(' OR ')})`);
      }
    }

    // 地点筛选
    if (subscription.locations && subscription.locations.length > 0) {
      const locConditions = subscription.locations.map(() => '(j.location LIKE ? OR j.location = ?)').join(' OR ');
      conditions.push(`(${locConditions})`);
      subscription.locations.forEach(loc => { params.push(`%${loc}%`, loc); });
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

  /**
   * 阶段2: 本地匹配评分 - 对筛选后的岗位进行 match-engine + score-engine 评分
   */
  private async scoreMatchJobs(jobs: JobItem[], subscription: SubscriptionCondition, onMatchProgress?: (current: number, total: number) => void): Promise<AnalysisJobResult[]> {
    const profile = this.subscriptionToProfile(subscription);
    const results: AnalysisJobResult[] = [];

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      try {
        const matchScore = matchEngine.match(profile, job);

        let finalScore = matchScore.total;

        const keywordBonus = this.calcKeywordBonus(job, subscription.keyword);
        finalScore = Math.min(100, Math.max(finalScore, keywordBonus));

        if (finalScore < 15) {
          if (onMatchProgress) onMatchProgress(i + 1, jobs.length);
          continue;
        }

        results.push({
          job_id: job.id!,
          title: job.title,
          company: job.company || '',
          location: job.location || '',
          salary: job.salary || '面议',
          education: job.education || '',
          match_score: Math.round(finalScore),
          skill_match: matchScore.breakdown.skills,
          education_match: matchScore.breakdown.education,
          location_match: matchScore.breakdown.location,
          ai_reasoning: undefined,
          ai_suggestions: undefined,
          is_new: false,
        });
      } catch (e) {
        console.error(`分析岗位 ${job.id} 失败:`, e);
      }

      if (onMatchProgress) onMatchProgress(i + 1, jobs.length);
    }

    results.sort((a, b) => b.match_score - a.match_score);
    return results;
  }

  private subscriptionToProfile(subscription: SubscriptionCondition): ResumeProfile {
    const skills: string[] = [];

    if (subscription.keyword) {
      const kw = subscription.keyword;
      const knownSkills = ['Python', 'Excel', 'SQL', '数据分析', '财务分析', 'CFA', 'CPA',
                           'Java', 'JavaScript', '机器学习', '深度学习', '金融', '会计'];
      skills.push(...knownSkills.filter(s =>
        kw.toLowerCase().includes(s.toLowerCase())
      ));

      const rawKeywords = String(kw)
        .split(/[,，;；\s、]+/)
        .map(k => k.trim())
        .filter(k => k.length > 0 && k.length <= 10);

      rawKeywords.forEach(kw => {
        if (!skills.some(s => s.toLowerCase() === kw.toLowerCase())) {
          skills.push(kw);
        }
      });
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

  private calcKeywordBonus(job: JobItem, keyword: string | null | undefined): number {
    if (!keyword) return 20;

    const keywords = String(keyword)
      .split(/[,，;；\s、]+/)
      .map(k => k.trim())
      .filter(k => k.length > 0);

    if (keywords.length === 0) return 20;

    const searchText = `${job.title} ${job.company} ${job.tags || ''} ${job.industry || ''} ${(job.description || '').slice(0, 200)} ${(job.requirements || '').slice(0, 100)}`.toLowerCase();

    let maxBonus = 20;
    for (const kw of keywords) {
      const normalized = kw.toLowerCase();
      if (searchText.includes(normalized)) {
        if (job.title.toLowerCase().includes(normalized)) {
          maxBonus = Math.max(maxBonus, 55);
        } else if ((job.requirements || '').toLowerCase().includes(normalized)) {
          maxBonus = Math.max(maxBonus, 45);
        } else if ((job.description || '').toLowerCase().includes(normalized)) {
          maxBonus = Math.max(maxBonus, 35);
        } else {
          maxBonus = Math.max(maxBonus, 25);
        }
      }
    }

    return maxBonus;
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

    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.config.aiService.chat([
          { role: 'system', content: '你是专业的求职顾问，请简洁地分析岗位匹配度。只返回JSON格式结果。' },
          { role: 'user', content: prompt },
        ]);

        const content = response.content?.trim();
        
        if (!content) {
          if (attempt < maxRetries) {
            console.warn(`AI分析岗位 ${result.job_id} 返回空响应，重试 ${attempt + 1}/${maxRetries}`);
            continue;
          }
          return { reasoning: '', suggestions: '' };
        }

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
        console.error(`AI分析岗位 ${result.job_id} 失败 (尝试 ${attempt + 1}/${maxRetries + 1}):`, e);
        if (attempt === maxRetries) {
          return { reasoning: '', suggestions: '' };
        }
      }
    }

    return { reasoning: '', suggestions: '' };
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
    const analysis = db.prepare('SELECT * FROM subscription_analyses WHERE id = ?').get(analysisId) as Record<string, unknown>;

    const results = db.prepare(`
      SELECT sar.*, j.title, j.company, j.location, j.salary, j.education
      FROM subscription_analysis_results sar
      JOIN jobs j ON sar.job_id = j.id
      WHERE sar.analysis_id = ?
      ORDER BY sar.match_score DESC
    `).all(analysisId) as Record<string, unknown>[];

    return {
      analysis_id: analysisId,
      status: 'cached',
      summary: {
        total_scanned: analysis.total_jobs_scanned as number,
        filtered_count: (analysis.filtered_count as number) ?? (analysis.total_jobs_scanned as number),
        new_jobs: analysis.new_jobs_count as number,
        matched: analysis.matched_jobs_count as number,
        ai_summary: (analysis.ai_summary as string) || undefined,
      },
      results: results.map(r => ({
        job_id: r.job_id as number,
        title: r.title as string,
        company: r.company as string,
        location: (r.location as string) || '',
        salary: (r.salary as string) || '面议',
        education: (r.education as string) || '',
        match_score: r.match_score as number,
        skill_match: r.skill_match as number,
        education_match: r.education_match as number,
        location_match: r.location_match as number,
        ai_reasoning: (r.ai_reasoning as string) || undefined,
        ai_suggestions: (r.ai_suggestions as string) || undefined,
        is_new: false,
      })),
      cached_at: analysis.analyzed_at as string,
    };
  }

  getAnalysisHistory(db: ReturnType<typeof getDb>, subscriptionId: number, limit = 40): any[] {
    initSubscriptionAnalysisTables(db);
    
    return db.prepare(`
      SELECT id, analyzed_at, status, total_jobs_scanned, new_jobs_count, matched_jobs_count, filtered_count, ai_summary
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
    `).all(analysisId, limit, offset) as Record<string, unknown>[];

    return {
      results: results.map(r => ({
        job_id: r.job_id as number,
        title: r.title as string,
        company: r.company as string,
        location: (r.location as string) || '',
        salary: (r.salary as string) || '面议',
        education: (r.educ as string) || '',
        match_score: r.match_score as number,
        skill_match: r.skill_match as number,
        education_match: r.education_match as number,
        location_match: r.location_match as number,
        ai_reasoning: (r.ai_reasoning as string) || undefined,
        ai_suggestions: (r.ai_suggestions as string) || undefined,
        is_new: false,
      })),
      total: count.cnt,
      page,
      totalPages,
    };
  }
}

let analyzerInstance: SubscriptionAnalyzer | null = null;

export function getSubscriptionAnalyzer(config?: SubscriptionAnalyzerConfig): SubscriptionAnalyzer {
  if (!analyzerInstance) {
    analyzerInstance = new SubscriptionAnalyzer(config || { aiService: null });
  }
  return analyzerInstance;
}
