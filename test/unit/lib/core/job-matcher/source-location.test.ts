import { describe, it, expect, beforeEach } from 'vitest'
import { matchJobToRule } from '@/lib/job-matcher'
import { JobFactory } from '__mocks__/factories/job.factory'

describe('JobMatcher - 数据源、地点、行业、学历匹配', () => {
  let jobFactory: JobFactory

  beforeEach(() => {
    jobFactory = new JobFactory()
  })

  describe('matchSource() 数据源匹配', () => {
    it('匹配指定的数据源应该通过', () => {
      const job = jobFactory.create({ source: 'boss直聘' })
      
      const result = matchJobToRule(job, {
        keywords: ['测试'],
        sources: ['boss直聘']
      })
      
      expect(result).not.toBeNull()
    })

    it('不匹配的数据源应该返回null', () => {
      const job = jobFactory.create({ source: '猎聘' })
      
      const result = matchJobToRule(job, {
        keywords: ['测试'],
        sources: ['boss直聘', '拉勾']
      })
      
      expect(result).toBeNull()
    })

    it('空sources列表应该默认全通过', () => {
      const job = jobFactory.create({ source: '任意来源' })
      
      const rule1 = matchJobToRule(job, { keywords: ['任意'], sources: [] })
      const rule2 = matchJobToRule(job, { keywords: ['任意'], sources: undefined })
      
      expect(rule1).not.toBeNull()
      expect(rule2).not.toBeNull()
    })

    it('职位无source字段应该默认通过', () => {
      const job = jobFactory.create()
      delete (job as any).source
      
      const result = matchJobToRule(job, {
        keywords: ['测试'],
        sources: ['boss直聘']
      })
      
      expect(result).not.toBeNull()
    })

    it('多个数据源任一匹配即可', () => {
      const jobFromLiepin = jobFactory.create({ source: '猎聘' })
      
      const result = matchJobToRule(jobFromLiepin, {
        keywords: ['测试'],
        sources: ['boss直聘', '猎聘', '拉勾']
      })
      
      expect(result).not.toBeNull()
    })
  })

  describe('matchLocation() 地点匹配', () => {
    it('精确城市匹配应该通过', () => {
      const job = jobFactory.create({ location: '北京' })
      
      const result = matchJobToRule(job, {
        keywords: ['测试'],
        locations: ['北京']
      })
      
      expect(result).not.toBeNull()
    })

    it('包含关系匹配(北京朝阳区包含北京)应该通过', () => {
      const job = jobFactory.create({ location: '北京朝阳区' })
      
      const result = matchJobToRule(job, {
        keywords: ['测试'],
        locations: ['北京']
      })
      
      expect(result).not.toBeNull()
    })

    it('不匹配的地点应该返回null', () => {
      const job = jobFactory.create({ location: '广州' })
      
      const result = matchJobToRule(job, {
        keywords: ['测试'],
        locations: ['北京', '上海']
      })
      
      expect(result).toBeNull()
    })

    it('空locations列表应该默认全通过', () => {
      const job = jobFactory.create({ location: '任意城市' })
      
      const result = matchJobToRule(job, {
        keywords: ['任意'],
        locations: []
      })
      
      expect(result).not.toBeNull()
    })

    it('职位无location字段应该默认通过', () => {
      const job = jobFactory.create()
      delete (job as any).location
      
      const result = matchJobToRule(job, {
        keywords: ['测试'],
        locations: ['北京']
      })
      
      expect(result).not.toBeNull()
    })

    it('多个地点任一匹配即可', () => {
      const jobInShanghai = jobFactory.create({ location: '上海浦东' })
      
      const result = matchJobToRule(jobInShanghai, {
        keywords: ['测试'],
        locations: ['北京', '上海', '深圳']
      })
      
      expect(result).not.toBeNull()
    })
  })

  describe('matchIndustry() 行业匹配', () => {
    it('精确行业匹配应该通过', () => {
      const job = jobFactory.create({ industry: '互联网' })
      
      const result = matchJobToRule(job, {
        keywords: ['测试'],
        industries: ['互联网']
      })
      
      expect(result).not.toBeNull()
    })

    it('包含关系匹配(互联网金融包含金融)应该通过', () => {
      const job = jobFactory.create({ industry: '互联网金融' })
      
      const result = matchJobToRule(job, {
        keywords: ['测试'],
        industries: ['金融']
      })
      
      expect(result).not.toBeNull()
    })

    it('不匹配的行业应该返回null', () => {
      const job = jobFactory.create({ industry: '教育' })
      
      const result = matchJobToRule(job, {
        keywords: ['测试'],
        industries: ['互联网', '金融']
      })
      
      expect(result).toBeNull()
    })

    it('空industries列表应该默认全通过', () => {
      const job = jobFactory.create({ industry: '任意行业' })
      
      const result = matchJobToRule(job, {
        keywords: ['任意'],
        industries: []
      })
      
      expect(result).not.toBeNull()
    })

    it('职位无industry字段应该默认通过', () => {
      const job = jobFactory.create()
      delete (job as any).industry
      
      const result = matchJobToRule(job, {
        keywords: ['测试'],
        industries: ['互联网']
      })
      
      expect(result).not.toBeNull()
    })
  })

  describe('matchEducation() 学历匹配', () => {
    it('岗位学历满足要求学历应该通过', () => {
      const job = jobFactory.create({ education: '硕士及以上学历' })
      
      // 要求本科,岗位是硕士,应该通过
      const result = matchJobToRule(job, {
        keywords: ['测试'],
        education: '本科'
      })
      
      expect(result).not.toBeNull()
    })

    it('岗位学历低于要求学历应该返回null', () => {
      const job = jobFactory.create({ education: '本科学历' })
      
      // 要求硕士,岗位只是本科,不应该通过
      const result = matchJobToRule(job, {
        keywords: ['测试'],
        education: '硕士'
      })
      
      expect(result).toBeNull()
    })

    it('博士学历可以匹配任何要求', () => {
      const job = jobFactory.create({ education: '博士学历' })
      
      const result = matchJobToRule(job, {
        keywords: ['测试'],
        education: '本科'
      })
      
      expect(result).not.toBeNull()
    })

    it('空education参数应该默认全通过', () => {
      const job = jobFactory.create({ education: '高中学历' })
      
      const result1 = matchJobToRule(job, { keywords: ['测试'], education: '' })
      const result2 = matchJobToRule(job, { keywords: ['测试'], education: undefined })
      
      expect(result1).not.toBeNull()
      expect(result2).not.toBeNull()
    })

    it('职位无education字段应该默认通过', () => {
      const job = jobFactory.create()
      delete (job as any).education
      
      const result = matchJobToRule(job, {
        keywords: ['测试'],
        education: '硕士'
      })
      
      expect(result).not.toBeNull()
    })

    it('学历等级顺序: 大专 < 本科 < 硕士 < 博士', () => {
      // 岗位是大专,要求本科 → 不通过
      const jobDazhuan = jobFactory.create({ education: '大专学历' })
      expect(matchJobToRule(jobDazhuan, { keywords: ['测试'], education: '本科' })).toBeNull()

      // 岗位是本科,要求本科 → 通过
      const jobBenke = jobFactory.create({ education: '本科学历' })
      expect(matchJobToRule(jobBenke, { keywords: ['测试'], education: '本科' })).not.toBeNull()

      // 岗位是硕士,要求本科 → 通过
      const jobShuoshi = jobFactory.create({ education: '硕士学历' })
      expect(matchJobToRule(jobShuoshi, { keywords: ['测试'], education: '本科' })).not.toBeNull()
    })
  })
})
