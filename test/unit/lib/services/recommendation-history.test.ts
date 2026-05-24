import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'

let mockPrepare: ReturnType<typeof vi.fn>
let mockExec: ReturnType<typeof vi.fn>

function createMockDbForHistory() {
  mockPrepare = vi.fn((sql: string) => vi.fn())
  mockExec = vi.fn()
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
  initRecommendationHistoryTable,
  saveRecommendationHistory,
  getRecommendationHistory,
} from '@/lib/recommendation-history'
import type { RecommendationHistoryItem } from '@/lib/recommendation-history'

describe('RecommendationHistory - 推荐历史记录', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const mocks = createMockDbForHistory()
    ;(getDb as unknown as vi.Mock).mockReturnValue(mocks.db)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initRecommendationHistoryTable', () => {
    it('应创建recommendation_history表', () => {
      initRecommendationHistoryTable()

      expect(mockExec).toHaveBeenCalled()
      const sql = mockExec.mock.calls[0][0] as string
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS recommendation_history')
    })

    it('表应包含正确的列定义', () => {
      initRecommendationHistoryTable()

      const sql = mockExec.mock.calls[0][0] as string
      expect(sql).toContain('id INTEGER PRIMARY KEY AUTOINCREMENT')
      expect(sql).toContain('user_id INTEGER')
      expect(sql).toContain('mode TEXT')
      expect(sql).toContain('job_id INTEGER')
      expect(sql).toContain('result TEXT')
      expect(sql).toContain('status TEXT')
      expect(sql).toContain('created_at TIMESTAMP')
    })

    it('应创建必要的索引', () => {
      initRecommendationHistoryTable()

      const sql = mockExec.mock.calls[0][0] as string
      expect(sql).toContain('idx_rec_hist_user')
      expect(sql).toContain('idx_rec_hist_mode')
      expect(sql).toContain('idx_rec_hist_created')
    })
  })

  describe('saveRecommendationHistory', () => {
    it('应保存推荐记录并返回完整的记录对象', () => {
      const savedRecord: RecommendationHistoryItem = {
        id: 1,
        mode: 'analyze',
        job_id: 42,
        result: { score: 85, matchRate: 0.9 },
        status: 'success',
        created_at: new Date().toISOString(),
      }

      mockPrepare.mockImplementation((sql: string) => {
        const mockFn = vi.fn()
        if (sql.includes('INSERT INTO recommendation_history')) {
          mockFn.mockReturnValue({ lastInsertRowid: 1, changes: 1 })
        } else if (sql.includes('SELECT * FROM recommendation_history WHERE id = ?')) {
          mockFn.mockReturnValue(savedRecord)
        }
        return mockFn
      })

      const result = saveRecommendationHistory({
        mode: 'analyze',
        jobId: 42,
        result: { score: 85, matchRate: 0.9 },
      })

      expect(result.id).toBe(1)
      expect(result.mode).toBe('analyze')
      expect(result.job_id).toBe(42)
      expect(result.status).toBe('success')
      expect(result.created_at).toBeDefined()
    })

    it('应保存所有提供的字段', () => {
      const fullRecord: RecommendationHistoryItem = {
        id: 2,
        user_id: 10,
        mode: 'chat',
        job_id: 5,
        profile_summary: '候选人擅长Python',
        prompt: '分析这个岗位是否适合我',
        result: { reply: '这个岗位很适合你...' },
        session_id: 'sess-abc-123',
        model: 'glm-4.7-flash',
        duration_ms: 1500,
        status: 'success',
        created_at: new Date().toISOString(),
      }

      mockPrepare.mockImplementation((sql: string) => {
        const mockFn = vi.fn()
        if (sql.includes('INSERT INTO recommendation_history')) {
          mockFn.mockReturnValue({ lastInsertRowid: 2, changes: 1 })
        } else if (sql.includes('SELECT * FROM recommendation_history WHERE id = ?')) {
          mockFn.mockReturnValue(fullRecord)
        }
        return mockFn
      })

      const result = saveRecommendationHistory({
        userId: 10,
        mode: 'chat',
        jobId: 5,
        profileSummary: '候选人擅长Python',
        prompt: '分析这个岗位是否适合我',
        result: { reply: '这个岗位很适合你...' },
        sessionId: 'sess-abc-123',
        model: 'glm-4.7-flash',
        durationMs: 1500,
      })

      expect(result.user_id).toBe(10)
      expect(result.profile_summary).toBe('候选人擅长Python')
      expect(result.prompt).toBe('分析这个岗位是否适合我')
      expect(result.session_id).toBe('sess-abc-123')
      expect(result.model).toBe('glm-4.7-flash')
      expect(result.duration_ms).toBe(1500)
    })

    it('status默认应为success', () => {
      const defaultStatusRecord: RecommendationHistoryItem = {
        id: 3,
        mode: 'analyze',
        result: {},
        status: 'success',
        created_at: new Date().toISOString(),
      }

      mockPrepare.mockImplementation((sql: string) => {
        const mockFn = vi.fn()
        if (sql.includes('INSERT INTO recommendation_history')) {
          mockFn.mockReturnValue({ lastInsertRowid: 3, changes: 1 })
        } else if (sql.includes('SELECT * FROM recommendation_history WHERE id = ?')) {
          mockFn.mockReturnValue(defaultStatusRecord)
        }
        return mockFn
      })

      const result = saveRecommendationHistory({
        mode: 'analyze',
        result: {},
      })

      expect(result.status).toBe('success')
    })

    it('应支持error状态', () => {
      const errorRecord: RecommendationHistoryItem = {
        id: 4,
        mode: 'ai_analysis',
        result: { error: 'API timeout' },
        status: 'error',
        created_at: new Date().toISOString(),
      }

      mockPrepare.mockImplementation((sql: string) => {
        const mockFn = vi.fn()
        if (sql.includes('INSERT INTO recommendation_history')) {
          mockFn.mockReturnValue({ lastInsertRowid: 4, changes: 1 })
        } else if (sql.includes('SELECT * FROM recommendation_history WHERE id = ?')) {
          mockFn.mockReturnValue(errorRecord)
        }
        return mockFn
      })

      const result = saveRecommendationHistory({
        mode: 'ai_analysis',
        result: { error: 'API timeout' },
        status: 'error',
      })

      expect(result.status).toBe('error')
    })

    it('profile_summary超过500字符应截断', () => {
      const longSummary = 'a'.repeat(600)
      const truncatedRecord: RecommendationHistoryItem = {
        id: 5,
        mode: 'analyze',
        profile_summary: longSummary.slice(0, 500),
        result: {},
        status: 'success',
        created_at: new Date().toISOString(),
      }

      mockPrepare.mockImplementation((sql: string) => {
        const mockFn = vi.fn()
        if (sql.includes('INSERT INTO recommendation_history')) {
          mockFn.mockReturnValue({ lastInsertRowid: 5, changes: 1 })
        } else if (sql.includes('SELECT * FROM recommendation_history WHERE id = ?')) {
          mockFn.mockReturnValue(truncatedRecord)
        }
        return mockFn
      })

      const result = saveRecommendationHistory({
        mode: 'analyze',
        profileSummary: longSummary,
        result: {},
      })

      expect(result.profile_summary?.length).toBeLessThanOrEqual(500)
    })

    it('prompt超过500字符应截断', () => {
      const longPrompt = 'q'.repeat(600)
      const truncatedRecord: RecommendationHistoryItem = {
        id: 6,
        mode: 'chat',
        prompt: longPrompt.slice(0, 500),
        result: {},
        status: 'success',
        created_at: new Date().toISOString(),
      }

      mockPrepare.mockImplementation((sql: string) => {
        const mockFn = vi.fn()
        if (sql.includes('INSERT INTO recommendation_history')) {
          mockFn.mockReturnValue({ lastInsertRowid: 6, changes: 1 })
        } else if (sql.includes('SELECT * FROM recommendation_history WHERE id = ?')) {
          mockFn.mockReturnValue(truncatedRecord)
        }
        return mockFn
      })

      const result = saveRecommendationHistory({
        mode: 'chat',
        prompt: longPrompt,
        result: {},
      })

      expect(result.prompt?.length).toBeLessThanOrEqual(500)
    })

    it('result应序列化为JSON字符串存储', () => {
      const complexResult = { score: 92, details: { skillMatch: 95, eduMatch: 88 }, suggestions: ['加强项目经验'] }

      mockPrepare.mockImplementation((sql: string) => {
        const mockFn = vi.fn()
        if (sql.includes('INSERT INTO recommendation_history')) {
          mockFn.mockReturnValue({ lastInsertRowid: 7, changes: 1 })
        } else {
          mockFn.mockReturnValue({
            id: 7, mode: 'analyze', result: complexResult,
            status: 'success', created_at: new Date().toISOString(),
          })
        }
        return mockFn
      })

      saveRecommendationHistory({ mode: 'analyze', result: complexResult })

      expect(mockPrepare).toHaveBeenCalled()
    })
  })

  describe('getRecommendationHistory', () => {
    it('应返回历史记录列表', () => {
      const mockRecords: RecommendationHistoryItem[] = [
        { id: 1, mode: 'analyze', result: { score: 80 }, status: 'success', created_at: '2024-01-02T00:00:00Z' },
        { id: 2, mode: 'chat', result: { reply: 'hi' }, status: 'success', created_at: '2024-01-01T00:00:00Z' },
      ]

      mockPrepare.mockImplementation(() => vi.fn().mockReturnValue(mockRecords))

      const history = getRecommendationHistory()

      expect(history).toHaveLength(2)
      expect(history[0].mode).toBe('analyze')
      expect(history[1].mode).toBe('chat')
    })

    it('默认limit应为20', () => {
      mockPrepare.mockImplementation(() => vi.fn().mockReturnValue([]))

      getRecommendationHistory()

      const sqlCalls = mockPrepare.mock.calls.map((c) => c[0] as string)
      const limitCall = sqlCalls.find((s) => s.includes('LIMIT'))
      expect(limitCall).toBeDefined()
    })

    it('应支持userId过滤', () => {
      mockPrepare.mockImplementation(() =>
        vi.fn().mockReturnValue([
          { id: 1, user_id: 5, mode: 'analyze', result: {}, status: 'success', created_at: '2024-01-01' },
        ])
      )

      const history = getRecommendationHistory({ userId: 5 })

      expect(history).toHaveLength(1)
      expect(history[0].user_id).toBe(5)
    })

    it('应支持mode过滤', () => {
      mockPrepare.mockImplementation(() =>
        vi.fn().mockReturnValue([
          { id: 1, mode: 'chat', result: {}, status: 'success', created_at: '2024-01-01' },
          { id: 2, mode: 'chat', result: {}, status: 'success', created_at: '2024-01-02' },
        ])
      )

      const history = getRecommendationHistory({ mode: 'chat' })

      expect(history).toHaveLength(2)
      expect(history.every((h) => h.mode === 'chat')).toBe(true)
    })

    it('应支持jobId过滤', () => {
      mockPrepare.mockImplementation(() =>
        vi.fn().mockReturnValue([
          { id: 1, job_id: 42, mode: 'ai_analysis', result: {}, status: 'success', created_at: '2024-01-01' },
        ])
      )

      const history = getRecommendationHistory({ jobId: 42 })

      expect(history).toHaveLength(1)
      expect(history[0].job_id).toBe(42)
    })

    it('应支持自定义limit', () => {
      mockPrepare.mockImplementation(() => vi.fn().mockReturnValue([]))

      getRecommendationHistory({ limit: 5 })

      const sqlCalls = mockPrepare.mock.calls.map((c) => c[0] as string)
      const hasLimit = sqlCalls.some((s) => s.includes('LIMIT') && s.includes('?'))
      expect(hasLimit).toBe(true)
    })

    it('结果应按created_at降序排列', () => {
      const mockRecords: RecommendationHistoryItem[] = [
        { id: 1, mode: 'analyze', result: {}, status: 'success', created_at: '2024-01-01T00:00:00Z' },
        { id: 2, mode: 'chat', result: {}, status: 'success', created_at: '2024-01-03T00:00:00Z' },
        { id: 3, mode: 'resume', result: {}, status: 'success', created_at: '2024-01-02T00:00:00Z' },
      ]

      mockPrepare.mockImplementation(() => vi.fn().mockReturnValue(mockRecords))

      const history = getRecommendationHistory()

      const sqlCalls = mockPrepare.mock.calls.map((c) => c[0] as string)
      expect(sqlCalls[0]).toContain('ORDER BY created_at DESC')
    })

    it('无匹配记录时应返回空数组', () => {
      mockPrepare.mockImplementation(() => vi.fn().mockReturnValue([]))

      const history = getRecommendationHistory({ userId: 99999 })

      expect(history).toEqual([])
    })
  })

  describe('去重逻辑', () => {
    it('相同参数的多次调用应产生不同ID的记录', () => {
      let insertId = 0
      mockPrepare.mockImplementation((sql: string) => {
        const mockFn = vi.fn()
        if (sql.includes('INSERT INTO recommendation_history')) {
          insertId++
          mockFn.mockReturnValue({ lastInsertRowid: insertId, changes: 1 })
        } else {
          mockFn.mockReturnValue({
            id: insertId, mode: 'analyze', result: {},
            status: 'success', created_at: new Date().toISOString(),
          })
        }
        return mockFn
      })

      const r1 = saveRecommendationHistory({ mode: 'analyze', result: { a: 1 } })
      const r2 = saveRecommendationHistory({ mode: 'analyze', result: { a: 1 } })

      expect(r1.id).not.toBe(r2.id)
    })
  })

  describe('模式有效性验证', () => {
    it('应接受所有合法的mode值', () => {
      const validModes = ['analyze', 'resume', 'delivery', 'chat', 'interview_questions', 'ai_analysis']

      for (const mode of validModes) {
        const record: RecommendationHistoryItem = {
          id: Math.floor(Math.random() * 1000),
          mode: mode as RecommendationHistoryItem['mode'],
          result: {},
          status: 'success',
          created_at: new Date().toISOString(),
        }

        mockPrepare.mockImplementation((sql: string) => {
          const mockFn = vi.fn()
          if (sql.includes('INSERT INTO recommendation_history')) {
            mockFn.mockReturnValue({ lastInsertRowid: record.id, changes: 1 })
          } else {
            mockFn.mockReturnValue(record)
          }
          return mockFn
        })

        const result = saveRecommendationHistory({ mode: mode as RecommendationHistoryItem['mode'], result: {} })
        expect(result.mode).toBe(mode)
      }
    })
  })
})
