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
      const job = jobFactory.create({ 
        title: '数据分析师岗位',
        source: 'boss直聘' 
      })
      
      const result = matchJobToRule(job, {
        keywords: ['数据分析师'],
        sources: ['boss直聘']
      })
      
      expect(result).not.toBeNull()
      expect(result!.matchScore).toBe(100)
    })

    it('不匹配的数据源应该返回null', () => {
      const job = jobFactory.create({ 
        title: '数据分析师',
        source: '猎聘' 
      })
      
      const result = matchJobToRule(job, {
        keywords: ['数据分析师'],
        sources: ['boss直聘', '拉勾'] // 不包含'猎聘'
      })
      
      // 关键词匹配成功,但source不匹配 → 返回null
      expect(result).toBeNull()
    })

    it('空sources列表应该默认全通过', () => {
      const job = jobFactory.create({ 
        title: 'Python开发',
        source: '任意来源' 
      })
      
      const rule1 = matchJobToRule(job, { keywords: ['Python'], sources: [] })
      const rule2 = matchJobToRule(job, { keywords: ['Python'], sources: undefined })
      
      expect(rule1).not.toBeNull()
      expect(rule2).not.toBeNull()
    })

    it('职位无source字段应该默认通过', () => {
      const job = jobFactory.create({ title: 'Java工程师' })
      delete (job as any).source
      
      const result = matchJobToRule(job, {
        keywords: ['Java工程师'],
        sources: ['boss直聘']
      })
      
      expect(result).not.toBeNull()
    })

    it('多个数据源任一匹配即可', () => {
      const jobFromLiepin = jobFactory.create({ 
        title: '产品经理',
        source: '猎聘' 
      })
      
      const result = matchJobToRule(jobFromLiepin, {
        keywords: ['产品经理'],
        sources: ['boss直聘', '猎聘', '拉勾']
      })
      
      expect(result).not.toBeNull()
    })
  })

  describe('matchLocation() 地点匹配', () => {
    it('精确城市匹配应该通过', () => {
      const job = jobFactory.create({ 
        title: '北京数据分析师',
        location: '北京' 
      })
      
      const result = matchJobToRule(job, {
        keywords: ['数据分析师'],
        locations: ['北京']
      })
      
      expect(result).not.toBeNull()
    })

    it('包含关系匹配(北京朝阳区包含北京)应该通过', () => {
      const job = jobFactory.create({ 
        title: '前端开发',
        location: '北京朝阳区' 
      })
      
      const result = matchJobToRule(job, {
        keywords: ['前端开发'],
        locations: ['北京']
      })
      
      expect(result).not.toBeNull()
    })

    it('不匹配的地点应该返回null', () => {
      const job = jobFactory.create({ 
        title: '广州销售',
        location: '广州' 
      })
      
      const result = matchJobToRule(job, {
        keywords: ['广州销售'],
        locations: ['北京', '上海'] // 广州不在列表中
      })
      
      expect(result).toBeNull()
    })

    it('空locations列表应该默认全通过', () => {
      const job = jobFactory.create({ 
        title: '上海职位',
        location: '任意城市' 
      })
      
      const result = matchJobToRule(job, {
        keywords: ['上海职位'],
        locations: []
      })
      
      expect(result).not.toBeNull()
    })

    it('职位无location字段应该默认通过', () => {
      const job = jobFactory.create({ title: '远程工作' })
      delete (job as any).location
      
      const result = matchJobToRule(job, {
        keywords: ['远程工作'],
        locations: ['北京']
      })
      
      expect(result).not.toBeNull()
    })

    it('多个地点任一匹配即可', () => {
      const jobInShanghai = jobFactory.create({ 
        title: '金融分析师',
        location: '上海浦东' 
      })
      
      const result = matchJobToRule(jobInShanghai, {
        keywords: ['金融分析师'],
        locations: ['北京', '上海', '深圳']
      })
      
      expect(result).not.toBeNull()
    })
  })

  describe('matchIndustry() 行业匹配', () => {
    it('精确行业匹配应该通过', () => {
      const job = jobFactory.create({ 
        title: '互联网工程师',
        industry: '互联网' 
      })
      
      const result = matchJobToRule(job, {
        keywords: ['互联网工程师'],
        industries: ['互联网']
      })
      
      expect(result).not.toBeNull()
    })

    it('包含关系匹配(互联网金融包含金融)应该通过', () => {
      const job = jobFactory.create({ 
        title: '量化研究员',
        industry: '互联网金融' 
      })
      
      const result = matchJobToRule(job, {
        keywords: ['量化研究员'],
        industries: ['金融']
      })
      
      expect(result).not.toBeNull()
    })

    it('不匹配的行业应该返回null', () => {
      const job = jobFactory.create({ 
        title: '教育老师',
        industry: '教育' 
      })
      
      const result = matchJobToRule(job, {
        keywords: ['教育老师'],
        industries: ['互联网', '金融'] // 教育不在列表
      })
      
      expect(result).toBeNull()
    })

    it('空industries列表应该默认全通过', () => {
      const job = jobFactory.create({ 
        title: '咨询顾问',
        industry: '任意行业' 
      })
      
      const result = matchJobToRule(job, {
        keywords: ['咨询顾问'],
        industries: []
      })
      
      expect(result).not.toBeNull()
    })

    it('职位无industry字段应该默认通过', () => {
      const job = jobFactory.create({ title: '自由职业者' })
      delete (job as any).industry
      
      const result = matchJobToRule(job, {
        keywords: ['自由职业者'],
        industries: ['互联网']
      })
      
      expect(result).not.toBeNull()
    })
  })

  describe('matchEducation() 学历匹配', () => {
    it('岗位学历满足要求学历应该通过', () => {
      const job = jobFactory.create({ 
        title: '硕士数据科学家',
        education: '硕士及以上学历' 
      })
      
      // 要求本科,岗位是硕士,应该通过
      const result = matchJobToRule(job, {
        keywords: ['数据科学家'],
        education: '本科'
      })
      
      expect(result).not.toBeNull()
    })

    it('岗位学历低于要求学历应该返回null', () => {
      const job = jobFactory.create({ 
        title: '本科实习生',
        education: '本科学历' 
      })
      
      // 要求硕士,岗位只是本科,不应该通过
      const result = matchJobToRule(job, {
        keywords: ['本科实习生'],
        education: '硕士'
      })
      
      expect(result).toBeNull()
    })

    it('博士学历可以匹配任何要求', () => {
      const job = jobFactory.create({ 
        title: '博士研究员',
        education: '博士学历' 
      })
      
      const result = matchJobToRule(job, {
        keywords: ['博士研究员'],
        education: '本科'
      })
      
      expect(result).not.toBeNull()
    })

    it('空education参数应该默认全通过', () => {
      const job = jobFactory.create({ 
        title: '高中毕业生',
        education: '高中学历' 
      })
      
      const result1 = matchJobToRule(job, { keywords: ['高中毕业生'], education: '' })
      const result2 = matchJobToRule(job, { keywords: ['高中毕业生'], education: undefined })
      
      expect(result1).not.toBeNull()
      expect(result2).not.toBeNull()
    })

    it('职位无education字段应该默认通过', () => {
      const job = jobFactory.create({ title: '经验丰富专家' })
      delete (job as any).education
      
      const result = matchJobToRule(job, {
        keywords: ['经验丰富专家'],
        education: '硕士'
      })
      
      expect(result).not.toBeNull()
    })

    it('学历等级顺序: 大专 < 本科 < 硕士 < 博士', () => {
      // 岗位是大专,要求本科 → 不通过
      const jobDazhuan = jobFactory.create({ 
        title: '大专技术员',
        education: '大专学历' 
      })
      expect(matchJobToRule(jobDazhuan, { 
        keywords: ['大专技术员'], 
        education: '本科' 
      })).toBeNull()

      // 岗位是本科,要求本科 → 通过
      const jobBenke = jobFactory.create({ 
        title: '本科工程师',
        education: '本科学历' 
      })
      expect(matchJobToRule(jobBenke, { 
        keywords: ['本科工程师'], 
        education: '本科' 
      })).not.toBeNull()

      // 岗位是硕士,要求本科 → 通过
      const jobShuoshi = jobFactory.create({ 
        title: '硕士经理',
        education: '硕士学历' 
      })
      expect(matchJobToRule(jobShuoshi, { 
        keywords: ['硕士经理'], 
        education: '本科' 
      })).not.toBeNull()
    })
  })
  
  describe('组合条件综合测试', () => {
    it('多维度同时匹配应该通过', () => {
      const job = jobFactory.create({
        title: '北京互联网数据分析师',
        company: '阿里巴巴',
        source: 'boss直聘',
        location: '北京朝阳区',
        industry: '互联网金融',
        education: '硕士学历'
      })
      
      const result = matchJobToRule(job, {
        keywords: ['数据分析师', '互联网'],
        sources: ['boss直聘'],
        locations: ['北京'],
        industries: ['互联网金融'],
        education: '本科'
      })
      
      expect(result).not.toBeNull()
      expect(result!.matchedKeywords).toContain('数据分析师')
      expect(result!.matchScore).toBe(100) // 2/2关键词命中
    })

    it('任一维度不匹配都应该返回null', () => {
      const job = jobFactory.create({
        title: '上海金融分析师',
        source: '猎聘',
        location: '上海',
        industry: '金融'
      })
      
      // 关键词匹配,但source不匹配
      const result = matchJobToRule(job, {
        keywords: ['金融分析师'],
        sources: ['boss直聘'], // 只允许boss直聘
        locations: ['上海'],     // 地点匹配
      })
      
      expect(result).toBeNull()
    })
  })
})
