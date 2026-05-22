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
      gender: '',
      birthDate: '',
      age: undefined,
      address: '',
      education: [],
      skills: [],
      internships: [],
      projects: [],
      certifications: [],
      languages: [],
      awards: [],
      volunteerExperience: '',
      socialLinks: [],
      portfolio: '',
      github: '',
      targetPosition: '',
      targetLocation: '',
      targetSalary: '',
      targetIndustry: '',
      jobTypePreference: '',
      availability: '',
      selfEvaluation: '',
      resumeText: text,
    };
  }

  parse(): ParseResult {
    const warnings: string[] = [];

    try {
      this.extractBasicInfo();
      this.extractGender();
      this.extractAgeAndBirth();
      this.extractAddress();
      this.extractEducation();
      this.extractSkills();
      this.extractInternships();
      this.extractProjects();
      this.extractCertifications();
      this.extractLanguages();
      this.extractAwards();
      this.extractSocialLinks();
      this.extractJobIntention();

      const confidence = this.calculateConfidence();

      if (!this.profile.name) warnings.push('未能识别姓名');
      if (this.profile.education.length === 0) warnings.push('未能识别教育背景');
      if (this.profile.skills.length === 0) warnings.push('未能识别技能');

      return { profile: this.profile, confidence, warnings };
    } catch (error) {
      throw new Error(`简历解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  private extractBasicInfo(): void {
    // 手机号 - 多种格式
    const phonePatterns = [
      /(?:手机|电话|联系方式|联系电话|Tel|Phone|Mobile)[：:\s]*(\d{11})/i,
      /(?:手机|电话|联系方式|联系电话|Tel|Phone|Mobile)[：:\s]*(\d{3}[-\s]\d{4}[-\s]\d{4})/i,
      /(\d{11})/,  // 裸11位数字
    ];
    for (const pattern of phonePatterns) {
      const match = this.text.match(pattern);
      if (match) {
        this.profile.phone = match[1].replace(/[-\s]/g, '');
        break;
      }
    }

    // 邮箱
    const emailMatch = this.text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (emailMatch) {
      this.profile.email = emailMatch[1];
    }

    // 姓名 - 多种策略
    this.extractName();
  }

  private extractName(): void {
    // 策略1：明确标签
    const namePatterns = [
      /(?:姓名|名字|Name)[：:\s]*([^\s,，\n]{2,4})/i,
    ];
    for (const pattern of namePatterns) {
      const match = this.text.match(pattern);
      if (match && this.isValidName(match[1])) {
        this.profile.name = match[1].trim();
        return;
      }
    }

    // 策略2：第一行是姓名（中文2-4字，或英文名）
    const lines = this.text.split('\n').filter(line => line.trim());
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      if (this.isValidName(firstLine) && !firstLine.includes('@') && !firstLine.match(/^\d/)) {
        this.profile.name = firstLine.replace(/[^\u4e00-\u9fa5a-zA-Z·]/g, '');
        return;
      }
    }

    // 策略3：简历头部区域找中文姓名
    const headerArea = this.text.slice(0, 300);
    const chineseNameMatch = headerArea.match(/([^\x00-\xff]{2,4})/);
    if (chineseNameMatch && this.isValidName(chineseNameMatch[1])) {
      // 确保不是学校名、公司名等
      const excludeWords = ['大学', '学院', '公司', '有限', '集团', '银行', '实习', '项目', '简历', '求职', '个人'];
      if (!excludeWords.some(w => chineseNameMatch[1].includes(w))) {
        this.profile.name = chineseNameMatch[1].trim();
      }
    }
  }

  private isValidName(name: string): boolean {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 10) return false;
    // 纯中文姓名
    if (/^[\u4e00-\u9fa5·]+$/.test(trimmed) && trimmed.length <= 4) return true;
    // 英文姓名
    if (/^[a-zA-Z\s]+$/.test(trimmed) && trimmed.length <= 30) return true;
    // 中英混合
    if (/^[\u4e00-\u9fa5a-zA-Z·\s]+$/.test(trimmed)) return true;
    return false;
  }

  private extractGender(): void {
    const patterns = [
      /(?:性别|Sex|Gender)[：:\s]*(男|女|male|female|M|F)/i,
      /\b(男|女)\s*[|\/\\,，、]\s*(?:\d|19|20)/,  // "男 | 1999" 这种格式
      /(?:男|女)\s*[|\/\\,，、]/,  // "男 |" 格式
    ];

    for (const pattern of patterns) {
      const match = this.text.match(pattern);
      if (match) {
        const val = match[1]?.toLowerCase() || match[0].toLowerCase();
        if (val.includes('男') || val === 'male' || val === 'm') {
          this.profile.gender = '男';
          return;
        }
        if (val.includes('女') || val === 'female' || val === 'f') {
          this.profile.gender = '女';
          return;
        }
      }
    }

    // 从常见格式推断：如 "张三 | 男 | 1999年"
    const pipeFormat = this.text.match(/[|\/\\]\s*(男|女)\s*[|\/\\]/);
    if (pipeFormat) {
      this.profile.gender = pipeFormat[1];
      return;
    }

    // 从个人描述推断：如 "他/她"
    const pronouns = this.text.slice(0, 500);
    if (pronouns.includes('他') && !pronouns.includes('她')) {
      this.profile.gender = '男';
    } else if (pronouns.includes('她') && !pronouns.includes('他')) {
      this.profile.gender = '女';
    }
  }

  private extractAgeAndBirth(): void {
    // 出生年月
    const birthPatterns = [
      /(?:出生|生日|出生日期|出生年月)[：:\s]*(\d{4})[.\-年](\d{1,2})[.\-月]?/i,
      /(\d{4})[.\-年](\d{1,2})[.\-月]?\s*(?:出生)/i,
    ];

    for (const pattern of birthPatterns) {
      const match = this.text.match(pattern);
      if (match) {
        const year = parseInt(match[1]);
        const month = match[2].padStart(2, '0');
        this.profile.birthDate = `${year}-${month}`;
        this.profile.age = new Date().getFullYear() - year;
        return;
      }
    }

    // 年龄直接标注
    const ageMatch = this.text.match(/(?:年龄|Age)[：:\s]*(\d{1,2})/i);
    if (ageMatch) {
      this.profile.age = parseInt(ageMatch[1]);
      return;
    }

    // 从出生年份推断：如 "1999年生" "1999年出生"
    const birthYearMatch = this.text.match(/(\d{4})\s*(?:年|生|出生)/);
    if (birthYearMatch) {
      const year = parseInt(birthYearMatch[1]);
      if (year >= 1960 && year <= 2010) {
        this.profile.age = new Date().getFullYear() - year;
        this.profile.birthDate = `${year}-01`;
      }
    }

    // 从身份证号推断（18位）
    const idMatch = this.text.match(/(\d{6})(\d{4})(\d{2})\d{6}[\dXx]/);
    if (idMatch && !this.profile.birthDate) {
      const year = parseInt(idMatch[2]);
      const month = idMatch[3];
      this.profile.birthDate = `${year}-${month}`;
      this.profile.age = new Date().getFullYear() - year;
    }
  }

  private extractAddress(): void {
    const patterns = [
      /(?:地址|住址|现居|居住地|所在地|Address|Location)[：:\s]*([^\n,，]{2,30})/i,
    ];

    for (const pattern of patterns) {
      const match = this.text.match(pattern);
      if (match) {
        this.profile.address = match[1].trim();
        return;
      }
    }

    // 从常见城市名推断
    const cities = ['北京', '上海', '广州', '深圳', '杭州', '成都', '南京', '武汉', '西安', '重庆',
      '苏州', '天津', '长沙', '郑州', '东莞', '青岛', '合肥', '佛山', '济南', '昆明'];
    const headerArea = this.text.slice(0, 500);
    for (const city of cities) {
      if (headerArea.includes(city + '市') || headerArea.includes(city)) {
        // 确认是地址而非其他上下文
        const cityPattern = new RegExp(city + '(?:市|市[^\\n]{0,10})');
        const m = headerArea.match(cityPattern);
        if (m) {
          this.profile.address = m[0].trim();
          break;
        }
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
      return { school, major, degree, graduationYear: null, startDate: '', endDate: '' };
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

      if (line.includes('实习经历') || line.includes('工作经历') || line.includes('工作经验')) {
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
    const parts = text.split(/[\s,，、|]+/).filter(p => p.length > 0);

    if (parts.length >= 2) {
      return { company: parts[0], position: parts[1] || '', duration: '', description: '', startDate: '', endDate: '' };
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
        const project: Project = { name: line, role: '', description: '' };

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

  private extractAwards(): void {
    const lines = this.text.split('\n');
    let inAwardSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.includes('获奖') || line.includes('荣誉') || line.includes('奖项') || line.includes('证书')) {
        inAwardSection = true;
        continue;
      }

      if (inAwardSection && line.length > 4) {
        // 检测是否进入其他区域
        if (line.includes('实习') || line.includes('项目') || line.includes('教育') || line.includes('技能') || line.includes('自我')) {
          inAwardSection = false;
          continue;
        }

        // 尝试解析奖项
        const levelMatch = line.match(/(国家|省|市|校|院|国际|全球|全国)/);
        const dateMatch = line.match(/(\d{4})[.\-年]/);

        if (levelMatch || line.includes('奖') || line.includes('荣誉') || line.includes('优秀')) {
          this.profile.awards = this.profile.awards || [];
          this.profile.awards.push({
            name: line.replace(/^\d+[.、]\s*/, '').trim(),
            level: levelMatch ? levelMatch[1] + '级' : '',
            date: dateMatch ? dateMatch[1] : '',
          });
        }
      }
    }
  }

  private extractSocialLinks(): void {
    // GitHub
    const githubMatch = this.text.match(/(?:github\.com\/|GitHub[：:\s]*)([a-zA-Z0-9_-]+)/i);
    if (githubMatch) {
      this.profile.github = githubMatch[0].includes('github.com')
        ? `https://github.com/${githubMatch[1]}`
        : githubMatch[1];
    }

    // 个人网站/作品集
    const portfolioMatch = this.text.match(/(?:个人网站|作品集|主页|Portfolio|Website|Blog)[：:\s]*(https?:\/\/[^\s]+)/i);
    if (portfolioMatch) {
      this.profile.portfolio = portfolioMatch[1];
    }

    // LinkedIn
    const linkedinMatch = this.text.match(/(?:linkedin\.com\/in\/)([a-zA-Z0-9_-]+)/i);
    if (linkedinMatch) {
      this.profile.socialLinks = this.profile.socialLinks || [];
      this.profile.socialLinks.push({
        platform: 'LinkedIn',
        url: `https://linkedin.com/in/${linkedinMatch[1]}`,
      });
    }
  }

  private extractJobIntention(): void {
    // 目标职位
    const positionPatterns = [
      /(?:求职意向|意向岗位|目标职位|期望职位|应聘职位|意向职位)[：:\s]*([^\n,，]{2,30})/i,
    ];
    for (const pattern of positionPatterns) {
      const match = this.text.match(pattern);
      if (match) {
        const parts = match[1].split(/[|\/\\,，、\s]+/).filter(Boolean);
        this.profile.targetPosition = parts[0].trim();
        // 有时一行包含多个信息如 "数据分析师 | 上海 | 15-20K"
        if (parts.length >= 2) {
          // 检测城市
          const cities = ['北京', '上海', '广州', '深圳', '杭州', '成都', '南京', '武汉', '西安', '重庆', '苏州', '天津'];
          for (const part of parts.slice(1)) {
            if (cities.some(c => part.includes(c))) {
              this.profile.targetLocation = part.trim();
            }
            if (part.match(/\d+[-~]\d+[Kk万]/)) {
              this.profile.targetSalary = part.trim();
            }
          }
        }
        break;
      }
    }

    // 目标地点
    if (!this.profile.targetLocation) {
      const locationPatterns = [
        /(?:期望城市|期望地点|工作地点|意向城市|目标地点)[：:\s]*([^\n,，]{2,20})/i,
      ];
      for (const pattern of locationPatterns) {
        const match = this.text.match(pattern);
        if (match) {
          this.profile.targetLocation = match[1].trim();
          break;
        }
      }
    }

    // 期望薪资
    if (!this.profile.targetSalary) {
      const salaryPatterns = [
        /(?:期望薪资|期望薪酬|薪资要求|月薪要求|薪资意向)[：:\s]*([^\n]{2,20})/i,
        /(\d{1,5}[-~至到]\d{1,5}\s*[Kk万Ww元])/,
      ];
      for (const pattern of salaryPatterns) {
        const match = this.text.match(pattern);
        if (match) {
          this.profile.targetSalary = match[1].trim();
          break;
        }
      }
    }

    // 目标行业
    const industryPatterns = [
      /(?:期望行业|意向行业|目标行业)[：:\s]*([^\n,，]{2,20})/i,
    ];
    for (const pattern of industryPatterns) {
      const match = this.text.match(pattern);
      if (match) {
        this.profile.targetIndustry = match[1].trim();
        break;
      }
    }

    // 工作类型
    const jobTypeMatch = this.text.match(/(?:工作类型|求职类型)[：:\s]*(全职|实习|兼职|远程)/i);
    if (jobTypeMatch) {
      this.profile.jobTypePreference = jobTypeMatch[1];
    }

    // 到岗时间
    const availabilityMatch = this.text.match(/(?:到岗时间|入职时间|可到岗)[：:\s]*([^\n,，]{2,15})/i);
    if (availabilityMatch) {
      this.profile.availability = availabilityMatch[1].trim();
    }

    // 自我评价
    const selfEvalPatterns = [
      /(?:自我评价|个人评价|个人简介|自我介绍|个人总结)[：:\s]*\n?([\s\S]{20,500}?)(?=\n(?:教育|实习|项目|技能|获奖|证书|$))/i,
    ];
    for (const pattern of selfEvalPatterns) {
      const match = this.text.match(pattern);
      if (match) {
        this.profile.selfEvaluation = match[1].trim();
        break;
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
    let total = 8;

    if (this.profile.name) score += 1;
    if (this.profile.phone || this.profile.email) score += 1;
    if (this.profile.gender) score += 0.5;
    if (this.profile.age || this.profile.birthDate) score += 0.5;
    if (this.profile.education.length > 0) score += 1;
    if (this.profile.skills.length > 0) score += 1;
    if (this.profile.internships.length > 0 || this.profile.projects.length > 0) score += 1;
    if (this.profile.targetPosition || this.profile.targetLocation) score += 1;
    if (this.profile.certifications.length > 0 || this.profile.languages.length > 0) score += 0.5;
    if (this.profile.awards?.length) score += 0.5;

    return Math.min(score / total, 1);
  }
}

export function parseResumeText(text: string): ParseResult {
  const parser = new ResumeParser(text);
  return parser.parse();
}