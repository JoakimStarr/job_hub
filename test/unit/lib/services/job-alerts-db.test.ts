import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'

const mockStmts: Record<string, ReturnType<typeof vi.fn>> = {}

function createMockDbForAlerts() {
  const mockPrepare = vi.fn((sql: string) => {
    if (!mockStmts[sql]) {
      mockStmts[sql] = vi.fn()
    }
    return mockStmts[sql]
  })
  const mockExec = vi.fn()
  return {
    db: {
      prepare: mockPrepare,
      exec: mockExec,
      pragma: vi.fn(),
      close: vi.fn(),
    } as unknown as Database.Database,
    prepare: mockPrepare,
    exec: mockExec,
  }
}

vi.mock('@/lib/db-utils', () => ({
  getDb: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
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
import type { JobAlert, AlertHistory } from '@/lib/job-alerts-db'

describe('JobAlertsDB - 职位提醒数据库操作', () => {
  let mockPrepare: ReturnType<typeof vi.fn>
  let mockExec: ReturnType<typeof vi.fn>

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

  const createMockAlertRecord = (id: number, overrides: Partial<JobAlert> = {}): Record<string, unknown> => ({
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
    Object.keys(mockStmts).forEach((k) => delete mockStmts[k])

    const mocks = createMockDbForAlerts()
    mockPrepare = mocks.prepare
    mockExec = mocks.exec
    ;(getDb as unknown as vi.Mock).mockReturnValue(mocks.db)
  })

  afterEach(() => {
    Object.keys(mockStmts).forEach((k) => delete mockStmts[k])
  })

  describe('initJobAlertsTables', () => {
    it('应创建user_job_alerts表', () => {
      initJobAlertsTables()

      expect(mockExec).toHaveBeenCalled()
      const sql = mockExec.mock.calls[0][0] as string
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS user_job_alerts')
    })

    it('应创建job_alert_history表', () => {
      initJobAlertsTables()

      const sql = mockExec.mock.calls.map((c) => c[0] as string)
      const hasHistoryTable = sql.some((s) => s.includes('job_alert_history'))
      expect(hasHistoryTable).toBe(true)
    })

    it('应创建必要的索引', () => {
      initJobAlertsTables()

      const allSql = mockExec.mock.calls.map((c) => c[0] as string)
      expect(allSql.some((s) => s.includes('idx_job_alerts_email'))).toBe(true)
      expect(allSql.some((s) => s.includes('idx_job_alerts_enabled'))).toBe(true)
      expect(allSql.some((s) => s.includes('idx_alert_history_alert_id'))).toBe(true)
    })
  })

  describe('getAllEnabledAlerts', () => {
    it('应只返回enabled=1的提醒', () => {
      mockPrepare.mockImplementation((sql: string) => {
        const mockFn = vi.fn()
        if (sql.includes('WHERE enabled = 1')) {
          mockFn.mockReturnValue([createMockAlertRecord(1), createMockAlertRecord(2)])
        } else {
          mockFn.mockReturnValue([])
        }
        return mockFn
      })

      const alerts = getAllEnabledAlerts()

      expect(alerts).toHaveLength(2)
      alerts.forEach((alert) => {
        expect(alert.enabled).toBe(true)
      })
    })

    it('应正确解析JSON字段', () => {
      const record = createMockAlertRecord(1, {
        keywords: JSON.stringify(['AI', 'ML', 'DL']),
        sources: JSON.stringify(['swufe', 'dufe']),
        locations: JSON.stringify(['北京', '上海', '深圳']),
        industries: JSON.stringify(['金融', '科技']),
        exclude_keywords: JSON.stringify(['兼职', '远程']),
      })
      mockPrepare.mockImplementation(() => vi.fn().mockReturnValue([record]))

      const alerts = getAllEnabledAlerts()

      expect(alerts[0].keywords).toEqual(['AI', 'ML', 'DL'])
      expect(alerts[0].sources).toEqual(['swufe', 'dufe'])
      expect(alerts[0].locations).toEqual(['北京', '上海', '深圳'])
      expect(alerts[0].industries).toEqual(['金融', '科技'])
      expect(alerts[0].exclude_keywords).toEqual(['兼职', '远程'])
    })

    it('无启用提醒时应返回空数组', () => {
      mockPrepare.mockImplementation(() => vi.fn().mockReturnValue([]))

      const alerts = getAllEnabledAlerts()

      expect(alerts).toEqual([])
    })
  })

  describe('getAllAlerts', () => {
    it('应返回所有提醒（包括禁用的）', () => {
      const records = [
        createMockAlertRecord(1, { enabled: 1 }),
        createMockAlertRecord(2, { enabled: 0 }),
      ]
      mockPrepare.mockImplementation(() => vi.fn().mockReturnValue(records))

      const alerts = getAllAlerts()

      expect(alerts).toHaveLength(2)
      expect(alerts[0].enabled).toBe(true)
      expect(alerts[1].enabled).toBe(false)
    })
  })

  describe('createAlert', () => {
    it('应创建新的提醒并返回完整对象', () => {
      mockPrepare.mockImplementation((sql: string) => {
        const mockFn = vi.fn()
        if (sql.includes('INSERT INTO user_job_alerts')) {
          mockFn.mockReturnValue({ lastInsertRowid: 5, changes: 1 })
        }
        return mockFn
      })

      const alertData = createTestAlert()
      const alert = createAlert(alertData)

      expect(alert.id).toBe(5)
      expect(alert.email).toBe('user@test.com')
      expect(alert.notify_count).toBe(0)
      expect(alert.created_at).toBeDefined()
      expect(alert.enabled).toBe(true)
    })

    it('disabled的提醒应设置enabled=false', () => {
      mockPrepare.mockImplementation((sql: string) => {
        const mockFn = vi.fn()
        if (sql.includes('INSERT INTO user_job_alerts')) {
          mockFn.mockReturnValue({ lastInsertRowid: 6, changes: 1 })
        }
        return mockFn
      })

      const alert = createAlert(createTestAlert({ enabled: false }))

      expect(alert.enabled).toBe(false)
    })

    it('默认min_notify_interval应为0', () => {
      mockPrepare.mockImplementation((sql: string) => {
        const mockFn = vi.fn()
        if (sql.includes('INSERT INTO user_job_alerts')) {
          mockFn.mockReturnValue({ lastInsertRowid: 7, changes: 1 })
        }
        return mockFn
      })

      const alertWithoutInterval = createTestAlert()
      delete (alertWithoutInterval as Record<string, unknown>).min_notify_interval
      const alert = createAlert(alertWithoutInterval)

      expect(alert.min_notify_interval).toBe(0)
    })
  })

  describe('updateAlert', () => {
    it('应更新指定字段', () => {
      mockPrepare.mockImplementation((sql: string) => {
        const mockFn = vi.fn()
        if (sql.includes('UPDATE user_job_alerts')) {
          mockFn.mockReturnValue({ changes: 1 })
        }
        return mockFn
      })

      const result = updateAlert(1, {
        email: 'new@email.com',
        keywords: ['新关键词'],
        min_notify_interval: 120,
      })

      expect(result).toBe(true)
    })

    it('无更新字段时应返回false', () => {
      const result = updateAlert(1, {})

      expect(result).toBe(false)
    })

    it('不存在的ID更新应返回false', () => {
      mockPrepare.mockImplementation((sql: string) => {
        const mockFn = vi.fn()
        if (sql.includes('UPDATE user_job_alerts')) {
          mockFn.mockReturnValue({ changes: 0 })
        }
        return mockFn
      })

      const result = updateAlert(99999, { email: 'x@y.com' })

      expect(result).toBe(false)
    })

    it('应支持更新exclude_keywords', () => {
      mockPrepare.mockImplementation((sql: string) => {
        const mockFn = vi.fn()
        if (sql.includes('UPDATE user_job_alerts')) {
          mockFn.mockReturnValue({ changes: 1 })
        }
        return mockFn
      })

      const result = updateAlert(1, { exclude_keywords: ['排除词'] })

      expect(result).toBe(true)
    })
  })

  describe('deleteAlert', () => {
    it('应删除存在的提醒并返回true', () => {
      mockPrepare.mockImplementation(() => vi.fn().mockReturnValue({ changes: 1 }))

      const result = deleteAlert(1)

      expect(result).toBe(true)
    })

    it('不存在的ID应返回false', () => {
      mockPrepare.mockImplementation(() => vi.fn().mockReturnValue({ changes: 0 }))

      const result = deleteAlert(99999)

      expect(result).toBe(false)
    })
  })

  describe('getAlertById', () => {
    it('应返回指定ID的提醒', () => {
      const record = createMockAlertRecord(42)
      mockPrepare.mockImplementation(() => vi.fn().mockReturnValue(record))

      const alert = getAlertById(42)

      expect(alert).not.toBeNull()
      expect(alert!.id).toBe(42)
      expect(alert!.email).toBe('user@test.com')
    })

    it('不存在的ID应返回null', () => {
      mockPrepare.mockImplementation(() => vi.fn().mockReturnValue(undefined))

      const alert = getAlertById(99999)

      expect(alert).toBeNull()
    })
  })

  describe('disableAlert / enableAlert', () => {
    it('disableAlert应禁用提醒', () => {
      mockPrepare.mockImplementation(() => vi.fn().mockReturnValue({ changes: 1 }))

      const result = disableAlert(1)

      expect(result).toBe(true)
    })

    it('enableAlert应启用提醒', () => {
      mockPrepare.mockImplementation(() => vi.fn().mockReturnValue({ changes: 1 }))

      const result = enableAlert(1)

      expect(result).toBe(true)
    })

    it('对不存在的ID操作应返回false', () => {
      mockPrepare.mockImplementation(() => vi.fn().mockReturnValue({ changes: 0 }))

      expect(disableAlert(999)).toBe(false)
      expect(enableAlert(999)).toBe(false)
    })
  })

  describe('recordAlertHistory', () => {
    it('应记录发送历史并更新通知计数', () => {
      recordAlertHistory(1, [10, 20, 30], true)

      expect(mockPrepare).toHaveBeenCalled()
    })

    it('应处理发送失败的情况', () => {
      recordAlertHistory(1, [], false, 'SMTP连接超时')

      expect(mockPrepare).toHaveBeenCalled()
    })
  })

  describe('getAlertHistory', () => {
    it('应返回指定alert的历史记录', () => {
      const mockRecords = [
        { id: 1, alert_id: 5, job_ids: '[1,2,3]', matched_count: 3, email_sent: 1, created_at: '2024-01-01T00:00:00Z' },
        { id: 2, alert_id: 5, job_ids: '[4,5]', matched_count: 2, email_sent: 1, created_at: '2024-01-02T00:00:00Z' },
      ]
      mockPrepare.mockImplementation(() => vi.fn().mockReturnValue(mockRecords))

      const history = getAlertHistory(5)

      expect(history).toHaveLength(2)
      expect(history[0].matched_count).toBe(3)
      expect(history[0].email_sent).toBe(true)
      expect(history[0].job_ids).toEqual([1, 2, 3])
    })

    it('不传alertId应返回全部历史', () => {
      mockPrepare.mockImplementation(() => vi.fn().mockReturnValue([]))

      const history = getAlertHistory()

      expect(Array.isArray(history)).toBe(true)
    })

    it('应正确解析error_message', () => {
      const mockRecords = [
        { id: 1, alert_id: 1, job_ids: '[]', matched_count: 0, email_sent: 0, error_message: '网络超时', created_at: '2024-01-01' },
      ]
      mockPrepare.mockImplementation(() => vi.fn().mockReturnValue(mockRecords))

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
      mockPrepare.mockImplementation(() => vi.fn().mockReturnValue(rows))

      const notifiedIds = getNotifiedJobIds(1)

      expect(notifiedIds).toBeInstanceOf(Set)
      expect(notifiedIds.size).toBe(7)
      expect(notifiedIds.has(1)).toBe(true)
      expect(notifiedIds.has(7)).toBe(true)
    })

    it('无历史记录时应返回空Set', () => {
      mockPrepare.mockImplementation(() => vi.fn().mockReturnValue([]))

      const notifiedIds = getNotifiedJobIds(1)

      expect(notifiedIds.size).toBe(0)
    })

    it('空job_ids数组应不影响结果', () => {
      const rows = [
        { job_ids: JSON.stringify([1, 2]) },
        { job_ids: JSON.stringify([]) },
        { job_ids: JSON.stringify([3]) },
      ]
      mockPrepare.mockImplementation(() => vi.fn().mockReturnValue(rows))

      const notifiedIds = getNotifiedJobIds(1)

      expect(notifiedIds.size).toBe(3)
    })
  })

  describe('频率限制相关', () => {
    it('min_notify_interval应在创建时被保存', () => {
      mockPrepare.mockImplementation((sql: string) => {
        const mockFn = vi.fn()
        if (sql.includes('INSERT INTO user_job_alerts')) {
          mockFn.mockReturnValue({ lastInsertRowid: 10, changes: 1 })
        }
        return mockFn
      })

      const alert = createAlert(createTestAlert({ min_notify_interval: 120 }))

      expect(alert.min_notify_interval).toBe(120)
    })

    it('min_notify_interval应在更新时生效', () => {
      mockPrepare.mockImplementation((sql: string) => {
        const mockFn = vi.fn()
        if (sql.includes('UPDATE user_job_alerts')) {
          mockFn.mockReturnValue({ changes: 1 })
        }
        return mockFn
      })

      const result = updateAlert(1, { min_notify_interval: 180 })

      expect(result).toBe(true)
    })
  })

  describe('触发条件匹配相关', () => {
    it('keywords存储为JSON字符串', () => {
      mockPrepare.mockImplementation((sql: string) => {
        const mockFn = vi.fn()
        if (sql.includes('INSERT INTO user_job_alerts')) {
          mockFn.mockReturnValue({ lastInsertRowid: 1, changes: 1 })
        }
        return mockFn
      })

      const alert = createAlert(createTestAlert({ keywords: ['Python', '机器学习', '深度学习'] }))

      expect(alert.keywords).toEqual(['Python', '机器学习', '深度学习'])
    })

    it('locations和industries也应正确序列化/反序列化', () => {
      const record = createMockAlertRecord(1, {
        locations: JSON.stringify(['北京', '上海', '广州', '深圳']),
        industries: JSON.stringify(['金融', '互联网', '教育']),
      })
      mockPrepare.mockImplementation(() => vi.fn().mockReturnValue([record]))

      const alerts = getAllEnabledAlerts()

      expect(alerts[0].locations).toHaveLength(4)
      expect(alerts[0].industries).toHaveLength(3)
    })

    it('education字段可选', () => {
      const record = createMockAlertRecord(1, { education: null })
      mockPrepare.mockImplementation(() => vi.fn().mockReturnValue([record]))

      const alerts = getAllEnabledAlerts()

      expect(alerts[0].education).toBeUndefined()
    })
  })
})
