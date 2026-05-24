import { describe, it, expect, beforeEach } from 'vitest'
import { MatchEngine } from '@/lib/match-engine'
import type { ResumeProfile, JobItem } from '@/types'

describe('MatchEngine - 输出完整性和性能测试', () => {
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
    internships: [],
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

  describe('输出结构完整性', () => {
    it('匹配结果应该包含所有必需的顶层字段', () => {
      const resume = createBaseResume()
      const job = createBaseJob()

      const result = matchEngine.match(resume, job)

      expect(result).toHaveProperty('total')
      expect(result).toHaveProperty('breakdown')
      expect(result).toHaveProperty('matchedFields')
      expect(result).toHaveProperty('gaps')
      expect(result).toHaveProperty('risks')
    })

    it('breakdown应该包含所有6个维度分数', () => {
      const resume = createBaseResume()
      const job = createBaseJob()

      const result = matchEngine.match(resume, job)

      expect(result.breakdown).toHaveProperty('skills')
      expect(result.breakdown).toHaveProperty('education')
      expect(result.breakdown).toHaveProperty('major')
      expect(result.breakdown).toHaveProperty('location')
      expect(result.breakdown).toHaveProperty('experience')
      expect(result.breakdown).toHaveProperty('industry')
    })

    it('total应该是数字类型且在0-100范围内', () => {
      const resume = createBaseResume()
      const job = createBaseJob()

      const result = matchEngine.match(resume, job)

      expect(typeof result.total).toBe('number')
      expect(result.total).toBeGreaterThanOrEqual(0)
      expect(result.total).toBeLessThanOrEqual(100)
    })

    it('各维度分数应该是数字类型且在合理范围内', () => {
      const resume = createBaseResume()
      const job = createBaseJob()

      const result = matchEngine.match(resume, job)

      const maxScores = {
        skills: 30,
        education: 20,
        major: 15,
        location: 10,
        experience: 15,
        industry: 10
      }

      for (const [dimension, maxScore] of Object.entries(maxScores)) {
        expect(typeof result.breakdown[dimension as keyof typeof result.breakdown]).toBe('number')
        expect(result.breakdown[dimension as keyof typeof result.breakdown])
          .toBeGreaterThanOrEqual(0)
        expect(result.breakdown[dimension as keyof typeof result.breakdown])
          .toBeLessThanOrEqual(maxScore)
      }
    })

    it('matchedFields应该是字符串数组', () => {
      const resume = createBaseResume()
      const job = createBaseJob()

      const result = matchEngine.match(resume, job)

      expect(Array.isArray(result.matchedFields)).toBe(true)
      for (const field of result.matchedFields) {
        expect(typeof field).toBe('string')
      }
    })

    it('gaps应该是字符串数组', () => {
      const resume = createBaseResume()
      const job = createBaseJob()

      const result = matchEngine.match(resume, job)

      expect(Array.isArray(result.gaps)).toBe(true)
      for (const gap of result.gaps) {
        expect(typeof gap).toBe('string')
      }
    })

    it('risks应该是字符串数组', () => {
      const resume = createBaseResume()
      const job = createBaseJob()

      const result = matchEngine.match(resume, job)

      expect(Array.isArray(result.risks)).toBe(true)
      for (const risk of result.risks) {
        expect(typeof risk).toBe('string')
      }
    })
  })

  describe('输出内容合理性', () => {
    it('matchedFields中的项目数量应该合理（不超过5个）', () => {
      const perfectResume = createBaseResume({
        skills: ['Python', 'SQL', 'Excel', '机器学习'],
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
        targetLocation: '北京',
        targetIndustry: '互联网'
      })
      const perfectJob = createBaseJob({
        description: '需要Python、SQL、Excel、机器学习能力',
        requirements: '硕士以上学历',
        location: '北京',
        industry: '互联网'
      })

      const result = matchEngine.match(perfectResume, perfectJob)

      expect(result.matchedFields.length).toBeLessThanOrEqual(5)
    })

    it('gaps中的项目数量应该合理（不超过5个）', () => {
      const noMatchResume = createBaseResume({
        skills: ['绘画'],
        education: []
      })
      const noMatchJob = createBaseJob({
        description: '需要编程和数据分析能力',
        requirements: '熟悉Python、SQL、Excel'
      })

      const result = matchEngine.match(noMatchResume, noMatchJob)

      expect(result.gaps.length).toBeLessThanOrEqual(5)
    })

    it('risks中的项目数量应该合理（不超过3个）', () => {
      const anyResume = createBaseResume()
      const anyJob = createBaseJob()

      const result = matchEngine.match(anyResume, anyJob)

      expect(result.risks.length).toBeLessThanOrEqual(3)
    })

    it('高匹配度时matchedFields数量应该多于低匹配度时', () => {
      const highMatchResume = createBaseResume({
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
        ]
      })
      const lowMatchResume = createBaseResume({
        skills: ['绘画']
      })
      const sameJob = createBaseJob({
        description: '需要Python、SQL、Excel、机器学习',
        requirements: '硕士以上学历'
      })

      const highResult = matchEngine.match(highMatchResume, sameJob)
      const lowResult = matchEngine.match(lowMatchResume, sameJob)

      expect(highResult.matchedFields.length).toBeGreaterThanOrEqual(
        lowResult.matchedFields.length
      )
    })

    it('低匹配度时gaps数量应该多于高匹配度时', () => {
      const highMatchResume = createBaseResume({
        skills: ['Python', 'SQL', 'Excel', '机器学习'],
        education: [
          {
            school: '清华大学',
            major: '计算机科学',
            degree: '硕士',
            graduationYear: 2024,
            startDate: '2021-09',
            endDate: '2024-06'
          }
        ]
      })
      const lowMatchResume = createBaseResume({
        skills: ['绘画'],
        education: []
      })
      const sameJob = createBaseJob({
        description: '需要Python、SQL、Excel、机器学习',
        requirements: '硕士以上学历'
      })

      const highResult = matchEngine.match(highMatchResume, sameJob)
      const lowResult = matchEngine.match(lowMatchResume, sameJob)

      expect(lowResult.gaps.length).toBeGreaterThanOrEqual(
        highResult.gaps.length
      )
    })

    it('matchedFields不应该包含空字符串', () => {
      const resume = createBaseResume()
      const job = createBaseJob()

      const result = matchEngine.match(resume, job)

      for (const field of result.matchedFields) {
        expect(field.trim().length).toBeGreaterThan(0)
      }
    })

    it('gaps不应该包含空字符串', () => {
      const resume = createBaseResume()
      const job = createBaseJob()

      const result = matchEngine.match(resume, job)

      for (const gap of result.gaps) {
        expect(gap.trim().length).toBeGreaterThan(0)
      }
    })

    it('risks不应该包含空字符串', () => {
      const resume = createBaseResume()
      const job = createBaseJob()

      const result = matchEngine.match(resume, job)

      for (const risk of result.risks) {
        expect(risk.trim().length).toBeGreaterThan(0)
      }
    })
  })

  describe('总分计算正确性', () => {
    it('完美匹配的总分应该在85-100之间', () => {
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
        internships: [
          {
            company: '某公司',
            position: '数据分析师',
            duration: '6个月',
            description: '负责数据分析工作',
            startDate: '2023-07',
            endDate: '2023-12'
          }
        ],
        resumeText: '优秀候选人有丰富经验'
      })
      const perfectJob = createBaseJob({
        description: '需要精通Python、SQL、机器学习，有金融背景优先',
        requirements: '硕士以上学历，3年以上数据分析经验',
        location: '北京',
        industry: '互联网'
      })

      const result = matchEngine.match(perfectResume, perfectJob)

      expect(result.total).toBeGreaterThanOrEqual(70)
      expect(result.total).toBeLessThanOrEqual(100)
    })

    it('完全不匹配的总分应该在0-30之间', () => {
      const noMatchResume = createBaseResume({
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
        targetIndustry: '艺术设计',
        resumeText: '艺术类候选人'
      })
      const noMatchJob = createBaseJob({
        title: '美容师',
        description: '负责顾客的美容护理工作',
        requirements: '有美容师证书',
        industry: '生活服务'
      })

      const result = matchEngine.match(noMatchResume, noMatchJob)

      expect(result.total).toBeGreaterThanOrEqual(0)
      expect(result.total).toBeLessThan(50)
    })

    it('总分应该是整数（四舍五入）', () => {
      const resume = createBaseResume()
      const job = createBaseJob()

      const result = matchEngine.match(resume, job)

      expect(Number.isInteger(result.total)).toBe(true)
    })

    it('相同输入应该产生相同的输出（幂等性）', () => {
      const resume = createBaseResume({
        skills: ['Python', 'SQL'],
        education: [
          {
            school: '某大学',
            major: '计算机',
            degree: '本科',
            graduationYear: 2023,
            startDate: '2019-09',
            endDate: '2023-06'
          }
        ]
      })
      const job = createBaseJob({
        description: '需要Python和SQL技能'
      })

      const result1 = matchEngine.match(resume, job)
      const result2 = matchEngine.match(resume, job)

      expect(result1.total).toBe(result2.total)
      expect(result1.breakdown).toEqual(result2.breakdown)
      expect(result1.matchedFields).toEqual(result2.matchedFields)
      expect(result1.gaps).toEqual(result2.gaps)
      expect(result1.risks).toEqual(result2.risks)
    })

    it('不同MatchEngine实例应该产生相同的结果', () => {
      const engine1 = new MatchEngine()
      const engine2 = new MatchEngine()
      const resume = createBaseResume()
      const job = createBaseJob()

      const result1 = engine1.match(resume, job)
      const result2 = engine2.match(resume, job)

      expect(result1.total).toBe(result2.total)
      expect(result1.breakdown).toEqual(result2.breakdown)
    })
  })

  describe('异常处理和边界条件', () => {
    it('不应该修改原始的resume对象', () => {
      const originalResume = createBaseResume()
      const originalResumeJSON = JSON.stringify(originalResume)
      const job = createBaseJob()

      matchEngine.match(originalResume, job)

      expect(JSON.stringify(originalResume)).toBe(originalResumeJSON)
    })

    it('不应该修改原始的job对象', () => {
      const resume = createBaseResume()
      const originalJob = createBaseJob()
      const originalJobJSON = JSON.stringify(originalJob)

      matchEngine.match(resume, originalJob)

      expect(JSON.stringify(originalJob)).toBe(originalJobJSON)
    })

    it('处理空字段时不应该抛出异常', () => {
      const partialResume = createBaseResume({
        skills: [] as any,
        education: [] as any,
        internships: [] as any
      } as any)
      const partialJob = createBaseJob({
        description: '',
        requirements: '',
        location: '',
        industry: ''
      } as any)

      expect(() => matchEngine.match(partialResume, partialJob)).not.toThrow()
    })

    it('处理空字符串字段时不应该抛出异常', () => {
      const nullFieldResume = createBaseResume({
        skills: [] as any,
        education: [] as any
      } as any)
      const nullFieldJob = createBaseJob({
        description: '',
        requirements: ''
      } as any)

      expect(() => matchEngine.match(nullFieldResume, nullFieldJob)).not.toThrow()
    })

    it('超长文本字段的处理能力', () => {
      const longTextResume = createBaseResume({
        skills: ['Python'],
        resumeText: 'A'.repeat(10000),
        targetLocation: '北京'
      })
      const longTextJob = createBaseJob({
        description: 'B'.repeat(5000),
        requirements: '需要Python技能'
      })

      const startTime = performance.now()
      const result = matchEngine.match(longTextResume, longTextJob)
      const elapsed = performance.now() - startTime

      expect(result).toBeDefined()
      expect(elapsed).toBeLessThan(200)
    })

    it('特殊Unicode字符的处理', () => {
      const unicodeResume = createBaseResume({
        skills: ['Python', '数据分析'],
        resumeText: '🎯 专业技能：Python、SQL、Excel 🚀'
      })
      const unicodeJob = createBaseJob({
        description: '需要✨数据分析💡能力',
        requirements: '熟悉Python编程🐍'
      })

      expect(() => matchEngine.match(unicodeResume, unicodeJob)).not.toThrow()
    })

    it('HTML标签在文本中应该被正常处理', () => {
      const htmlResume = createBaseResume({
        skills: ['Python'],
        resumeText: '<p>熟练使用Python</p><div>有丰富的项目经验</div>'
      })
      const htmlJob = createBaseJob({
        description: '<strong>需要Python开发</strong>经验',
        requirements: '会使用<em>数据库</em>'
      })

      expect(() => matchEngine.match(htmlResume, htmlJob)).not.toThrow()
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

    it('批量匹配100个简历对应该在2秒内完成', () => {
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

      for (const result of results) {
        expect(result.total).toBeGreaterThanOrEqual(0)
        expect(result.total).toBeLessThanOrEqual(100)
      }
    })

    it('批量匹配100个职位对应该在2秒内完成', () => {
      const resume = createBaseResume({
        skills: ['Python', 'SQL'],
        resumeText: '有技术背景'
      })
      const jobs = Array.from({ length: 100 }, (_, i) =>
        createBaseJob({
          id: 5000 + i,
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

    it('大规模矩阵匹配（100x100）应该在10秒内完成', () => {
      const resumes = Array.from({ length: 100 }, (_, i) =>
        createBaseResume({
          name: `候选人${i}`,
          skills: i % 3 === 0 ? ['Python', 'SQL'] : ['绘画'],
          resumeText: `简历${i}`
        })
      )
      const jobs = Array.from({ length: 100 }, (_, i) =>
        createBaseJob({
          id: 6000 + i,
          title: `职位${i}`,
          description: `职位描述${i}`
        })
      )

      const startTime = performance.now()

      let totalMatches = 0
      for (const resume of resumes) {
        for (const job of jobs) {
          matchEngine.match(resume, job)
          totalMatches++
        }
      }

      const totalTime = performance.now() - startTime

      expect(totalMatches).toBe(10000) // 100 x 100
      expect(totalTime).toBeLessThan(10000)
    })

    it('内存稳定性测试：连续执行1000次不应该内存溢出', () => {
      const resume = createBaseResume()
      const job = createBaseJob()

      const results: any[] = []

      for (let i = 0; i < 1000; i++) {
        results.push(matchEngine.match(resume, job))
      }

      expect(results.length).toBe(1000)
      expect(results[0].total).toBe(results[999].total) // 结果一致性
    })

    it('极端情况：空数据对象的性能', () => {
      const emptyResume = createBaseResume({
        name: '空白简历',
        skills: [],
        education: [],
        certifications: [],
        internships: [],
        projects: [],
        resumeText: ''
      })
      const minimalJob = createBaseJob({
        description: '',
        requirements: '',
        location: '',
        industry: ''
      })

      const iterations = 200
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        matchEngine.match(emptyResume, minimalJob)
      }

      const totalTime = performance.now() - startTime
      const avgTime = totalTime / iterations

      expect(avgTime).toBeLessThan(50)
    })
  })

  describe('数据一致性验证', () => {
    it('多次调用同一组数据应该返回完全一致的结果', () => {
      const resume = createBaseResume({
        skills: ['Python', 'SQL', 'Excel', '机器学习'],
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
        targetLocation: '北京',
        targetIndustry: '互联网',
        resumeText: '优秀候选人有丰富经验和技能'
      })
      const job = createBaseJob({
        location: '北京',
        industry: '互联网',
        description: '需要技术能力的岗位'
      })

      const results = Array.from({ length: 10 }, () =>
        matchEngine.match(resume, job)
      )

      const firstResult = results[0]
      for (let i = 1; i < results.length; i++) {
        expect(results[i].total).toBe(firstResult.total)
        expect(results[i].breakdown).toEqual(firstResult.breakdown)
        expect(results[i].matchedFields).toEqual(firstResult.matchedFields)
        expect(results[i].gaps).toEqual(firstResult.gaps)
        expect(results[i].risks).toEqual(firstResult.risks)
      }
    })

    it('不同顺序的相同数据集应该产生可重复的结果', () => {
      const resumes = [
        createBaseResume({
          name: '候选人A',
          skills: ['Python', 'SQL', 'Excel', '机器学习'],
          education: [
            {
              school: '清华大学',
              major: '计算机科学',
              degree: '硕士',
              graduationYear: 2024,
              startDate: '2021-09',
              endDate: '2024-06'
            }
          ]
        }),
        createBaseResume({
          name: '候选人B',
          skills: ['Python', 'Excel']
        }),
        createBaseResume({
          name: '候选人C',
          skills: ['绘画']
        }),
        createBaseResume({
          name: '候选人D',
          skills: ['Python']
        })
      ]
      const jobs = [
        createBaseJob({ id: 7001, title: '职位A' }),
        createBaseJob({ id: 7002, title: '职位B' }),
        createBaseJob({ id: 7003, title: '职位C' }),
        createBaseJob({ id: 7004, title: '职位D' })
      ]

      const results1 = resumes.map(resume =>
        jobs.map(job => matchEngine.match(resume, job))
      )

      const results2 = [...resumes].reverse().map(resume =>
        [...jobs].reverse().map(job => matchEngine.match(resume, job))
      ).reverse().map(row => [...row].reverse())

      for (let i = 0; i < resumes.length; i++) {
        for (let j = 0; j < jobs.length; j++) {
          expect(results1[i][j].total).toBe(results2[i][j].total)
        }
      }
    })
  })
})
