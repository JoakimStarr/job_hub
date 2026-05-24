import { describe, it, expect, beforeEach } from 'vitest'
import { matchJobToRule } from '@/lib/job-matcher'
import { JobFactory } from '__mocks__/factories/job.factory'

describe('JobMatcher - 关键词匹配', () => {
  let jobFactory: JobFactory

  beforeEach(() => {
    jobFactory = new JobFactory()
  })

  describe('matchKeywords() 通过 matchJobToRule 测试', () => {
    it('应该正确匹配标题中的单个关键词', () => {
      const job = jobFactory.create({ title: '高级数据分析师' })
      const rule = { keywords: ['数据分析师'] }
      
      const result = matchJobToRule(job, rule)
      
      expect(result).not.toBeNull()
      expect(result!.matchedKeywords).toContain('数据分析师')
      expect(result!.matchedKeywords).toHaveLength(1)
    })

    it('应该不区分大小写进行匹配', () => {
      const job = jobFactory.create({ 
        title: 'Python开发工程师',
        tags: 'python,django,flask'
      })
      
      const resultLower = matchJobToRule(job, { keywords: ['python'] })
      const resultUpper = matchJobToRule(job, { keywords: ['PYTHON'] })
      const resultMixed = matchJobToRule(job, { keywords: ['Python'] })
      
      expect(resultLower).not.toBeNull()
      expect(resultUpper).not.toBeNull()
      expect(resultMixed).not.toBeNull()
      expect(resultLower!.matchedKeywords).toEqual(['python'])
      expect(resultUpper!.matchedKeywords).toEqual(['PYTHON'])
    })

    it('应该支持多个关键词同时匹配(OR逻辑)', () => {
      const job = jobFactory.create({
        title: '数据分析专家',
        description: '需要熟悉Python和SQL',
        requirements: '有机器学习经验者优先'
      })
      
      const rule = { keywords: ['Python', 'SQL', '机器学习'] }
      const result = matchJobToRule(job, rule)
      
      expect(result).not.toBeNull()
      expect(result!.matchedKeywords).toHaveLength(3)
      expect(result!.matchedKeywords).toContain('Python')
      expect(result!.matchedKeywords).toContain('SQL')
      expect(result!.matchedKeywords).toContain('机器学习')
    })

    it('应该搜索标题、公司、标签、行业等多个字段', () => {
      const job = jobFactory.create({
        title: '前端工程师',
        company: '阿里巴巴',
        tags: 'React,Vue,JavaScript',
        industry: '互联网'
      })
      
      const rule1 = { keywords: ['React'] }
      const rule2 = { keywords: ['阿里巴巴'] }
      
      const result1 = matchJobToRule(job, rule1)
      const result2 = matchJobToRule(job, rule2)
      
      expect(result1).not.toBeNull()
      expect(result2).not.toBeNull()
      expect(result1!.matchedKeywords).toHaveLength(1)
      expect(result2!.matchedKeywords).toHaveLength(1)
    })

    it('空关键词列表应该返回null', () => {
      const job = jobFactory.create({ title: '测试职位' })
      
      const result = matchJobToRule(job, { keywords: [] })
      
      expect(result).toBeNull()
    })

    it('没有匹配任何关键词时返回null', () => {
      const job = jobFactory.create({ 
        title: '销售经理', 
        description: '负责销售工作',
        industry: '零售'
      })
      
      const result = matchJobToRule(job, { keywords: ['程序员', '工程师'] })
      
      expect(result).toBeNull()
    })

    it('应该处理特殊字符和空格（归一化）', () => {
      const job = jobFactory.create({
        title: '全栈开发工程师 (Remote)',
        company: 'Tech-Corp'
      })
      
      const result = matchJobToRule(job, { keywords: ['全栈开发', 'remote'] })
      
      expect(result).not.toBeNull()
      expect(result!.matchedKeywords).toHaveLength(2)
    })

    it('超长描述文本不应导致性能问题', () => {
      const longDescription = 'a'.repeat(10000)
      const job = jobFactory.create({ description: longDescription })
      
      const startTime = performance.now()
      const result = matchJobToRule(job, { keywords: ['test'] })
      const endTime = performance.now()
      
      expect(endTime - startTime).toBeLessThan(100) // 应该在100ms内完成
    })

    it('应该正确处理包含HTML标签的文本', () => {
      const job = jobFactory.create({
        description: '<p>需要<strong>Python</strong>技能</p>'
      })
      
      const result = matchJobToRule(job, { keywords: ['Python'] })
      
      expect(result).not.toBeNull()
      expect(result!.matchedKeywords).toContain('Python')
    })

    it('应该只搜索description前200字', () => {
      const shortKeyword = 'UNIQUE_KEYWORD_12345'
      const longDescription = 'x'.repeat(201) + shortKeyword
      const job = jobFactory.create({ description: longDescription })
      
      const result = matchJobToRule(job, { keywords: [shortKeyword] })
      
      // 关键词在200字之后,不应该被匹配到
      expect(result).toBeNull()
    })

    it('应该只搜索requirements前100字', () => {
      const shortKeyword = 'UNIQUE_REQ_67890'
      const longRequirements = 'y'.repeat(101) + shortKeyword
      const job = jobFactory.create({ requirements: longRequirements })
      
      const result = matchJobToRule(job, { keywords: [shortKeyword] })
      
      // 关键词在100字之后,不应该被匹配到
      expect(result).toBeNull()
    })
  })

  describe('匹配分数计算', () => {
    it('全部关键词命中应该得100分', () => {
      const job = jobFactory.create({
        title: 'Python SQL Excel 数据分析',
        description: '需要Python和SQL技能'
      })
      
      const rule = { keywords: ['Python', 'SQL'] }
      const result = matchJobToRule(job, rule)
      
      expect(result).not.toBeNull()
      expect(result!.matchScore).toBe(100)
    })

    it('部分关键词命中应该按比例得分', () => {
      const job = jobFactory.create({ 
        title: 'Pythontest',
        description: '',
        requirements: '',
        tags: '',
        company: '',
        industry: ''
      })
      
      const rule = { keywords: ['Python', 'SQL', 'Excel', 'R'] }
      const result = matchJobToRule(job, rule)
      
      expect(result).not.toBeNull()
      // 1/4 = 25% (只匹配到Python)
      expect(result!.matchScore).toBe(25)
    })

    it('匹配分数应该是整数', () => {
      const job = jobFactory.create({ title: 'Test' })
      const rule = { keywords: ['Test', 'Other'] }
      
      const result = matchJobToRule(job, rule)
      
      if (result) {
        expect(Number.isInteger(result.matchScore)).toBe(true)
      }
    })
  })
})
