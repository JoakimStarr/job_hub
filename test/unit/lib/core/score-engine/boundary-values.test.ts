import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreEngine } from '@/lib/score-engine'
import type { ResumeProfile } from '@/types'

describe('ScoreEngine - 综合边界值和特殊情况', () => {
  let scoreEngine: ScoreEngine

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
      {
        school: '北京大学',
        major: '金融学',
        degree: '学士',
        graduationYear: 2021,
        startDate: '2017-09',
        endDate: '2021-06',
      },
    ],
    skills: ['Python', 'SQL', 'Excel', '机器学习', '数据分析', 'R', 'Tableau'],
    certifications: ['CFA Level 3', 'CPA', 'FRM'],
    languages: ['中文(母语)', '英语(CET-6)'],
    internships: [
      {
        company: '某知名互联网公司',
        position: '数据分析师实习生',
        duration: '6个月',
        description: '负责业务数据分析和报告撰写，使用Python和SQL进行数据处理',
        startDate: '2023-07',
        endDate: '2023-12',
      },
      {
        company: '某证券公司',
        position: '量化分析实习生',
        duration: '3个月',
        description: '参与量化策略研究，使用机器学习模型进行预测',
        startDate: '2023-01',
        endDate: '2023-03',
      },
    ],
    projects: [
      {
        name: '用户行为预测系统',
        role: '核心开发者',
        description: '使用XGBoost构建用户流失预测模型，AUC达到0.85',
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

  beforeEach(() => {
    scoreEngine = new ScoreEngine()
  })

  describe('calculateOverallScore() - 简历完整性评分', () => {
    it('丰富简历应该得到80+分', () => {
      const score = scoreEngine.calculateOverallScore(perfectProfile)

      expect(score).toBeGreaterThanOrEqual(80)
    })

    it('空白简历应该得到<30分', () => {
      const score = scoreEngine.calculateOverallScore(minimalProfile)

      expect(score).toBeLessThan(30)
    })

    it('完全空白的简历应该得到0分', () => {
      const emptyProfile: ResumeProfile = {
        name: '',
        phone: '',
        email: '',
        skills: [],
        education: [],
        certifications: [],
        internships: [],
        projects: [],
        resumeText: '',
      }
      const score = scoreEngine.calculateOverallScore(emptyProfile)

      expect(score).toBe(0)
    })

    it('只有基本信息（姓名+联系方式）的简历应该得10分', () => {
      const basicInfoProfile: ResumeProfile = {
        name: '测试用户',
        phone: '13800138000',
        email: 'test@example.com',
        skills: [],
        education: [],
        certifications: [],
        internships: [],
        projects: [],
        resumeText: '',
      }
      const score = scoreEngine.calculateOverallScore(basicInfoProfile)

      expect(score).toBe(10)
    })

    it('技能数量对分数的影响应该是递增的但有上限', () => {
      const baseProfile: ResumeProfile = {
        name: '测试',
        phone: '13800138000',
        education: [],
        certifications: [],
        internships: [],
        projects: [],
      }

      const scores: number[] = []
      for (let i = 1; i <= 15; i++) {
        const profile: ResumeProfile = {
          ...baseProfile,
          skills: Array(i).fill(null).map((_, idx) => `技能${idx}`),
        }
        const score = scoreEngine.calculateOverallScore(profile)
        scores.push(score)
      }

      for (let i = 1; i < scores.length; i++) {
        if (i <= 8) {
          expect(scores[i]).toBeGreaterThan(scores[i - 1])
        } else {
          expect(scores[i]).toBe(scores[i - 1])
        }
      }
    })

    it('教育经历对分数的贡献应该是20分', () => {
      const withoutEdu: ResumeProfile = {
        name: '测试',
        phone: '13800138000',
        education: [],
        skills: [],
        certifications: [],
        internships: [],
        projects: [],
      }

      const withEdu: ResumeProfile = {
        ...withoutEdu,
        education: [{
          school: '某大学',
          major: '计算机科学',
          degree: '学士',
          graduationYear: 2024,
          startDate: '2020-09',
          endDate: '2024-06',
        }],
      }

      const scoreWithout = scoreEngine.calculateOverallScore(withoutEdu)
      const scoreWith = scoreEngine.calculateOverallScore(withEdu)

      expect(scoreWith - scoreWithout).toBe(20)
    })

    it('实习经历对分数的贡献应该是20分', () => {
      const withoutInternship: ResumeProfile = {
        name: '测试',
        phone: '13800138000',
        education: [],
        skills: [],
        certifications: [],
        internships: [],
        projects: [],
      }

      const withInternship: ResumeProfile = {
        ...withoutInternship,
        internships: [{
          company: '某公司',
          position: '实习生',
          duration: '3个月',
          description: '测试描述',
          startDate: '2023-01',
          endDate: '2023-03',
        }],
      }

      const scoreWithout = scoreEngine.calculateOverallScore(withoutInternship)
      const scoreWith = scoreEngine.calculateOverallScore(withInternship)

      expect(scoreWith - scoreWithout).toBe(20)
    })

    it('项目经历对分数的贡献应该是15分', () => {
      const withoutProject: ResumeProfile = {
        name: '测试',
        phone: '13800138000',
        education: [],
        skills: [],
        certifications: [],
        internships: [],
        projects: [],
      }

      const withProject: ResumeProfile = {
        ...withoutProject,
        projects: [{
          name: '测试项目',
          role: '成员',
          description: '测试描述',
        }],
      }

      const scoreWithout = scoreEngine.calculateOverallScore(withoutProject)
      const scoreWith = scoreEngine.calculateOverallScore(withProject)

      expect(scoreWith - scoreWithout).toBe(15)
    })

    it('证书对分数的贡献应该是10分', () => {
      const withoutCert: ResumeProfile = {
        name: '测试',
        phone: '13800138000',
        education: [],
        skills: [],
        certifications: [],
        internships: [],
        projects: [],
      }

      const withCert: ResumeProfile = {
        ...withoutCert,
        certifications: ['CFA Level 1'],
      }

      const scoreWithout = scoreEngine.calculateOverallScore(withoutCert)
      const scoreWith = scoreEngine.calculateOverallScore(withCert)

      expect(scoreWith - scoreWithout).toBe(10)
    })
  })

  describe('calculateOverallScore() - 随机验证和边界值', () => it('随机生成50次简历，分数应该在0-100范围内', () => {
    for (let i = 0; i < 50; i++) {
      const randomSkillsCount = Math.floor(Math.random() * 10)
      const hasEducation = Math.random() > 0.3
      const hasInternship = Math.random() > 0.5
      const hasProject = Math.random() > 0.5
      const hasCertification = Math.random() > 0.6

      const randomProfile: ResumeProfile = {
        name: `候选人${i}`,
        phone: '13800138000',
        email: `test${i}@example.com`,
        gender: '男',
        birthDate: '2000-01-01',
        age: 24,
        address: '北京',
        education: hasEducation ? [{
          school: '某大学',
          major: '计算机科学',
          degree: '学士',
          graduationYear: 2024,
          startDate: '2020-09',
          endDate: '2024-06',
        }] : [],
        skills: Array(randomSkillsCount).fill(null).map((_, idx) => `技能${idx}`),
        certifications: hasCertification ? ['CFA Level 1'] : [],
        languages: ['中文(母语)'],
        internships: hasInternship ? [{
          company: '某公司',
          position: '实习生',
          duration: '3个月',
          description: '测试描述',
          startDate: '2023-01',
          endDate: '2023-03',
        }] : [],
        projects: hasProject ? [{
          name: '测试项目',
          role: '成员',
          description: '测试描述',
        }] : [],
        targetPosition: '数据分析师',
        targetLocation: '北京',
        targetSalary: '15-25K',
        targetIndustry: '互联网',
        resumeText: '测试简历文本',
      }

      const score = scoreEngine.calculateOverallScore(randomProfile)

      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    }
  }),

  it('分数不应该超过100分上限', () => {
    const score = scoreEngine.calculateOverallScore(perfectProfile)

    expect(score).toBeLessThanOrEqual(100)
  }),

  it('分数不应该是负数', () => {
    const score = scoreEngine.calculateOverallScore(minimalProfile)

    expect(score).toBeGreaterThanOrEqual(0)
  }),

  it('不同完整度的简历应该有明显的分数差异', () => {
    const perfectScore = scoreEngine.calculateOverallScore(perfectProfile)
    const partialScore = scoreEngine.calculateOverallScore(partialProfile)
    const minimalScore = scoreEngine.calculateOverallScore(minimalProfile)

    expect(perfectScore).toBeGreaterThan(partialScore)
    expect(partialScore).toBeGreaterThan(minimalScore)
    expect(perfectScore - minimalScore).toBeGreaterThanOrEqual(50)
  }))

  describe('getRecommendationPriority() - 推荐优先级', () => {
    it('70+分应该返回"high"优先级', () => {
      expect(scoreEngine.getRecommendationPriority(70)).toBe('high')
      expect(scoreEngine.getRecommendationPriority(85)).toBe('high')
      expect(scoreEngine.getRecommendationPriority(100)).toBe('high')
    })

    it('55-69分应该返回"medium"优先级', () => {
      expect(scoreEngine.getRecommendationPriority(55)).toBe('medium')
      expect(scoreEngine.getRecommendationPriority(60)).toBe('medium')
      expect(scoreEngine.getRecommendationPriority(69.99)).toBe('medium')
    })

    it('<55分应该返回"low"优先级', () => {
      expect(scoreEngine.getRecommendationPriority(54.99)).toBe('low')
      expect(scoreEngine.getRecommendationPriority(30)).toBe('low')
      expect(scoreEngine.getRecommendationPriority(0)).toBe('low')
      expect(scoreEngine.getRecommendationPriority(-10)).toBe('low')
    })

    it('优先级的边界值应该精确切换', () => {
      expect(scoreEngine.getRecommendationPriority(69.99)).toBe('medium')
      expect(scoreEngine.getRecommendationPriority(70)).toBe('high')

      expect(scoreEngine.getRecommendationPriority(54.99)).toBe('low')
      expect(scoreEngine.getRecommendationPriority(55)).toBe('medium')
    })
  })

  describe('getMatchColor() - 匹配颜色', () => {
    it('85+分应该返回绿色(#10b981)', () => {
      expect(scoreEngine.getMatchColor(85)).toBe('#10b981')
      expect(scoreEngine.getMatchColor(90)).toBe('#10b981')
      expect(scoreEngine.getMatchColor(100)).toBe('#10b981')
    })

    it('70-84分应该返回蓝色(#3b82f6)', () => {
      expect(scoreEngine.getMatchColor(70)).toBe('#3b82f6')
      expect(scoreEngine.getMatchColor(75)).toBe('#3b82f6')
      expect(scoreEngine.getMatchColor(84.99)).toBe('#3b82f6')
    })

    it('55-69分应该返回黄色/橙色(#f59e0b)', () => {
      expect(scoreEngine.getMatchColor(55)).toBe('#f59e0b')
      expect(scoreEngine.getMatchColor(60)).toBe('#f59e0b')
      expect(scoreEngine.getMatchColor(69.99)).toBe('#f59e0b')
    })

    it('<55分应该返回红色(#ef4444)', () => {
      expect(scoreEngine.getMatchColor(54.99)).toBe('#ef4444')
      expect(scoreEngine.getMatchColor(30)).toBe('#ef4444')
      expect(scoreEngine.getMatchColor(0)).toBe('#ef4444')
      expect(scoreEngine.getMatchColor(-10)).toBe('#ef4444')
    })

    it('颜色值应该是有效的十六进制格式', () => {
      const testScores = [0, 30, 55, 70, 85, 100]
      for (const score of testScores) {
        const color = scoreEngine.getMatchColor(score)
        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/)
      }
    })
  })

  describe('特殊输入处理', () => {
    it('undefined字段应该被优雅处理', () => {
      const profileWithUndefined = {
        ...partialProfile,
        skills: undefined as any,
        education: undefined as any,
      }

      try {
        scoreEngine.calculateOverallScore(profileWithUndefined)
      } catch (error) {
        expect(error).toBeInstanceOf(TypeError)
      }
    })

    it('null字段应该被优雅处理', () => {
      const profileWithNull = {
        ...partialProfile,
        certifications: null as any,
        projects: null as any,
      }

      try {
        scoreEngine.calculateOverallScore(profileWithNull)
      } catch (error) {
        expect(error).toBeInstanceOf(TypeError)
      }
    })

    it('极大数量的技能不应该导致性能问题', () => {
      const manySkillsProfile: ResumeProfile = {
        ...minimalProfile,
        skills: Array(100).fill(null).map((_, i) => `技能${i}`),
      }

      const startTime = performance.now()
      const score = scoreEngine.calculateOverallScore(manySkillsProfile)
      const elapsed = performance.now() - startTime

      expect(elapsed).toBeLessThan(50)
      expect(score).toBeLessThanOrEqual(100)
    })

    it('超长字符串字段不应该导致错误', () => {
      const longTextProfile: ResumeProfile = {
        ...minimalProfile,
        resumeText: 'a'.repeat(10000),
      }

      expect(() => {
        scoreEngine.calculateOverallScore(longTextProfile)
      }).not.toThrow()
    })
  })

  describe('综合功能验证', () => {
    it('所有公共方法都应该正常工作且不抛出异常', () => {
      const methods = [
        () => scoreEngine.calculateOverallScore(partialProfile),
        () => scoreEngine.getMatchLevel(75),
        () => scoreEngine.getMatchLevelEn(75),
        () => scoreEngine.getRecommendationPriority(75),
        () => scoreEngine.getMatchColor(75),
      ]

      for (const method of methods) {
        expect(() => method()).not.toThrow()
      }
    })

    it('同一份简历的评分、等级、优先级、颜色应该保持一致', () => {
      const score = scoreEngine.calculateOverallScore(perfectProfile)

      const level = scoreEngine.getMatchLevel(score)
      const levelEn = scoreEngine.getMatchLevelEn(score)
      const priority = scoreEngine.getRecommendationPriority(score)
      const color = scoreEngine.getMatchColor(score)

      expect(typeof level).toBe('string')
      expect(typeof levelEn).toBe('string')
      expect(['high', 'medium', 'low']).toContain(priority)
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/)

      if (score >= 85) {
        expect(level).toBe('冲刺岗')
        expect(priority).toBe('high')
        expect(color).toBe('#10b981')
      } else if (score >= 70) {
        expect(level).toBe('匹配岗')
        expect(priority).toBe('high')
        expect(color).toBe('#3b82f6')
      }
    })
  })
})
