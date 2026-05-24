import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSendMail = vi.fn()
const mockCreateTransport = vi.fn(() => ({
  sendMail: mockSendMail,
}))

vi.mock('nodemailer', () => ({
  default: {
    createTransport: mockCreateTransport,
  },
}))

vi.mock('./logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import {
  sendJobAlertEmail,
  sendTestEmail,
  isEmailConfigured,
} from '@/lib/email-service'
import type { JobAlertEmailData } from '@/lib/email-service'

describe('EmailService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.SMTP_HOST
    delete process.env.SMTP_PORT
    delete process.env.SMTP_USER
    delete process.env.SMTP_PASS
    delete process.env.SMTP_SECURE
    delete process.env.SMTP_FROM_NAME
    delete process.env.SMTP_FROM_EMAIL
    delete process.env.NEXT_PUBLIC_BASE_URL
  })

  describe('SMTP配置检测', () => {
    it('当SMTP配置不完整时应返回配置错误', async () => {
      process.env.SMTP_HOST = 'smtp.test.com'
      process.env.SMTP_USER = 'user'

      const result = await sendJobAlertEmail({
        to: 'test@example.com',
        alertId: 1,
        keywords: ['测试'],
        jobs: [],
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('SMTP configuration not complete')
      expect(mockCreateTransport).not.toHaveBeenCalled()
    })

    it('isEmailConfigured应在SMTP未配置时返回false', () => {
      delete process.env.SMTP_HOST

      expect(isEmailConfigured()).toBe(false)
    })

    it('isEmailConfigured应在SMTP已配置时返回true', () => {
      process.env.SMTP_HOST = 'smtp.test.com'
      process.env.SMTP_PORT = '587'
      process.env.SMTP_USER = 'test@test.com'
      process.env.SMTP_PASS = 'password'

      expect(isEmailConfigured()).toBe(true)
    })
  })

  describe('邮件发送成功场景', () => {
    beforeEach(() => {
      process.env.SMTP_HOST = 'smtp.test.com'
      process.env.SMTP_PORT = '587'
      process.env.SMTP_USER = 'sender@test.com'
      process.env.SMTP_PASS = 'password'
      process.env.NEXT_PUBLIC_BASE_URL = 'https://example.com'

      mockSendMail.mockResolvedValue({ messageId: '<test-123@test.com>' })
    })

    it('应成功发送职位提醒邮件', async () => {
      const emailData: JobAlertEmailData = {
        to: 'recipient@test.com',
        alertId: 42,
        keywords: ['数据分析', 'Python'],
        jobs: [
          {
            id: 1,
            title: '数据分析师',
            company: '测试公司',
            location: '北京',
            salary: '15-25K',
            source: 'swufe',
            matchedKeywords: ['Python', 'SQL'],
            relevanceScore: 85,
          },
        ],
      }

      const result = await sendJobAlertEmail(emailData)

      expect(result.success).toBe(true)
      expect(mockSendMail).toHaveBeenCalledTimes(1)
      const callArgs = mockSendMail.mock.calls[0][0]
      expect(callArgs.to).toBe('recipient@test.com')
      expect(callArgs.subject).toContain('职位推荐')
      expect(callArgs.subject).toContain('数据分析')
      expect(callArgs.html).toContain('数据分析师')
      expect(callArgs.html).toContain('匹配度 85%')
      expect(callArgs.text).toContain('数据分析师')
    })

    it('应成功发送测试邮件', async () => {
      const result = await sendTestEmail('test@example.com')

      expect(result.success).toBe(true)
      expect(mockSendMail).toHaveBeenCalledTimes(1)
      const callArgs = mockSendMail.mock.calls[0][0]
      expect(callArgs.to).toBe('test@example.com')
      expect(callArgs.subject).toContain('测试邮件')
      expect(callArgs.html).toContain('测试邮件')
    })
  })

  describe('邮件发送失败场景', () => {
    beforeEach(() => {
      process.env.SMTP_HOST = 'smtp.test.com'
      process.env.SMTP_PORT = '587'
      process.env.SMTP_USER = 'sender@test.com'
      process.env.SMTP_PASS = 'password'
    })

    it('SMTP服务抛异常时返回错误信息', async () => {
      mockSendMail.mockRejectedValue(new Error('Connection refused'))

      const result = await sendJobAlertEmail({
        to: 'fail@test.com',
        alertId: 1,
        keywords: ['测试'],
        jobs: [],
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Connection refused')
    })

    it('发送测试邮件失败时返回错误', async () => {
      mockSendMail.mockRejectedValue(new Error('Network error'))

      const result = await sendTestEmail('fail@test.com')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
    })
  })

  describe('邮件模板渲染', () => {
    beforeEach(() => {
      process.env.SMTP_HOST = 'smtp.test.com'
      process.env.SMTP_PORT = '587'
      process.env.SMTP_USER = 'sender@test.com'
      process.env.SMTP_PASS = 'password'
      process.env.NEXT_PUBLIC_BASE_URL = 'https://example.com'
      mockSendMail.mockResolvedValue({ messageId: '<test-123>' })
    })

    it('HTML模板应包含取消订阅链接', async () => {
      await sendJobAlertEmail({
        to: 'user@test.com',
        alertId: 99,
        keywords: ['关键词'],
        jobs: [],
      })

      const callArgs = mockSendMail.mock.calls[0][0]
      expect(callArgs.html).toContain('/unsubscribe')
      expect(callArgs.html).toContain('alert_id=99')
      expect(callArgs.html).toContain(encodeURIComponent('user@test.com'))
    })

    it('HTML模板应根据匹配度显示不同颜色 - 高匹配度(>=80)为绿色', async () => {
      await sendJobAlertEmail({
        to: 'user@test.com',
        alertId: 1,
        keywords: ['k'],
        jobs: [{ id: 1, title: '高匹配岗位', relevanceScore: 90, matchedKeywords: ['k'] }],
      })

      const html = mockSendMail.mock.calls[0][0].html
      expect(html).toContain('#10b981')
    })

    it('HTML模板应根据匹配度显示不同颜色 - 中等匹配度(60-79)为蓝色', async () => {
      await sendJobAlertEmail({
        to: 'user@test.com',
        alertId: 1,
        keywords: ['k'],
        jobs: [{ id: 1, title: '中匹配岗位', relevanceScore: 70, matchedKeywords: ['k'] }],
      })

      const html = mockSendMail.mock.calls[0][0].html
      expect(html).toContain('#3b82f6')
    })

    it('HTML模板应根据匹配度显示不同颜色 - 低匹配度(<60)为黄色', async () => {
      await sendJobAlertEmail({
        to: 'user@test.com',
        alertId: 1,
        keywords: ['k'],
        jobs: [{ id: 1, title: '低匹配岗位', relevanceScore: 50, matchedKeywords: ['k'] }],
      })

      const html = mockSendMail.mock.calls[0][0].html
      expect(html).toContain('#f59e0b')
    })

    it('文本版本应包含所有关键信息', async () => {
      await sendJobAlertEmail({
        to: 'user@test.com',
        alertId: 1,
        keywords: ['AI', '机器学习'],
        jobs: [
          {
            id: 10,
            title: 'AI工程师',
            company: '科技公司',
            location: '上海',
            salary: '30-50K',
            university: '某大学',
            source_url: 'https://example.com/job/10',
            matchedKeywords: ['AI'],
            reason: '候选人技能高度匹配',
            relevanceScore: 92,
          },
        ],
      })

      const text = mockSendMail.mock.calls[0][0].text
      expect(text).toContain('AI工程师')
      expect(text).toContain('科技公司')
      expect(text).toContain('上海')
      expect(text).toContain('30-50K')
      expect(text).toContain('匹配度 92%')
      expect(text).toContain('AI推荐理由：候选人技能高度匹配')
    })

    it('多关键词应正确渲染在邮件中', async () => {
      await sendJobAlertEmail({
        to: 'user@test.com',
        alertId: 1,
        keywords: ['Python', 'SQL', 'Excel'],
        jobs: [],
      })

      const callArgs = mockSendMail.mock.calls[0][0]
      expect(callArgs.html).toContain('Python')
      expect(callArgs.html).toContain('SQL')
      expect(callArgs.html).toContain('Excel')
      expect(callArgs.subject).toContain('Python、SQL、Excel')
    })

    it('规则回退模式应显示规则标签而非AI标签', async () => {
      await sendJobAlertEmail({
        to: 'user@test.com',
        alertId: 1,
        keywords: ['k'],
        matchMode: 'rule-fallback',
        jobs: [],
      })

      const callArgs = mockSendMail.mock.calls[0][0]
      expect(callArgs.html).not.toContain('🤖')
      expect(callArgs.html).toContain('📋')
      expect(callArgs.html).toContain('规则匹配')
    })

    it('空jobs列表应正确处理', async () => {
      const result = await sendJobAlertEmail({
        to: 'user@test.com',
        alertId: 1,
        keywords: ['k'],
        jobs: [],
      })

      expect(result.success).toBe(true)
      expect(mockSendMail).toHaveBeenCalled()
      const subject = mockSendMail.mock.calls[0][0].subject
      expect(subject).toContain('0 个匹配岗位')
    })
  })
})
