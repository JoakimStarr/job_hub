import { faker } from '@faker-js/faker/locale/zh_CN'
import type { ResumeProfile, Education, Internship, Project } from '@/types'

export class ResumeFactory {
  private overrides: Partial<ResumeProfile> = {}

  withOverrides(overrides: Partial<ResumeProfile>): this {
    this.overrides = { ...this.overrides, ...overrides }
    return this
  }

  create(overrides?: Partial<ResumeProfile>): ResumeProfile {
    const baseProfile: ResumeProfile = {
      name: faker.person.firstName(),
      phone: faker.phone.number(),
      email: faker.internet.email(),
      gender: faker.helpers.arrayElement(['男', '女']),
      birthDate: faker.date.birthdate().toISOString().split('T')[0],
      age: faker.number.int({ min: 22, max: 35 }),
      address: faker.location.city(),
      
      education: this.generateDefaultEducation(),
      skills: faker.helpers.arrayElements([
        'Python', 'SQL', 'Excel', '机器学习', '数据分析',
        'Java', 'JavaScript', 'React', 'CFA', 'CPA',
      ], { min: 2, max: 5 }),
      
      certifications: faker.helpers.arrayElements([
        'CFA Level 1', 'CPA', 'FRM', 'ACCA', 'PMP',
      ], { min: 0, max: 2 }),
      
      languages: ['中文(母语)', '英语(CET-6)'],
      
      internships: this.generateDefaultInternships(),
      projects: this.generateDefaultProjects(),
      
      targetPosition: faker.helpers.arrayElement([
        '数据分析师', '投资分析师', '产品经理',
      ]),
      targetLocation: faker.helpers.arrayElement(['北京', '上海', '深圳']),
      targetSalary: '15-25K',
      targetIndustry: faker.helpers.arrayElement(['互联网', '金融', '咨询']),
      
      resumeText: faker.lorem.paragraphs({ min: 3, max: 5 }),
      
      ...this.overrides,
      ...overrides,
    }

    return baseProfile
  }

  createPerfectMatch(): ResumeProfile {
    return this.create({
      name: '完美候选人',
      skills: ['Python', 'SQL', 'Excel', '机器学习', '数据分析', 'R', 'Tableau'],
      education: [
        {
          school: '清华大学',
          major: '计算机科学与技术',
          degree: '硕士',
          graduationYear: 2024,
          startDate: '2021-09',
          endDate: '2024-06',
        },
        {
          school: '北京大学',
          major: '金融学',
          degree: '学士',
          graduationYear: 2021,
          startDate: '2017-09',
          endDate: '2021-06',
        },
      ],
      certifications: ['CFA Level 3', 'CPA', 'FRM'],
      internships: [
        {
          company: '某知名互联网公司',
          position: '数据分析师实习生',
          duration: '6个月',
          description: '负责业务数据分析和报告撰写，使用Python和SQL进行数据处理',
          startDate: '2023-07',
          endDate: '2023-12',
        },
        {
          company: '某证券公司',
          position: '量化分析实习生',
          duration: '3个月',
          description: '参与量化策略研究，使用机器学习模型进行预测',
          startDate: '2023-01',
          endDate: '2023-03',
        },
      ],
      projects: [
        {
          name: '用户行为预测系统',
          role: '核心开发者',
          description: '使用XGBoost构建用户流失预测模型，AUC达到0.85',
        },
        {
          name: '金融数据可视化平台',
          role: '项目负责人',
          description: '使用React+ECharts搭建实时数据监控大屏',
        },
      ],
      targetPosition: '高级数据分析师',
      targetLocation: '北京',
      targetIndustry: '互联网金融',
    })
  }

