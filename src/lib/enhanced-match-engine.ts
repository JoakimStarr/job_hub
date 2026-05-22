import type { ResumeProfile, JobItem } from '@/types';
import { getActiveProfile, initUserProfileTables } from './user-profile-db';

initUserProfileTables();

interface SkillSynonym {
  skill: string;
  synonyms: string[];
}

const SKILL_SYNONYMS: SkillSynonym[] = [
  { skill: 'Python', synonyms: ['python', 'py', 'Python3'] },
  { skill: 'Java', synonyms: ['java', 'JAVA', 'Java8', 'Java11'] },
  { skill: 'JavaScript', synonyms: ['javascript', 'js', 'JavaScript', 'ES6'] },
  { skill: 'React', synonyms: ['react', 'reactjs', 'React.js'] },
  { skill: 'Vue', synonyms: ['vue', 'vuejs', 'Vue.js', 'vue3'] },
  { skill: 'SQL', synonyms: ['sql', 'SQL', 'mysql', 'postgresql', 'oracle'] },
  { skill: 'C++', synonyms: ['c++', 'cpp', 'C++'] },
  { skill: 'Go', synonyms: ['go', 'golang', 'Go语言'] },
  { skill: 'Rust', synonyms: ['rust', 'Rust语言'] },
  { skill: 'TypeScript', synonyms: ['typescript', 'ts', 'TS'] },
  { skill: 'Node.js', synonyms: ['node.js', 'nodejs', 'node'] },
  { skill: 'Docker', synonyms: ['docker', 'Docker容器'] },
  { skill: 'Kubernetes', synonyms: ['kubernetes', 'k8s', 'k8s集群'] },
  { skill: 'AWS', synonyms: ['aws', 'Amazon Web Services', '亚马逊云'] },
  { skill: '机器学习', synonyms: ['机器学习', 'ML', 'Machine Learning', '深度学习', 'DL'] },
  { skill: '数据分析', synonyms: ['数据分析', '数据挖掘', 'Data Analysis', 'data mining'] },
  { skill: 'Excel', synonyms: ['excel', 'EXCEL', '电子表格', '表格处理'] },
  { skill: 'PPT', synonyms: ['ppt', 'PowerPoint', '演示文稿', '幻灯片'] },
  { skill: '沟通能力', synonyms: ['沟通能力', '表达能力', '团队协作', 'teamwork'] },
  { skill: '领导力', synonyms: ['领导力', '管理能力', 'leadership', '项目管理'] },
];

const JOB_TYPE_WEIGHTS: Record<string, Record<string, number>> = {
  '技术': {
    skills: 0.35,
    education: 0.15,
    major: 0.10,
    location: 0.05,
    experience: 0.25,
    industry: 0.10,
  },
  '金融': {
    skills: 0.20,
    education: 0.30,
    major: 0.20,
    location: 0.10,
    experience: 0.10,
    industry: 0.10,
  },
  '产品': {
    skills: 0.20,
    education: 0.15,
    major: 0.10,
    location: 0.10,
    experience: 0.25,
    industry: 0.20,
  },
  '运营': {
    skills: 0.15,
    education: 0.15,
    major: 0.10,
    location: 0.15,
    experience: 0.25,
    industry: 0.20,
  },
  '设计': {
    skills: 0.30,
    education: 0.15,
    major: 0.15,
    location: 0.10,
    experience: 0.20,
    industry: 0.10,
  },
};

const DEFAULT_WEIGHTS = {
  skills: 0.30,
  education: 0.20,
  major: 0.15,
  location: 0.10,
  experience: 0.15,
  industry: 0.10,
};

export interface EnhancedMatchScore {
  jobId: number;
  totalScore: number;
  breakdown: {
    skills: number;
    education: number;
    major: number;
    location: number;
    experience: number;
    industry: number;
    bonus: number;
  };
  matchedSkills: string[];
  missingSkills: string[];
  recommendations: string[];
  matchLevel: 'excellent' | 'good' | 'moderate' | 'poor' | 'mismatch';
  confidence: number;
  dynamicWeights: typeof DEFAULT_WEIGHTS;
}

function normalizeSkill(skill: string): string {
  return skill.toLowerCase().trim();
}

