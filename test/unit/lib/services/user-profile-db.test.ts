import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'

const mockDbInstances: Map<Database.Database, {
  prepare: ReturnType<typeof vi.fn>;
  exec: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  all: ReturnType<typeof vi.fn>;
}> = new Map()

function createMockDb() {
  const stmts: Record<string, ReturnType<typeof vi.fn>> = {}
  const mockPrepare = vi.fn((sql: string) => {
    if (!stmts[sql]) {
      stmts[sql] = vi.fn()
    }
    return stmts[sql]
  })
  const mockExec = vi.fn()
  const mockDb = {
    prepare: mockPrepare,
    exec: mockExec,
    pragma: vi.fn(),
    close: vi.fn(),
  } as unknown as Database.Database

  const handlers = { prepare: mockPrepare, exec: mockExec, run: vi.fn(), get: vi.fn(), all: vi.fn() }
  mockDbInstances.set(mockDb, handlers)

  return { db: mockDb, ...handlers }
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
  initUserProfileTables,
  getActiveProfile,
  createProfile,
  updateProfile,
  saveParsedProfile,
  getPdfCache,
  setPdfCache,
  cleanupExpiredCache,
  getProfileHistory,
  rollbackProfile,
  deleteProfile,
} from '@/lib/user-profile-db'
import type { ResumeProfile, Education, Internship } from '@/types'

