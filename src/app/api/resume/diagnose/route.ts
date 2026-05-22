import { NextRequest, NextResponse } from 'next/server';
import type { ResumeProfile, ResumeDiagnosis } from '@/lib/resume-types';
import { requireAuthUnified } from '@/lib/auth-server';
import { AuthError } from '@/lib/auth';
import { logger } from '@/lib/logger';
import skillDictionary from '../../../../../data/skill_dictionary.json';

export async function POST(request: NextRequest) {
  try {
    await requireAuthUnified(request);

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
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('简历诊断错误:', error);
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

  // === 基本信息 (15分) ===
  let basicScore = 0;
  if (profile.name) basicScore += 3;
  else gaps.push('缺少姓名信息');

  if (profile.phone) basicScore += 3;
  else gaps.push('缺少手机号码');

  if (profile.email) basicScore += 3;
  else gaps.push('缺少邮箱地址');

  if (profile.gender) basicScore += 2;
  if (profile.address) basicScore += 2;
  if (profile.birthDate || profile.age) basicScore += 2;

  if (basicScore >= 10) {
    highlights.push('基本信息较完整');
  } else if (basicScore < 5) {
    risks.push('基本信息严重缺失，影响HR联系');
    suggestions.push('请补充姓名、手机号、邮箱等基本联系方式');
  }
  score += basicScore;

  // === 教育背景 (20分) ===
  if (profile.education.length > 0) {
    let eduScore = 10;
    const topUniversities = skillDictionary.universities.top_tier;
    const financeUniversities = skillDictionary.universities.finance_universities;

    const hasTopSchool = profile.education.some(edu =>
      topUniversities.some(school => edu.school.includes(school))
    );
    const hasFinanceSchool = profile.education.some(edu =>
      financeUniversities.some(school => edu.school.includes(school))
    );

    if (hasTopSchool) {
      eduScore += 8;
      highlights.push(`顶尖院校背景: ${profile.education[0].school}`);
    } else if (hasFinanceSchool) {
      eduScore += 5;
      highlights.push(`财经类院校背景: ${profile.education[0].school}`);
    } else {
      highlights.push(`已识别院校背景: ${profile.education.map(e => e.school).join('、')}`);
    }

    const majors = profile.education.map(e => e.major).filter(m => m);
    if (majors.length > 0) {
      eduScore += 2;
      highlights.push(`专业信息明确: ${majors.join('、')}`);
    } else {
      gaps.push('教育经历缺少专业信息');
      suggestions.push('建议补充所学专业，有助于专业对口岗位匹配');
    }

    score += Math.min(eduScore, 20);
  } else {
    gaps.push('缺少教育背景信息');
    suggestions.push('建议补充教育背景信息，这是简历的核心内容');
  }

  // === 技能 (20分) ===
  if (profile.skills.length > 0) {
    const skillScore = Math.min(profile.skills.length * 3, 20);
    score += skillScore;

    if (profile.skills.length >= 5) {
      highlights.push(`技能丰富: ${profile.skills.length}项技能（${profile.skills.slice(0, 5).join('、')}等）`);
    } else if (profile.skills.length >= 3) {
      highlights.push(`技能较明确: ${profile.skills.join('、')}`);
    } else {
      risks.push('技能项较少，可能影响岗位匹配');
      suggestions.push('建议补充更多专业技能，尤其是与目标岗位相关的技能');
    }
  } else {
    gaps.push('缺少技能信息');
    suggestions.push('建议补充专业技能，这是岗位匹配的关键依据');
  }

  // === 实习经历 (20分) ===
  if (profile.internships.length > 0) {
    let internScore = 10;
    if (profile.internships.length >= 3) {
      internScore += 10;
      highlights.push(`实习经历丰富: ${profile.internships.length}段实习`);
    } else if (profile.internships.length >= 2) {
      internScore += 7;
      highlights.push(`有${profile.internships.length}段实习经历`);
    } else {
      internScore += 3;
      highlights.push('有实习经历');
      suggestions.push('建议增加更多实习经历，提升竞争力');
    }

    const hasDescription = profile.internships.some(i => i.description && i.description.length > 20);
    if (hasDescription) {
      internScore += 3;
      highlights.push('实习经历描述较详细');
    } else {
      gaps.push('实习经历缺少详细描述');
      suggestions.push('建议为实习经历补充具体工作内容和成果');
    }

    score += Math.min(internScore, 20);
  } else {
    gaps.push('缺少实习经历');
    suggestions.push('建议补充实习经历，应届生实习经验是重要加分项');
  }

  // === 项目经历 (10分) ===
  if (profile.projects.length > 0) {
    let projScore = 5;
    if (profile.projects.length >= 2) {
      projScore += 5;
      highlights.push(`有${profile.projects.length}个项目经历`);
    } else {
      highlights.push('有项目经历');
    }

    const hasProjDesc = profile.projects.some(p => p.description && p.description.length > 20);
    if (!hasProjDesc) {
      gaps.push('项目经历缺少详细描述');
      suggestions.push('建议为项目补充背景、目标和你的具体贡献');
    }

    score += Math.min(projScore, 10);
  } else {
    gaps.push('缺少项目经历');
    suggestions.push('建议补充项目经历，展示实践能力');
  }

  // === 证书 (5分) ===
  if (profile.certifications?.length > 0) {
    score += 5;
    highlights.push(`持有专业证书: ${profile.certifications.join('、')}`);
  } else {
    suggestions.push('可考虑考取相关职业资格证书（如CFA、CPA等），增加竞争力');
  }

  // === 语言能力 (5分) ===
  if (profile.languages?.length > 0) {
    score += 5;
    highlights.push(`语言能力: ${profile.languages.join('、')}`);
  } else {
    suggestions.push('建议补充语言能力信息（如英语CET-4/6、雅思等）');
  }

  // === 获奖经历 (5分) ===
  if ((profile.awards?.length || 0) > 0) {
    score += 5;
    const nationalAwards = (profile.awards || []).filter(a =>
      a.level?.includes('国家') || a.level?.includes('国际')
    );
    if (nationalAwards.length > 0) {
      highlights.push(`获得国家级/国际奖项: ${nationalAwards.map(a => a.name).join('、')}`);
    } else {
      highlights.push(`有获奖经历: ${(profile.awards || []).map(a => a.name).join('、')}`);
    }
  } else {
    suggestions.push('如有获奖经历建议补充，尤其是专业相关竞赛获奖');
  }

  // === 求职意向 (加分项) ===
  const intentFields = [
    { field: profile.targetPosition, name: '目标职位' },
    { field: profile.targetLocation, name: '目标地点' },
    { field: profile.targetIndustry, name: '目标行业' },
    { field: profile.availability, name: '到岗时间' },
  ];
  const filledIntents = intentFields.filter(i => i.field).length;
  if (filledIntents >= 3) {
    score += 5;
    highlights.push('求职意向明确');
  } else if (filledIntents > 0) {
    score += 2;
    suggestions.push('建议完善求职意向（目标职位、地点、行业等），有助于精准推荐');
  } else {
    gaps.push('缺少求职意向');
    suggestions.push('强烈建议补充求职意向，帮助系统更精准地推荐岗位');
  }

  // === 自我评价 (加分项) ===
  if (profile.selfEvaluation && profile.selfEvaluation.length > 30) {
    score += 5;
    highlights.push('有自我评价描述');
  } else if (!profile.selfEvaluation) {
    suggestions.push('建议添加自我评价，突出个人优势和职业目标');
  }

  // === 社交/作品 (加分项) ===
  if (profile.github || profile.portfolio || (profile.socialLinks?.length || 0) > 0) {
    score += 5;
    highlights.push('有个人作品/社交链接');
  }

  // === 简历内容长度检查 ===
  if (profile.resumeText.length < 200) {
    risks.push('简历内容过短');
    suggestions.push('建议丰富简历内容，增加详细信息，一般简历应不少于300字');
  } else if (profile.resumeText.length > 5000) {
    highlights.push('简历内容较丰富');
  }

  // === 综合评估 ===
  if (score >= 80) {
    highlights.push('简历整体质量较高，竞争力强');
  } else if (score >= 60) {
    highlights.push('简历基本完整，有一定竞争力');
  } else if (score < 40) {
    risks.push('简历信息严重不足，建议尽快补充');
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