function findSynonymMatches(userSkill: string): string[] {
  const normalizedUserSkill = normalizeSkill(userSkill);
  
  for (const synonymGroup of SKILL_SYNONYMS) {
    const normalizedMainSkill = normalizeSkill(synonymGroup.skill);
    const normalizedSynonyms = synonymGroup.synonyms.map(normalizeSkill);
    
    if (normalizedUserSkill === normalizedMainSkill || 
        normalizedSynonyms.includes(normalizedUserSkill)) {
      return [synonymGroup.skill, ...synonymGroup.synonyms];
    }
  }
  
  return [userSkill];
}

function calculateSkillMatch(
  userSkills: string[],
  jobRequirements: string
): {
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
} {
  if (!jobRequirements || !userSkills?.length) {
    return { score: 0, matchedSkills: [], missingSkills: [] };
  }

  const requiredSkills = jobRequirements
    .split(/[,，;；\n]/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  if (requiredSkills.length === 0) {
    return { score: 0, matchedSkills: [], missingSkills: [] };
  }

  let matchedCount = 0;
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const reqSkill of requiredSkills) {
    const normalizedReq = normalizeSkill(reqSkill);
    let isMatched = false;

    for (const userSkill of userSkills) {
      const userVariants = findSynonymMatches(userSkill);
      
      if (userVariants.some(variant => 
        normalizedReq.includes(normalizeSkill(variant)) ||
        normalizeSkill(variant).includes(normalizedReq)
      )) {
        isMatched = true;
        break;
      }

      if (normalizedReq.includes(normalizeSkill(userSkill)) ||
          normalizeSkill(userSkill).includes(normalizedReq)) {
        isMatched = true;
        break;
      }
    }

    if (isMatched) {
      matchedCount++;
      matchedSkills.push(reqSkill);
    } else {
      missingSkills.push(reqSkill);
    }
  }

  const score = Math.round((matchedCount / requiredSkills.length) * 100);

  return { score, matchedSkills, missingSkills };
}

function calculateEducationMatch(
  userEducation: ResumeProfile['education'],
  jobRequirements?: string
): number {
  if (!userEducation?.length) return 0;

  const latestEdu = userEducation[userEducation.length - 1];
  
  const degreeScores: Record<string, number> = {
    '博士': 100,
    '硕士': 85,
    '本科': 70,
    '专科': 50,
    '其他': 30,
  };

  let baseScore = degreeScores[latestEdu.degree] || degreeScores['其他'];

  if (jobRequirements) {
    const reqLower = jobRequirements.toLowerCase();
    
    if (reqLower.includes('硕士') && baseScore < 85) {
      baseScore *= 0.5;
    } else if (reqLower.includes('本科') && baseScore < 70) {
      baseScore *= 0.7;
    } else if (reqLower.includes('博士') && baseScore < 100) {
      baseScore *= 0.4;
    }
  }

  const now = new Date().getFullYear();
  const gradYear = latestEdu.graduationYear || now;
  
  if (gradYear >= now - 1 && gradYear <= now + 1) {
    baseScore += 10;
  } else if (gradYear < now - 2) {
    baseScore -= 5;
  }

  return Math.min(100, Math.max(0, baseScore));
}

function calculateMajorMatch(
  userMajors: string[],
  jobTitle: string,
  jobDescription?: string
): number {
  if (!userMajors?.length) return 0;

  const allText = `${jobTitle} ${jobDescription || ''}`.toLowerCase();

  const majorKeywords: Record<string, string[]> = {
    '计算机科学': ['计算机', '软件工程', 'cs', 'se'],
    '金融学': ['金融', '金融学', 'finance', '经济'],
    '会计学': ['会计', 'acca', 'cpa', '审计'],
    '市场营销': ['市场', '营销', 'marketing'],
    '设计': ['设计', 'ui', 'ux', '视觉', 'design'],
    '法学': ['法律', '法务', 'law', 'legal'],
  };

  let maxScore = 0;

  for (const major of userMajors) {
    const majorLower = major.toLowerCase();
    
    if (allText.includes(majorLower)) {
      maxScore = Math.max(maxScore, 90);
    }

    for (const [category, keywords] of Object.entries(majorKeywords)) {
      if (keywords.some(kw => 
        majorLower.includes(kw) || kw.includes(majorLower)
      )) {
        if (allText.includes(category.toLowerCase()) || 
            keywords.some(kw => allText.includes(kw))) {
          maxScore = Math.max(maxScore, 80);
        } else {
          maxScore = Math.max(maxScore, 60);
        }
      }
    }
  }

  return maxScore;
}

