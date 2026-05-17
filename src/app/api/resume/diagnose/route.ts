import { NextRequest, NextResponse } from 'next/server';
import type { ResumeProfile, ResumeDiagnosis } from '@/lib/resume-types';
import skillDictionary from '../../../../../data/skill_dictionary.json';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { profile } = body as { profile: ResumeProfile };

    if (!profile) {
      return NextResponse.json(
        { error: '缺少用户画像数据' },
        { status: 400 }
      );
    }

    const diagnosis = diagnoseResume(profile);

    return NextResponse.json(diagnosis);
  } catch (error) {
    console.error('简历诊断错误:', error);
    return NextResponse.json(
      { error: '简历诊断失败' },
      { status: 500 }
    );
  }
}

function diagnoseResume(profile: ResumeProfile): ResumeDiagnosis {
  const highlights: string[] = [];
  const risks: string[] = [];
  const gaps: string[] = [];
  const suggestions: string[] = [];
  
  let score = 0;

  if (profile.education.length > 0) {
    score += 20;
    const topUniversities = skillDictionary.universities.top_tier;
    const financeUniversities = skillDictionary.universities.finance_universities;
    
    const hasTopSchool = profile.education.some(edu => 
      topUniversities.some(school => edu.school.includes(school))
    );
    const hasFinanceSchool = profile.education.some(edu => 
      financeUniversities.some(school => edu.school.includes(school))
    );
    
    if (hasTopSchool) {
      highlights.push(`顶尖院校背景: ${profile.education[0].school}`);
    } else if (hasFinanceSchool) {
      highlights.push(`财经类院校背景: ${profile.education[0].school}`);
    } else {
      highlights.push(`已识别院校背景: ${profile.education.map(e => e.school).join('、')}`);
    }

    const majors = profile.education.map(e => e.major).filter(m => m);
    if (majors.length > 0) {
      highlights.push(`专业信息较明确: ${majors.join('、')}`);
    }
  } else {
    gaps.push('缺少教育背景信息');
    suggestions.push('建议补充教育背景信息');
  }

  if (profile.skills.length > 0) {
    score += Math.min(profile.skills.length * 3, 25);
    highlights.push(`技能/证书信息较丰富: ${profile.skills.slice(0, 5).join('、')}`);
  } else {
    gaps.push('缺少技能信息');
    suggestions.push('建议补充专业技能和证书');
  }

  if (profile.internships.length > 0) {
    score += 20;
    if (profile.internships.length >= 2) {
      highlights.push(`实习经历丰富: ${profile.internships.length}段实习`);
    } else {
      highlights.push('有实习经历');
    }
  } else {
    gaps.push('缺少实习经历描述');
    suggestions.push('建议补充实习经历和具体职责');
  }

  if (profile.projects.length > 0) {
    score += 15;
    highlights.push(`有项目经历: ${profile.projects.length}个项目`);
  } else {
    gaps.push('缺少项目经历信息');
    suggestions.push('建议补充项目经历，展示实践能力');
  }

  if (profile.certifications.length > 0) {
    score += 10;
    highlights.push(`有专业证书: ${profile.certifications.join('、')}`);
  } else {
    suggestions.push('可考虑考取相关职业资格证书');
  }

  if (!profile.phone && !profile.email) {
    risks.push('缺少联系方式');
    suggestions.push('建议补充手机号或邮箱');
  }

  if (profile.resumeText.length < 200) {
    risks.push('简历内容过短');
    suggestions.push('建议丰富简历内容，增加详细信息');
  }

  if (score > 100) score = 100;

  return {
    score,
    highlights,
    risks,
    gaps,
    suggestions,
  };
}
