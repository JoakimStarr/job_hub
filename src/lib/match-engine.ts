import type { ResumeProfile, MatchScore, JobItem } from './resume-types';
import majorSimilarity from '../../data/major_similarity.json';

export class MatchEngine {
  match(profile: ResumeProfile, job: JobItem): MatchScore {
    const breakdown = {
      skills: this.matchSkills(profile, job),
      education: this.matchEducation(profile, job),
      major: this.matchMajor(profile, job),
      location: this.matchLocation(profile, job),
      experience: this.matchExperience(profile, job),
      industry: this.matchIndustry(profile, job),
    };

    const matchedFields = this.getMatchedFields(profile, job, breakdown);
    const gaps = this.getGaps(profile, job, breakdown);
    const risks = this.getRisks(profile, job, breakdown);

    const total = this.calculateTotalScore(breakdown);

    return {
      total,
      breakdown,
      matchedFields,
      gaps,
      risks,
    };
  }

  private matchSkills(profile: ResumeProfile, job: JobItem): number {
    if (!profile.skills.length) return 0;

    const jobText = `${job.description} ${job.requirements}`.toLowerCase();
    const jobSkills = this.extractJobSkills(jobText);

    if (!jobSkills.length) return 15;

    const matchedSkills = profile.skills.filter(skill => 
      jobText.includes(skill.toLowerCase())
    );

    const score = (matchedSkills.length / jobSkills.length) * 30;
    return Math.min(score, 30);
  }

  private extractJobSkills(text: string): string[] {
    const skillKeywords = [
      'python', 'java', 'javascript', 'sql', 'excel', 'wind', 'bloomberg',
      '数据分析', '财务分析', '投资分析', '风险管理', '量化投资',
      '机器学习', '深度学习', '大数据', '人工智能',
      'cfa', 'cpa', 'frm', 'acca',
    ];

    return skillKeywords.filter(skill => text.includes(skill));
  }

  private matchEducation(profile: ResumeProfile, job: JobItem): number {
    if (!profile.education.length) return 0;

    const jobEducation = (job.education || '').toLowerCase();
    
    if (!jobEducation) return 15;

    const userDegrees = profile.education.map(e => e.degree);
    const degreeMap: Record<string, number> = {
      '博士': 4,
      '硕士': 3,
      '研究生': 3,
      '本科': 2,
      '专科': 1,
      '大专': 1,
    };

    const userMaxDegree = Math.max(...userDegrees.map(d => degreeMap[d] || 0));

    if (jobEducation.includes('博士')) {
      return userMaxDegree >= 4 ? 20 : userMaxDegree >= 3 ? 10 : 0;
    } else if (jobEducation.includes('硕士') || jobEducation.includes('研究生')) {
      return userMaxDegree >= 3 ? 20 : userMaxDegree >= 2 ? 10 : 0;
    } else if (jobEducation.includes('本科')) {
      return userMaxDegree >= 2 ? 20 : 10;
    }

    return 15;
  }

  private matchMajor(profile: ResumeProfile, job: JobItem): number {
    if (!profile.education.length) return 0;

    const jobText = `${job.description} ${job.requirements}`.toLowerCase();
    const userMajors = profile.education.map(e => e.major).filter(m => m);

    if (!userMajors.length) return 0;

    for (const userMajor of userMajors) {
      const similarity = majorSimilarity[userMajor as keyof typeof majorSimilarity];
      if (similarity) {
        for (const [jobMajor, score] of Object.entries(similarity)) {
          if (jobText.includes(jobMajor)) {
            return score * 15;
          }
        }
      }

      if (jobText.includes(userMajor)) {
        return 15;
      }
    }

    const majorKeywords = ['金融', '经济', '会计', '财务', '统计', '数学', '计算机'];
    for (const keyword of majorKeywords) {
      if (userMajors.some(m => m.includes(keyword)) && jobText.includes(keyword)) {
        return 10;
      }
    }

    return 5;
  }

  private matchLocation(profile: ResumeProfile, job: JobItem): number {
    if (!job.location) return 10;

    const jobLocation = job.location;
    
    const locationKeywords = ['北京', '上海', '广州', '深圳', '成都', '重庆', '杭州', '南京', '武汉', '西安'];
    
    for (const keyword of locationKeywords) {
      if (jobLocation.includes(keyword)) {
        if (profile.resumeText.includes(keyword)) {
          return 10;
        }
      }
    }

    return 5;
  }

