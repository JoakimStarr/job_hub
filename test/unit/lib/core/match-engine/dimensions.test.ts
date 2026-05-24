import { describe, it, expect, beforeEach } from 'vitest'
import { MatchEngine } from '@/lib/match-engine'
import type { ResumeProfile, JobItem } from '@/types'

describe('MatchEngine - 地点/经验/行业/专业维度测试', () => {
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

  describe('地点维度匹配', () => {
    it('地点完全匹配应该获得10分满分', () => {
      const beijingResume = createBaseResume({
        targetLocation: '北京',
        resumeText: '希望在北京工作和发展'
      })
      const beijingJob = createBaseJob({
        location: '北京'
      })

      const result = matchEngine.match(beijingResume, beijingJob)

      expect(result.breakdown.location).toBe(10)
    })

    it('上海匹配应该获得10分', () => {
      const shanghaiResume = createBaseResume({
        targetLocation: '上海',
        resumeText: '期望在上海工作'
      })
      const shanghaiJob = createBaseJob({
        location: '上海'
      })

      const result = matchEngine.match(shanghaiResume, shanghaiJob)

      expect(result.breakdown.location).toBe(10)
    })

    it('深圳匹配应该获得10分', () => {
      const shenzhenResume = createBaseResume({
        targetLocation: '深圳',
        resumeText: '希望到深圳发展'
      })
      const shenzhenJob = createBaseJob({
        location: '深圳'
      })

      const result = matchEngine.match(shenzhenResume, shenzhenJob)

      expect(result.breakdown.location).toBe(10)
    })

    it('其他一线城市（广州、成都、杭州等）匹配应该获得10分', () => {
      const testCases = [
        { city: '广州', text: '希望在广州工作' },
        { city: '成都', text: '计划去成都发展' },
        { city: '杭州', text: '想在杭州生活' },
        { city: '南京', text: '目标城市是南京' },
        { city: '武汉', text: '愿意在武汉工作' },
        { city: '西安', text: '考虑西安的机会' }
      ]

      for (const testCase of testCases) {
        const cityResume = createBaseResume({
          targetLocation: testCase.city,
          resumeText: testCase.text
        })
        const cityJob = createBaseJob({
          location: testCase.city
        })

        const result = matchEngine.match(cityResume, cityJob)
        expect(result.breakdown.location).toBe(10)
      }
    })

    it('地点不匹配应该获得5分', () => {
      const beijingResume = createBaseResume({
        targetLocation: '北京',
        resumeText: '只接受北京的职位'
      })
      const shanghaiJob = createBaseJob({
        location: '上海'
      })

      const result = matchEngine.match(beijingResume, shanghaiJob)

      expect(result.breakdown.location).toBe(5)
    })

    it('包含区域信息的地点匹配（如北京朝阳区）', () => {
      const beijingResume = createBaseResume({
        targetLocation: '北京',
        resumeText: '希望在北京朝阳区工作'
      })
      const beijingDistrictJob = createBaseJob({
        location: '北京朝阳区'
      })

      const result = matchEngine.match(beijingResume, beijingDistrictJob)

      expect(result.breakdown.location).toBe(10) // 包含"北京"关键词
    })

    it('职位未指定地点时应该获得10分基础分', () => {
      const anyLocationResume = createBaseResume()
      const noLocationJob = createBaseJob({
        // 不设置location字段
        description: '这是一个远程岗位'
      })

      const result = matchEngine.match(anyLocationResume, noLocationJob)

      expect(result.breakdown.location).toBe(10)
    })

    it('地点不匹配应该在risks中显示警告', () => {
      const beijingResume = createBaseResume({
        targetLocation: '北京',
        resumeText: '只想去北京'
      })
      const guangzhouJob = createBaseJob({
        location: '广州'
      })

      const result = matchEngine.match(beijingResume, guangzhouJob)

      expect(result.risks.some(risk => risk.includes('地点'))).toBe(true)
    })

    it('地点匹配应该在matchedFields中显示', () => {
      const matchedLocationResume = createBaseResume({
        targetLocation: '杭州',
        resumeText: '期待在杭州的工作机会'
      })
      const hangzhouJob = createBaseJob({
        location: '杭州'
      })

      const result = matchEngine.match(matchedLocationResume, hangzhouJob)

      const hasLocationField = result.matchedFields.some(field =>
        field.includes('地点') && field.includes('杭州')
      )
      expect(hasLocationField).toBe(true)
    })
  })

  describe('经验/实习维度匹配', () => {
    it('应届生/校招岗位应该获得15分', () => {
      const freshGraduateResume = createBaseResume({ internships: [] })
      const campusRecruitmentJob = createBaseJob({
        experience: '应届毕业生',
        description: '面向2024届毕业生的校园招聘'
      })

      const result = matchEngine.match(freshGraduateResume, campusRecruitmentJob)

      expect(result.breakdown.experience).toBe(15)
    })

    it('有实习经历的候选人申请实习岗位应该获得15分', () => {
      const withInternshipResume = createBaseResume({
        internships: [
          {
            company: '某公司',
            position: '实习生',
            duration: '3个月',
            description: '参与项目开发',
            startDate: '2023-06',
            endDate: '2023-09'
          }
        ]
      })
      const internshipJob = createBaseJob({
        description: '招聘实习生，需要有实习经历',
        requirements: '有相关实习经验者优先'
      })

      const result = matchEngine.match(withInternshipResume, internshipJob)

      expect(result.breakdown.experience).toBe(15)
    })

    it('无实习经历申请需要实习的岗位只能获得5分', () => {
      const noInternshipResume = createBaseResume({ internships: [] })
      const internshipRequiredJob = createBaseJob({
        description: '这个岗位需要有一定的实习经历或实习经验',
        requirements: '有实习经验者优先考虑'
      })

      const result = matchEngine.match(noInternshipResume, internshipRequiredJob)

      expect(result.breakdown.experience).toBe(5)
    })

    it('1年经验要求与1个以上实习的匹配', () => {
      const oneInternshipResume = createBaseResume({
        internships: [
          {
            company: '公司A',
            position: '助理',
            duration: '6个月',
            description: '辅助工作',
            startDate: '2023-01',
            endDate: '2023-06'
          }
        ]
      })
      const oneYearExperienceJob = createBaseJob({
        experience: '1年经验',
        description: '需要1年以上工作经验'
      })

      const result = matchEngine.match(oneInternshipResume, oneYearExperienceJob)

      expect(result.breakdown.experience).toBe(12)
    })

    it('3年经验要求与2个以上实习的匹配', () => {
      const twoInternshipsResume = createBaseResume({
        internships: [
          {
            company: '公司A',
            position: '实习生1',
            duration: '3个月',
            description: '第一段实习',
            startDate: '2022-06',
            endDate: '2022-09'
          },
          {
            company: '公司B',
            position: '实习生2',
            duration: '6个月',
            description: '第二段实习',
            startDate: '2023-01',
            endDate: '2023-06'
          }
        ]
      })
      const threeYearExperienceJob = createBaseJob({
        experience: '3年经验',
        description: '需要3年以上工作经验'
      })

      const result = matchEngine.match(twoInternshipsResume, threeYearExperienceJob)

      expect(result.breakdown.experience).toBe(10)
    })

    it('有任意实习经历但无明确经验的场景', () => {
      const withSomeInternshipResume = createBaseResume({
        internships: [
          {
            company: '某公司',
            position: '实习生',
            duration: '2个月',
            description: '短期实习',
            startDate: '2023-07',
            endDate: '2023-08'
          }
        ]
      })
      const noSpecificRequirementJob = createBaseJob({
        description: '这是一个普通岗位，欢迎应届生和有经验者申请'
      })

      const result = matchEngine.match(withSomeInternshipResume, noSpecificRequirementJob)

      expect(result.breakdown.experience).toBe(10) // 有实习经历
    })

    it('无任何实习经历且无特殊要求的场景', () => {
      const noExperienceResume = createBaseResume({ internships: [] })
      const normalJob = createBaseJob({
        description: '普通岗位，不限经验'
      })

      const result = matchEngine.match(noExperienceResume, normalJob)

      expect(result.breakdown.experience).toBe(5) // 基础分
    })

    it('多段实习经历不应该重复计分', () => {
      const manyInternshipsResume = createBaseResume({
        internships: Array.from({ length: 5 }, (_, i) => ({
          company: `公司${i}`,
          position: `实习生${i}`,
          duration: `${(i + 1) * 2}个月`,
          description: `第${i + 1}段实习`,
          startDate: `202${i}-01`,
          endDate: `202${i}-06`
        }))
      })
      const anyJob = createBaseJob()

      const result = matchEngine.match(manyInternshipsResume, anyJob)

      expect(result.breakdown.experience).toBeLessThanOrEqual(15) // 不应超过满分
    })

    it('缺少实习经历应该在gaps中显示提示', () => {
      const noInternshipResume = createBaseResume({ internships: [] })
      const experienceRequiredJob = createBaseJob({
        description: '需要有实际项目经验或实习经历'
      })

      const result = matchEngine.match(noInternshipResume, experienceRequiredJob)

      expect(result.gaps).toContain('缺少实习经历')
    })
  })

  describe('行业维度匹配', () => {
    it('行业完全匹配应该获得10分满分', () => {
      const internetResume = createBaseResume({
        targetIndustry: '互联网',
        resumeText: '有互联网公司实习经验，熟悉互联网行业'
      })
      const internetJob = createBaseJob({
        industry: '互联网'
      })

      const result = matchEngine.match(internetResume, internetJob)

      expect(result.breakdown.industry).toBe(10)
    })

    it('金融行业匹配应该获得10分', () => {
      const financeResume = createBaseResume({
        targetIndustry: '金融',
        resumeText: '在证券公司和银行都有实习经历，对金融行业感兴趣'
      })
      const financeJob = createBaseJob({
        industry: '金融'
      })

      const result = matchEngine.match(financeResume, financeJob)

      expect(result.breakdown.industry).toBe(10)
    })

    it('证券子行业匹配应该获得10分', () => {
      const securitiesResume = createBaseResume({
        targetIndustry: '证券',
        resumeText: '在某头部证券公司实习过，对证券行业有深入了解'
      })
      const securitiesJob = createBaseJob({
        industry: '证券'
      })

      const result = matchEngine.match(securitiesResume, securitiesJob)

      expect(result.breakdown.industry).toBe(10)
    })

    it('银行子行业匹配应该获得10分', () => {
      const bankResume = createBaseResume({
        targetIndustry: '银行',
        resumeText: '在银行有过实习经历，了解银行业务流程'
      })
      const bankJob = createBaseJob({
        industry: '银行'
      })

      const result = matchEngine.match(bankResume, bankJob)

      expect(result.breakdown.industry).toBe(10)
    })

    it('基金/保险/投资子行业匹配应该获得10分', () => {
      const subIndustries = ['基金', '保险', '投资']

      for (const industry of subIndustries) {
        const industryResume = createBaseResume({
          targetIndustry: industry,
          resumeText: `在${industry}行业有相关经验`
        })
        const industryJob = createBaseJob({
          industry: industry
        })

        const result = matchEngine.match(industryResume, industryJob)
        expect(result.breakdown.industry).toBe(10)
      }
    })

    it('科技/互联网相关行业匹配', () => {
      const techResume = createBaseResume({
        targetIndustry: '科技',
        resumeText: '科技公司背景，熟悉科技行业发展'
      })
      const techJob = createBaseJob({
        industry: '科技'
      })

      const result = matchEngine.match(techResume, techJob)

      expect(result.breakdown.industry).toBe(10)
    })

    it('行业不匹配应该获得5分', () => {
      const artResume = createBaseResume({
        targetIndustry: '艺术设计',
        resumeText: '专注于艺术设计领域'
      })
      const financeJob = createBaseJob({
        industry: '金融'
      })

      const result = matchEngine.match(artResume, financeJob)

      expect(result.breakdown.industry).toBe(5)
    })

    it('职位未指定行业时应该获得基础分', () => {
      const anyIndustryResume = createBaseResume()
      const noIndustryJob = createBaseJob({
        description: '未指定行业的岗位'
      })

      const result = matchEngine.match(anyIndustryResume, noIndustryJob)

      expect(result.breakdown.industry).toBeGreaterThanOrEqual(5)
    })
  })

  describe('专业维度匹配', () => {
    it('专业名称完全匹配应该获得15分满分', () => {
      const csMajorResume = createBaseResume({
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
        resumeText: '主修计算机科学与技术专业'
      })
      const csMajorJob = createBaseJob({
        description: '需要计算机科学与技术专业的候选人',
        requirements: '计算机相关专业优先'
      })

      const result = matchEngine.match(csMajorResume, csMajorJob)

      expect(result.breakdown.major).toBe(15)
    })

    it('金融学专业匹配应该获得15分', () => {
      const financeMajorResume = createBaseResume({
        education: [
          {
            school: '北京大学',
            major: '金融学',
            degree: '本科',
            graduationYear: 2023,
            startDate: '2019-09',
            endDate: '2023-06'
          }
        ],
        resumeText: '金融学专业背景'
      })
      const financeRelatedJob = createBaseJob({
        description: '金融学或相关专业优先',
        requirements: '有金融学基础'
      })

      const result = matchEngine.match(financeMajorResume, financeRelatedJob)

      expect(result.breakdown.major).toBeGreaterThanOrEqual(10)
    })

    it('专业关键词部分匹配应该获得10分', () => {
      const economicsMajorResume = createBaseResume({
        education: [
          {
            school: '复旦大学',
            major: '经济学',
            degree: '硕士',
            graduationYear: 2024,
            startDate: '2021-09',
            endDate: '2024-06'
          }
        ],
        resumeText: '经济学专业，对经济分析有深入研究'
      })
      const economicKeywordJob = createBaseJob({
        description: '需要有经济或金融背景的候选人',
        requirements: '经济类专业优先'
      })

      const result = matchEngine.match(economicsMajorResume, economicKeywordJob)

      expect(result.breakdown.major).toBe(10) // "经济"关键词匹配
    })

    it('统计/数学/会计/财务等专业关键词匹配', () => {
      const keywordMajors = [
        { major: '统计学', keyword: '统计' },
        { major: '数学与应用数学', keyword: '数学' },
        { major: '会计学', keyword: '会计' },
        { major: '财务管理', keyword: '财务' }
      ]

      for (const { major, keyword } of keywordMajors) {
        const majorResume = createBaseResume({
          education: [
            {
              school: '某大学',
              major: major,
              degree: '本科',
              graduationYear: 2023,
              startDate: '2019-09',
              endDate: '2023-06'
            }
          ],
          resumeText: `${major}专业背景`
        })
        const keywordJob = createBaseJob({
          description: `需要${keyword}相关专业的候选人`,
          requirements: `${keyword}类或相关专业`
        })

        const result = matchEngine.match(majorResume, keywordJob)
        expect(result.breakdown.major).toBe(10)
      }
    })

    it('计算机专业关键词匹配', () => {
      const csResume = createBaseResume({
        education: [
          {
            school: '浙江大学',
            major: '计算机科学',
            degree: '学士',
            graduationYear: 2023,
            startDate: '2019-09',
            endDate: '2023-06'
          }
        ],
        resumeText: '计算机专业，擅长编程'
      })
      const computerKeywordJob = createBaseJob({
        description: '需要计算机相关专业的候选人',
        requirements: '计算机或软件工程专业优先'
      })

      const result = matchEngine.match(csResume, computerKeywordJob)

      expect(result.breakdown.major).toBe(10) // "计算机"关键词
    })

    it('完全不相关的专业应该获得低分（5分）', () => {
      const unrelatedMajorResume = createBaseResume({
        education: [
          {
            school: '某艺术学院',
            major: '表演艺术',
            degree: '本科',
            graduationYear: 2022,
            startDate: '2018-09',
            endDate: '2022-06'
          }
        ],
        resumeText: '表演艺术专业，擅长舞台表演'
      })
      const engineeringJob = createBaseJob({
        description: '需要理工科背景的技术岗位',
        requirements: '计算机、数学、物理等相关专业'
      })

      const result = matchEngine.match(unrelatedMajorResume, engineeringJob)

      expect(result.breakdown.major).toBeLessThan(10)
    })

    it('空教育经历时专业得分应该为0', () => {
      const noEducationResume = createBaseResume({ education: [] })
      const anyJob = createBaseJob()

      const result = matchEngine.match(noEducationResume, anyJob)

      expect(result.breakdown.major).toBe(0)
    })

    it('专业匹配度高时应该在matchedFields中显示专业', () => {
      const matchedMajorResume = createBaseResume({
        education: [
          {
            school: '清华大学',
            major: '数据科学',
            degree: '硕士',
            graduationYear: 2024,
            startDate: '2021-09',
            endDate: '2024-06'
          }
        ],
        resumeText: '数据科学专业背景'
      })
      const dataRelatedJob = createBaseJob({
        description: '需要数据科学或相关专业背景'
      })

      const result = matchEngine.match(matchedMajorResume, dataRelatedJob)

      const hasMajorField = result.matchedFields.some(field =>
        field.includes('专业')
      )
      expect(hasMajorField).toBe(true)
    })

    it('专业不匹配时应该在gaps中显示提示', () => {
      const mismatchedMajorResume = createBaseResume({
        education: [
          {
            school: '某大学',
            major: '历史学',
            degree: '本科',
            graduationYear: 2022,
            startDate: '2018-09',
            endDate: '2022-06'
          }
        ],
        resumeText: '历史学专业'
      })
      const engineeringJob = createBaseJob({
        description: '需要工程类专业背景'
      })

      const result = matchEngine.match(mismatchedMajorResume, engineeringJob)

      expect(result.gaps).toContain('专业背景与岗位要求不完全匹配')
    })
  })

  describe('综合维度交互测试', () => {
    it('地点+行业双匹配应该比单匹配分数更高', () => {
      const doubleMatchResume = createBaseResume({
        targetLocation: '北京',
        targetIndustry: '互联网',
        resumeText: '希望在北京的互联网行业发展'
      })
      const matchingBothJob = createBaseJob({
        location: '北京',
        industry: '互联网'
      })
      const matchingOneJob = createBaseJob({
        location: '北京',
        industry: '传统制造' // 只匹配地点
      })

      const doubleResult = matchEngine.match(doubleMatchResume, matchingBothJob)
      const singleResult = matchEngine.match(doubleMatchResume, matchingOneJob)

      expect(doubleResult.total).toBeGreaterThan(singleResult.total)
    })

    it('所有维度都匹配时总分应该最高', () => {
      const allMatchResume = createBaseResume({
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
        internships: [
          {
            company: '某公司',
            position: '数据分析师',
            duration: '6个月',
            description: '数据分析工作',
            startDate: '2023-07',
            endDate: '2023-12'
          }
        ],
        resumeText: '优秀候选人有丰富经验和技能'
      })
      const allMatchJob = createBaseJob({
        location: '北京',
        industry: '互联网',
        description: '需要Python、SQL、Excel、机器学习等技能',
        requirements: '硕士以上学历'
      })

      const allMatchResult = matchEngine.match(allMatchResume, allMatchJob)

      expect(allMatchResult.breakdown.location).toBeGreaterThanOrEqual(5)
      expect(allMatchResult.breakdown.industry).toBeGreaterThanOrEqual(5)
      expect(allMatchResult.breakdown.experience).toBeGreaterThanOrEqual(10)
      expect(allMatchResult.breakdown.major).toBeGreaterThanOrEqual(5)
    })
  })

  describe('性能基准测试', () => {
    it('维度匹配计算应该在合理时间内完成', () => {
      const complexResume = createBaseResume({
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
        internships: [
          {
            company: '某公司',
            position: '数据分析师',
            duration: '6个月',
            description: '数据分析工作',
            startDate: '2023-07',
            endDate: '2023-12'
          }
        ]
      })
      const job = createBaseJob({
        location: '北京',
        industry: '互联网'
      })

      const iterations = 100
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        matchEngine.match(complexResume, job)
      }

      const totalTime = performance.now() - startTime
      const avgTime = totalTime / iterations

      expect(avgTime).toBeLessThan(50)
    })

    it('批量维度匹配性能测试', () => {
      const jobs = Array.from({ length: 50 }, (_, i) =>
        createBaseJob({
          id: 4000 + i,
          title: `职位${i}`,
          location: ['北京', '上海', '深圳'][i % 3],
          industry: ['互联网', '金融', '咨询'][i % 3]
        })
      )
      const resume = createBaseResume({
        targetLocation: '北京',
        targetIndustry: '互联网',
        resumeText: '希望在北京的互联网公司工作'
      })

      const startTime = performance.now()
      const results = jobs.map(job => matchEngine.match(resume, job))
      const totalTime = performance.now() - startTime

      expect(results.length).toBe(50)
      expect(totalTime).toBeLessThan(1000)
    })
  })
})
