import { NextRequest, NextResponse } from 'next/server';
import { getDb, getSourceName } from '@/lib/db-utils';
import { aiService } from '@/lib/ai-service';
import { logger } from '@/lib/logger';
import type { ResumeProfile } from '@/lib/resume-types';

interface AnalysisResult {
  score: {
    total: number;
    skills: number;
    education: number;
    match_rate: number;
  };
  recommendation: string;
  suggestions: string[];
  risks: string[];
  action_plan: string[];
}

function generateMockAnalysis(job: Record<string, unknown>, profile?: ResumeProfile): AnalysisResult {
  const suggestions: string[] = [];
  const risks: string[] = [];

  let score = 50;

  if (job.salary) {
    score += 15;
  } else {
    suggestions.push('职位未标明薪资范围，建议在面试时询问');
  }

  if (job.description && String(job.description).length > 100) {
    score += 20;
  } else if (!job.description) {
    suggestions.push('职位描述不完整，建议联系招聘方了解更多详情');
  }

  if (job.requirements && String(job.requirements).length > 50) {
    score += 10;
  }

  if (job.company) {
    score += 5;
  }

  if (job.location) {
    score += 5;
  }

  if (String(job.title || '').includes('高级') || String(job.title || '').includes('资深')) {
    risks.push('该职位要求较高，需要丰富的经验');
  }

  if (!job.education || job.education === '不限') {
    suggestions.push('学历要求宽松，适合各层次求职者');
  }

  if (String(job.description || '').toLowerCase().includes('加班') ||
      String(job.requirements || '').toLowerCase().includes('加班')) {
    risks.push('职位描述中提及可能需要加班');
  }

  if (profile) {
    if (profile.skills.length > 0) {
      score += 5;
      suggestions.push(`你的技能组合包含 ${profile.skills.length} 项技能`);
    }
    if (profile.education && profile.education.length > 0) {
      const highestEdu = profile.education[profile.education.length - 1];
      if (highestEdu.degree === '本科' || highestEdu.degree === '硕士' || highestEdu.degree === '博士') {
        score += 5;
        suggestions.push(`你的学历背景符合大多数职位要求`);
      }
    }
  }

  score = Math.min(100, Math.max(0, score));

  let recommendation: string;
  if (score >= 75) {
    recommendation = '推荐投递';
  } else if (score >= 55) {
    recommendation = '可以考虑';
  } else {
    recommendation = '竞争激烈';
  }

  return {
    score: {
      total: score,
      skills: Math.min(100, score + Math.floor(Math.random() * 10 - 5)),
      education: Math.min(100, score + Math.floor(Math.random() * 10 - 5)),
      match_rate: Math.min(100, score + Math.floor(Math.random() * 15 - 7)),
    },
    recommendation,
    suggestions: suggestions.length > 0 ? suggestions : ['职位信息完整度较高', '建议准备相关作品集'],
    risks: risks.length > 0 ? risks : ['暂无明显风险因素'],
    action_plan: [
      '仔细阅读职位描述和要求',
      '准备针对性的简历和求职信',
      '了解公司背景和业务',
      '练习常见面试问题',
      '准备展示相关项目经验',
    ],
  };
}

function buildAnalysisPrompt(job: Record<string, unknown>, profile?: ResumeProfile): string {
  let prompt = `请分析以下职位信息，并提供详细的评估报告：

职位标题：${job.title || '未知'}
公司名称：${job.company || '未知'}
工作地点：${job.location || '未知'}
薪资范围：${job.salary || '未提供'}
职位类型：${job.job_type || '未知'}
行业：${job.industry || '未知'}
学历要求：${job.education || '不限'}
经验要求：${job.experience || '未说明'}

职位描述：
${job.description || '无详细描述'}

任职要求：
${job.requirements || '无具体要求'}`;

  if (profile) {
    prompt += `

求职者简历信息：
姓名：${profile.name}
邮箱：${profile.email}
电话：${profile.phone}
技能：${profile.skills.join(', ') || '无'}
教育背景：${profile.education.map(e => `${e.school} - ${e.major} (${e.degree})`).join('; ') || '无'}
实习经历：${profile.internships.map(i => `${i.company} - ${i.position}`).join('; ') || '无'}
项目经验：${profile.projects.map(p => p.name).join(', ') || '无'}
证书：${profile.certifications.join(', ') || '无'}
语言能力：${profile.languages.join(', ') || '无'}`;
  }

  prompt += `

请以JSON格式返回分析结果，包含以下字段：
{
  "score": {
    "total": 数字（0-100）,
    "skills": 数字（0-100）,
    "education": 数字（0-100）,
    "match_rate": 数字（0-100）
  },
  "recommendation": "推荐投递/可以考虑/竞争激烈",
  "suggestions": ["建议1", "建议2", ...],
  "risks": ["风险1", "风险2", ...],
  "action_plan": ["行动1", "行动2", ...]
}`;

  return prompt;
}

async function parseAIResponse(content: string): Promise<AnalysisResult> {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as AnalysisResult;
    }
    throw new Error('无法解析AI响应为JSON格式');
  } catch {
    throw new Error('AI响应格式错误');
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id } = await params;

  try {
    const body = await request.json();
    const { profile }: { profile?: ResumeProfile } = body;

    const db = getDb();
    const job = db.prepare(`
      SELECT 
        id, title, company, location, salary, description, requirements,
        job_type, industry, education, experience, source, university,
        source_url, apply_url, publish_date, deadline, category, tags,
        is_favorite, is_read, created_at, updated_at
      FROM jobs 
      WHERE id = ?
    `).get(parseInt(id)) as Record<string, unknown> | undefined;

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    let result: AnalysisResult;

    if (aiService) {
      try {
        const prompt = buildAnalysisPrompt(job, profile);
        const response = await aiService.chat([
          {
            role: 'system',
            content: '你是一个专业的职业分析师，擅长评估职位信息和匹配度。请始终以JSON格式返回结果。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ]);

        result = await parseAIResponse(response.content);
      } catch (error) {
        logger.error('AI analysis failed:', error);
        result = generateMockAnalysis(job, profile);
      }
    } else {
      result = generateMockAnalysis(job, profile);
    }

    const duration = Date.now() - startTime;
    logger.api('POST', `/api/jobs/${id}/ai-analysis`, 200, duration);

    return NextResponse.json(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('AI analysis error:', error);
    logger.api('POST', `/api/jobs/${id}/ai-analysis`, 500, duration);

    return NextResponse.json(
      { error: 'Failed to analyze job' },
      { status: 500 }
    );
  }
}