function calculateLocationMatch(
  userLocation: string,
  jobLocation?: string
): number {
  if (!userLocation || !jobLocation) return 80;

  const userLoc = userLocation.toLowerCase();
  const jobLoc = jobLocation.toLowerCase();

  if (userLoc === jobLoc || userLoc.includes(jobLoc) || jobLoc.includes(userLoc)) {
    return 100;
  }

  const sameProvincePatterns = [
    [/北京/, /天津/],
    [/上海/, /苏州/],
    [/广州/, /深圳|佛山/],
    [/成都/, /重庆/],
  ];

  for (const [pattern1, pattern2] of sameProvincePatterns) {
    if ((pattern1.test(userLoc) && pattern2.test(jobLoc)) ||
        (pattern2.test(userLoc) && pattern1.test(jobLoc))) {
      return 85;
    }
  }

  return 60;
}

function calculateExperienceMatch(
  internships: ResumeProfile['internships'],
  projects: ResumeProfile['projects'],
  jobRequirements?: string
): number {
  let totalMonths = 0;

  if (internships?.length) {
    for (const intern of internships) {
      if (intern.duration) {
        const months = parseInt(intern.duration.match(/\d+/)?.[0] || '0');
        totalMonths += months;
      }
    }
  }

  if (projects?.length) {
    totalMonths += projects.length * 2;
  }

  let baseScore = Math.min((totalMonths / 12) * 40, 100);

  if (jobRequirements) {
    const reqLower = jobRequirements.toLowerCase();
    
    if (reqLower.includes('实习') && totalMonths >= 3) {
      baseScore += 20;
    }
    
    if (reqLower.includes('经验') && totalMonths >= 12) {
      baseScore += 15;
    }
    
    if (reqLower.includes('应届') || reqLower.includes('毕业生')) {
      baseScore = Math.min(baseScore + 10, 100);
    }
  }

  return Math.min(100, Math.max(0, baseScore));
}

function calculateIndustryMatch(
  userIndustries: string[],
  jobIndustry?: string
): number {
  if (!userIndustries?.length || !jobIndustry) return 75;

  const userIndustryLower = userIndustries.map(i => i.toLowerCase());
  const jobIndustryLower = jobIndustry.toLowerCase();

  if (userIndustryLower.some(ui => ui.includes(jobIndustryLower) || jobIndustryLower.includes(ui))) {
    return 95;
  }

  const relatedIndustries: Record<string, string[]> = {
    '互联网': ['科技', 'IT', '软件', 'SaaS'],
    '金融': ['银行', '证券', '保险', '基金', '投资'],
    '教育': ['培训', '在线教育', '学校'],
    '医疗': ['健康', '医药', '生物', '医院'],
  };

  for (const [industry, related] of Object.entries(relatedIndustries)) {
    if (jobIndustryLower.includes(industry) &&
        userIndustryLower.some(ui => related.some(r => ui.includes(r)))) {
      return 85;
    }
  }

  return 65;
}

function detectJobType(job: JobItem): string {
  const text = `${job.title} ${job.description || ''} ${job.requirements || ''}`.toLowerCase();

  const typePatterns: Record<string, RegExp[]> = {
    '技术': [
      /开发|工程师|程序员|程序员|后端|前端|全栈|java|python|c\+\+|go|rust/,
      /算法|机器学习|深度学习|ai|数据科学|大数据/,
      /测试|qa|运维|devops|sre|dba/,
      /架构师|技术总监|cto|tech lead/
    ],
    '金融': [
      /金融|银行|证券|基金|投行|风控|量化|交易|分析师|投资|财务|审计|会计/,
      /cfa|cpa|frm|acca/
    ],
    '产品': [
      /产品经理|产品专员|pm|产品运营|用户体验|ux|交互设计/
    ],
    '运营': [
      /运营|市场|推广|品牌|新媒体|内容|社群|用户增长|活动策划/
    ],
    '设计': [
      /设计师|ui|ux|平面|视觉|插画|动效|设计总监/
    ]
  };

  for (const [type, patterns] of Object.entries(typePatterns)) {
    if (patterns.some(pattern => pattern.test(text))) {
      return type;
    }
  }

  return '通用';
}

function getDynamicWeights(job: JobItem): typeof DEFAULT_WEIGHTS {
  const jobType = detectJobType(job);
  const weights = JOB_TYPE_WEIGHTS[jobType];
  return (weights || DEFAULT_WEIGHTS) as typeof DEFAULT_WEIGHTS;
}

