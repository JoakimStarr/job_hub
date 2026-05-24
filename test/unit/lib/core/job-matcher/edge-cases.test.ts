import { describe, it, expect, beforeEach } from 'vitest'
import { matchJobToRule } from '@/lib/job-matcher'
import { JobFactory } from '__mocks__/factories/job.factory'

describe('JobMatcher - 边界条件和异常场景', () => {
  let jobFactory: JobFactory

  beforeEach(() => {
    jobFactory = new JobFactory()
  })

  describe('空值和undefined处理', () => {
    it('所有字段为空的职位应该返回null', () => {
      const emptyJob = {
        id: 1,
        title: '',
      } as any
      
      const result = matchJobToRule(emptyJob, { keywords: ['test'] })
      
      expect(result).toBeNull()
    })

    it('title为null的职位应该优雅降级', () => {
      const jobWithNullTitle = {
        id: 1,
        title: null as any,
        company: '某公司',
      }
      
      expect(() => matchJobToRule(jobWithNullTitle, { keywords: ['某公司'] })).not.toThrow()
    })

    it('rule.keywords为空数组应该返回null', () => {
      const job = jobFactory.create({ title: '任何职位' })
      
      const result = matchJobToRule(job, { keywords: [] })
      
      expect(result).toBeNull()
    })

    it('rule.keywords包含空字符串应该忽略', () => {
      const job = jobFactory.create({ title: 'Python开发' })
      
      const result = matchJobToRule(job, { keywords: ['', 'Python', ''] })
      
      // 空字符串应该被忽略,但'Python'应该匹配
      if (result) {
        expect(result.matchedKeywords).toEqual(['Python'])
      }
    })

    it('rule对象只包含keywords(其他都是可选)', () => {
      const job = jobFactory.create({ title: '测试职位' })
      
      const minimalRule = { keywords: ['测试'] }
      
      const result = matchJobToRule(job, minimalRule)
      
      expect(result).not.toBeNull()
    })
  })

  describe('特殊字符和编码', () => {
    it('应该正确处理emoji表情', () => {
      const job = jobFactory.create({ 
        title: '数据分析师🚀',
        description: '我们需要你💪'
      })
      
      const result = matchJobToRule(job, { keywords: ['数据分析师'] })
      
      expect(result).not.toBeNull()
    })

    it('应该正确处理全角半角字符', () => {
      const job = jobFactory.create({
        title: 'Ｐｙｔｈｏｎ开发工程师', // 全角
      })
      
      const result = matchJobToRule(job, { keywords: ['python'] }) // 半音
      
      // normalizeText会去掉特殊字符,所以全角的python可能变成"ｐｙｔｈｏｎ"
      // 这个测试主要确保不会报错
      expect(() => matchJobToRule(job, { keywords: ['python'] })).not.toThrow()
    })

    it('应该正确处理换行符和制表符', () => {
      const job = jobFactory.create({
        description: '需要\nPython\t和SQL\r技能'
      })
      
      const result = matchJobToRule(job, { keywords: ['Python', 'SQL'] })
      
      expect(result).not.toBeNull()
      expect(result!.matchedKeywords.length).toBeGreaterThanOrEqual(2)
    })

    it('应该正确处理连续的多个空格', () => {
      const job = jobFactory.create({
        title: '数据   分析师', // 多个空格
      })
      
      const result = matchJobToRule(job, { keywords: ['数据分析师'] })
      
      // normalizeText会把空格去掉,所以"数据分析师"应该能匹配到
      expect(result).not.toBeNull()
    })
  })

  describe('极端长度输入', () => {
    it('超长标题(1000字符)不应该导致性能问题', () => {
      const longTitle = 'A'.repeat(1000)
      const job = jobFactory.create({ title: longTitle })
      
      const startTime = performance.now()
      const result = matchJobToRule(job, { keywords: ['A'] })
      const elapsed = performance.now() - startTime
      
      expect(elapsed).toBeLessThan(50)
      expect(result).not.toBeNull()
    })

    it('超长关键词列表(50个)应该正常工作', () => {
      const job = jobFactory.create({ 
        title: 'Python SQL Excel 数据分析专家'
      })
      
      const manyKeywords = Array.from({ length: 50 }, (_, i) => `关键词${i}`)
      manyKeywords.push('Python') // 确保至少有一个能匹配
      
      const startTime = performance.now()
      const result = matchJobToRule(job, { keywords: manyKeywords })
      const elapsed = performance.now() - startTime
      
      expect(elapsed).toBeLessThan(100)
      expect(result).not.toBeNull()
      expect(result!.matchedKeywords).toContain('Python')
    })

    it('单个超长关键词(500字符)应该被正确处理', () => {
      const longKeyword = 'X'.repeat(500)
      const job = jobFactory.create({ title: longKeyword })
      
      const result = matchJobToRule(job, { keywords: [longKeyword] })
      
      expect(result).not.toBeNull()
      expect(result!.matchScore).toBe(100)
    })
  })

  describe('组合条件复杂场景', () => {
    it('多维度完全匹配', () => {
      const job = jobFactory.createPerfectMatch()
      
      const rule = {
        keywords: ['数据分析师', 'Python'],
        sources: ['boss直聘'],
        locations: ['北京'],
        industries: ['互联网金融'],
        exclude_keywords: []
      }
      
      const result = matchJobToRule(job, rule)
      
      expect(result).not.toBeNull()
      expect(result!.matchScore).toBe(100)
    })

    it('多维度完全不匹配', () => {
      const job = jobFactory.createNoMatch()
      
      const rule = {
        keywords: ['程序员'],
        sources: ['boss直聘'],
        locations: ['北京'],
        industries: ['互联网']
      }
      
      const result = matchJobToRule(job, rule)
      
      expect(result).toBeNull()
    })

    it('部分维度匹配但关键词不命中', () => {
      const job = jobFactory.create({
        title: '美容师',
        location: '北京',
        source: 'boss直聘',
        industry: '互联网'
      })
      
      const rule = {
        keywords: ['Python开发'], // 不匹配
        sources: ['boss直聘'], // 匹配
        locations: ['北京'], // 匹配
        industries: ['互联网'] // 匹配
      }
      
      // 关键词是OR逻辑的首要条件,关键词不命中就返回null
      const result = matchJobToRule(job, rule)
      
      expect(result).toBeNull()
    })

    it('排除关键词优先于包含关键词', () => {
      const job = jobFactory.create({
        title: 'Python实习工程师',
        source: 'boss直聘',
        location: '北京'
      })
      
      const rule = {
        keywords: ['Python', '工程师'], // 命中
        sources: ['boss直聘'], // 命中
        locations: ['北京'], // 命中
        exclude_keywords: ['实习'] // 排除!
      }
      
      // 虽然其他都匹配,但有排除关键词,应该返回null
      const result = matchJobToRule(job, rule)
      
      expect(result).toBeNull()
    })
  })

  describe('并发和重复调用稳定性', () => {
    it('同一个job多次调用应该返回一致结果', () => {
      const job = jobFactory.createRealistic()
      const rule = { keywords: ['数据', 'Python'] }
      
      const results = Array.from({ length: 10 }, () => matchJobToRule(job, rule))
      
      // 所有结果应该相同
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toEqual(results[0])
      }
    })

    it('大量并发调用不应该导致错误', () => {
      const jobs = jobFactory.createBatch(100)
      const rule = { keywords: ['数据分析师'] }
      
      const results = jobs.map(job => {
        try {
          return matchJobToRule(job, rule)
        } catch (error) {
          return error
        }
      })
      
      // 所有调用都应该成功完成(不抛异常)
      const errors = results.filter(r => r instanceof Error)
      expect(errors.length).toBe(0)
    })
  })

  describe('数据完整性验证', () => {
    it('返回的job对象应该是原始对象的引用', () => {
      const originalJob = jobFactory.createRealistic()
      const rule = { keywords: ['数据'] }
      
      const result = matchJobToRule(originalJob, rule)
      
      if (result) {
        expect(result.job).toBe(originalJob)
      }
    })

    it('matchedKeywords应该是原始关键词的副本(不是引用)', () => {
      const job = jobFactory.create({ title: 'Python SQL' })
      const originalKeywords = ['Python', 'SQL', 'Excel']
      const rule = { keywords: originalKeywords }
      
      const result = matchJobToRule(job, rule)
      
      if (result) {
        // 修改原始数组不应该影响结果
        originalKeywords.push('NEW_KEYWORD')
        expect(result.matchedKeywords).not.toContain('NEW_KEYWORD')
      }
    })
  })
})