  private matchExperience(profile: ResumeProfile, job: JobItem): number {
    const jobText = `${job.description || ''} ${job.requirements || ''}`.toLowerCase();
    const jobExperience = (job.experience || '').toLowerCase();

    if (jobExperience.includes('应届') || jobExperience.includes('校招')) {
      return 15;
    }

    if (jobText.includes('实习经历') || jobText.includes('实习经验')) {
      if (profile.internships.length > 0) {
        return 15;
      } else {
        return 5;
      }
    }

    if (jobExperience.includes('1年') || jobExperience.includes('一年')) {
      if (profile.internships.length >= 1) {
        return 12;
      }
    }

    if (jobExperience.includes('3年') || jobExperience.includes('三年')) {
      if (profile.internships.length >= 2) {
        return 10;
      }
    }

    if (profile.internships.length > 0) {
      return 10;
    }

    return 5;
  }

  private matchIndustry(profile: ResumeProfile, job: JobItem): number {
    if (!job.industry) return 10;

    const jobIndustry = job.industry.toLowerCase();
    
    const industryKeywords = ['证券', '银行', '基金', '保险', '投资', '金融', '互联网', '科技'];
    
    for (const keyword of industryKeywords) {
      if (jobIndustry.includes(keyword)) {
        if (profile.resumeText.includes(keyword)) {
          return 10;
        }
      }
    }

    return 5;
  }

  private calculateTotalScore(breakdown: MatchScore['breakdown']): number {
    const weights = {
      skills: 0.30,
      education: 0.20,
      major: 0.15,
      location: 0.10,
      experience: 0.15,
      industry: 0.10,
    };

    return Math.round(
      breakdown.skills * weights.skills +
      breakdown.education * weights.education +
      breakdown.major * weights.major +
      breakdown.location * weights.location +
      breakdown.experience * weights.experience +
      breakdown.industry * weights.industry
    );
  }

  private getMatchedFields(profile: ResumeProfile, job: JobItem, breakdown: MatchScore['breakdown']): string[] {
    const fields: string[] = [];

    if (breakdown.skills >= 15) {
      const matchedSkills = profile.skills.filter(skill => 
        `${job.description} ${job.requirements}`.toLowerCase().includes(skill.toLowerCase())
      );
      if (matchedSkills.length > 0) {
        fields.push(`技能: ${matchedSkills.slice(0, 3).join(', ')}`);
      }
    }

    if (breakdown.education >= 15) {
      const degree = profile.education[0]?.degree;
      if (degree) {
        fields.push(`学历: ${degree}`);
      }
    }

    if (breakdown.major >= 10) {
      const major = profile.education[0]?.major;
      if (major) {
        fields.push(`专业: ${major}`);
      }
    }

    if (breakdown.location >= 8) {
      fields.push(`地点: ${job.location}`);
    }

    return fields;
  }

  private getGaps(profile: ResumeProfile, job: JobItem, breakdown: MatchScore['breakdown']): string[] {
    const gaps: string[] = [];

    if (breakdown.skills < 15) {
      const jobText = `${job.description} ${job.requirements}`.toLowerCase();
      const missingSkills = this.extractJobSkills(jobText).filter(skill => 
        !profile.skills.includes(skill)
      );
      if (missingSkills.length > 0) {
        gaps.push(`缺少技能: ${missingSkills.slice(0, 3).join(', ')}`);
      }
    }

    if (breakdown.experience < 10) {
      if (profile.internships.length === 0) {
        gaps.push('缺少实习经历');
      }
    }

    if (breakdown.major < 10) {
      gaps.push('专业背景与岗位要求不完全匹配');
    }

    return gaps;
  }

  private getRisks(profile: ResumeProfile, job: JobItem, breakdown: MatchScore['breakdown']): string[] {
    const risks: string[] = [];

    if (breakdown.education > 18 && (job.education || '').includes('本科')) {
      risks.push('学历可能高于岗位要求（overqualified）');
    }

    if (breakdown.location < 6) {
      risks.push('工作地点与意向地点不匹配');
    }

    if ((job.description || '').length < 100) {
      risks.push('岗位描述信息较少，建议查看原网页');
    }

    return risks;
  }
}

export const matchEngine = new MatchEngine();