function calculateBonusPoints(
  profile: ResumeProfile,
  job: JobItem,
  breakdown: EnhancedMatchScore['breakdown']
): number {
  let bonus = 0;

  const hasCertifications = profile.certifications?.length > 0;
  const hasLanguages = profile.languages?.length > 0;
  const hasMultipleInternships = (profile.internships?.length || 0) >= 2;
  const hasProjects = (profile.projects?.length || 0) >= 1;

  if (hasCertifications) bonus += 5;
  if (hasLanguages && breakdown.skills >= 80) bonus += 3;
  if (hasMultipleInternships) bonus += 5;
  if (hasProjects) bonus += 3;

  const highMatchDimensions = Object.entries(breakdown)
    .filter(([key, value]) => key !== 'bonus' && value >= 85)
    .length;

  if (highMatchDimensions >= 4) {
    bonus += 10;
  } else if (highMatchDimensions >= 3) {
    bonus += 5;
  }

  return Math.min(bonus, 20);
}

function generateRecommendations(score: EnhancedMatchScore): string[] {
  const recommendations: string[] = [];

  if (score.breakdown.skills < 60) {
    recommendations.push(`建议补充技能：${score.missingSkills.slice(0, 3).join('、')}`);
  }

  if (score.breakdown.experience < 50 && score.breakdown.experience > 0) {
    recommendations.push('建议增加相关实习或项目经验');
  }

  if (score.breakdown.education < 70) {
    recommendations.push('学历要求较高，可突出项目成果和实践能力');
  }

  if (score.totalScore >= 85 && score.matchedSkills.length >= 3) {
    recommendations.push('✨ 匹配度很高，强烈推荐申请！');
  } else if (score.totalScore >= 70) {
    recommendations.push('👍 匹配度良好，值得尝试');
  } else if (score.totalScore >= 55) {
    recommendations.push('💡 可以尝试，但需在简历中重点展示相关优势');
  }

  return recommendations;
}

function determineMatchLevel(totalScore: number): EnhancedMatchScore['matchLevel'] {
  if (totalScore >= 85) return 'excellent';
  if (totalScore >= 70) return 'good';
  if (totalScore >= 55) return 'moderate';
  if (totalScore >= 40) return 'poor';
  return 'mismatch';
}

export function enhancedCalculateMatchScore(
  profile: ResumeProfile,
  job: JobItem
): EnhancedMatchScore {
  const dynamicWeights = getDynamicWeights(job);

  const skillResult = calculateSkillMatch(
    profile.skills || [],
    job.requirements || ''
  );

  const educationScore = calculateEducationMatch(
    profile.education || [],
    job.requirements
  );

  const userMajors = (profile.education || []).map(e => e.major).filter(Boolean);
  const majorScore = calculateMajorMatch(userMajors, job.title, job.description);

  const locationScore = calculateLocationMatch(
    (profile as any).targetLocation || '',
    job.location
  );

  const experienceScore = calculateExperienceMatch(
    profile.internships || [],
    profile.projects || [],
    job.requirements
  );

  const userIndustries = [(profile as any).targetIndustry].filter(Boolean);
  const industryScore = calculateIndustryMatch(userIndustries, job.industry);

  const breakdown = {
    skills: skillResult.score,
    education: educationScore,
    major: majorScore,
    location: locationScore,
    experience: experienceScore,
    industry: industryScore,
    bonus: 0,
  };

  const bonus = calculateBonusPoints(profile, job, breakdown);
  breakdown.bonus = bonus;

  const maxScores = {
    skills: 100,
    education: 100,
    major: 100,
    location: 100,
    experience: 100,
    industry: 100,
    bonus: 20,
  };

  const weightedTotal =
    (breakdown.skills / maxScores.skills) * 100 * dynamicWeights.skills +
    (breakdown.education / maxScores.education) * 100 * dynamicWeights.education +
    (breakdown.major / maxScores.major) * 100 * dynamicWeights.major +
    (breakdown.location / maxScores.location) * 100 * dynamicWeights.location +
    (breakdown.experience / maxScores.experience) * 100 * dynamicWeights.experience +
    (breakdown.industry / maxScores.industry) * 100 * dynamicWeights.industry +
    (breakdown.bonus / maxScores.bonus) * 100 * 0.05;

  const totalScore = Math.round(Math.min(weightedTotal, 100));

  const recommendations = generateRecommendations({
    jobId: job.id,
    totalScore,
    breakdown,
    matchedSkills: skillResult.matchedSkills,
    missingSkills: skillResult.missingSkills,
    recommendations: [],
    matchLevel: 'good',
    confidence: 0,
    dynamicWeights,
  });

  return {
    jobId: job.id,
    totalScore,
    breakdown,
    matchedSkills: skillResult.matchedSkills,
    missingSkills: skillResult.missingSkills,
    recommendations,
    matchLevel: determineMatchLevel(totalScore),
    confidence: calculateConfidence(breakdown),
    dynamicWeights,
  };
}