  createNoMatch(): ResumeProfile {
    return this.create({
      name: '完全不匹配候选人',
      skills: ['市场营销', '文案写作', '活动策划', '客户关系管理'],
      education: [
        {
          school: '某艺术学院',
          major: '广告学',
          degree: '学士',
          graduationYear: 2022,
          startDate: '2018-09',
          endDate: '2022-06',
        },
      ],
      certifications: [],
      internships: [
        {
          company: '某广告公司',
          position: '市场策划实习生',
          duration: '3个月',
          description: '负责活动策划和文案撰写',
          startDate: '2022-01',
          endDate: '2022-03',
        },
      ],
      projects: [],
      targetPosition: '市场专员',
      targetLocation: '广州',
      targetIndustry: '广告传媒',
    })
  }

  createPartialMatch(): ResumeProfile {
    return this.create({
      name: '部分匹配候选人',
      skills: ['Python', 'Excel'],
      education: [
        {
          school: '某普通大学',
          major: '统计学',
          degree: '学士',
          graduationYear: 2023,
          startDate: '2019-09',
          endDate: '2023-06',
        },
      ],
      certifications: [],
      internships: [
        {
          company: '某小公司',
          position: '数据录入员',
          duration: '2个月',
          description: '负责数据整理和Excel报表制作',
          startDate: '2023-07',
          endDate: '2023-08',
        },
      ],
      projects: [
        {
          name: '课程作业项目',
          role: '组员',
          description: '使用Python进行简单的数据分析',
        },
      ],
      targetPosition: '数据分析师',
      targetLocation: '上海',
    })
  }

  createRichProfile(): ResumeProfile {
    return this.createPerfectMatch()
  }

  createMinimal(): ResumeProfile {
    return this.create({
      name: '空白简历',
      skills: [],
      education: [],
      certifications: [],
      internships: [],
      projects: [],
      resumeText: '',
    })
  }

  createEmpty(): ResumeProfile {
    return this.createMinimal()
  }

  createRealistic(): ResumeProfile {
    return this.create()
  }

  createRandom(): ResumeProfile {
    const profileTypes = [
      () => this.createPerfectMatch(),
      () => this.createNoMatch(),
      () => this.createPartialMatch(),
      () => this.create(),
    ]
    
    const randomType = faker.helpers.arrayElement(profileTypes)
    return randomType()
  }

  withSkills(skills: string[]): ResumeProfile {
    return this.create({ skills })
  }

  withoutProjects(): ResumeProfile {
    return this.create({ projects: [] })
  }

  withEducation(educationList: Education[]): ResumeProfile {
    return this.create({ education: educationList })
  }

  withInternships(internships: Internship[]): ResumeProfile {
    return this.create({ internships })
  }

  withLocation(location: string): ResumeProfile {
    return this.create({ targetLocation: location })
  }

  withTargetPosition(position: string): ResumeProfile {
    return this.create({ targetPosition: position })
  }

  private generateDefaultEducation(): Education[] {
    return [
      {
        school: faker.university.name(),
        major: faker.helpers.arrayElement([
          '计算机科学', '金融学', '统计学', '数学', '经济学',
        ]),
        degree: faker.helpers.arrayElement(['学士', '硕士', '博士']),
        graduationYear: faker.number.int({ min: 2020, max: 2024 }),
        startDate: `${faker.number.int({ min: 2016, max: 2020 })}-09`,
        endDate: `${faker.number.int({ min: 2020, max: 2024 })}-06`,
      },
    ]
  }

  private generateDefaultInternships(): Internship[] {
    return [
      {
        company: faker.company.name(),
        position: faker.person.jobTitle(),
        duration: `${faker.number.int({ min: 1, max: 6 })}个月`,
        description: faker.lorem.sentence(),
        startDate: '2023-01',
        endDate: '2023-06',
      },
    ]
  }

  private generateDefaultProjects(): Project[] {
    return [
      {
        name: faker.commerce.productName(),
        role: faker.helpers.arrayElement(['核心开发', '项目负责人', '参与者']),
        description: faker.lorem.sentence(),
      },
    ]
  }

  reset(): this {
    this.overrides = {}
    return this
  }
}
