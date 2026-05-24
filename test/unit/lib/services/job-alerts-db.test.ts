import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db-utils', () => ({
  getDb: vi.fn(() => ({
    prepare: vi.fn(() => ({
      get: vi.fn(),
      run: vi.fn(),
      all: vi.fn(),
    })),
    exec: vi.fn(),
    pragma: vi.fn(),
    close: vi.fn(),
  })),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { getDb } from '@/lib/db-utils'
import {
  initJobAlertsTables,
  getAllEnabledAlerts,
  getAllAlerts,
  createAlert,
  updateAlert,
  deleteAlert,
  getAlertById,
  disableAlert,
  enableAlert,
  recordAlertHistory,
  getAlertHistory,
  getNotifiedJobIds,
} from '@/lib/job-alerts-db'
import type { JobAlert } from '@/lib/job-alerts-db'

describe('JobAlertsDB - 职位提醒数据库操作', () => {
  const createTestAlert = (overrides: Partial<Omit<JobAlert, 'id' | 'notify_count' | 'created_at'>> = {}): Omit<JobAlert, 'id' | 'notify_count' | 'created_at'> => ({
    email: 'user@test.com',
    keywords: ['Python', '数据分析'],
    sources: ['swufe', 'jxufe'],
    locations: ['北京', '上海'],
    industries: ['互联网'],
    exclude_keywords: ['实习', '兼职'],
    min_notify_interval: 60,
    enabled: true,
    education: '本科',
    ...overrides,
  })

  const createMockAlertRecord = (id: number, overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    id,
    email: 'user@test.com',
    keywords: JSON.stringify(['Python']),
    sources: JSON.stringify(['swufe']),
    locations: JSON.stringify(['北京']),
    industries: JSON.stringify(['互联网']),
    education: '本科',
    exclude_keywords: JSON.stringify([]),
    min_notify_interval: 0,
    enabled: 1,
    last_notified_at: null,
    notify_count: 0,
    created_at: new Date().toISOString(),
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    ;(getDb as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      prepare: vi.fn(() => ({ get: vi.fn(), run: vi.fn(), all: vi.fn() })),
      exec: vi.fn(),
      pragma: vi.fn(),
      close: vi.fn(),
    })
  })

  describe('initJobAlertsTables', () => {
    it('应创建user_job_alerts表', () => {
      initJobAlertsTables()
      expect(getDb().exec).toHaveBeenCalled()
      const sql = getDb().exec.mock.calls[0][0] as string
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS user_job_alerts')
    })

    it('应创建job_alert_history表', () => {
      initJobAlertsTables()
      const allSql = getDb().exec.mock.calls.map((c: [string]) => c[0])
      expect(allSql.some((s) => s.includes('job_alert_history'))).toBe(true)
    })

    it('应创建必要的索引', () => {
      initJobAlertsTables()
      const allSql = getDb().exec.mock.calls.map((c: [string]) => c[0]) as string[]
      expect(allSql.some((s) => s.includes('idx_job_alerts_email'))).toBe(true)
      expect(allSql.some((s) => s.includes('idx_job_alerts_enabled'))).toBe(true)
      expect(allSql.some((s) => s.includes('idx_alert_history_alert_id'))).toBe(true)
    })
  })

  describe('getAllEnabledAlerts', () => {
    it('应只返回enabled=1的提醒', () => {
      getDb().prepare.mockImplementation((sql: string) => {
        const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
        if (sql.includes('WHERE enabled = 1')) s.all.mockReturnValue([createMockAlertRecord(1), createMockAlertRecord(2)])
        return s
      })

      const alerts = getAllEnabledAlerts()
      expect(alerts).toHaveLength(2)
      alerts.forEach((alert) => expect(alert.enabled).toBe(true))
    })

    it('应正确解析JSON字段', () => {
      const record = createMockAlertRecord(1, {
        keywords: JSON.stringify(['AI', 'ML', 'DL']),
        sources: JSON.stringify(['swufe', 'dufe']),
        locations: JSON.stringify(['北京', '上海', '深圳']),
        industries: JSON.stringify(['金融', '科技']),
        exclude_keywords: JSON.stringify(['兼职', '远程']),
      })

      getDb().prepare.mockImplementation((sql: string) => {
        const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
        if (sql.includes('WHERE enabled = 1')) s.all.mockReturnValue([record])
        return s
      })

      const alerts = getAllEnabledAlerts()
      expect(alerts[0].keywords).toEqual(['AI', 'ML', 'DL'])
      expect(alerts[0].sources).toEqual(['swufe', 'dufe'])
      expect(alerts[0].locations).toEqual(['北京', '上海', '深圳'])
      expect(alerts[0].industries).toEqual(['金融', '科技'])
      expect(alerts[0].exclude_keywords).toEqual(['兼职', '远程'])
    })

    it('无启用提醒时应返回空数组', () => {
      getDb().prepare.mockImplementation(() => ({ get: vi.fn(), run: vi.fn(), all: vi.fn().mockReturnValue([]) }))
      expect(getAllEnabledAlerts()).toEqual([])
    })
  })

  describe('getAllAlerts', () => {
    it('应返回所有提醒（包括禁用的）', () => {
      const records = [createMockAlertRecord(1, { enabled: 1 }), createMockAlertRecord(2, { enabled: 0 })]
      getDb().prepare.mockImplementation(() => ({ get: vi.fn(), run: vi.fn(), all: vi.fn().mockReturnValue(records) }))

      const alerts = getAllAlerts()
      expect(alerts).toHaveLength(2)
      expect(alerts[0].enabled).toBe(true)
      expect(alerts[1].enabled).toBe(false)
    })
  })

  describe('createAlert', () => {
    it('应创建新的提醒并返回完整对象', () => {
      getDb().prepare.mockImplementation((sql: string) => {
        const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
        if (sql.includes('INSERT INTO user_job_alerts')) s.run.mockReturnValue({ lastInsertRowid: 5, changes: 1 })
        return s
      })

      const alert = createAlert(createTestAlert())
      expect(alert.id).toBe(5)
      expect(alert.email).toBe('user@test.com')
      expect(alert.notify_count).toBe(0)
      expect(alert.created_at).toBeDefined()
      expect(alert.enabled).toBe(true)
    })

    it('disabled的提醒应设置enabled=false', () => {
      getDb().prepare.mockImplementation((sql: string) => {
        const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
        if (sql.includes('INSERT INTO user_job_alerts')) s.run.mockReturnValue({ lastInsertRowid: 6, changes: 1 })
        return s
      })

      expect(createAlert(createTestAlert({ enabled: false })).enabled).toBe(false)
    })

    it('默认min_notify_interval应为0', () => {
      getDb().prepare.mockImplementation((sql: string) => {
        const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
        if (sql.includes('INSERT INTO user_job_alerts')) s.run.mockReturnValue({ lastInsertRowid: 7, changes: 1 })
        return s
      })

      const alertData = createTestAlert()
      delete (alertData as Record<string, unknown>).min_notify_interval
      const result = createAlert(alertData)
      expect(result.min_notify_interval ?? 0).toBe(0)
    })
  })

  describe('updateAlert', () => {
    it('应更新指定字段', () => {
      getDb().prepare.mockImplementation((sql: string) => {
        const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
        if (sql.includes('UPDATE user_job_alerts')) s.run.mockReturnValue({ changes: 1 })
        return s
      })

      expect(updateAlert(1, { email: 'new@email.com', keywords: ['新关键词'], min_notify_interval: 120 })).toBe(true)
    })

    it('无更新字段时应返回false', () => {
      expect(updateAlert(1, {})).toBe(false)
    })

    it('不存在的ID更新应返回false', () => {
      getDb().prepare.mockImplementation((sql: string) => {
        const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
        if (sql.includes('UPDATE user_job_alerts')) s.run.mockReturnValue({ changes: 0 })
        return s
      })

      expect(updateAlert(99999, { email: 'x@y.com' })).toBe(false)
    })

    it('应支持更新exclude_keywords', () => {
      getDb().prepare.mockImplementation((sql: string) => {
        const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
        if (sql.includes('UPDATE user_job_alerts')) s.run.mockReturnValue({ changes: 1 })
        return s
      })

      expect(updateAlert(1, { exclude_keywords: ['排除词'] })).toBe(true)
    })
  })

  describe('deleteAlert', () => {
    it('应删除存在的提醒并返回true', () => {
      getDb().prepare.mockImplementation(() => ({ get: vi.fn(), run: vi.fn().mockReturnValue({ changes: 1 }), all: vi.fn() }))
      expect(deleteAlert(1)).toBe(true)
    })

    it('不存在的ID应返回false', () => {
      getDb().prepare.mockImplementation(() => ({ get: vi.fn(), run: vi.fn().mockReturnValue({ changes: 0 }), all: vi.fn() }))
      expect(deleteAlert(99999)).toBe(false)
    })
  })

  describe('getAlertById', () => {
    it('应返回指定ID的提醒', () => {
      const record = createMockAlertRecord(42)

      getDb().prepare.mockImplementation((sql: string) => {
        const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
        if (sql.includes('WHERE id = ?')) s.get.mockReturnValue(record)
        return s
      })

      const alert = getAlertById(42)
      expect(alert).not.toBeNull()
      if (alert) {
        expect(alert.id).toBe(42)
        expect(alert.email).toBe('user@test.com')
      }
    })

    it('不存在的ID应返回null', () => {
      getDb().prepare.mockImplementation(() => ({ get: vi.fn().mockReturnValue(undefined), run: vi.fn(), all: vi.fn() }))
      expect(getAlertById(99999)).toBeNull()
    })
  })

  describe('disableAlert / enableAlert', () => {
    it('disableAlert应禁用提醒', () => {
      getDb().prepare.mockImplementation(() => ({ get: vi.fn(), run: vi.fn().mockReturnValue({ changes: 1 }), all: vi.fn() }))
      expect(disableAlert(1)).toBe(true)
    })

    it('enableAlert应启用提醒', () => {
      getDb().prepare.mockImplementation(() => ({ get: vi.fn(), run: vi.fn().mockReturnValue({ changes: 1 }), all: vi.fn() }))
      expect(enableAlert(1)).toBe(true)
    })

    it('对不存在的ID操作应返回false', () => {
      getDb().prepare.mockImplementation(() => ({ get: vi.fn(), run: vi.fn().mockReturnValue({ changes: 0 }), all: vi.fn() }))
      expect(disableAlert(999)).toBe(false)
      expect(enableAlert(999)).toBe(false)
    })
  })

  describe('recordAlertHistory', () => {
    it('应记录发送历史并更新通知计数', () => {
      recordAlertHistory(1, [10, 20, 30], true)
      expect(getDb().prepare).toHaveBeenCalled()
    })

    it('应处理发送失败的情况', () => {
      recordAlertHistory(1, [], false, 'SMTP连接超时')
      expect(getDb().prepare).toHaveBeenCalled()
    })
  })

  describe('getAlertHistory', () => {
    it('应返回指定alert的历史记录', () => {
      const mockRecords = [
        { id: 1, alert_id: 5, job_ids: '[1,2,3]', matched_count: 3, email_sent: 1, created_at: '2024-01-01T00:00:00Z' },
        { id: 2, alert_id: 5, job_ids: '[4,5]', matched_count: 2, email_sent: 1, created_at: '2024-01-02T00:00:00Z' },
      ]

      getDb().prepare.mockImplementation((sql: string) => {
        const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
        if (sql.includes('job_alert_history WHERE alert_id = ?')) s.all.mockReturnValue(mockRecords)
        return s
      })

      const history = getAlertHistory(5)
      expect(history).toHaveLength(2)
      expect(history[0].matched_count).toBe(3)
      expect(history[0].email_sent).toBe(true)
      expect(history[0].job_ids).toEqual([1, 2, 3])
    })

    it('不传alertId应返回全部历史', () => {
      getDb().prepare.mockImplementation(() => ({ get: vi.fn(), run: vi.fn(), all: vi.fn().mockReturnValue([]) }))
      expect(Array.isArray(getAlertHistory())).toBe(true)
    })

    it('应正确解析error_message', () => {
      const mockRecords = [{ id: 1, alert_id: 1, job_ids: '[]', matched_count: 0, email_sent: 0, error_message: '网络超时', created_at: '2024-01-01' }]

      getDb().prepare.mockImplementation((sql: string) => {
        const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
        if (sql.includes('job_alert_history')) s.all.mockReturnValue(mockRecords)
        return s
      })

      const history = getAlertHistory(1)
      expect(history[0].error_message).toBe('网络超时')
      expect(history[0].email_sent).toBe(false)
    })
  })

  describe('getNotifiedJobIds - 去重逻辑', () => {
    it('应聚合所有已通知的job ID（去重）', () => {
      const rows = [
        { job_ids: JSON.stringify([1, 2, 3]) },
        { job_ids: JSON.stringify([3, 4, 5]) },
        { job_ids: JSON.stringify([5, 6, 7]) },
      ]

      getDb().prepare.mockImplementation((sql: string) => {
        const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
        if (sql.includes('job_alert_history WHERE alert_id = ?')) s.all.mockReturnValue(rows)
        return s
      })

      const notifiedIds = getNotifiedJobIds(1)
      expect(notifiedIds).toBeInstanceOf(Set)
      expect(notifiedIds.size).toBe(7)
      expect(notifiedIds.has(1)).toBe(true)
      expect(notifiedIds.has(7)).toBe(true)
    })

    it('无历史记录时应返回空Set', () => {
      getDb().prepare.mockImplementation(() => ({ get: vi.fn(), run: vi.fn(), all: vi.fn().mockReturnValue([]) }))
      expect(getNotifiedJobIds(1).size).toBe(0)
    })

    it('空job_ids数组应不影响结果', () => {
      const rows = [{ job_ids: JSON.stringify([1, 2]) }, { job_ids: JSON.stringify([]) }, { job_ids: JSON.stringify([3]) }]

      getDb().prepare.mockImplementation((sql: string) => {
        const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
        if (sql.includes('job_alert_history WHERE alert_id = ?')) s.all.mockReturnValue(rows)
        return s
      })

      expect(getNotifiedJobIds(1).size).toBe(3)
    })
  })

  describe('频率限制相关', () => {
    it('min_notify_interval应在创建时被保存', () => {
      getDb().prepare.mockImplementation((sql: string) => {
        const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
        if (sql.includes('INSERT INTO user_job_alerts')) s.run.mockReturnValue({ lastInsertRowid: 10, changes: 1 })
        return s
      })

      expect(createAlert(createTestAlert({ min_notify_interval: 120 })).min_notify_interval).toBe(120)
    })

    it('min_notify_interval应在更新时生效', () => {
      getDb().prepare.mockImplementation((sql: string) => {
        const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
        if (sql.includes('UPDATE user_job_alerts')) s.run.mockReturnValue({ changes: 1 })
        return s
      })

      expect(updateAlert(1, { min_notify_interval: 180 })).toBe(true)
    })
  })

  describe('触发条件匹配相关', () => {
    it('keywords存储为JSON字符串', () => {
      getDb().prepare.mockImplementation((sql: string) => {
        const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
        if (sql.includes('INSERT INTO user_job_alerts')) s.run.mockReturnValue({ lastInsertRowid: 1, changes: 1 })
        return s
      })

      expect(createAlert(createTestAlert({ keywords: ['Python', '机器学习', '深度学习'] })).keywords).toEqual(['Python', '机器学习', '深度学习'])
    })

    it('locations和industries也应正确序列化/反序列化', () => {
      const record = createMockAlertRecord(1, {
        locations: JSON.stringify(['北京', '上海', '广州', '深圳']),
        industries: JSON.stringify(['金融', '互联网', '教育']),
      })

      getDb().prepare.mockImplementation(() => ({ get: vi.fn(), run: vi.fn(), all: vi.fn().mockReturnValue([record]) }))

      const alerts = getAllEnabledAlerts()
      expect(alerts[0].locations).toHaveLength(4)
      expect(alerts[0].industries).toHaveLength(3)
    })

    it('education字段可选', () => {
      const record = createMockAlertRecord(1, { education: null })

      getDb().prepare.mockImplementation(() => ({ get: vi.fn(), run: vi.fn(), all: vi.fn().mockReturnValue([record]) }))

      const result = getAllEnabledAlerts()[0]
      expect(result.education === undefined || result.education === null).toBe(true)
    })
  })
})
