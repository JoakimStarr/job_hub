import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai-service';
import { getDb } from '@/lib/db-utils';
import { withApiHandler } from '@/lib/api-response';
import type { ResumeProfile, JobItem } from '@/lib/resume-types';
import { matchEngine } from '@/lib/match-engine';
import { scoreEngine } from '@/lib/score-engine';
import { logger } from '@/lib/logger';
import { buildRAGContext, buildRAGPrompt } from '@/lib/embedding-service';

export const POST = withApiHandler(async (request: NextRequest) => {
  const body = await request.json();
  const { job_id, profile, prompt } = body;

  if (!aiService) {
    return NextResponse.json(
      { error: 'AI服务未配置，请设置AI_API_KEY环境变量' },
      { status: 503 }
    );
  }

  let job: JobItem | null = null;
  if (job_id) {
    const db = getDb();
    job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job_id) as JobItem;
  }

  const systemPrompt = `你是一位专业的金融行业求职顾问，拥有丰富的招聘和职业规划经验。
你的任务是帮助求职者分析岗位匹配度，提供专业的建议和指导。

分析要点：
1. 岗位要求与求职者背景的匹配度
2. 求职者的优势和不足
3. 改进建议和行动计划
4. 面试准备建议

请用专业、友好、鼓励的语气回复，避免过于生硬或机械。`;

  let userPrompt = '';

  if (profile) {
    userPrompt += `求职者画像：\n${profile}\n\n`;
  }

  if (job) {
    userPrompt += `岗位信息：\n`;
    userPrompt += `标题：${job.title}\n`;
    userPrompt += `公司：${job.company}\n`;
    userPrompt += `地点：${job.location}\n`;
    userPrompt += `薪资：${job.salary || '面议'}\n`;
    userPrompt += `学历要求：${job.education || '不限'}\n`;
    userPrompt += `经验要求：${job.experience || '不限'}\n`;
    userPrompt += `岗位描述：${job.description}\n`;
    userPrompt += `岗位要求：${job.requirements}\n\n`;

    if (profile) {
      try {
        const profileData = parseProfileText(profile);
        const matchScore = matchEngine.match(profileData, job);
        const matchLevel = scoreEngine.getMatchLevel(matchScore.total);
        const suggestions = scoreEngine.generateSuggestions(profileData, job, matchScore);
        const actionPlan = scoreEngine.generateActionPlan(profileData, job, matchScore);

        userPrompt += `匹配度分析：\n`;
        userPrompt += `总分：${matchScore.total}分 (${matchLevel})\n`;
        userPrompt += `技能匹配：${Math.round(matchScore.breakdown.skills)}/30\n`;
        userPrompt += `学历匹配：${Math.round(matchScore.breakdown.education)}/20\n`;
        userPrompt += `专业匹配：${Math.round(matchScore.breakdown.major)}/15\n`;
        userPrompt += `地点匹配：${Math.round(matchScore.breakdown.location)}/10\n`;
        userPrompt += `经验匹配：${Math.round(matchScore.breakdown.experience)}/15\n`;
        userPrompt += `行业匹配：${Math.round(matchScore.breakdown.industry)}/10\n\n`;

        if (matchScore.matchedFields.length > 0) {
          userPrompt += `匹配项：${matchScore.matchedFields.join('、')}\n`;
        }
        if (matchScore.gaps.length > 0) {
          userPrompt += `能力缺口：${matchScore.gaps.join('、')}\n`;
        }
        if (suggestions.length > 0) {
          userPrompt += `改进建议：${suggestions.join('、')}\n`;
        }
        if (actionPlan.length > 0) {
          userPrompt += `行动计划：${actionPlan.join('、')}\n`;
        }
        userPrompt += '\n';
      } catch (error) {
        logger.error('匹配度分析错误:', error);
      }
    }
  }

  if (prompt) {
    userPrompt += `用户问题：${prompt}\n`;
  }

  if (job) {
    const ragItems = buildRAGContext(job.id);
    if (ragItems.length > 0) {
      userPrompt += `\n【参考信息】\n${buildRAGPrompt(ragItems)}\n`;
    }
  }

  if (!userPrompt) {
    return NextResponse.json(
      { error: '请提供岗位ID、个人画像或具体问题' },
      { status: 400 }
    );
  }

  const response = await aiService.chat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  return NextResponse.json({
    result: response.content,
    model: response.model,
    usage: response.usage,
  });
}, { requireAuth: true });

function parseProfileText(text: string): ResumeProfile {
  const lines = text.split('\n').filter(line => line.trim());

  const profile: ResumeProfile = {
    name: '',
    phone: '',
    email: '',
    education: [],
    skills: [],
    internships: [],
    projects: [],
    certifications: [],
    languages: [],
    resumeText: text,
  };

  for (const line of lines) {
    if (line.includes('大学') || line.includes('学院')) {
      profile.education.push({
        school: line,
        major: '',
        degree: '',
        graduationYear: null,
        startDate: '',
        endDate: '',
      });
    }

    const skillKeywords = ['Python', 'Excel', 'Wind', 'SQL', '数据分析', '财务分析', 'CFA', 'CPA', 'FRM'];
    for (const skill of skillKeywords) {
      if (line.includes(skill) && !profile.skills.includes(skill)) {
        profile.skills.push(skill);
      }
    }
  }

  return profile;
}