describe('UserProfileDB - 用户画像数据库操作', () => {
  let mockHandlers: ReturnType<typeof createMockDb>

  const createTestProfile = (overrides: Partial<ResumeProfile> = {}): ResumeProfile => ({
    name: '测试用户',
    phone: '13800138000',
    email: 'test@example.com',
    education: [
      {
        school: '测试大学',
        major: '计算机科学',
        degree: '本科',
        graduationYear: 2024,
        startDate: '2020-09',
        endDate: '2024-06',
      },
    ] as Education[],
    skills: ['Python', 'SQL'],
    certifications: [],
    languages: ['中文'],
    internships: [] as Internship[],
    projects: [],
    resumeText: '测试简历文本',
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockHandlers = createMockDb()
    ;(getDb as unknown as vi.Mock).mockReturnValue(mockHandlers.db)
  })

  afterEach(() => {
    mockDbInstances.clear()
  })

  describe('initUserProfileTables', () => {
    it('应执行CREATE TABLE语句', () => {
      initUserProfileTables()

      expect(mockHandlers.exec).toHaveBeenCalled()
      const execSql = mockHandlers.exec.mock.calls[0][0] as string
      expect(execSql).toContain('CREATE TABLE IF NOT EXISTS user_profiles')
    })

    it('应创建pdf_parse_cache表', () => {
      initUserProfileTables()

      const execSql = mockHandlers.exec.mock.calls[0][0] as string
      expect(execSql).toContain('CREATE TABLE IF NOT EXISTS pdf_parse_cache')
    })

    it('应创建索引', () => {
      initUserProfileTables()

      const execSql = mockHandlers.exec.mock.calls[0][0] as string
      expect(execSql).toContain('CREATE INDEX IF NOT EXISTS idx_user_profiles_active')
      expect(execSql).toContain('CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id')
      expect(execSql).toContain('CREATE INDEX IF NOT EXISTS idx_user_profiles_file_hash')
      expect(execSql).toContain('CREATE INDEX IF NOT EXISTS idx_pdf_cache_expires')
    })
  })

  describe('getActiveProfile', () => {
    it('存在活跃画像时应返回解析后的数据', () => {
      const profileData = JSON.stringify(createTestProfile())
      mockHandlers.get.mockReturnValue({ profile_data: profileData })

      const result = getActiveProfile(1)

      expect(result).not.toBeNull()
      expect(result!.name).toBe('测试用户')
      expect(result!.email).toBe('test@example.com')
    })

    it('不存在活跃画像时应返回null', () => {
      mockHandlers.get.mockReturnValue(undefined)

      const result = getActiveProfile(999)

      expect(result).toBeNull()
    })

    it('JSON解析失败时应返回null并记录错误', () => {
      mockHandlers.get.mockReturnValue({ profile_data: 'invalid json' })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const result = getActiveProfile(1)
      consoleSpy.mockRestore()

      expect(result).toBeNull()
    })
  })

  describe('createProfile', () => {
    it('应正确插入新画像记录并返回ID', () => {
      mockHandlers.get.mockReturnValue({ max_version: 0 })
      mockHandlers.run.mockReturnValue({ lastInsertRowid: 42, changes: 1 })

      const profile = createTestProfile()
      const id = createProfile(1, profile)

      expect(id).toBe(42)
      expect(mockHandlers.run).toHaveBeenCalled()
    })

    it('应自动递增版本号', () => {
      mockHandlers.get.mockReturnValue({ max_version: 3 })
      mockHandlers.run.mockReturnValue({ lastInsertRowid: 50, changes: 1 })

      createProfile(1, createTestProfile())

      const insertCall = mockHandlers.prepare.mock.calls.find(
        (call) => typeof call[0] === 'string' && (call[0] as string).includes('INSERT INTO user_profiles')
      )
      expect(insertCall).toBeDefined()
    })

    it('支持source选项', () => {
      mockHandlers.get.mockReturnValue({ max_version: 0 })
      mockHandlers.run.mockReturnValue({ lastInsertRowid: 1, changes: 1 })

      createProfile(1, createTestProfile(), { source: 'parsed' })

      const runArgs = mockHandlers.run.mock.calls[0]
      expect(runArgs).toContain('parsed')
    })

    it('支持fileHash和fileName选项', () => {
      mockHandlers.get.mockReturnValue({ max_version: 0 })
      mockHandlers.run.mockReturnValue({ lastInsertRowid: 1, changes: 1 })

      createProfile(1, createTestProfile(), {
        source: 'parsed',
        fileHash: 'abc123',
        fileName: 'resume.pdf',
        confidenceScore: 0.95,
      })

      const runArgs = mockHandlers.run.mock.calls[0]
      expect(runArgs).toContain('abc123')
      expect(runArgs).toContain('resume.pdf')
      expect(runArgs).toContain(0.95)
    })
  })

  describe('updateProfile', () => {
    it('应合并更新并返回新画像', () => {
      const existingProfile = createTestProfile()
      mockHandlers.get
        .mockReturnValueOnce({ profile_data: JSON.stringify(existingProfile) })
        .mockReturnValueOnce({ max_version: 1 })
      mockHandlers.run.mockReturnValue({ lastInsertRowid: 2, changes: 1 })

      const result = updateProfile(1, { name: '更新后的名字' })

      expect(result).not.toBeNull()
      expect(result!.name).toBe('更新后的名字')
      expect(result!.phone).toBe('13800138000')
    })

    it('不存在活跃画像时应返回null', () => {
      mockHandlers.get.mockReturnValue(undefined)

      const result = updateProfile(999, { name: 'test' })

      expect(result).toBeNull()
    })

    it('应先停用旧记录再创建新记录', () => {
      const existingProfile = createTestProfile()
      mockHandlers.get
        .mockReturnValueOnce({ profile_data: JSON.stringify(existingProfile) })
        .mockReturnValueOnce({ max_version: 1 })
      mockHandlers.run.mockReturnValue({ lastInsertRowid: 2, changes: 1 })

      updateProfile(1, { skills: ['Java'] })

      const sqlCalls = mockHandlers.prepare.mock.calls.map((c) => c[0])
      const hasUpdateInactive = sqlCalls.some((s) => typeof s === 'string' && (s as string).includes('is_active = 0'))
      const hasInsertNew = sqlCalls.some((s) => typeof s === 'string' && (s as string).includes('INSERT INTO user_profiles'))

      expect(hasUpdateInactive).toBe(true)
      expect(hasInsertNew).toBe(true)
    })
  })

  describe('saveParsedProfile', () => {
    it('应为parsed源创建profile', () => {
      mockHandlers.get.mockReturnValue({ max_version: 0 })
      mockHandlers.run.mockReturnValue({ lastInsertRowid: 10, changes: 1 })

      const profile = createTestProfile()
      const id = saveParsedProfile(1, profile, 'hash456', 'file.pdf', 0.88)

      expect(id).toBe(10)
      expect(mockHandlers.run).toHaveBeenCalled()
    })
  })

  describe('PDF缓存操作', () => {
    describe('getPdfCache', () => {
      it('缓存命中且未过期时应返回数据', () => {
        const cacheData = { parsedText: '简历文本内容', parseResult: createTestProfile() }
        mockHandlers.get.mockReturnValue({
          parsed_text: '简历文本内容',
          parse_result: JSON.stringify(cacheData.parseResult),
        })

        const result = getPdfCache('hash123')

        expect(result).not.toBeNull()
        expect(result!.parsedText).toBe('简历文本内容')
        expect(result!.parseResult.name).toBe('测试用户')
      })

      it('缓存不存在时应返回null', () => {
        mockHandlers.get.mockReturnValue(undefined)

        const result = getPdfCache('nonexistent')

        expect(result).toBeNull()
      })

      it('JSON解析失败时应返回null', () => {
        mockHandlers.get.mockReturnValue({ parsed_text: 'ok', parse_result: 'bad-json' })

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const result = getPdfCache('hash')
        consoleSpy.mockRestore()

        expect(result).toBeNull()
      })
    })

    describe('setPdfCache', () => {
      it('应正确插入或更新缓存', () => {
        setPdfCache(
          'hash789',
          'resume.pdf',
          102400,
          'parsed text',
          createTestProfile(),
          false,
          1500
        )

        expect(mockHandlers.run).toHaveBeenCalled()
      })

      it('使用默认TTL为24小时', () => {
        setPdfCache('hash', 'f.pdf', 100, 'text', createTestProfile(), false, 100)

        const runArgs = mockHandlers.run.mock.calls[0]
        expect(runArgs).toContain(24)
      })

      it('可自定义TTL小时数', () => {
        setPdfCache('hash', 'f.pdf', 100, 'text', createTestProfile(), false, 100, 48)

        const runArgs = mockHandlers.run.mock.calls[0]
        expect(runArgs).toContain(48)
      })
    })

    describe('cleanupExpiredCache', () => {
      it('应删除过期缓存并返回删除数量', () => {
        mockHandlers.run.mockReturnValue({ changes: 5 })

        const count = cleanupExpiredCache()

        expect(count).toBe(5)
      })

      it('无过期缓存时应返回0', () => {
        mockHandlers.run.mockReturnValue({ changes: 0 })

        const count = cleanupExpiredCache()

        expect(count).toBe(0)
      })
    })
  })

  describe('getProfileHistory', () => {
    it('应返回用户画像历史记录', () => {
      const mockRecords = [
        { id: 1, user_id: 1, version: 2, is_active: 0, created_at: '2024-01-01' },
        { id: 2, user_id: 1, version: 1, is_active: 0, created_at: '2024-01-02' },
      ]
      mockHandlers.all.mockReturnValue(mockRecords)

      const history = getProfileHistory(1)

      expect(history).toHaveLength(2)
    })

    it('应限制返回数量', () => {
      mockHandlers.all.mockReturnValue([])

      getProfileHistory(1, 5)

      const limitCall = mockHandlers.prepare.mock.calls.find(
        (c) => typeof c[0] === 'string' && (c[0] as string).includes('LIMIT ?')
      )
      expect(limitCall).toBeDefined()
    })
  })

  describe('rollbackProfile', () => {
    it('目标版本存在时应回滚成功', () => {
      mockHandlers.get
        .mockReturnValueOnce({ id: 10, user_id: 1, version: 2, is_active: 0 })
        .mockReturnValueOnce({ changes: 1 })
        .mockReturnValueOnce({ changes: 1 })

      const result = rollbackProfile(1, 2)

      expect(result).toBe(true)
    })

    it('目标版本不存在时应返回false', () => {
      mockHandlers.get.mockReturnValue(undefined)

      const result = rollbackProfile(1, 999)

      expect(result).toBe(false)
    })
  })

  describe('deleteProfile', () => {
    it('应删除用户所有画像记录', () => {
      mockHandlers.run.mockReturnValue({ changes: 3 })

      const result = deleteProfile(1)

      expect(result).toBe(true)
    })

    it('无记录时删除应返回false', () => {
      mockHandlers.run.mockReturnValue({ changes: 0 })

      const result = deleteProfile(999)

      expect(result).toBe(false)
    })
  })

  describe('事务处理模拟', () => {
    it('updateProfile涉及多步操作应按顺序执行', () => {
      const existingProfile = createTestProfile()
      let callOrder = 0

      mockHandlers.get
        .mockImplementation(() => {
          callOrder++
          return callOrder === 1 ? { profile_data: JSON.stringify(existingProfile) } : { max_version: 1 }
        })
      mockHandlers.run.mockImplementation(() => {
        callOrder++
        return { lastInsertRowid: callOrder, changes: 1 }
      })

      updateProfile(1, { name: 'new' })

      expect(mockHandlers.get).toHaveBeenCalledTimes(2)
      expect(mockHandlers.run).toHaveBeenCalledTimes(2)
    })
  })
})
