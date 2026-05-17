import type { ResumeProfile, Education, Internship, Project, ParseResult } from './resume-types';
import skillDictionary from '../../data/skill_dictionary.json';

export class ResumeParser {
  private text: string;
  private profile: ResumeProfile;

  constructor(text: string) {
    this.text = text;
    this.profile = {
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
  }

  parse(): ParseResult {
    const warnings: string[] = [];
    
    try {
      this.extractBasicInfo();
      this.extractEducation();
      this.extractSkills();
      this.extractInternships();
      this.extractProjects();
      this.extractCertifications();
      this.extractLanguages();

      const confidence = this.calculateConfidence();

      if (!this.profile.name) {
        warnings.push('未能识别姓名');
      }
      if (this.profile.education.length === 0) {
        warnings.push('未能识别教育背景');
      }
      if (this.profile.skills.length === 0) {
        warnings.push('未能识别技能');
      }

      return {
        profile: this.profile,
        confidence,
        warnings,
      };
    } catch (error) {
      throw new Error(`简历解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  private extractBasicInfo(): void {
    const phoneRegex = /(?:手机|电话|联系方式)[：:\s]*(\d{11})/i;
    const phoneMatch = this.text.match(phoneRegex);
    if (phoneMatch) {
      this.profile.phone = phoneMatch[1];
    }

    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
    const emailMatch = this.text.match(emailRegex);
    if (emailMatch) {
      this.profile.email = emailMatch[1];
    }

    const lines = this.text.split('\n').filter(line => line.trim());
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      if (firstLine.length < 20 && !firstLine.includes('@') && !firstLine.match(/\d{11}/)) {
        this.profile.name = firstLine.replace(/[^\u4e00-\u9fa5a-zA-Z]/g, '');
      }
    }
  }

  private extractEducation(): void {
    const educationRegex = /(\d{4})[.\-年](\d{1,2})[.\-月]?\s*[-至到~]+\s*(?:至今|(\d{4})[.\-年](\d{1,2})[.\-月]?)\s+([^\n]+)/gi;
    let match;

    while ((match = educationRegex.exec(this.text)) !== null) {
      const educationText = match[5];
      const education = this.parseEducationText(educationText);
      if (education) {
        education.startDate = `${match[1]}-${match[2].padStart(2, '0')}`;
        education.endDate = match[3] ? `${match[3]}-${match[4].padStart(2, '0')}` : '至今';
        education.graduationYear = match[3] ? parseInt(match[3]) : null;
        this.profile.education.push(education);
      }
    }

    const schoolKeywords = ['大学', '学院', '研究院', '学校'];
    const degreeKeywords = ['博士', '硕士', '本科', '专科', '大专', '研究生'];
    
    const lines = this.text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (schoolKeywords.some(keyword => line.includes(keyword))) {
        const hasDegree = degreeKeywords.some(keyword => line.includes(keyword));
        
        if (hasDegree) {
          const education = this.parseEducationText(line);
          if (education) {
            const exists = this.profile.education.some(
              e => e.school === education.school && e.major === education.major
            );
            if (!exists) {
              this.profile.education.push(education);
            }
          }
        }
      }
    }
  }

  private parseEducationText(text: string): Education | null {
    const degreeKeywords = ['博士', '硕士', '本科', '专科', '大专', '研究生'];
    const schoolKeywords = ['大学', '学院', '研究院', '学校'];
    
    let degree = '';
    for (const keyword of degreeKeywords) {
      if (text.includes(keyword)) {
        degree = keyword;
        break;
      }
    }

    let school = '';
    for (const keyword of schoolKeywords) {
      const index = text.indexOf(keyword);
      if (index !== -1) {
        const start = Math.max(0, text.lastIndexOf(' ', index) + 1);
        school = text.substring(start, index + keyword.length);
        break;
      }
    }

    const majors = skillDictionary.majors;
    let major = '';
    for (const category in majors) {
      for (const m of majors[category as keyof typeof majors]) {
        if (text.includes(m)) {
          major = m;
          break;
        }
      }
      if (major) break;
    }

    if (school || major) {
      return {
        school,
        major,
        degree,
        graduationYear: null,
        startDate: '',
        endDate: '',
      };
    }

    return null;
  }

  private extractSkills(): void {
    const allSkills = [
      ...skillDictionary.finance,
      ...skillDictionary.tech,
      ...skillDictionary.soft_skills,
    ];

    const foundSkills = new Set<string>();
    
    for (const skill of allSkills) {
      if (this.text.includes(skill)) {
        foundSkills.add(skill);
      }
    }

    this.profile.skills = Array.from(foundSkills);
  }

  private extractInternships(): void {
    const internshipRegex = /(\d{4})[.\-年](\d{1,2})[.\-月]?\s*[-至到~]+\s*(?:至今|(\d{4})[.\-年](\d{1,2})[.\-月]?)\s+([^\n]+)/gi;
    let match;

    while ((match = internshipRegex.exec(this.text)) !== null) {
      const internshipText = match[5];
      
      if (internshipText.includes('实习') || internshipText.includes('兼职')) {
        const internship = this.parseInternshipText(internshipText);
        if (internship) {
          internship.startDate = `${match[1]}-${match[2].padStart(2, '0')}`;
          internship.endDate = match[3] ? `${match[3]}-${match[4].padStart(2, '0')}` : '至今';
          internship.duration = this.calculateDuration(internship.startDate, internship.endDate);
          this.profile.internships.push(internship);
        }
      }
    }

    const lines = this.text.split('\n');
    let inInternshipSection = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.includes('实习经历') || line.includes('工作经历')) {
        inInternshipSection = true;
        continue;
      }
      
      if (inInternshipSection && line.match(/^\d{4}[.\-年]/)) {
        const internship = this.parseInternshipText(line);
        if (internship) {
          this.profile.internships.push(internship);
        }
      }
      
      if (inInternshipSection && (line.includes('项目经历') || line.includes('教育经历'))) {
        inInternshipSection = false;
      }
    }
  }

  private parseInternshipText(text: string): Internship | null {
    const parts = text.split(/[\s,，、]+/).filter(p => p.length > 0);
    
    if (parts.length >= 2) {
      return {
        company: parts[0],
        position: parts[1] || '',
        duration: '',
        description: '',
        startDate: '',
        endDate: '',
      };
    }
    
    return null;
  }

  private extractProjects(): void {
    const lines = this.text.split('\n');
    let inProjectSection = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.includes('项目经历') || line.includes('项目经验')) {
        inProjectSection = true;
        continue;
      }
      
      if (inProjectSection && line.length > 5 && !line.includes('：')) {
        const project: Project = {
          name: line,
          role: '',
          description: '',
        };
        
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (nextLine.length > 10) {
            project.description = nextLine;
          }
        }
        
        this.profile.projects.push(project);
      }
      
      if (inProjectSection && (line.includes('实习经历') || line.includes('教育经历') || line.includes('技能'))) {
        inProjectSection = false;
      }
    }
  }

  private extractCertifications(): void {
    for (const cert of skillDictionary.certifications) {
      if (this.text.includes(cert)) {
        this.profile.certifications.push(cert);
      }
    }
  }

  private extractLanguages(): void {
    for (const lang of skillDictionary.languages) {
      if (this.text.includes(lang)) {
        this.profile.languages.push(lang);
      }
    }
  }

  private calculateDuration(startDate: string, endDate: string): string {
    if (!startDate) return '';
    
    const start = new Date(startDate);
    const end = endDate === '至今' ? new Date() : new Date(endDate);
    
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    
    if (months < 12) {
      return `${months}个月`;
    } else {
      const years = Math.floor(months / 12);
      const remainingMonths = months % 12;
      return remainingMonths > 0 ? `${years}年${remainingMonths}个月` : `${years}年`;
    }
  }

  private calculateConfidence(): number {
    let score = 0;
    let total = 5;

    if (this.profile.name) score += 1;
    if (this.profile.phone || this.profile.email) score += 1;
    if (this.profile.education.length > 0) score += 1;
    if (this.profile.skills.length > 0) score += 1;
    if (this.profile.internships.length > 0 || this.profile.projects.length > 0) score += 1;

    return score / total;
  }
}

export function parseResumeText(text: string): ParseResult {
  const parser = new ResumeParser(text);
  return parser.parse();
}
