import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db-utils';
import { aiService } from '@/lib/ai-service';
import { requireAuthUnified } from '@/lib/auth-server';
import { AuthError } from '@/lib/auth';
import { logger } from '@/lib/logger';

interface InterviewQuestion {
  category: string;
  questions: string[];
}

interface InterviewQuestionsResult {
  job_title: string;
  company: string;
  technical_questions: InterviewQuestion[];
  behavioral_questions: InterviewQuestion[];
  preparation_tips: string[];
}

function buildInterviewPrompt(job: Record<string, unknown>): string {
  return `请根据以下职位信息，生成面试题目和准备建议：

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
${job.requirements || '无具体要求'}

请生成针对该职位的面试准备内容，以JSON格式返回，包含以下字段：
{
  "job_title": "职位名称",
  "company": "公司名称",
  "technical_questions": [
    { "category": "专业技能", "questions": ["问题1", "问题2", "问题3"] },
    { "category": "行业知识", "questions": ["问题1", "问题2"] }
  ],
  "behavioral_questions": [
    { "category": "行为面试", "questions": ["问题1", "问题2", "问题3"] },
    { "category": "职业规划", "questions": ["问题1", "问题2"] }
  ],
  "preparation_tips": ["建议1", "建议2", "建议3", "建议4", "建议5"]
}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id } = await params;

  try {
    await requireAuthUnified(request);

    const db = getDb();
    const job = db.prepare(`
      SELECT id, title, company, location, salary, description, requirements,
             job_type, industry, education, experience
      FROM jobs WHERE id = ?
    `).get(parseInt(id)) as Record<string, unknown> | undefined;

    if (!job) {
      return NextResponse.json({ error: '职位不存在' }, { status: 404 });
    }

    if (!aiService) {
      return NextResponse.json(
        { error: 'AI服务未配置，请设置AI_API_KEY环境变量' },
        { status: 503 }
      );
    }

    const prompt = buildInterviewPrompt(job);
    const response = await aiService.chat([
      {
        role: 'system',
        content: '你是一位专业的面试辅导专家，擅长根据职位要求生成针对性的面试题目和准备建议。请始终以JSON格式返回结果。',
      },
      { role: 'user', content: prompt },
    ]);

    let result: InterviewQuestionsResult;
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]) as InterviewQuestionsResult;
      } else {
        throw new Error('无法解析AI响应');
      }
    } catch {
      return NextResponse.json(
        { error: 'AI响应格式错误' },
        { status: 500 }
      );
    }

    const duration = Date.now() - startTime;
    logger.api('POST', `/api/jobs/${id}/interview-questions`, 200, duration);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const duration = Date.now() - startTime;
    logger.error('面试题目生成失败:', error);
    logger.api('POST', `/api/jobs/${id}/interview-questions`, 500, duration);
    return NextResponse.json(
      { error: '面试题目生成失败' },
      { status: 500 }
    );
  }
}