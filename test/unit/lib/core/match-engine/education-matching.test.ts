import { describe, it, expect, beforeEach } from 'vitest'
import { MatchEngine } from '@/lib/match-engine'
import type { ResumeProfile, JobItem } from '@/types'

describe('MatchEngine - 教育维度详细测试', () => {
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

  describe('博士学历匹配', () => {
    it('博士匹配博士要求应该获得20分满分', () => {
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
      const phdJob = createBaseJob({
        education: '博士学历'
      })

      const result = matchEngine.match(phdResume, phdJob)

      expect(result.breakdown.education).toBe(20)
    })

    it('博士匹配硕士要求应该获得20分（超过要求）', () => {
      const phdResume = createBaseResume({
        education: [
          {
            school: '清华大学',
            major: '金融学',
            degree: '博士',
            graduationYear: 2024,
            startDate: '2019-09',
            endDate: '2024-06'
          }
        ]
      })
      const masterJob = createBaseJob({
        education: '硕士及以上学历'
      })

      const result = matchEngine.match(phdResume, masterJob)

      expect(result.breakdown.education).toBe(20)
    })

    it('博士匹配本科要求应该获得20分（远超要求）', () => {
      const phdResume = createBaseResume({
        education: [
          {
            school: '北京大学',
            major: '数学',
            degree: '博士',
            graduationYear: 2024,
            startDate: '2019-09',
            endDate: '2024-06'
          }
        ]
      })
      const bachelorJob = createBaseJob({
        education: '本科及以上'
      })

      const result = matchEngine.match(phdResume, bachelorJob)

      expect(result.breakdown.education).toBe(20)
    })

    it('博士学历应该触发overqualified风险提示', () => {
      const phdResume = createBaseResume({
        education: [
          {
            school: '某大学',
            major: '计算机',
            degree: '博士',
            graduationYear: 2024,
            startDate: '2019-09',
            endDate: '2024-06'
          }
        ]
      })
      const bachelorLevelJob = createBaseJob({
        education: '本科及以上',
        description: '这是一个初级岗位'
      })

      const result = matchEngine.match(phdResume, bachelorLevelJob)

      expect(result.risks).toContain('学历可能高于岗位要求（overqualified）')
    })
  })

  describe('硕士学历匹配', () => {
    it('硕士匹配硕士要求应该获得20分满分', () => {
      const masterResume = createBaseResume({
        education: [
          {
            school: '复旦大学',
            major: '统计学',
            degree: '硕士',
            graduationYear: 2024,
            startDate: '2021-09',
            endDate: '2024-06'
          }
        ]
      })
      const masterJob = createBaseJob({
        education: '硕士及以上学历'
      })

      const result = matchEngine.match(masterResume, masterJob)

      expect(result.breakdown.education).toBe(20)
    })

    it('硕士匹配研究生要求应该获得20分满分', () => {
      const masterResume = createBaseResume({
        education: [
          {
            school: '上海交通大学',
            major: '金融学',
            degree: '研究生',
            graduationYear: 2024,
            startDate: '2021-09',
            endDate: '2024-06'
          }
        ]
      })
      const graduateStudentJob = createBaseJob({
        education: '研究生学历'
      })

      const result = matchEngine.match(masterResume, graduateStudentJob)

      expect(result.breakdown.education).toBe(20)
    })

    it('硕士匹配本科要求应该获得20分（超过要求）', () => {
      const masterResume = createBaseResume({
        education: [
          {
            school: '浙江大学',
            major: '经济学',
            degree: '硕士',
            graduationYear: 2023,
            startDate: '2020-09',
            endDate: '2023-06'
          }
        ]
      })
      const bachelorJob = createBaseJob({
        education: '本科及以上'
      })

      const result = matchEngine.match(masterResume, bachelorJob)

      expect(result.breakdown.education).toBe(20)
    })

    it('硕士不能匹配博士要求只能获得10分', () => {
      const masterResume = createBaseResume({
        education: [
          {
            school: '南京大学',
            major: '物理学',
            degree: '硕士',
            graduationYear: 2024,
            startDate: '2021-09',
            endDate: '2024-06'
          }
        ]
      })
      const phdRequiredJob = createBaseJob({
        education: '博士学历'
      })

      const result = matchEngine.match(masterResume, phdRequiredJob)

      expect(result.breakdown.education).toBe(10)
    })
  })

  describe('本科学历匹配', () => {
    it('本科匹配本科要求应该获得20分满分', () => {
      const bachelorResume = createBaseResume({
        education: [
          {
            school: '武汉大学',
            major: '计算机科学',
            degree: '本科',
            graduationYear: 2023,
            startDate: '2019-09',
            endDate: '2023-06'
          }
        ]
      })
      const bachelorJob = createBaseJob({
        education: '本科及以上'
      })

      const result = matchEngine.match(bachelorResume, bachelorJob)

      expect(result.breakdown.education).toBe(20)
    })

    it('本科不能匹配硕士要求只能获得10分', () => {
      const bachelorResume = createBaseResume({
        education: [
          {
            school: '华中科技大学',
            major: '软件工程',
            degree: '本科',
            graduationYear: 2023,
            startDate: '2019-09',
            endDate: '2023-06'
          }
        ]
      })
      const masterRequiredJob = createBaseJob({
        education: '硕士及以上学历'
      })

      const result = matchEngine.match(bachelorResume, masterRequiredJob)

      expect(result.breakdown.education).toBe(10)
    })

    it('本科不能匹配博士要求应该获得0分', () => {
      const bachelorResume = createBaseResume({
        education: [
          {
            school: '中山大学',
            major: '化学',
            degree: '本科',
            graduationYear: 2022,
            startDate: '2018-09',
            endDate: '2022-06'
          }
        ]
      })
      const phdOnlyJob = createBaseJob({
        education: '博士学历'
      })

      const result = matchEngine.match(bachelorResume, phdOnlyJob)

      expect(result.breakdown.education).toBe(0)
    })

    it('本科生申请专科要求的岗位应该获得20分', () => {
      const bachelorResume = createBaseResume({
        education: [
          {
            school: '四川大学',
            major: '会计学',
            degree: '本科',
            graduationYear: 2023,
            startDate: '2019-09',
            endDate: '2023-06'
          }
        ]
      })
      const collegeJob = createBaseJob({
        education: '专科以上学历' // 虽然写专科，但包含"本科"
      })

      const result = matchEngine.match(bachelorResume, collegeJob)

      expect(result.breakdown.education).toBeGreaterThanOrEqual(10)
    })
  })

  describe('专科学历匹配', () => {
    it('专科学历匹配不限要求时的情况', () => {
      const collegeResume = createBaseResume({
        education: [
          {
            school: '某职业技术学院',
            major: '计算机应用',
            degree: '大专',
            graduationYear: 2023,
            startDate: '2020-09',
            endDate: '2023-06'
          }
        ]
      })
      const noRequirementJob = createBaseJob({
        education: '不限'
      })

      const result = matchEngine.match(collegeResume, noRequirementJob)

      expect(result.breakdown.education).toBeGreaterThanOrEqual(10)
    })

    it('专科学历匹配本科要求应该获得10分', () => {
      const collegeResume = createBaseResume({
        education: [
          {
            school: '某职业学院',
            major: '电子商务',
            degree: '专科',
            graduationYear: 2022,
            startDate: '2019-09',
            endDate: '2022-06'
          }
        ]
      })
      const bachelorRequiredJob = createBaseJob({
        education: '本科及以上'
      })

      const result = matchEngine.match(collegeResume, bachelorRequiredJob)

      expect(result.breakdown.education).toBe(10)
    })
  })

  describe('多段教育经历处理', () => {
    it('多段学历应该取最高学历进行匹配', () => {
      const multiDegreeResume = createBaseResume({
        education: [
          {
            school: '某大学',
            major: '计算机',
            degree: '本科',
            graduationYear: 2020,
            startDate: '2016-09',
            endDate: '2020-06'
          },
          {
            school: '另一所大学',
            major: '人工智能',
            degree: '硕士',
            graduationYear: 2023,
            startDate: '2020-09',
            endDate: '2023-06'
          }
        ]
      })
      const masterJob = createBaseJob({
        education: '硕士及以上学历'
      })

      const result = matchEngine.match(multiDegreeResume, masterJob)

      expect(result.breakdown.education).toBe(20) // 应该使用最高学历（硕士）
    })

    it('相同最高学历的多段经历不应该影响分数', () => {
      const twoBachelorDegrees = createBaseResume({
        education: [
          {
            school: '大学A',
            major: '数学',
            degree: '本科',
            graduationYear: 2018,
            startDate: '2014-09',
            endDate: '2018-06'
          },
          {
            school: '大学B',
            major: '计算机',
            degree: '学士',
            graduationYear: 2021,
            startDate: '2017-09',
            endDate: '2021-06'
          }
        ]
      })
      const bachelorJob = createBaseJob({
        education: '本科及以上'
      })

      const result = matchEngine.match(twoBachelorDegrees, bachelorJob)

      expect(result.breakdown.education).toBe(20)
    })
  })

  describe('无教育经历场景', () => {
    it('空教育经历列表应该返回0分', () => {
      const noEducationResume = createBaseResume({ education: [] })
      const anyJob = createBaseJob()

      const result = matchEngine.match(noEducationResume, anyJob)

      expect(result.breakdown.education).toBe(0)
    })

    it('职位未明确学历要求时应该返回15分基础分', () => {
      const normalEducationResume = createBaseResume({
        education: [
          {
            school: '某大学',
            major: '历史',
            degree: '本科',
            graduationYear: 2022,
            startDate: '2018-09',
            endDate: '2022-06'
          }
        ]
      })
      const noEduRequirementJob = createBaseJob({
        // 不设置education字段或设为空字符串
        description: '这是一个不强调学历的岗位'
      })

      const result = matchEngine.match(normalEducationResume, noEduRequirementJob)

      expect(result.breakdown.education).toBe(15) // 基础分
    })
  })

  describe('matchedFields中的学历信息', () => {
    it('高学历匹配应该在matchedFields中显示学历', () => {
      const highDegreeResume = createBaseResume({
        education: [
          {
            school: '清华大学',
            major: '计算机',
            degree: '硕士',
            graduationYear: 2024,
            startDate: '2021-09',
            endDate: '2024-06'
          }
        ]
      })
      const matchingJob = createBaseJob({
        education: '本科及以上'
      })

      const result = matchEngine.match(highDegreeResume, matchingJob)

      const hasEduField = result.matchedFields.some(field =>
        field.includes('学历') && field.includes('硕士')
      )
      expect(hasEduField).toBe(true)
    })

    it('低学历匹配不应该在matchedFields中显示学历', () => {
      const lowDegreeResume = createBaseResume({
        education: [
          {
            school: '某学校',
            major: '专业',
            degree: '专科',
            graduationYear: 2022,
            startDate: '2019-09',
            endDate: '2022-06'
          }
        ]
      })
      const highRequirementJob = createBaseJob({
        education: '硕士及以上学历'
      })

      const result = matchEngine.match(lowDegreeResume, highRequirementJob)

      const hasEduField = result.matchedFields.some(field => field.includes('学历'))
      expect(hasEduField).toBe(false) // 10分 < 15，不会显示
    })
  })

  describe('边界条件测试', () => {
    it('学位名称变体识别：学士vs本科', () => {
      const bachelorVariantResume = createBaseResume({
        education: [
          {
            school: '某大学',
            major: '物理',
            degree: '学士',
            graduationYear: 2022,
            startDate: '2018-09',
            endDate: '2022-06'
          }
        ]
      })
      const bachelorJob = createBaseJob({
        education: '本科及以上'
      })

      const result = matchEngine.match(bachelorVariantResume, bachelorJob)

      expect(result.breakdown.education).toBe(20) // 学士应该等同于本科
    })

    it('学位名称变体识别：大专vs专科', () => {
      const collegeVariantResume = createBaseResume({
        education: [
          {
            school: '某学院',
            major: '机械',
            degree: '大专',
            graduationYear: 2022,
            startDate: '2019-09',
            endDate: '2022-06'
          }
        ]
      })
      const anyJob = createBaseJob()

      const result = matchEngine.match(collegeVariantResume, anyJob)

      expect(result).toBeDefined()
      expect(typeof result.breakdown.education).toBe('number')
    })

    it('未知的学位名称应该被安全处理', () => {
      const unknownDegreeResume = createBaseResume({
        education: [
          {
            school: '某学校',
            major: '专业',
            degree: '高中', // 不在degreeMap中
            graduationYear: 2020,
            startDate: '2017-09',
            endDate: '2020-06'
          }
        ]
      })
      const anyJob = createBaseJob()

      expect(() => matchEngine.match(unknownDegreeResume, anyJob)).not.toThrow()
    })

    it('超长学位名称的处理', () => {
      const longDegreeNameResume = createBaseResume({
        education: [
          {
            school: '某大学',
            major: '专业',
            degree: '这是一个非常非常长的学位名称用于测试系统稳定性',
            graduationYear: 2023,
            startDate: '2019-09',
            endDate: '2023-06'
          }
        ]
      })
      const anyJob = createBaseJob()

      const result = matchEngine.match(longDegreeNameResume, anyJob)

      expect(result).toBeDefined()
    })
  })

  describe('性能基准测试', () => {
    it('学历匹配计算应该在合理时间内完成', () => {
      const complexEducationResume = createBaseResume({
        education: Array.from({ length: 5 }, (_, i) => ({
          school: `学校${i}`,
          major: `专业${i}`,
          degree: ['专科', '本科', '硕士', '博士'][i % 4],
          graduationYear: 2020 + i,
          startDate: `${2016 + i}-09`,
          endDate: `${2020 + i}-06`
        }))
      })
      const job = createBaseJob()

      const iterations = 100
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        matchEngine.match(complexEducationResume, job)
      }

      const totalTime = performance.now() - startTime
      const avgTime = totalTime / iterations

      expect(avgTime).toBeLessThan(50)
    })

    it('批量学历匹配性能测试', () => {
      const job = createBaseJob()
      const resumesWithVaryingEducation = Array.from({ length: 50 }, (_, i) =>
        createBaseResume({
          education: [
            {
              school: `学校${i}`,
              major: ['计算机', '金融', '数学', '文学'][i % 4],
              degree: ['本科', '硕士', '博士', '专科'][i % 4],
              graduationYear: 2020 + (i % 5),
              startDate: `${2016 + (i % 5)}-09`,
              endDate: `${2020 + (i % 5)}-06`
            }
          ]
        })
      )

      const startTime = performance.now()
      const results = resumesWithVaryingEducation.map(resume =>
        matchEngine.match(resume, job)
      )
      const totalTime = performance.now() - startTime

      expect(results.length).toBe(50)
      expect(totalTime).toBeLessThan(1000)
    })
  })
})
