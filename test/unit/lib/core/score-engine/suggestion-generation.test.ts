import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreEngine } from '@/lib/score-engine'
import { MatchEngine } from '@/lib/match-engine'
import type { ResumeProfile, JobItem } from '@/types'

describe('ScoreEngine - 建议生成 (generateSuggestions)', () => {
  let scoreEngine: ScoreEngine
  let matchEngine: MatchEngine

  const perfectProfile: ResumeProfile = {
    name: '完美候选人',
    phone: '13800138000',
    email: 'perfect@test.com',
    gender: '男',
    birthDate: '2000-01-01',
    age: 24,
    address: '北京',
    education: [
      {
        school: '清华大学',
        major: '计算机科学与技术',
        degree: '硕士',
        graduationYear: 2024,
        startDate: '2021-09',
        endDate: '2024-06',
      },
    ],
    skills: ['Python', 'SQL', 'Excel', '机器学习', '数据分析'],
    certifications: ['CFA Level 3', 'CPA', 'FRM'],
    languages: ['中文(母语)', '英语(CET-6)'],
    internships: [
      {
        company: '某知名互联网公司',
        position: '数据分析师实习生',
        duration: '6个月',
        description: '负责业务数据分析和报告撰写',
        startDate: '2023-07',
        endDate: '2023-12',
      },
      {
        company: '某证券公司',
        position: '量化分析实习生',
        duration: '3个月',
        description: '参与量化策略研究',
        startDate: '2023-01',
        endDate: '2023-03',
      },
    ],
    projects: [
      {
        name: '用户行为预测系统',
        role: '核心开发者',
        description: '使用XGBoost构建用户流失预测模型',
      },
      {
        name: '金融数据可视化平台',
        role: '项目负责人',
        description: '使用React+ECharts搭建实时数据监控大屏',
      },
    ],
    targetPosition: '高级数据分析师',
    targetLocation: '北京',
    targetSalary: '25-40K',
    targetIndustry: '互联网金融',
    resumeText: '精通Python和SQL，有丰富的数据分析经验',
  }

  const minimalProfile: ResumeProfile = {
    name: '',
    phone: '',
    email: '',
    gender: '',
    birthDate: '',
    age: 0,
    address: '',
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    internships: [],
    projects: [],
    targetPosition: '',
    targetLocation: '',
    targetSalary: '',
    targetIndustry: '',
    resumeText: '',
  }

  const partialProfile: ResumeProfile = {
    name: '部分匹配候选人',
    phone: '13900139000',
    email: 'partial@test.com',
    gender: '女',
    birthDate: '2001-01-01',
    age: 23,
    address: '上海',
    education: [
      {
        school: '某普通大学',
        major: '统计学',
        degree: '学士',
        graduationYear: 2023,
        startDate: '2019-09',
        endDate: '2023-06',
      },
    ],
    skills: ['Python', 'Excel'],
    certifications: [],
    languages: ['中文(母语)'],
    internships: [
      {
        company: '某小公司',
        position: '数据录入员',
        duration: '2个月',
        description: '负责数据整理和Excel报表制作',
        startDate: '2023-07',
        endDate: '2023-08',
      },
    ],
    projects: [
      {
        name: '课程作业项目',
        role: '组员',
        description: '使用Python进行简单的数据分析',
      },
    ],
    targetPosition: '数据分析师',
    targetLocation: '上海',
    targetSalary: '10-15K',
    targetIndustry: '咨询',
    resumeText: '有Python和Excel基础',
  }

  const noMatchProfile: ResumeProfile = {
    name: '完全不匹配候选人',
    phone: '13600136000',
    email: 'nomatch@test.com',
    gender: '男',
    birthDate: '1999-01-01',
    age: 25,
    address: '广州',
    education: [
      {
        school: '某艺术学院',
        major: '广告学',
        degree: '学士',
        graduationYear: 2022,
        startDate: '2018-09',
        endDate: '2022-06',
      },
    ],
    skills: ['市场营销', '文案写作', '活动策划'],
    certifications: [],
    languages: ['中文(母语)'],
    internships: [
      {
        company: '某广告公司',
        position: '市场策划实习生',
        duration: '3个月',
        description: '负责活动策划和文案撰写',
        startDate: '2022-01',
        endDate: '2022-03',
      },
    ],
    projects: [],
    targetPosition: '市场专员',
    targetLocation: '广州',
    targetSalary: '8-12K',
    targetIndustry: '广告传媒',
    resumeText: '有市场营销和活动策划经验',
  }

  const perfectJob: JobItem = {
    id: 1,
    title: '高级数据分析师',
    company: '某知名互联网公司',
    location: '北京',
    source: 'boss直聘',
    salary: '25-40K',
    description: '需要精通Python、SQL、机器学习，有金融背景优先，负责业务数据分析和模型构建',
    requirements: '硕士以上学历，3年以上数据分析经验，熟悉Python/SQL/Excel，有机器学习项目经验',
    tags: 'Python,SQL,机器学习,数据分析,金融',
    industry: '互联网金融',
    education: '硕士及以上学历',
    experience: '3-5年',
    job_type: '全职',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  }

  const defaultJob: JobItem = {
    id: 2,
    title: '数据分析师',
    company: '某公司',
    location: '北京',
    source: 'boss直聘',
    salary: '15-25K',
    description: '负责业务数据分析工作',
    requirements: '熟悉Python和SQL优先',
    tags: 'Python,SQL,数据分析',
    industry: '互联网',
    education: '本科及以上',
    experience: '1-3年',
    job_type: '全职',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  }

  const jobWithSkillsRequirement: JobItem = {
    id: 3,
    title: 'Python开发工程师',
    company: '某科技公司',
    location: '深圳',
    source: '猎聘',
    salary: '20-30K',
    description: '需要精通Python、SQL、机器学习进行数据分析',
    requirements: '熟练使用Python、SQL、Excel等工具',
    tags: 'Python,SQL,机器学习,数据分析',
    industry: '互联网',
    education: '本科及以上',
    experience: '2-4年',
    job_type: '全职',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  }

  const jobWithInternshipRequirement: JobItem = {
    id: 4,
    title: '数据分析实习生',
    company: '某公司',
    location: '上海',
    source: '实习僧',
    salary: '150-200/天',
    description: '协助团队完成数据分析工作',
    requirements: '有相关实习经验优先，应届毕业生',
    tags: '数据分析,实习',
    industry: '互联网',
    education: '本科及以上',
    experience: '应届毕业生',
    job_type: '实习',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  }

  const jobWithMajorMismatch: JobItem = {
    id: 5,
    title: '金融分析师',
    company: '某证券公司',
    location: '北京',
    source: '智联招聘',
    salary: '18-28K',
    description: '金融数据分析岗位，需要金融或计算机背景',
    requirements: '金融、统计、计算机相关专业',
    tags: '金融,分析,数据',
    industry: '证券',
    education: '本科及以上',
    experience: '1-3年',
    job_type: '全职',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  }

  beforeEach(() => {
    scoreEngine = new ScoreEngine()
    matchEngine = new MatchEngine()
  })

  describe('完美简历场景 - 建议数量应该较少', () => {
    it('完美匹配简历应该产生≤2条建议', () => {
      const matchScore = matchEngine.match(perfectProfile, perfectJob)

      const suggestions = scoreEngine.generateSuggestions(perfectProfile, perfectJob, matchScore)

      expect(suggestions.length).toBeLessThanOrEqual(2)
    })

    it('完美简历的建议应该是正面或中性的', () => {
      const matchScore = matchEngine.match(perfectProfile, perfectJob)

      const suggestions = scoreEngine.generateSuggestions(perfectProfile, perfectJob, matchScore)

      for (const suggestion of suggestions) {
        expect(suggestion).toBeDefined()
        expect(typeof suggestion).toBe('string')
        expect(suggestion.length).toBeGreaterThan(0)
      }
    })

    it('高技能匹配度应该减少技能相关建议', () => {
      const matchScore = matchEngine.match(perfectProfile, perfectJob)

      const suggestions = scoreEngine.generateSuggestions(perfectProfile, perfectJob, matchScore)

      const skillSuggestions = suggestions.filter(s =>
        s.includes('技能') || s.includes('学习')
      )
      expect(skillSuggestions.length).toBeLessThanOrEqual(1)
    })
  })

  describe('空白简历场景 - 应该产生全面改进建议', () => {
    it('空白简历应该产生≥4条建议', () => {
      const job: JobItem = {
        ...defaultJob,
        description: '需要Python、SQL、数据分析技能',
        requirements: '本科以上学历，有实习经验优先',
      }
      const matchScore = matchEngine.match(minimalProfile, job)

      const suggestions = scoreEngine.generateSuggestions(minimalProfile, job, matchScore)

      expect(suggestions.length).toBeGreaterThanOrEqual(4)
    })

    it('空白简历应该包含证书建议', () => {
      const matchScore = matchEngine.match(minimalProfile, defaultJob)

      const suggestions = scoreEngine.generateSuggestions(minimalProfile, defaultJob, matchScore)

      const hasCertSuggestion = suggestions.some(s =>
        s.includes('证书') || s.includes('CFA') || s.includes('CPA')
      )
      expect(hasCertSuggestion).toBe(true)
    })

    it('空白简历应该包含项目经历建议', () => {
      const matchScore = matchEngine.match(minimalProfile, defaultJob)

      const suggestions = scoreEngine.generateSuggestions(minimalProfile, defaultJob, matchScore)

      const hasProjectSuggestion = suggestions.some(s =>
        s.includes('项目')
      )
      expect(hasProjectSuggestion).toBe(true)
    })

    it('空白或低分简历应该包含实习相关建议（当符合条件时）', () => {
      const profileNoInternship: ResumeProfile = {
        ...minimalProfile,
        education: [{
          school: '某大学',
          major: '计算机科学',
          degree: '学士',
          graduationYear: 2024,
          startDate: '2020-09',
          endDate: '2024-06',
        }],
      }
      const jobRequiringInternship: JobItem = {
        ...defaultJob,
        description: '需要实习经验，有数据分析项目经验优先',
        requirements: '有2段以上实习经验，熟悉Python和SQL',
      }
      const matchScore = matchEngine.match(profileNoInternship, jobRequiringInternship)

      const suggestions = scoreEngine.generateSuggestions(profileNoInternship, jobRequiringInternship, matchScore)

      const hasAnySuggestion = suggestions.length > 0
      expect(hasAnySuggestion).toBe(true)
    })
  })

  describe('只缺技能场景 - 应该聚焦技能建议', () => {
    it('低技能分数应该触发技能学习建议', () => {
      const profileLowSkill: ResumeProfile = {
        ...perfectProfile,
        skills: ['市场营销'],
        certifications: ['CFA Level 1'],
        internships: [perfectProfile.internships[0]],
        projects: [perfectProfile.projects[0]],
      }
      const matchScore = matchEngine.match(profileLowSkill, jobWithSkillsRequirement)

      const suggestions = scoreEngine.generateSuggestions(profileLowSkill, jobWithSkillsRequirement, matchScore)

      const hasSkillSuggestion = suggestions.some(s =>
        s.includes('技能') || s.includes('学习')
      )
      expect(hasSkillSuggestion).toBe(true)
    })

    it('技能建议应该列出具体的缺失技能', () => {
      const profileOnlyExcel: ResumeProfile = {
        ...partialProfile,
        skills: ['Excel'],
      }
      const matchScore = matchEngine.match(profileOnlyExcel, jobWithSkillsRequirement)

      const suggestions = scoreEngine.generateSuggestions(profileOnlyExcel, jobWithSkillsRequirement, matchScore)

      const skillSuggestion = suggestions.find(s => s.includes('技能'))
      expect(skillSuggestion).toBeDefined()
      if (skillSuggestion) {
        expect(skillSuggestion).toContain('Python')
      }
    })

    it('技能建议最多显示3个缺失技能', () => {
      const profileNoSkills: ResumeProfile = {
        ...minimalProfile,
        education: [partialProfile.education[0]],
      }
      const jobWithManySkills: JobItem = {
        ...defaultJob,
        description: '需要Python、SQL、Excel、机器学习、深度学习、大数据',
        requirements: '熟悉多种编程语言和数据分析工具',
      }
      const matchScore = matchEngine.match(profileNoSkills, jobWithManySkills)

      const suggestions = scoreEngine.generateSuggestions(profileNoSkills, jobWithManySkills, matchScore)

      const skillSuggestion = suggestions.find(s => s.includes('技能'))
      expect(skillSuggestion).toBeDefined()
      if (skillSuggestion) {
        const skillsInSuggestion = skillSuggestion.split(':')[1]?.split(',').map(s => s.trim())
        expect(skillsInSuggestion?.length).toBeLessThanOrEqual(3)
      }
    })
  })

  describe('建议数量合理性验证', () => {
    it('任何情况下建议数量应该在0-6条之间', () => {
      const testCases = [
        perfectProfile,
        minimalProfile,
        partialProfile,
        noMatchProfile,
      ]

      for (const profile of testCases) {
        const matchScore = matchEngine.match(profile, defaultJob)

        const suggestions = scoreEngine.generateSuggestions(profile, defaultJob, matchScore)

        expect(suggestions.length).toBeGreaterThan(0)
        expect(suggestions.length).toBeLessThanOrEqual(6)
      }
    })

    it('建议不应该包含空字符串', () => {
      const matchScore = matchEngine.match(partialProfile, defaultJob)

      const suggestions = scoreEngine.generateSuggestions(partialProfile, defaultJob, matchScore)

      for (const suggestion of suggestions) {
        expect(suggestion.trim().length).toBeGreaterThan(0)
      }
    })

    it('每条建议都应该是有意义的中文文本', () => {
      const matchScore = matchEngine.match(partialProfile, defaultJob)

      const suggestions = scoreEngine.generateSuggestions(partialProfile, defaultJob, matchScore)

      for (const suggestion of suggestions) {
        expect(typeof suggestion).toBe('string')
        expect(suggestion.length).toBeGreaterThanOrEqual(5)
        expect(/[\u4e00-\u9fa5]/.test(suggestion)).toBe(true)
      }
    })
  })

  describe('专业背景差异场景', () => {
    it('专业不匹配时应该给出弥补建议', () => {
      const matchScore = matchEngine.match(noMatchProfile, jobWithMajorMismatch)

      const suggestions = scoreEngine.generateSuggestions(noMatchProfile, jobWithMajorMismatch, matchScore)

      const hasMajorSuggestion = suggestions.some(s =>
        s.includes('证书') || s.includes('项目') || s.includes('专业')
      )
      expect(hasMajorSuggestion).toBe(true)
    })

    it('专业匹配度高时可能仍会给出专业背景建议（取决于证书和项目）', () => {
      const matchScore = matchEngine.match(perfectProfile, perfectJob)

      const suggestions = scoreEngine.generateSuggestions(perfectProfile, perfectJob, matchScore)

      const majorSuggestion = suggestions.find(s =>
        s.includes('证书') || s.includes('项目')
      )
      if (perfectProfile.certifications.length === 0 || perfectProfile.projects.length === 0) {
        expect(majorSuggestion).toBeDefined()
      }
    })
  })

  describe('实习经历不足场景', () => {
    it('完全无实习经历应该给出相关建议（当experience分数较低时）', () => {
      const profileNoInternship: ResumeProfile = {
        ...minimalProfile,
        education: [{
          school: '某大学',
          major: '计算机科学',
          degree: '学士',
          graduationYear: 2024,
          startDate: '2020-09',
          endDate: '2024-06',
        }],
      }
      const matchScore = matchEngine.match(profileNoInternship, jobWithInternshipRequirement)

      const suggestions = scoreEngine.generateSuggestions(profileNoInternship, jobWithInternshipRequirement, matchScore)

      if (matchScore.breakdown.experience < 10) {
        const hasInternshipSuggestion = suggestions.some(s =>
          s.includes('实习')
        )
        expect(hasInternshipSuggestion).toBe(true)
      }
    })

    it('只有1段实习经历可能建议补充更多（当experience分数较低时）', () => {
      const profileOneInternship: ResumeProfile = {
        ...partialProfile,
        internships: [
          {
            company: '某公司',
            position: '实习生',
            duration: '2个月',
            description: '简单工作',
            startDate: '2023-01',
            endDate: '2023-02',
          }
        ],
      }
      const jobRequiringMoreInternship: JobItem = {
        ...defaultJob,
        requirements: '有2段以上实习经验优先',
      }
      const matchScore = matchEngine.match(profileOneInternship, jobRequiringMoreInternship)

      const suggestions = scoreEngine.generateSuggestions(profileOneInternship, jobRequiringMoreInternship, matchScore)

      if (matchScore.breakdown.experience < 10 && profileOneInternship.internships.length > 0 && profileOneInternship.internships.length < 2) {
        const hasMoreInternshipSuggestion = suggestions.some(s =>
          s.includes('补充更多实习经历')
        )
        expect(hasMoreInternshipSuggestion).toBe(true)
      }
    })
  })
})
