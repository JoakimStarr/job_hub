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
    ;(getDb as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      prepare: vi.fn(() => ({ get: vi.fn(), run: vi.fn(), all: vi.fn() })),
      exec: vi.fn(),
      pragma: vi.fn(),
      close: vi.fn(),
    })
  })

  function setupPrepare(pattern: string, returnValue: unknown) {
    const db = getDb()
    db.prepare.mockImplementation((sql: string) => {
      const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
      if (sql.includes(pattern)) {
        if (typeof returnValue === 'object' && !Array.isArray(returnValue)) {
          s.get.mockReturnValue(returnValue)
        } else if (Array.isArray(returnValue)) {
          s.all.mockReturnValue(returnValue)
        }
      }
      return s
    })
    return db.prepare
  }

  describe('initUserProfileTables', () => {
    it('应执行CREATE TABLE语句', () => {
      initUserProfileTables()
      expect(getDb().exec).toHaveBeenCalled()
      const sql = getDb().exec.mock.calls[0][0] as string
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS user_profiles')
    })

    it('应创建pdf_parse_cache表', () => {
      initUserProfileTables()
      const sql = getDb().exec.mock.calls[0][0] as string
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS pdf_parse_cache')
    })

    it('应创建索引', () => {
      initUserProfileTables()
      const sql = getDb().exec.mock.calls[0][0] as string
      expect(sql).toContain('idx_user_profiles_active')
      expect(sql).toContain('idx_user_profiles_user_id')
      expect(sql).toContain('idx_pdf_cache_expires')
    })
  })

  describe('getActiveProfile', () => {
    it('存在活跃画像时应返回解析后的数据', () => {
      const profileData = JSON.stringify(createTestProfile())
      setupPrepare('WHERE user_id = ? AND is_active = 1', { profile_data: profileData })

      const result = getActiveProfile(1)

      expect(result).not.toBeNull()
      expect(result!.name).toBe('测试用户')
      expect(result!.email).toBe('test@example.com')
    })

    it('不存在活跃画像时应返回null', () => {
      setupPrepare('WHERE user_id = ? AND is_active = 1', undefined)

      const result = getActiveProfile(999)
      expect(result).toBeNull()
    })

    it('JSON解析失败时应返回null并记录错误', () => {
      setupPrepare('WHERE user_id = ? AND is_active = 1', { profile_data: 'invalid json' })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const result = getActiveProfile(1)
      consoleSpy.mockRestore()

      expect(result).toBeNull()
    })
  })

  describe('createProfile', () => {
    it('应正确插入新画像记录并返回ID', () => {
      let callIdx = 0
      getDb().prepare.mockImplementation((sql: string) => {
        const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
        callIdx++
        if (sql.includes('MAX(version)')) {
          s.get.mockReturnValue({ max_version: 0 })
        } else if (sql.includes('INSERT INTO user_profiles')) {
          s.run.mockReturnValue({ lastInsertRowid: 42, changes: 1 })
        }
        return s
      })

      const id = createProfile(1, createTestProfile())
      expect(id).toBe(42)
    })

    it('应自动递增版本号', () => {
      let maxVerCallCount = 0
      getDb().prepare.mockImplementation((sql: string) => {
        const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
        if (sql.includes('MAX(version)')) {
          maxVerCallCount++
          s.get.mockReturnValue({ max_version: 3 })
        } else if (sql.includes('INSERT INTO user_profiles')) {
          s.run.mockReturnValue({ lastInsertRowid: 1, changes: 1 })
        }
        return s
      })

      createProfile(1, createTestProfile())
      expect(maxVerCallCount).toBe(1)
    })

    it('支持source选项', () => {
      getDb().prepare.mockImplementation((sql: string) => {
        const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
        if (sql.includes('MAX(version)')) s.get.mockReturnValue({ max_version: 0 })
        else if (sql.includes('INSERT INTO user_profiles')) s.run.mockReturnValue({ lastInsertRowid: 1, changes: 1 })
        return s
      })

      const id = createProfile(1, createTestProfile(), { source: 'parsed' })
      expect(id).toBeGreaterThan(0)
    })

    it('支持fileHash和fileName选项', () => {
      getDb().prepare.mockImplementation((sql: string) => {
        const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
        if (sql.includes('MAX(version)')) s.get.mockReturnValue({ max_version: 0 })
        else if (sql.includes('INSERT INTO user_profiles')) s.run.mockReturnValue({ lastInsertRowid: 5, changes: 1 })
        return s
      })

      const id = createProfile(1, createTestProfile(), {
        source: 'parsed', fileHash: 'abc123', fileName: 'resume.pdf', confidenceScore: 0.95,
      })
      expect(id).toBe(5)
    })
  })

  describe('updateProfile', () => {
    it('应合并更新并返回新画像', () => {
      const existingProfile = createTestProfile()
      let step = 0

      getDb().prepare.mockImplementation((sql: string) => {
        const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
        step++
        if (step === 1 && sql.includes('is_active = 1')) {
          s.get.mockReturnValue({ profile_data: JSON.stringify(existingProfile) })
        } else if (step === 2 && sql.includes('MAX(version)')) {
          s.get.mockReturnValue({ max_version: 1 })
        } else if (sql.includes('UPDATE') || sql.includes('INSERT INTO user_profiles')) {
          s.run.mockReturnValue({ lastInsertRowid: 2, changes: 1 })
        }
        return s
      })

      const result = updateProfile(1, { name: '更新后的名字' })
      expect(result).not.toBeNull()
      expect(result!.name).toBe('更新后的名字')
      expect(result!.phone).toBe('13800138000')
    })

    it('不存在活跃画像时应返回null', () => {
      getDb().prepare.mockImplementation((sql: string) => {
        const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
        if (sql.includes('is_active = 1')) s.get.mockReturnValue(undefined)
        return s
      })

      const result = updateProfile(999, { name: 'test' })
      expect(result).toBeNull()
    })

    it('应先停用旧记录再创建新记录', () => {
      const existingProfile = createTestProfile()
      const sqlLog: string[] = []

      getDb().prepare.mockImplementation((sql: string) => {
        sqlLog.push(sql)
        const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
        if (sql.includes('is_active = 1') && sql.includes('ORDER BY updated_at')) {
          s.get.mockReturnValue({ profile_data: JSON.stringify(existingProfile) })
        } else if (sql.includes('MAX(version)')) {
          s.get.mockReturnValue({ max_version: 1 })
        } else if (sql.includes('SET is_active = 0') || sql.includes('INSERT INTO user_profiles')) {
          s.run.mockReturnValue({ lastInsertRowid: 2, changes: 1 })
        }
        return s
      })

      updateProfile(1, { skills: ['Java'] })
      const hasUpdateInactive = sqlLog.some((s) => s.includes('is_active = 0'))
      const hasInsertNew = sqlLog.some((s) => s.includes('INSERT INTO user_profiles'))
      expect(hasUpdateInactive).toBe(true)
      expect(hasInsertNew).toBe(true)
    })
  })

  describe('saveParsedProfile', () => {
    it('应为parsed源创建profile', () => {
      getDb().prepare.mockImplementation((sql: string) => {
        const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
        if (sql.includes('MAX(version)')) s.get.mockReturnValue({ max_version: 0 })
        else if (sql.includes('INSERT INTO user_profiles')) s.run.mockReturnValue({ lastInsertRowid: 10, changes: 1 })
        return s
      })

      const id = saveParsedProfile(1, createTestProfile(), 'hash456', 'file.pdf', 0.88)
      expect(id).toBe(10)
    })
  })

  describe('PDF缓存操作', () => {
    describe('getPdfCache', () => {
      it('缓存命中且未过期时应返回数据', () => {
        const cacheData = { parsedText: '简历文本内容', parseResult: createTestProfile() }

        getDb().prepare.mockImplementation((sql: string) => {
          const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
          if (sql.includes('pdf_parse_cache') && sql.includes('WHERE file_hash')) {
            s.get.mockReturnValue({
              parsed_text: '简历文本内容',
              parse_result: JSON.stringify(cacheData.parseResult),
            })
          }
          return s
        })

        const result = getPdfCache('hash123')
        expect(result).not.toBeNull()
        expect(result!.parsedText).toBe('简历文本内容')
        expect(result!.parseResult.name).toBe('测试用户')
      })

      it('缓存不存在时应返回null', () => {
        getDb().prepare.mockImplementation((sql: string) => {
          const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
          if (sql.includes('pdf_parse_cache') && sql.includes('WHERE file_hash')) {
            s.get.mockReturnValue(undefined)
          }
          return s
        })

        const result = getPdfCache('nonexistent')
        expect(result).toBeNull()
      })

      it('JSON解析失败时应返回null', () => {
        getDb().prepare.mockImplementation((sql: string) => {
          const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
          if (sql.includes('pdf_parse_cache') && sql.includes('WHERE file_hash')) {
            s.get.mockReturnValue({ parsed_text: 'ok', parse_result: 'bad-json' })
          }
          return s
        })

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const result = getPdfCache('hash')
        consoleSpy.mockRestore()

        expect(result).toBeNull()
      })
    })

    describe('setPdfCache', () => {
      it('应正确插入或更新缓存', () => {
        getDb().prepare.mockImplementation((sql: string) => {
          const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
          if (sql.includes('INSERT OR REPLACE INTO pdf_parse_cache')) {
            s.run.mockReturnValue({ lastInsertRowid: 1, changes: 1 })
          }
          return s
        })

        setPdfCache('hash789', 'resume.pdf', 102400, 'parsed text', createTestProfile(), false, 1500)
        expect(getDb().prepare).toHaveBeenCalled()
      })

      it('使用默认TTL为24小时', () => {
        let capturedHours: unknown

        getDb().prepare.mockImplementation((sql: string) => {
          const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
          if (sql.includes('INSERT OR REPLACE INTO pdf_parse_cache')) {
            s.run.mockImplementationOnce((...args) => {
              capturedHours = args[args.length - 1]
              return { lastInsertRowid: 1, changes: 1 }
            })
          }
          return s
        })

        setPdfCache('hash', 'f.pdf', 100, 'text', createTestProfile(), false, 100)
        expect(capturedHours).toBe(24)
      })

      it('可自定义TTL小时数', () => {
        let capturedHours: unknown

        getDb().prepare.mockImplementation((sql: string) => {
          const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
          if (sql.includes('INSERT OR REPLACE INTO pdf_parse_cache')) {
            s.run.mockImplementationOnce((...args) => {
              capturedHours = args[args.length - 1]
              return { lastInsertRowid: 1, changes: 1 }
            })
          }
          return s
        })

        setPdfCache('hash', 'f.pdf', 100, 'text', createTestProfile(), false, 100, 48)
        expect(capturedHours).toBe(48)
      })
    })

    describe('cleanupExpiredCache', () => {
      it('应删除过期缓存并返回删除数量', () => {
        getDb().prepare.mockImplementation((sql: string) => {
          const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
          if (sql.includes('DELETE FROM pdf_parse_cache WHERE expires_at')) {
            s.run.mockReturnValue({ changes: 5 })
          }
          return s
        })

        const count = cleanupExpiredCache()
        expect(count).toBe(5)
      })

      it('无过期缓存时应返回0', () => {
        getDb().prepare.mockImplementation((sql: string) => {
          const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
          if (sql.includes('DELETE FROM pdf_parse_cache WHERE expires_at')) {
            s.run.mockReturnValue({ changes: 0 })
          }
          return s
        })

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

      getDb().prepare.mockImplementation((sql: string) => {
        const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
        if (sql.includes('SELECT * FROM user_profiles') && sql.includes('ORDER BY version DESC')) {
          s.all.mockReturnValue(mockRecords)
        }
        return s
      })

      const history = getProfileHistory(1)
      expect(history).toHaveLength(2)
    })

    it('应限制返回数量', () => {
      getDb().prepare.mockImplementation((sql: string) => {
        const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
        if (sql.includes('SELECT * FROM user_profiles') && sql.includes('LIMIT')) {
          s.all.mockReturnValue([])
        }
        return s
      })

      getProfileHistory(1, 5)
      expect(getDb().prepare).toHaveBeenCalled()
    })
  })

  describe('rollbackProfile', () => {
    it('目标版本存在时应回滚成功', () => {
      const targetRecord = { id: 10, user_id: 1, version: 2, is_active: 0 }

      getDb().prepare.mockImplementation((sql: string) => {
        const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
        if (sql.includes('SELECT * FROM user_profiles') && sql.includes('version = ?')) {
          s.get.mockReturnValue(targetRecord)
        } else if (sql.includes('UPDATE user_profiles SET is_active')) {
          s.run.mockReturnValue({ changes: 1 })
        } else if (sql.includes('UPDATE user_profiles SET is_active = 1') || sql.includes("SET is_active = 1")) {
          s.run.mockReturnValue({ changes: 1 })
        }
        return s
      })

      const result = rollbackProfile(1, 2)
      expect(result).toBe(true)
    })

    it('目标版本不存在时应返回false', () => {
      getDb().prepare.mockImplementation((sql: string) => {
        const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
        if (sql.includes('SELECT * FROM user_profiles WHERE user_id = ? AND version = ?')) {
          s.get.mockReturnValue(undefined)
        }
        return s
      })

      const result = rollbackProfile(1, 999)
      expect(result).toBe(false)
    })
  })

  describe('deleteProfile', () => {
    it('应删除用户所有画像记录', () => {
      getDb().prepare.mockImplementation((sql: string) => {
        const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
        if (sql.includes('DELETE FROM user_profiles WHERE user_id = ?')) {
          s.run.mockReturnValue({ changes: 3 })
        }
        return s
      })

      const result = deleteProfile(1)
      expect(result).toBe(true)
    })

    it('无记录时删除应返回false', () => {
      getDb().prepare.mockImplementation((sql: string) => {
        const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
        if (sql.includes('DELETE FROM user_profiles WHERE user_id = ?')) {
          s.run.mockReturnValue({ changes: 0 })
        }
        return s
      })

      const result = deleteProfile(999)
      expect(result).toBe(false)
    })
  })

  describe('事务处理模拟', () => {
    it('updateProfile涉及多步操作应按顺序执行', () => {
      const existingProfile = createTestProfile()
      const callOrder: string[] = []

      getDb().prepare.mockImplementation((sql: string) => {
        callOrder.push(sql)
        const s = { get: vi.fn(), run: vi.fn(), all: vi.fn() }
        if (sql.includes('is_active = 1') && sql.includes('ORDER BY')) {
          s.get.mockReturnValue({ profile_data: JSON.stringify(existingProfile) })
        } else if (sql.includes('MAX(version)') || sql.includes('COALESCE(MAX')) {
          s.get.mockReturnValue({ max_version: 1 })
        } else if (sql.includes('SET is_active = 0') || sql.includes("is_active = 0")) {
          s.run.mockReturnValue({ changes: 1 })
        } else if (sql.includes('INSERT INTO user_profiles')) {
          s.run.mockReturnValue({ lastInsertRowid: 3, changes: 1 })
        }
        return s
      })

      updateProfile(1, { name: 'new' })

      expect(callOrder.length).toBeGreaterThanOrEqual(3)
      expect(callOrder.some((s) => s.includes('is_active = 1'))).toBe(true)
      expect(callOrder.some((s) => s.includes('MAX(version)') || s.includes('COALESCE(MAX'))).toBe(true)
      expect(callOrder.some((s) => s.includes('is_active = 0') || s.includes("SET is_active = 0"))).toBe(true)
      expect(callOrder.some((s) => s.includes('INSERT INTO user_profiles'))).toBe(true)
    })
  })
})
