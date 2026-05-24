import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreEngine } from '@/lib/score-engine'
import { MatchEngine } from '@/lib/match-engine'
import type { ResumeProfile, JobItem, MatchScore } from '@/types'

describe('ScoreEngine - 行动计划生成 (generateActionPlan)', () => {
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
    ],
    projects: [
      {
        name: '用户行为预测系统',
        role: '核心开发者',
        description: '使用XGBoost构建用户流失预测模型',
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

  const perfectJob: JobItem = {
    id: 1,
    title: '高级数据分析师',
    company: '某知名互联网公司',
    location: '北京',
    source: 'boss直聘',
    salary: '25-40K',
    description: '需要精通Python、SQL、机器学习，有金融背景优先',
    requirements: '硕士以上学历，3年以上数据分析经验，熟悉Python/SQL/Excel',
    tags: 'Python,SQL,机器学习,数据分析,金融',
    industry: '互联网金融',
    education: '硕士及以上学历',
    experience: '3-5年',
    job_type: '全职',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  }

  const noMatchJob: JobItem = {
    id: 2,
    title: '美容师',
    company: '某美容院',
    location: '三四线城市',
    source: '线下招聘',
    salary: '5-8K',
    description: '负责顾客的美容护理工作',
    requirements: '有美容师证书，形象气质佳',
    tags: '美容,护理,服务',
    industry: '生活服务',
    education: '不限',
    experience: '1-3年',
    job_type: '全职',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  }

  const partialJob: JobItem = {
    id: 3,
    title: '数据分析师助理',
    company: '某咨询公司',
    location: '上海',
    source: '猎聘',
    salary: '10-15K',
    description: '协助高级分析师完成数据处理和分析工作',
    requirements: '本科及以上学历，有一定的数据分析基础',
    tags: '数据分析,Excel',
    industry: '咨询',
    education: '本科及以上',
    experience: '1-3年',
    job_type: '全职',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  }

  const defaultJob: JobItem = {
    id: 4,
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

  beforeEach(() => {
    scoreEngine = new ScoreEngine()
    matchEngine = new MatchEngine()
  })

  describe('"冲刺岗"行动计划 - 强调立即行动', () => {
    it('冲刺岗计划应该包含"优先投递"关键词', () => {
      const matchScore = matchEngine.match(perfectProfile, perfectJob)
      matchScore.total = 90

      const actions = scoreEngine.generateActionPlan(perfectProfile, perfectJob, matchScore)

      expect(actions.length).toBeGreaterThan(0)
      const hasPriorityAction = actions.some(a =>
        a.includes('优先投递') || a.includes('把握机会')
      )
      expect(hasPriorityAction).toBe(true)
    })

    it('冲刺岗计划应该强调突出优势', () => {
      const matchScore = matchEngine.match(perfectProfile, perfectJob)
      matchScore.total = 88

      const actions = scoreEngine.generateActionPlan(perfectProfile, perfectJob, matchScore)

      const hasHighlightAction = actions.some(a =>
        a.includes('突出') || a.includes('技能') || a.includes('项目')
      )
      expect(hasHighlightAction).toBe(true)
    })

    it('冲刺岗计划应该包含面试准备建议', () => {
      const matchScore = matchEngine.match(perfectProfile, perfectJob)
      matchScore.total = 92

      const actions = scoreEngine.generateActionPlan(perfectProfile, perfectJob, matchScore)

      const hasInterviewPrep = actions.some(a =>
        a.includes('面试')
      )
      expect(hasInterviewPrep).toBe(true)
    })

    it('冲刺岗计划应该至少有3条基础行动', () => {
      const matchScore = matchEngine.match(perfectProfile, perfectJob)
      matchScore.total = 85

      const actions = scoreEngine.generateActionPlan(perfectProfile, perfectJob, matchScore)

      expect(actions.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('"挑战岗"行动计划 - 强调提升能力', () => {
    it('挑战岗计划应该包含"提升能力"相关内容', () => {
      const matchScore = matchEngine.match(minimalProfile, noMatchJob)
      matchScore.total = 30

      const actions = scoreEngine.generateActionPlan(minimalProfile, noMatchJob, matchScore)

      const hasImproveAction = actions.some(a =>
        a.includes('提升') || a.includes('能力')
      )
      expect(hasImproveAction).toBe(true)
    })

    it('挑战岗计划应该建议寻找更匹配的岗位', () => {
      const matchScore = matchEngine.match(minimalProfile, noMatchJob)
      matchScore.total = 40

      const actions = scoreEngine.generateActionPlan(minimalProfile, noMatchJob, matchScore)

      const hasFindBetterJob = actions.some(a =>
        a.includes('更匹配') || a.includes('其他')
      )
      expect(hasFindBetterJob).toBe(true)
    })

    it('挑战岗计划应该建议通过实习或项目积累经验', () => {
      const matchScore = matchEngine.match(minimalProfile, noMatchJob)
      matchScore.total = 45

      const actions = scoreEngine.generateActionPlan(minimalProfile, noMatchJob, matchScore)

      const hasExperienceSuggestion = actions.some(a =>
        a.includes('实习') || a.includes('项目') || a.includes('积累')
      )
      expect(hasExperienceSuggestion).toBe(true)
    })

    it('挑战岗计划不应该鼓励立即投递', () => {
      const matchScore = matchEngine.match(minimalProfile, noMatchJob)
      matchScore.total = 35

      const actions = scoreEngine.generateActionPlan(minimalProfile, noMatchJob, matchScore)

      const hasImmediateApply = actions.some(a =>
        a.includes('优先投递') || a.includes('尽快投递')
      )
      expect(hasImmediateApply).toBe(false)
    })
  })

  describe('"匹配岗"行动计划 - 平衡型策略', () => {
    it('匹配岗计划应该建议尽快投递', () => {
      const matchScore = matchEngine.match(partialProfile, partialJob)
      matchScore.total = 75

      const actions = scoreEngine.generateActionPlan(partialProfile, partialJob, matchScore)

      const hasQuickApply = actions.some(a =>
        a.includes('尽快投递') || a.includes('投递')
      )
      expect(hasQuickApply).toBe(true)
    })

    it('匹配岗计划应该建议补充技能', () => {
      const matchScore = matchEngine.match(partialProfile, partialJob)
      matchScore.total = 72

      const actions = scoreEngine.generateActionPlan(partialProfile, partialJob, matchScore)

      const hasSkillSupplement = actions.some(a =>
        a.includes('补充') && a.includes('技能')
      )
      expect(hasSkillSupplement).toBe(true)
    })

    it('匹配岗计划应该准备项目经历介绍', () => {
      const matchScore = matchEngine.match(partialProfile, partialJob)
      matchScore.total = 78

      const actions = scoreEngine.generateActionPlan(partialProfile, partialJob, matchScore)

      const hasProjectPrep = actions.some(a =>
        a.includes('项目')
      )
      expect(hasProjectPrep).toBe(true)
    })
  })

  describe('"潜力岗"行动计划 - 发展型策略', () => {
    it('潜力岗计划应该建议补充技能后投递', () => {
      const profileWithSomeSkills: ResumeProfile = {
        ...minimalProfile,
        name: '潜力候选人',
        phone: '13700137000',
        skills: ['Python'],
        education: [{
          school: '某大学',
          major: '计算机科学',
          degree: '学士',
          graduationYear: 2023,
          startDate: '2019-09',
          endDate: '2023-06',
        }],
      }
      const jobRequiringMoreSkills: JobItem = {
        ...defaultJob,
        description: '需要Python、SQL、机器学习技能',
        requirements: '本科以上学历，有项目经验优先',
      }

      const matchScore = matchEngine.match(profileWithSomeSkills, jobRequiringMoreSkills)
      matchScore.total = 60

      const actions = scoreEngine.generateActionPlan(profileWithSomeSkills, jobRequiringMoreSkills, matchScore)

      const hasSkillFirst = actions.some(a =>
        a.includes('补充') && (a.includes('技能') || a.includes('后投递'))
      )
      expect(hasSkillFirst).toBe(true)
    })

    it('潜力岗计划应该提到证书或项目的弥补作用', () => {
      const matchScore = matchEngine.match(partialProfile, defaultJob)
      matchScore.total = 58

      const actions = scoreEngine.generateActionPlan(partialProfile, defaultJob, matchScore)

      const hasCompensateMention = actions.some(a =>
        (a.includes('证书') || a.includes('项目')) && a.includes('弥补')
      )
      expect(hasCompensateMention).toBe(true)
    })

    it('潜力岗计划应该建议关注类似岗位', () => {
      const matchScore = matchEngine.match(partialProfile, defaultJob)
      matchScore.total = 62

      const actions = scoreEngine.generateActionPlan(partialProfile, defaultJob, matchScore)

      const hasSimilarJobSuggestion = actions.some(a =>
        a.includes('类似') || a.includes('关注')
      )
      expect(hasSimilarJobSuggestion).toBe(true)
    })
  })

  describe('行动计划具体性和可执行性', () => {
    it('所有行动建议都应该是具体的而非空泛的', () => {
      const testProfiles = [perfectProfile, partialProfile, minimalProfile]

      for (const profile of testProfiles) {
        const matchScore = matchEngine.match(profile, defaultJob)
        const actions = scoreEngine.generateActionPlan(profile, defaultJob, matchScore)

        for (const action of actions) {
          expect(action.length).toBeGreaterThanOrEqual(5)
          expect(typeof action).toBe('string')
        }
      }
    })

    it('行动建议应该包含明确的动词或行动导向词汇', () => {
      const matchScore = matchEngine.match(partialProfile, defaultJob)
      const actions = scoreEngine.generateActionPlan(partialProfile, defaultJob, matchScore)

      const actionVerbs = ['建议', '准备', '补充', '通过', '关注', '寻找', '重点']
      for (const action of actions) {
        expect(action.length).toBeGreaterThanOrEqual(5)
        expect(typeof action).toBe('string')
      }
    })

    it('当存在差距时，应该重点改进第一个差距', () => {
      const profileNoSkills: ResumeProfile = {
        ...partialProfile,
        skills: [],
      }
      const jobWithRequirements: JobItem = {
        ...defaultJob,
        description: '需要Python和SQL技能',
        requirements: '熟练使用Python进行数据分析',
      }

      const matchScore = matchEngine.match(profileNoSkills, jobWithRequirements)

      if (matchScore.gaps.length > 0) {
        const actions = scoreEngine.generateActionPlan(profileNoSkills, jobWithRequirements, matchScore)
        const hasGapFocus = actions.some(a =>
          a.includes('重点改进') && a.includes(matchScore.gaps[0])
        )
        expect(hasGapFocus).toBe(true)
      }
    })

    it('行动建议数量应该在合理范围内', () => {
      const testCases = [
        { profile: perfectProfile, expectedMin: 3 },
        { profile: partialProfile, expectedMin: 3 },
        { profile: minimalProfile, expectedMin: 3 },
      ]

      for (const { profile, expectedMin } of testCases) {
        const matchScore = matchEngine.match(profile, defaultJob)
        const actions = scoreEngine.generateActionPlan(profile, defaultJob, matchScore)

        expect(actions.length).toBeGreaterThanOrEqual(expectedMin)
        expect(actions.length).toBeLessThanOrEqual(6)
      }
    })
  })

  describe('不同分数边界的行动计划差异', () => {
    it('84.99分（匹配岗）vs 85分（冲刺岗）的计划应该有明显区别', () => {
      const baseMatchScore = matchEngine.match(partialProfile, defaultJob)

      const matchScoreLow: MatchScore = { ...baseMatchScore, total: 84.99 }
      const matchScoreHigh: MatchScore = { ...baseMatchScore, total: 85 }

      const actionsLow = scoreEngine.generateActionPlan(partialProfile, defaultJob, matchScoreLow)
      const actionsHigh = scoreEngine.generateActionPlan(partialProfile, defaultJob, matchScoreHigh)

      const highHasPriority = actionsHigh.some(a => a.includes('优先投递'))

      expect(highHasPriority).toBe(true)
    })

    it('54.99分（挑战岗）vs 55分（潜力岗）的计划应该有明显区别', () => {
      const baseMatchScore = matchEngine.match(partialProfile, defaultJob)

      const matchScoreLow: MatchScore = { ...baseMatchScore, total: 54.99 }
      const matchScoreHigh: MatchScore = { ...baseMatchScore, total: 55 }

      const actionsLow = scoreEngine.generateActionPlan(partialProfile, defaultJob, matchScoreLow)
      const actionsHigh = scoreEngine.generateActionPlan(partialProfile, defaultJob, matchScoreHigh)

      const lowHasImprove = actionsLow.some(a => a.includes('提升'))
      const highHasSupplement = actionsHigh.some(a => a.includes('补充'))

      expect(lowHasImprove || highHasSupplement).toBe(true)
    })
  })
})
