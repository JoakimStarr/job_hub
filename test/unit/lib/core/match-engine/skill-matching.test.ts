import { describe, it, expect, beforeEach } from 'vitest'
import { MatchEngine } from '@/lib/match-engine'
import type { ResumeProfile, JobItem } from '@/types'

describe('MatchEngine - 技能维度详细测试', () => {
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

  describe('完美技能匹配', () => {
    it('所有技能完全匹配应该获得30分满分', () => {
      const resumeWithAllSkills = createBaseResume({
        skills: ['Python', 'SQL', 'Excel', '机器学习', '数据分析']
      })
      const jobRequiringAllSkills = createBaseJob({
        description: '需要精通Python、SQL、Excel、机器学习、数据分析',
        requirements: '熟练使用这些工具进行数据处理和分析工作'
      })

      const result = matchEngine.match(resumeWithAllSkills, jobRequiringAllSkills)

      expect(result.breakdown.skills).toBe(30)
    })

    it('包含所有关键词的技能列表应该获得高分', () => {
      const comprehensiveSkillsResume = createBaseResume({
        skills: [
          'Python', 'Java', 'JavaScript', 'SQL', 'Excel',
          'Wind', 'Bloomberg', '数据分析', '财务分析',
          '投资分析', '风险管理', '量化投资',
          '机器学习', '深度学习', '大数据', '人工智能',
          'CFA', 'CPA', 'FRM', 'ACCA'
        ]
      })
      const jobWithManyKeywords = createBaseJob({
        description: '需要Python、SQL、Excel、机器学习、数据分析、CFA、CPA等综合能力',
        requirements: '有金融分析和量化投资经验者优先'
      })

      const result = matchEngine.match(comprehensiveSkillsResume, jobWithManyKeywords)

      expect(result.breakdown.skills).toBe(30)
    })

    it('技能数量超过职位要求时应该获得满分', () => {
      const overQualifiedSkills = createBaseResume({
        skills: ['Python', 'SQL', 'Excel', 'R', 'Tableau', 'PowerBI', '机器学习', '深度学习']
      })
      const simpleJob = createBaseJob({
        description: '需要Python和SQL基础',
        requirements: '会使用Excel即可'
      })

      const result = matchEngine.match(overQualifiedSkills, simpleJob)

      expect(result.breakdown.skills).toBe(30)
    })
  })

  describe('部分技能匹配', () => {
    it('一半技能匹配应该获得15分左右（±5分）', () => {
      const halfSkillsResume = createBaseResume({
        skills: ['Python', 'SQL'] // 匹配2个
      })
      const jobNeedingFourSkills = createBaseJob({
        description: '需要Python、SQL、Excel、机器学习四种技能',
        requirements: '至少掌握其中两种'
      })

      const result = matchEngine.match(halfSkillsResume, jobNeedingFourSkills)

      expect(result.breakdown.skills).toBeGreaterThanOrEqual(10)
      expect(result.breakdown.skills).toBeLessThanOrEqual(20)
    })

    it('仅匹配1/3技能应该获得较低分数', () => {
      const oneThirdSkillsResume = createBaseResume({
        skills: ['Python'] // 只匹配1个
      })
      const jobNeedingThreeSkills = createBaseJob({
        description: '需要Python、SQL、Excel三种核心技能',
        requirements: '熟练使用这些工具'
      })

      const result = matchEngine.match(oneThirdSkillsResume, jobNeedingThreeSkills)

      expect(result.breakdown.skills).toBeGreaterThan(0)
      expect(result.breakdown.skills).toBeLessThan(15)
    })

    it('匹配大部分但非全部技能应该获得接近满分的分数', () => {
      const mostSkillsResume = createBaseResume({
        skills: ['Python', 'SQL', 'Excel', '机器学习'] // 匹配4个
      })
      const jobNeedingFiveSkills = createBaseJob({
        description: '需要Python、SQL、Excel、机器学习、数据分析五种技能',
        requirements: '综合能力强者优先'
      })

      const result = matchEngine.match(mostSkillsResume, jobNeedingFiveSkills)

      expect(result.breakdown.skills).toBeGreaterThanOrEqual(20)
      expect(result.breakdown.skills).toBeLessThan(30)
    })

    it('不同技能组合的匹配度应该有所差异', () => {
      const pythonOnlyResume = createBaseResume({ skills: ['Python'] })
      const pythonAndSqlResume = createBaseResume({ skills: ['Python', 'SQL'] })
      const sameJob = createBaseJob({
        description: '需要Python和SQL技能的数据分析师岗位',
        requirements: '熟悉Excel者加分'
      })

      const pythonOnlyResult = matchEngine.match(pythonOnlyResume, sameJob)
      const pythonAndSqlResult = matchEngine.match(pythonAndSqlResume, sameJob)

      expect(pythonAndSqlResult.breakdown.skills).toBeGreaterThan(
        pythonOnlyResult.breakdown.skills
      )
    })
  })

  describe('无技能匹配场景', () => {
    it('无任何相关技能应该获得0分或基础分', () => {
      const irrelevantSkillsResume = createBaseResume({
        skills: ['绘画', '摄影', '写作', '烹饪']
      })
      const techJob = createBaseJob({
        description: '需要编程和数据分析技能',
        requirements: '熟悉Python和SQL'
      })

      const result = matchEngine.match(irrelevantSkillsResume, techJob)

      expect(result.breakdown.skills).toBeLessThan(10)
    })

    it('空技能列表应该返回0分', () => {
      const noSkillsResume = createBaseResume({ skills: [] })
      const anyJob = createBaseJob()

      const result = matchEngine.match(noSkillsResume, anyJob)

      expect(result.breakdown.skills).toBe(0)
    })

    it('技能不匹配但职位未明确要求技能时应该获得基础分15分', () => {
      const anySkillsResume = createBaseResume({
        skills: ['市场营销', '文案写作']
      })
      const noSkillRequirementJob = createBaseJob({
        description: '这是一个普通行政岗位',
        requirements: '工作认真负责即可' // 不包含任何技能关键词
      })

      const result = matchEngine.match(anySkillsResume, noSkillRequirementJob)

      expect(result.breakdown.skills).toBe(15) // 基础分
    })
  })

  describe('技能关键词识别测试', () => {
    it('应该正确识别Python技能', () => {
      const pythonResume = createBaseResume({ skills: ['Python'] })
      const pythonJob = createBaseJob({
        description: '需要Python开发经验'
      })

      const result = matchEngine.match(pythonResume, pythonJob)

      expect(result.breakdown.skills).toBeGreaterThan(0)
    })

    it('应该正确识别中文技能：数据分析', () => {
      const dataAnalysisResume = createBaseResume({ skills: ['数据分析'] })
      const dataAnalysisJob = createBaseJob({
        description: '需要数据分析能力'
      })

      const result = matchEngine.match(dataAnalysisResume, dataAnalysisJob)

      expect(result.breakdown.skills).toBeGreaterThan(0)
    })

    it('应该正确识别证书类技能：CFA', () => {
      const cfaResume = createBaseResume({ skills: ['CFA'] })
      const cfaJob = createBaseJob({
        description: '持有CFA证书者优先'
      })

      const result = matchEngine.match(cfaResume, cfaJob)

      expect(result.breakdown.skills).toBeGreaterThan(0)
    })

    it('应该同时识别多个不同类型的技能', () => {
      const mixedSkillsResume = createBaseResume({
        skills: ['Python', 'CFA', '财务分析', '机器学习']
      })
      const mixedRequirementsJob = createBaseJob({
        description: '需要Python编程能力和CFA证书，有财务分析和机器学习经验',
        requirements: '复合型人才优先'
      })

      const result = matchEngine.match(mixedSkillsResume, mixedRequirementsJob)

      expect(result.breakdown.skills).toBeGreaterThanOrEqual(20)
    })

    it('大小写不敏感的技能匹配', () => {
      const lowercaseSkillResume = createBaseResume({ skills: ['python'] })
      const uppercaseJob = createBaseJob({
        description: '需要PYTHON开发经验' // 大写
      })

      const result = matchEngine.match(lowercaseSkillResume, uppercaseJob)

      expect(result.breakdown.skills).toBeGreaterThan(0)
    })
  })

  describe('边界条件测试', () => {
    it('单个技能匹配单个要求的场景', () => {
      const singleSkillResume = createBaseResume({ skills: ['SQL'] })
      const singleRequirementJob = createBaseJob({
        description: '需要会SQL'
      })

      const result = matchEngine.match(singleSkillResume, singleRequirementJob)

      expect(result.breakdown.skills).toBeGreaterThanOrEqual(15) // 1/1匹配应该获得较高分数
    })

    it('大量技能与少量要求的匹配', () => {
      const manySkillsResume = createBaseResume({
        skills: Array.from({ length: 20 }, (_, i) => `skill${i}`)
      })
      const fewRequirementJob = createBaseJob({
        description: '只需要Python技能'
      })

      const result = matchEngine.match(manySkillsResume, fewRequirementJob)

      expect(result.breakdown.skills).toBeLessThanOrEqual(30)
    })

    it('少量技能与大量要求的匹配', () => {
      const fewSkillsResume = createBaseResume({ skills: ['Python'] })
      const manyRequirementsJob = createBaseJob({
        description: '需要Python、SQL、Excel、R、Tableau、PowerBI、机器学习、深度学习等多种技能'
      })

      const result = matchEngine.match(fewSkillsResume, manyRequirementsJob)

      expect(result.breakdown.skills).toBeGreaterThan(0)
      expect(result.breakdown.skills).toBeLessThan(10)
    })

    it('特殊字符技能名称的处理', () => {
      const specialCharSkillsResume = createBaseResume({
        skills: ['C++', 'C#', '.NET']
      })
      const normalJob = createBaseJob()

      expect(() => matchEngine.match(specialCharSkillsResume, normalJob)).not.toThrow()
    })

    it('超长技能名称的处理', () => {
      const longSkillNameResume = createBaseResume({
        skills: ['这是一非常非常长的技能名称用于测试系统是否能正常处理']
      })
      const anyJob = createBaseJob()

      const result = matchEngine.match(longSkillNameResume, anyJob)

      expect(result).toBeDefined()
    })
  })

  describe('matchedFields中的技能信息', () => {
    it('高技能匹配度应该在matchedFields中显示技能', () => {
      const skilledResume = createBaseResume({
        skills: ['Python', 'SQL', 'Excel']
      })
      const matchingJob = createBaseJob({
        description: '需要Python、SQL、Excel技能'
      })

      const result = matchEngine.match(skilledResume, matchingJob)

      const hasSkillField = result.matchedFields.some(field =>
        field.includes('技能') && (field.includes('Python') || field.includes('SQL'))
      )
      expect(hasSkillField).toBe(true)
    })

    it('低技能匹配度不应该在matchedFields中显示技能', () => {
      const lowSkillResume = createBaseResume({
        skills: ['绘画'] // 不相关的技能
      })
      const techJob = createBaseJob({
        description: '需要Python和SQL技能'
      })

      const result = matchEngine.match(lowSkillResume, techJob)

      const hasSkillField = result.matchedFields.some(field => field.includes('技能'))
      expect(hasSkillField).toBe(false)
    })
  })

  describe('gaps中的技能缺失信息', () => {
    it('技能不足时应该在gaps中显示缺少的技能', () => {
      const incompleteSkillsResume = createBaseResume({
        skills: ['Python'] // 缺少SQL和Excel
      })
      const jobRequiringMultipleSkills = createBaseJob({
        description: '需要Python、SQL、Excel三种技能',
        requirements: '熟练使用这些工具'
      })

      const result = matchEngine.match(incompleteSkillsResume, jobRequiringMultipleSkills)

      const hasMissingSkillGap = result.gaps.some(gap => gap.includes('缺少技能'))
      expect(hasMissingSkillGap).toBe(true)
    })

    it('技能充足时不应该在gaps中显示缺少技能', () => {
      const completeSkillsResume = createBaseResume({
        skills: ['Python', 'SQL', 'Excel', '机器学习']
      })
      const jobThatCanBeFulfilled = createBaseJob({
        description: '需要Python和SQL技能'
      })

      const result = matchEngine.match(completeSkillsResume, jobThatCanBeFulfilled)

      const hasMissingSkillGap = result.gaps.some(gap => gap.includes('缺少技能'))
      expect(hasMissingSkillGap).toBe(false)
    })
  })

  describe('性能基准测试', () => {
    it('技能匹配计算应该在合理时间内完成', () => {
      const largeSkillsSet = Array.from({ length: 100 }, (_, i) => `skill${i}`)
      const resumeWithManySkills = createBaseResume({ skills: largeSkillsSet })
      const job = createBaseJob()

      const iterations = 50
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        matchEngine.match(resumeWithManySkills, job)
      }

      const totalTime = performance.now() - startTime
      const avgTime = totalTime / iterations

      expect(avgTime).toBeLessThan(50)
    })

    it('批量技能匹配性能测试', () => {
      const job = createBaseJob()
      const resumesWithVaryingSkills = Array.from({ length: 50 }, (_, i) =>
        createBaseResume({
          skills: Array.from({ length: (i % 10) + 1 }, (_, j) => `skill${j}`)
        })
      )

      const startTime = performance.now()
      const results = resumesWithVaryingSkills.map(resume =>
        matchEngine.match(resume, job)
      )
      const totalTime = performance.now() - startTime

      expect(results.length).toBe(50)
      expect(totalTime).toBeLessThan(1000)
    })
  })
})
