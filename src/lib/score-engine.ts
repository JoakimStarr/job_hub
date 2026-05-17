import type { ResumeProfile, MatchScore, JobItem } from './resume-types';

export class ScoreEngine {
  getMatchLevel(score: number): string {
    if (score >= 85) return '冲刺岗';
    if (score >= 70) return '匹配岗';
    if (score >= 55) return '潜力岗';
    return '挑战岗';
  }

  getMatchLevelEn(score: number): string {
    if (score >= 85) return 'Sprint Position';
    if (score >= 70) return 'Match Position';
    if (score >= 55) return 'Potential Position';
    return 'Challenge Position';
  }

  generateSuggestions(profile: ResumeProfile, job: JobItem, matchScore: MatchScore): string[] {
    const suggestions: string[] = [];

    if (matchScore.breakdown.skills < 15) {
      const jobText = `${job.description} ${job.requirements}`.toLowerCase();
      const missingSkills = this.extractMissingSkills(profile, jobText);
      if (missingSkills.length > 0) {
        suggestions.push(`建议学习相关技能: ${missingSkills.slice(0, 3).join(', ')}`);
      }
    }

    if (matchScore.breakdown.experience < 10) {
      if (profile.internships.length === 0) {
        suggestions.push('建议增加相关实习经历');
      } else if (profile.internships.length < 2) {
        suggestions.push('建议补充更多实习经历');
      }
    }

    if (matchScore.breakdown.major < 10) {
      suggestions.push('可以通过相关证书或项目弥补专业背景差异');
    }

    if (profile.certifications.length === 0) {
      suggestions.push('建议考取相关职业资格证书（如CFA、CPA、FRM等）');
    }

    if (profile.projects.length === 0) {
      suggestions.push('建议补充项目经历，展示实践能力');
    }

    return suggestions;
  }

  generateActionPlan(profile: ResumeProfile, job: JobItem, matchScore: MatchScore): string[] {
    const actions: string[] = [];

    const level = this.getMatchLevel(matchScore.total);
    
    if (level === '冲刺岗') {
      actions.push('建议优先投递，把握机会');
      actions.push('简历中突出相关技能和项目经历');
      actions.push('准备针对性的面试问题');
    } else if (level === '匹配岗') {
      actions.push('建议尽快投递');
      actions.push('补充岗位要求的相关技能');
      actions.push('准备项目经历介绍');
    } else if (level === '潜力岗') {
      actions.push('建议补充相关技能后投递');
      actions.push('可以通过项目或证书弥补不足');
      actions.push('关注类似岗位的招聘信息');
    } else {
      actions.push('建议先提升相关能力');
      actions.push('寻找更匹配的岗位');
      actions.push('可以通过实习或项目积累经验');
    }

    if (matchScore.gaps.length > 0) {
      actions.push(`重点改进: ${matchScore.gaps[0]}`);
    }

    return actions;
  }

  private extractMissingSkills(profile: ResumeProfile, jobText: string): string[] {
    const skillKeywords = [
      'Python', 'Java', 'JavaScript', 'SQL', 'Excel', 'Wind', 'Bloomberg',
      '数据分析', '财务分析', '投资分析', '风险管理', '量化投资',
      '机器学习', '深度学习', '大数据', '人工智能',
      'CFA', 'CPA', 'FRM', 'ACCA',
    ];

    return skillKeywords.filter(skill => 
      jobText.includes(skill.toLowerCase()) && !profile.skills.includes(skill)
    );
  }

  calculateOverallScore(profile: ResumeProfile): number {
    let score = 0;

    if (profile.education.length > 0) score += 20;
    if (profile.skills.length > 0) score += Math.min(profile.skills.length * 3, 25);
    if (profile.internships.length > 0) score += 20;
    if (profile.projects.length > 0) score += 15;
    if (profile.certifications.length > 0) score += 10;
    if (profile.name && (profile.phone || profile.email)) score += 10;

    return Math.min(score, 100);
  }

  getRecommendationPriority(score: number): 'high' | 'medium' | 'low' {
    if (score >= 70) return 'high';
    if (score >= 55) return 'medium';
    return 'low';
  }

  getMatchColor(score: number): string {
    if (score >= 85) return '#10b981';
    if (score >= 70) return '#3b82f6';
    if (score >= 55) return '#f59e0b';
    return '#ef4444';
  }
}

export const scoreEngine = new ScoreEngine();
