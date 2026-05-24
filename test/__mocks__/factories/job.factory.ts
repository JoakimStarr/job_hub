import { faker } from '@faker-js/faker/locale/zh_CN'
import type { JobItem } from '@/types'

export class JobFactory {
  private overrides: Partial<JobItem> = {}
  private static idCounter = 1000

  withOverrides(overrides: Partial<JobItem>): this {
    this.overrides = { ...this.overrides, ...overrides }
    return this
  }

  create(overrides?: Partial<JobItem>): JobItem {
    const baseJob: JobItem = {
      id: JobFactory.idCounter++,
      title: faker.helpers.arrayElement([
        '高级数据分析师',
        '投资分析师',
        'Python开发工程师',
        '产品经理',
        '量化研究员',
        '风控专员',
        '金融科技工程师',
        '机器学习工程师',
        '前端开发工程师',
        'Java后端开发工程师',
      ]),
      company: faker.company.name(),
      location: faker.helpers.arrayElement([
        '北京', '上海', '深圳', '杭州', '广州', '成都',
        '北京朝阳区', '上海浦东新区', '深圳南山区',
      ]),
      source: faker.helpers.arrayElement([
        'boss直聘', '猎聘', '拉勾', '智联招聘', '前程无忧',
      ]),
      salary: `${faker.number.int({ min: 10, max: 50 })}-${faker.number.int({ min: 20, max: 80 })}K`,
      description: faker.lorem.paragraphs({ min: 2, max: 4 }),
      requirements: faker.lorem.paragraph(),
      tags: faker.helpers.arrayElements([
        'Python', 'SQL', 'Excel', '机器学习', '数据分析',
        'CFA', 'CPA', '金融', '互联网', '远程', 'Java', 'React',
      ], { min: 2, max: 5 }).join(','),
      industry: faker.helpers.arrayElement([
        '互联网', '金融', '咨询', '教育', '医疗', '互联网金融',
      ]),
      education: faker.helpers.arrayElement([
        '本科及以上', '硕士及以上学历', '博士学历', '不限',
      ]),
      experience: faker.helpers.arrayElement([
        '1-3年', '3-5年', '5-10年', '不限', '应届毕业生',
      ]),
      job_type: faker.helpers.arrayElement([
        '全职', '兼职', '实习', '远程',
      ]),
      created_at: faker.date.recent().toISOString(),
      updated_at: faker.date.recent().toISOString(),
      ...this.overrides,
      ...overrides,
    }

    return baseJob
  }

  createBatch(count: number): JobItem[] {
    return Array.from({ length: count }, () => this.create())
  }

  createPerfectMatch(): JobItem {
    return this.create({
      title: '高级数据分析师',
      company: '某知名互联网公司',
      description: '需要精通Python、SQL、机器学习，有金融背景优先，负责业务数据分析和模型构建',
      requirements: '硕士以上学历，3年以上数据分析经验，熟悉Python/SQL/Excel，有机器学习项目经验',
      location: '北京',
      source: 'boss直聘',
      industry: '互联网金融',
      tags: 'Python,SQL,机器学习,数据分析,金融',
      education: '硕士及以上学历',
      experience: '3-5年',
      salary: '25-40K',
    })
  }

  createNoMatch(): JobItem {
    return this.create({
      title: '美容师',
      company: '某美容院',
      description: '负责顾客的美容护理工作，包括面部护理、身体护理等',
      requirements: '有美容师证书，形象气质佳，有相关工作经验者优先',
      location: '三四线城市',
      source: '线下招聘',
      industry: '生活服务',
      tags: '美容,护理,服务',
      education: '不限',
      experience: '1-3年',
      salary: '5-8K',
    })
  }

  createPartialMatch(): JobItem {
    return this.create({
      title: '数据分析师助理',
      description: '协助高级分析师完成数据处理和分析工作',
      requirements: '本科及以上学历，有一定的数据分析基础',
      location: '上海',
      source: '猎聘',
      industry: '咨询',
      tags: '数据分析,Excel',
      education: '本科及以上',
      experience: '1-3年',
      salary: '10-15K',
    })
  }

  createRealistic(): JobItem {
    return this.create()
  }

  withRequirements(requirements: string): JobItem {
    return this.create({ requirements })
  }

  withEducationRequirement(education: string): JobItem {
    return this.create({ requirements: education })
  }

  withLocation(location: string): JobItem {
    return this.create({ location })
  }

  withSource(source: string): JobItem {
    return this.create({ source })
  }

  withIndustry(industry: string): JobItem {
    return this.create({ industry })
  }

  withTags(tags: string): JobItem {
    return this.create({ tags })
  }

  withTitleAndKeywords(title: string, keywords: string[]): JobItem {
    return this.create({
      title,
      description: `需要${keywords.join('、')}等相关技能`,
      requirements: `熟悉${keywords.slice(0, 3).join('、')}等工具`,
      tags: keywords.join(','),
    })
  }

  reset(): this {
    this.overrides = {}
    return this
  }
}
