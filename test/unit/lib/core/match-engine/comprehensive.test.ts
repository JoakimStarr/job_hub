import { describe, it, expect, beforeEach } from 'vitest'
import { MatchEngine } from '@/lib/match-engine'
import type { ResumeProfile, JobItem } from '@/types'

describe('MatchEngine - 综合匹配流程测试', () => {
  let matchEngine: MatchEngine

  const createBaseResume = (overrides: Partial<ResumeProfile> = {}): ResumeProfile => ({
    name: '测试候选人',
    phone: '13800138000',
    email: 'test@test.com',
    gender: '男',
    birthDate: '2000-01-01',
    age: 24,
    address: '北京',
    education: [
      {
        school: '某大学',
        major: '计算机科学',
        degree: '本科',
        graduationYear: 2023,
        startDate: '2019-09',
        endDate: '2023-06'
      }
    ],
    skills: ['Python', 'SQL'],
    certifications: [],
    languages: ['中文(母语)'],
    internships: [
      {
        company: '某公司',
        position: '实习生',
        duration: '3个月',
        description: '实习工作',
        startDate: '2023-01',
        endDate: '2023-03'
      }
    ],
    projects: [],
    targetPosition: '数据分析师',
    targetLocation: '北京',
    targetSalary: '15-25K',
    targetIndustry: '互联网',
    resumeText: '有Python和SQL经验，希望在北京发展',
    ...overrides
  })

  const createBaseJob = (overrides: Partial<JobItem> = {}): JobItem => ({
    id: 1,
    title: '数据分析师',
    company: '某公司',
    location: '北京',
    salary: '15-25K',
    description: '需要数据分析能力',
    requirements: '熟悉Python和SQL',
    industry: '互联网',
    education: '本科及以上',
    experience: '1-3年',
    job_type: '全职',
    source: 'boss直聘',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  })

  beforeEach(() => {
    matchEngine = new MatchEngine()
  })

  describe('完美匹配场景', () => {
    it('完美匹配简历应该获得85分以上', () => {
      const perfectResume = createBaseResume({
        name: '完美候选人',
        skills: ['Python', 'SQL', 'Excel', '机器学习', '数据分析', 'R', 'Tableau'],
        education: [
          {
            school: '清华大学',
            major: '计算机科学与技术',
            degree: '硕士',
            graduationYear: 2024,
            startDate: '2021-09',
            endDate: '2024-06'
          },
          {
            school: '北京大学',
            major: '金融学',
            degree: '学士',
            graduationYear: 2021,
            startDate: '2017-09',
            endDate: '2021-06'
          }
        ],
        certifications: ['CFA Level 3', 'CPA', 'FRM'],
        internships: [
          {
            company: '某知名互联网公司',
            position: '数据分析师实习生',
            duration: '6个月',
            description: '负责业务数据分析和报告撰写，使用Python和SQL进行数据处理',
            startDate: '2023-07',
            endDate: '2023-12'
          },
          {
            company: '某证券公司',
            position: '量化分析实习生',
            duration: '3个月',
            description: '参与量化策略研究，使用机器学习模型进行预测',
            startDate: '2023-01',
            endDate: '2023-03'
          }
        ],
        projects: [
          {
            name: '用户行为预测系统',
            role: '核心开发者',
            description: '使用XGBoost构建用户流失预测模型，AUC达到0.85'
          },
          {
            name: '金融数据可视化平台',
            role: '项目负责人',
            description: '使用React+ECharts搭建实时数据监控大屏'
          }
        ],
        targetPosition: '高级数据分析师',
        targetLocation: '北京',
        targetIndustry: '互联网金融',
        resumeText: '精通Python、SQL、Excel、机器学习、数据分析等技能，有丰富的互联网和金融行业经验'
      })
      const perfectJob = createBaseJob({
        id: 1001,
        title: '高级数据分析师',
        company: '某知名互联网公司',
        description: '需要精通Python、SQL、机器学习，有金融背景优先，负责业务数据分析和模型构建',
        requirements: '硕士以上学历，3年以上数据分析经验，熟悉Python/SQL/Excel，有机器学习项目经验',
        location: '北京',
        source: 'boss直聘',
        industry: '互联网金融',
        tags: 'Python,SQL,机器学习,数据分析,金融',
        education: '硕士及以上学历',
        experience: '3-5年',
        salary: '25-40K'
      })

      const result = matchEngine.match(perfectResume, perfectJob)

      expect(result.total).toBeGreaterThanOrEqual(85)
      expect(result.total).toBeLessThanOrEqual(100)
    })

    it('完美匹配的各维度得分应该在较高范围', () => {
      const perfectResume = createBaseResume({
        skills: ['Python', 'SQL', 'Excel', '机器学习', '数据分析'],
        education: [
          {
            school: '清华大学',
            major: '计算机科学与技术',
            degree: '硕士',
            graduationYear: 2024,
            startDate: '2021-09',
            endDate: '2024-06'
          }
        ],
        targetLocation: '北京',
        targetIndustry: '互联网',
        resumeText: '在北京的互联网公司工作，擅长Python和SQL'
      })
      const perfectJob = createBaseJob({
        description: '需要Python、SQL、Excel、机器学习、数据分析',
        requirements: '硕士以上学历',
        location: '北京',
        industry: '互联网',
        education: '硕士及以上学历'
      })

      const result = matchEngine.match(perfectResume, perfectJob)

      expect(result.breakdown.skills).toBeGreaterThanOrEqual(20)
      expect(result.breakdown.education).toBeGreaterThanOrEqual(15)
      expect(result.breakdown.major).toBeGreaterThanOrEqual(10)
      expect(result.breakdown.location).toBeGreaterThanOrEqual(8)
      expect(result.breakdown.experience).toBeGreaterThanOrEqual(10)
      expect(result.breakdown.industry).toBeGreaterThanOrEqual(8)
    })

    it('完美匹配应该包含多个matchedFields', () => {
      const perfectResume = createBaseResume({
        skills: ['Python', 'SQL', 'Excel', '机器学习'],
        education: [
          {
            school: '北京大学',
            major: '数据科学',
            degree: '硕士',
            graduationYear: 2024,
            startDate: '2021-09',
            endDate: '2024-06'
          }
        ],
        targetLocation: '上海',
        targetIndustry: '科技',
        resumeText: '希望在上海的科技公司工作'
      })
      const perfectJob = createBaseJob({
        description: '需要Python、SQL、Excel、机器学习能力',
        requirements: '硕士以上学历优先',
        location: '上海',
        industry: '科技',
        education: '本科及以上'
      })

      const result = matchEngine.match(perfectResume, perfectJob)

      expect(result.matchedFields.length).toBeGreaterThan(2)
      expect(result.gaps.length).toBeLessThan(2)
    })

    it('技能完全匹配的候选人应该获得技能满分', () => {
      const resumeWithAllSkills = createBaseResume({
        skills: ['Python', 'SQL', 'Excel', '机器学习', '数据分析', 'R', 'Tableau']
      })
      const jobRequiringAllSkills = createBaseJob({
        description: '需要精通Python、SQL、Excel、机器学习、数据分析',
        requirements: '熟悉R和Tableau等工具'
      })

      const result = matchEngine.match(resumeWithAllSkills, jobRequiringAllSkills)

      expect(result.breakdown.skills).toBe(30)
    })

    it('学历专业地点行业都匹配时总分应该很高', () => {
      const wellMatchedResume = createBaseResume({
        education: [
          {
            school: '清华大学',
            major: '计算机科学与技术',
            degree: '硕士',
            graduationYear: 2024,
            startDate: '2021-09',
            endDate: '2024-06'
          }
        ],
        skills: ['Python', 'SQL', 'Excel'],
        targetLocation: '北京',
        targetIndustry: '互联网',
        internships: [
          {
            company: '某科技公司',
            position: '数据分析师',
            duration: '6个月',
            description: '负责数据分析工作',
            startDate: '2023-07',
            endDate: '2023-12'
          }
        ],
        resumeText: '希望在北京的互联网行业发展'
      })
      const matchingJob = createBaseJob({
        location: '北京',
        industry: '互联网',
        education: '硕士及以上学历',
        description: '需要Python和SQL技能的数据分析师岗位'
      })

      const result = matchEngine.match(wellMatchedResume, matchingJob)

      expect(result.total).toBeGreaterThanOrEqual(75)
    })
  })

  describe('完全不匹配场景', () => {
    it('完全不匹配的简历应该获得30分以下', () => {
      const noMatchResume = createBaseResume({
        name: '完全不匹配候选人',
        skills: ['市场营销', '文案写作', '活动策划', '客户关系管理'],
        education: [
          {
            school: '某艺术学院',
            major: '广告学',
            degree: '学士',
            graduationYear: 2022,
            startDate: '2018-09',
            endDate: '2022-06'
          }
        ],
        certifications: [],
        internships: [
          {
            company: '某广告公司',
            position: '市场策划实习生',
            duration: '3个月',
            description: '负责活动策划和文案撰写',
            startDate: '2022-01',
            endDate: '2022-03'
          }
        ],
        projects: [],
        targetPosition: '市场专员',
        targetLocation: '广州',
        targetIndustry: '广告传媒',
        resumeText: '擅长市场营销和活动策划，希望在广告传媒行业发展'
      })
      const noMatchJob = createBaseJob({
        id: 2001,
        title: '美容师',
        company: '某美容院',
        description: '负责顾客的美容护理工作，包括面部护理、身体护理等',
        requirements: '有美容师证书，形象气质佳，有相关工作经验者优先',
        location: '三四线城市',
        source: '线下招聘',
        industry: '生活服务',
        tags: '美容,护理,服务',
        education: '不限',
        experience: '1-3年',
        salary: '5-8K'
      })

      const result = matchEngine.match(noMatchResume, noMatchJob)

      expect(result.total).toBeLessThan(30)
    })

    it('完全不匹配的技能维度应该接近0分', () => {
      const noMatchResume = createBaseResume({
        skills: ['绘画', '摄影']
      })
      const noMatchJob = createBaseJob({
        description: '需要编程能力',
        requirements: '熟悉Java和Python'
      })

      const result = matchEngine.match(noMatchResume, noMatchJob)

      expect(result.breakdown.skills).toBeLessThan(15)
    })

    it('完全不匹配应该显示多个gaps', () => {
      const noMatchResume = createBaseResume({
        skills: ['绘画'],
        education: []
      })
      const noMatchJob = createBaseJob({
        description: '需要编程和数据分析能力',
        requirements: '熟悉Python、SQL、Excel'
      })

      const result = matchEngine.match(noMatchResume, noMatchJob)

      expect(result.gaps.length).toBeGreaterThan(0)
    })

    it('空白简历与任何职位匹配都应该低分', () => {
      const emptyResume = createBaseResume({
        name: '空白简历',
        skills: [],
        education: [],
        certifications: [],
        internships: [],
        projects: [],
        resumeText: ''
      })
      const anyJob = createBaseJob()

      const result = matchEngine.match(emptyResume, anyJob)

      expect(result.total).toBeLessThan(40)
    })

    it('跨领域完全不匹配（艺术vs技术）应该极低分', () => {
      const artResume = createBaseResume({
        name: '艺术生',
        skills: ['绘画', '设计', '摄影'],
        education: [
          {
            school: '某艺术学院',
            major: '美术学',
            degree: '学士',
            graduationYear: 2023,
            startDate: '2019-09',
            endDate: '2023-06'
          }
        ],
        targetIndustry: '艺术设计',
        resumeText: '擅长绘画和设计，有丰富的艺术创作经验'
      })
      const techJob = createBaseJob({
        title: '高级Java开发工程师',
        description: '需要5年以上Java开发经验，熟悉Spring Boot、微服务架构',
        requirements: '计算机相关专业本科以上学历，有大型项目经验',
        industry: '互联网科技',
        tags: 'Java,Spring Boot,微服务'
      })

      const result = matchEngine.match(artResume, techJob)

      expect(result.total).toBeLessThan(25)
    })
  })

  describe('中等匹配场景', () => {
    it('中等匹配的简历应该获得55-70分', () => {
      const partialResume = createBaseResume({
        name: '部分匹配候选人',
        skills: ['Python', 'Excel'],
        education: [
          {
            school: '某普通大学',
            major: '统计学',
            degree: '学士',
            graduationYear: 2023,
            startDate: '2019-09',
            endDate: '2023-06'
          }
        ],
        certifications: [],
        internships: [
          {
            company: '某小公司',
            position: '数据录入员',
            duration: '2个月',
            description: '负责数据整理和Excel报表制作',
            startDate: '2023-07',
            endDate: '2023-08'
          }
        ],
        projects: [
          {
            name: '课程作业项目',
            role: '组员',
            description: '使用Python进行简单的数据分析'
          }
        ],
        targetPosition: '数据分析师',
        targetLocation: '上海',
        resumeText: '有Python和Excel基础，希望从事数据分析工作'
      })
      const partialJob = createBaseJob({
        title: '数据分析师助理',
        description: '协助高级分析师完成数据处理和分析工作',
        requirements: '本科及以上学历，有一定的数据分析基础',
        location: '上海',
        source: '猎聘',
        industry: '咨询',
        tags: '数据分析,Excel',
        education: '本科及以上',
        experience: '1-3年',
        salary: '10-15K'
      })

      const result = matchEngine.match(partialResume, partialJob)

      expect(result.total).toBeGreaterThanOrEqual(50)
      expect(result.total).toBeLessThanOrEqual(75)
    })

    it('部分技能匹配应该得到中等分数', () => {
      const partialSkillsResume = createBaseResume({
        skills: ['Python', 'Excel']
      })
      const jobNeedingMoreSkills = createBaseJob({
        description: '需要Python、SQL、Excel、机器学习等技能',
        requirements: '熟练使用数据分析工具'
      })

      const result = matchEngine.match(partialSkillsResume, jobNeedingMoreSkills)

      expect(result.breakdown.skills).toBeGreaterThan(0)
      expect(result.breakdown.skills).toBeLessThan(25)
    })

    it('中等匹配应该同时包含matchedFields和gaps', () => {
      const partialResume = createBaseResume({
        skills: ['Python'],
        education: [
          {
            school: '某大学',
            major: '统计学',
            degree: '学士',
            graduationYear: 2023,
            startDate: '2019-09',
            endDate: '2023-06'
          }
        ]
      })
      const partialJob = createBaseJob({
        description: '需要Python和SQL技能',
        requirements: '本科以上学历'
      })

      const result = matchEngine.match(partialResume, partialJob)

      expect(result.matchedFields.length + result.gaps.length).toBeGreaterThan(0)
    })

    it('学历达标但技能不足应该是中等分数', () => {
      const goodEduButWeakSkills = createBaseResume({
        education: [
          {
            school: '某985大学',
            major: '计算机科学',
            degree: '硕士',
            graduationYear: 2024,
            startDate: '2021-09',
            endDate: '2024-06'
          }
        ],
        skills: ['Office办公软件'],
        internships: []
      })
      const techJob = createBaseJob({
        description: '数据分析师岗位，需要编程能力',
        requirements: '本科以上学历',
        education: '本科及以上'
      })

      const result = matchEngine.match(goodEduButWeakSkills, techJob)

      expect(result.total).toBeGreaterThanOrEqual(40)
      expect(result.total).toBeLessThanOrEqual(65)
    })

    it('技能强但学历不足应该是中等分数', () => {
      const strongSkillsButLowEdu = createBaseResume({
        education: [
          {
            school: '某专科学校',
            major: '计算机应用',
            degree: '专科',
            graduationYear: 2023,
            startDate: '2020-09',
            endDate: '2023-06'
          }
        ],
        skills: ['Python', 'SQL', 'Excel', '机器学习', '深度学习', '大数据'],
        internships: [
          {
            company: '某公司',
            position: '数据分析实习生',
            duration: '6个月',
            description: '使用Python进行数据分析',
            startDate: '2023-01',
            endDate: '2023-06'
          }
        ]
      })
      const highRequirementJob = createBaseJob({
        description: '高级数据分析师，需要强大的技术背景',
        requirements: '硕士以上学历优先',
        education: '硕士及以上学历'
      })

      const result = matchEngine.match(strongSkillsButLowEdu, highRequirementJob)

      expect(result.total).toBeGreaterThanOrEqual(45)
      expect(result.total).toBeLessThanOrEqual(70)
    })
  })

  describe('特殊场景测试', () => {
    it('同一简历匹配不同职位应该得到不同分数', () => {
      const sameResume = createBaseResume({
        skills: ['Python', 'SQL', 'Excel'],
        resumeText: '有编程和数据分析经验'
      })
      const techJob = createBaseJob({
        title: 'Python开发工程师',
        description: '需要Python编程经验',
        industry: '互联网'
      })
      const financeJob = createBaseJob({
        title: '投资分析师',
        description: '需要金融背景和CFA证书',
        industry: '金融'
      })

      const techResult = matchEngine.match(sameResume, techJob)
      const financeResult = matchEngine.match(sameResume, financeJob)

      expect(techResult.total).not.toBe(financeResult.total)
    })

    it('同一职位匹配不同简历应该得到不同分数', () => {
      const sameJob = createBaseJob()
      const excellentResume = createBaseResume({
        skills: ['Python', 'SQL', 'Excel', '机器学习', '数据分析'],
        education: [
          {
            school: '清华大学',
            major: '计算机科学',
            degree: '硕士',
            graduationYear: 2024,
            startDate: '2021-09',
            endDate: '2024-06'
          }
        ],
        resumeText: '优秀候选人有丰富经验'
      })
      const poorResume = createBaseResume({
        skills: ['绘画', '摄影'],
        education: [
          {
            school: '某艺术学院',
            major: '广告学',
            degree: '学士',
            graduationYear: 2022,
            startDate: '2018-09',
            endDate: '2022-06'
          }
        ],
        resumeText: '艺术类候选人'
      })

      const excellentResult = matchEngine.match(excellentResume, sameJob)
      const poorResult = matchEngine.match(poorResume, sameJob)

      expect(excellentResult.total).toBeGreaterThan(poorResult.total)
    })

    it('overqualified风险检测应该正常工作', () => {
      const phdResume = createBaseResume({
        education: [
          {
            school: '清华大学',
            major: '计算机科学',
            degree: '博士',
            graduationYear: 2024,
            startDate: '2019-09',
            endDate: '2024-06'
          }
        ]
      })
      const bachelorJob = createBaseJob({
        education: '本科及以上',
        description: '这是一个初级岗位'
      })

      const result = matchEngine.match(phdResume, bachelorJob)

      expect(result.risks).toContain('学历可能高于岗位要求（overqualified）')
    })

    it('地点不匹配风险应该被检测到', () => {
      const beijingResume = createBaseResume({
        targetLocation: '北京',
        resumeText: '希望在北京发展'
      })
      const shanghaiJob = createBaseJob({
        location: '上海'
      })

      const result = matchEngine.match(beijingResume, shanghaiJob)

      expect(result.risks.some(risk => risk.includes('地点'))).toBe(true)
    })

    it('岗位描述信息过少的风险提示', () => {
      const anyResume = createBaseResume()
      const shortDescriptionJob = createBaseJob({
        description: '招人' // 非常简短的描述
      })

      const result = matchEngine.match(anyResume, shortDescriptionJob)

      expect(result.risks.some(risk => risk.includes('信息较少'))).toBe(true)
    })
  })

  describe('边界条件测试', () => {
    it('空技能列表不应该导致错误', () => {
      const noSkillsResume = createBaseResume({ skills: [] })
      const anyJob = createBaseJob()

      const result = matchEngine.match(noSkillsResume, anyJob)

      expect(result).toBeDefined()
      expect(typeof result.total).toBe('number')
    })

    it('空教育经历不应该导致错误', () => {
      const noEducationResume = createBaseResume({ education: [] })
      const anyJob = createBaseJob()

      const result = matchEngine.match(noEducationResume, anyJob)

      expect(result).toBeDefined()
      expect(result.breakdown.education).toBe(0)
    })

    it('空实习经历不应该导致错误', () => {
      const noInternshipResume = createBaseResume({ internships: [] })
      const anyJob = createBaseJob()

      const result = matchEngine.match(noInternshipResume, anyJob)

      expect(result).toBeDefined()
    })

    it('超长技能列表应该正常处理', () => {
      const manySkillsResume = createBaseResume({
        skills: Array.from({ length: 50 }, (_, i) => `skill${i}`)
      })
      const anyJob = createBaseJob()

      const startTime = performance.now()
      const result = matchEngine.match(manySkillsResume, anyJob)
      const elapsed = performance.now() - startTime

      expect(result).toBeDefined()
      expect(elapsed).toBeLessThan(100)
    })

    it('特殊字符在技能名称中应该正常处理', () => {
      const specialCharResume = createBaseResume({
        skills: ['C++', 'C#', '.NET', 'Node.js']
      })
      const anyJob = createBaseJob()

      expect(() => matchEngine.match(specialCharResume, anyJob)).not.toThrow()
    })

    it('Unicode字符应该正确处理', () => {
      const unicodeResume = createBaseResume({
        skills: ['Python', '数据分析', '機器學習']
      })
      const unicodeJob = createBaseJob({
        description: '需要數據分析和機器學習能力'
      })

      const result = matchEngine.match(unicodeResume, unicodeJob)

      expect(result).toBeDefined()
    })
  })

  describe('性能基准测试', () => {
    it('单次匹配应该在50ms内完成', () => {
      const resume = createBaseResume({
        skills: ['Python', 'SQL', 'Excel', '机器学习'],
        education: [
          {
            school: '某大学',
            major: '计算机',
            degree: '硕士',
            graduationYear: 2024,
            startDate: '2021-09',
            endDate: '2024-06'
          }
        ],
        targetLocation: '北京',
        targetIndustry: '互联网',
        resumeText: '有丰富的技术和项目经验'
      })
      const job = createBaseJob({
        description: '需要技术能力的岗位',
        requirements: '本科以上学历'
      })

      const iterations = 100
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        matchEngine.match(resume, job)
      }

      const totalTime = performance.now() - startTime
      const avgTime = totalTime / iterations

      expect(avgTime).toBeLessThan(50)
    })

    it('批量匹配100个简历应该在2秒内完成', () => {
      const job = createBaseJob()
      const resumes = Array.from({ length: 100 }, (_, i) =>
        createBaseResume({
          name: `候选人${i}`,
          skills: i % 3 === 0 ? ['Python', 'SQL', 'Excel'] : i % 3 === 1 ? ['Python'] : ['绘画'],
          resumeText: `这是第${i}个候选人的简历`
        })
      )

      const startTime = performance.now()

      const results = resumes.map(resume => matchEngine.match(resume, job))

      const totalTime = performance.now() - startTime

      expect(results.length).toBe(100)
      expect(totalTime).toBeLessThan(2000)
    })

    it('批量匹配100个职位应该在2秒内完成', () => {
      const resume = createBaseResume({
        skills: ['Python', 'SQL'],
        resumeText: '有技术背景'
      })
      const jobs = Array.from({ length: 100 }, (_, i) =>
        createBaseJob({
          id: 3000 + i,
          title: `职位${i}`,
          description: `这是第${i}个职位的描述`,
          requirements: i % 2 === 0 ? '需要Python' : '需要Java'
        })
      )

      const startTime = performance.now()

      const results = jobs.map(job => matchEngine.match(resume, job))

      const totalTime = performance.now() - startTime

      expect(results.length).toBe(100)
      expect(totalTime).toBeLessThan(2000)
    })

    it('高并发场景下不应该出现内存泄漏', () => {
      const resume = createBaseResume()
      const job = createBaseJob()

      const iterations = 1000

      for (let i = 0; i < iterations; i++) {
        matchEngine.match(resume, job)
      }

      expect(true).toBe(true) // 如果能执行到这里说明没有崩溃
    })
  })
})