function calculateConfidence(breakdown: EnhancedMatchScore['breakdown']): number {
  const scores = [
    breakdown.skills,
    breakdown.education,
    breakdown.major,
    breakdown.location,
    breakdown.experience,
    breakdown.industry,
  ];

  const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  const consistencyScore = Math.max(0, 100 - stdDev * 1.5);
  const dataCompleteness = scores.filter(s => s > 0).length / scores.length * 100;

  return Math.round(consistencyScore * 0.6 + dataCompleteness * 0.4);
}

export async function batchMatchJobs(
  userId: number,
  jobs: JobItem[]
): Promise<EnhancedMatchScore[]> {
  const profile = getActiveProfile(userId);
  
  if (!profile) {
    throw new Error('未找到用户画像，请先上传简历或创建画像');
  }

  return jobs
    .map(job => enhancedCalculateMatchScore(profile, job))
    .sort((a, b) => b.totalScore - a.totalScore);
}

export function getAlgorithmExplanation(): string {
  return `
## 🎯 智能岗位匹配算法 v2.0

### 核心特性

#### 1️⃣ **智能技能同义词匹配**
- 内置 20+ 技能同义词库（如 Python/py/python3, React/reactjs/React.js）
- 模糊匹配：支持部分匹配和包含关系
- 自动识别技术栈关联性

#### 2️⃣ **动态权重调整系统**
根据职位类型自动调整评分权重：

| 职位类型 | 技能 | 学历 | 专业 | 地点 | 经验 | 行业 |
|---------|------|------|------|------|------|------|
| 技术 | 35% | 15% | 10% | 5% | 25% | 10% |
| 金融 | 20% | 30% | 20% | 10% | 10% | 10% |
| 产品 | 20% | 15% | 10% | 10% | 25% | 20% |
| 运营 | 15% | 15% | 10% | 15% | 25% | 20% |
| 设计 | 30% | 15% | 15% | 10% | 20% | 10% |

#### 3️⃣ **多维度评分体系** (总分 100 分)

**基础维度（6个）：**
- **技能匹配** (0-100分)：基于同义词的精确/模糊匹配
- **学历匹配** (0-100分)：学位等级 + 毕业时间合理性
- **专业相关性** (0-100分)：专业关键词与职位描述匹配
- **地点偏好** (0-100分)：工作地点与期望地点匹配度
- **经验丰富度** (0-100分)：实习时长 + 项目数量加权
- **行业契合度** (0-100分)：目标行业与职位行业匹配

**加分项（bonus）：**
- 证书资质 (+5分)
- 语言能力 (+3分，高技能匹配时)
- 多段实习经历 (+5分)
- 项目经历 (+3分)
- 多维度高分奖励 (+5~10分)

#### 4️⃣ **智能推荐等级**

- 🟢 **优秀 (≥85分)**：强烈推荐，匹配度高
- 🔵 **良好 (70-84分)**：值得尝试，有竞争力
- 🟡 **一般 (55-69分)**：可以尝试，需突出优势
- 🔴 **较低 (40-54分)**：匹配度低，谨慎考虑
- ⚫ **不匹配 (<40分)**：不建议申请

#### 5️⃣ **置信度评估**
基于评分一致性和数据完整性的双重校验，确保推荐结果可靠。

### 算法优势

✅ **更精准**：同义词匹配减少漏判  
✅ **更智能**：动态权重适应不同职位类型  
✅ **更全面**：7个维度全方位评估  
✅ **更实用**：提供具体的改进建议  
✅ **更透明**：完整的评分明细和置信度  

### 使用示例

\`\`\`typescript
import { batchMatchJobs, enhancedCalculateMatchScore } from '@/lib/enhanced-match-engine';

// 批量匹配所有职位
const results = await batchMatchJobs(userId, jobs);

// 单个职位匹配
const singleResult = enhancedCalculateMatchScore(profile, job);
console.log(\`匹配得分: \${singleResult.totalScore}\`);
console.log(\`匹配技能: \${singleResult.matchedSkills.join(', ')}\`);
console.log(\`缺失技能: \${singleResult.missingSkills.join(', ')}\`);
console.log(\`改进建议: \${singleResult.recommendations.join('\\n')}\`);
\`\`\`
`;
}