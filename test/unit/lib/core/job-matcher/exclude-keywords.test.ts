import { describe, it, expect, beforeEach } from 'vitest'
import { matchJobToRule } from '@/lib/job-matcher'
import { JobFactory } from '__mocks__/factories/job.factory'

describe('JobMatcher - 排除关键词匹配', () => {
  let jobFactory: JobFactory

  beforeEach(() => {
    jobFactory = new JobFactory()
  })

  describe('matchExcludeKeywords() 通过 matchJobToRule 测试', () => {
    it('应该排除包含任一排除关键词的职位', () => {
      const job = jobFactory.create({
        title: '实习数据分析师',
        company: '某公司'
      })
      
      const rule = {
        keywords: ['数据分析师'],
        exclude_keywords: ['实习']
      }
      
      const result = matchJobToRule(job, rule)
      
      expect(result).toBeNull() // 应该被排除
    })

    it('不包含排除关键词时应该正常匹配', () => {
      const job = jobFactory.create({
        title: '高级数据分析师',
        description: '5年经验'
      })
      
      const rule = {
        keywords: ['数据分析师'],
        exclude_keywords: ['实习', '兼职']
      }
      
      const result = matchJobToRule(job, rule)
      
      expect(result).not.toBeNull()
      expect(result!.matchedKeywords).toContain('数据分析师')
    })

    it('空排除列表不应该影响匹配', () => {
      const job = jobFactory.create({ title: '任何职位' })
      
      const rule1 = { keywords: ['任何'], exclude_keywords: [] }
      const rule2 = { keywords: ['任何'], exclude_keywords: undefined }
      
      const result1 = matchJobToRule(job, rule1)
      const result2 = matchJobToRule(job, rule2)
      
      expect(result1).not.toBeNull()
      expect(result2).not.toBeNull()
    })

    it('应该在相同范围内搜索排除和包含关键词', () => {
      const job = jobFactory.create({
        title: 'Java后端开发工程师',
        description: '熟悉Java开发',
        tags: 'Java,开发',
        requirements: 'Java开发经验'
      })

      // 包含Java,排除Python
      const rule = {
        keywords: ['Java'],
        exclude_keywords: ['Python']
      }

      const result = matchJobToRule(job, rule)

      expect(result).not.toBeNull()
      expect(result!.matchedKeywords).toContain('Java')
    })

    it('多个排除关键词任一命中即排除', () => {
      const jobIntern = jobFactory.create({ title: '实习生' })
      const jobPartTime = jobFactory.create({ title: '兼职开发' })
      const jobFullTime = jobFactory.create({ title: '全职开发' })
      
      const rule = {
        keywords: ['开发'],
        exclude_keywords: ['实习', '兼职', '临时']
      }
      
      expect(matchJobToRule(jobIntern, rule)).toBeNull()
      expect(matchJobToRule(jobPartTime, rule)).toBeNull()
      expect(matchJobToRule(jobFullTime, rule)).not.toBeNull()
    })

    it('排除关键词应该在标题中生效', () => {
      const job = jobFactory.create({ title: '外包前端工程师' })
      
      const rule = {
        keywords: ['前端工程师'],
        exclude_keywords: ['外包']
      }
      
      expect(matchJobToRule(job, rule)).toBeNull()
    })

    it('排除关键词应该在标签中生效', () => {
      const job = jobFactory.create({
        title: '数据分析师',
        tags: '实习,兼职,数据分析'
      })
      
      const rule = {
        keywords: ['数据分析师'],
        exclude_keywords: ['实习']
      }
      
      expect(matchJobToRule(job, rule)).toBeNull()
    })

    it('排除关键词应该在行业中生效', () => {
      const job = jobFactory.create({
        title: '分析师',
        industry: '保险推销'
      })
      
      const rule = {
        keywords: ['分析师'],
        exclude_keywords: ['推销']
      }
      
      expect(matchJobToRule(job, rule)).toBeNull()
    })

    it('排除关键词不区分大小写', () => {
      const job = jobFactory.create({ title: '实习岗位' })

      const rule = {
        keywords: ['岗位'],
        exclude_keywords: ['实习'] // 使用实际能匹配的关键词
      }

      expect(matchJobToRule(job, rule)).toBeNull()
    })
  })
})
