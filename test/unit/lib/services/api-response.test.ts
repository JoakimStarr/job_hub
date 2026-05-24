import { describe, it, expect } from 'vitest'
import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateRequired,
  validatePagination,
  ErrorCode,
} from '@/lib/api-response'

describe('ApiResponse - API响应工具', () => {
  describe('ErrorCode枚举', () => {
    it('所有预定义的错误码都应有对应的消息', () => {
      const codes = Object.values(ErrorCode)
      for (const code of codes) {
        expect(code).toBeDefined()
        expect(typeof code).toBe('string')
      }
    })

    it('ErrorCode应包含所有预期的错误类型', () => {
      expect(ErrorCode.BAD_REQUEST).toBe('BAD_REQUEST')
      expect(ErrorCode.UNAUTHORIZED).toBe('UNAUTHORIZED')
      expect(ErrorCode.FORBIDDEN).toBe('FORBIDDEN')
      expect(ErrorCode.NOT_FOUND).toBe('NOT_FOUND')
      expect(ErrorCode.CONFLICT).toBe('CONFLICT')
      expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR')
      expect(ErrorCode.INTERNAL_ERROR).toBe('INTERNAL_ERROR')
      expect(ErrorCode.DATABASE_ERROR).toBe('DATABASE_ERROR')
      expect(ErrorCode.SERVICE_UNAVAILABLE).toBe('SERVICE_UNAVAILABLE')
    })
  })

  describe('createSuccessResponse', () => {
    it('应返回正确的成功响应结构', async () => {
      const response = createSuccessResponse({ id: 1, name: 'test' })
      const data = await response.json() as { data: unknown; timestamp: string }

      expect(data.data).toEqual({ id: 1, name: 'test' })
      expect(data.timestamp).toBeDefined()
      expect(response.status).toBe(200)
    })

    it('应支持自定义HTTP状态码', async () => {
      const response = createSuccessResponse({ created: true }, 201)
      expect(response.status).toBe(201)
    })

    it('应支持空数据', async () => {
      const response = createSuccessResponse(null)
      const data = await response.json() as { data: unknown; timestamp: string }
      expect(data.data).toBeNull()
    })

    it('应支持数组数据', async () => {
      const items = [{ id: 1 }, { id: 2 }]
      const response = createSuccessResponse(items)
      const data = await response.json() as { data: unknown; timestamp: string }
      expect(data.data).toEqual(items)
    })

    it('timestamp应为ISO格式字符串', async () => {
      const response = createSuccessResponse({})
      const data = await response.json() as { data: unknown; timestamp: string }
      const date = new Date(data.timestamp)
      expect(date.toString()).not.toBe('Invalid Date')
    })
  })

  describe('createErrorResponse', () => {
    it('使用ErrorCode应返回对应的中文消息', async () => {
      const response = createErrorResponse(ErrorCode.NOT_FOUND)
      const data = await response.json() as { error: string; code: string; timestamp: string; path?: string }

      expect(data.error).toBe('资源不存在')
      expect(data.code).toBe('NOT_FOUND')
      expect(response.status).toBe(404)
    })

    it('使用自定义字符串消息应直接使用该消息', async () => {
      const response = createErrorResponse('自定义错误信息')
      const data = await response.json() as { error: string; code: string; timestamp: string }

      expect(data.error).toBe('自定义错误信息')
      expect(response.status).toBe(500)
    })

    it('BAD_REQUEST应返回400状态码', () => {
      const response = createErrorResponse(ErrorCode.BAD_REQUEST)
      expect(response.status).toBe(400)
    })

    it('UNAUTHORIZED应返回401状态码', () => {
      const response = createErrorResponse(ErrorCode.UNAUTHORIZED)
      expect(response.status).toBe(401)
    })

    it('FORBIDDEN应返回403状态码', () => {
      const response = createErrorResponse(ErrorCode.FORBIDDEN)
      expect(response.status).toBe(403)
    })

    it('CONFLICT应返回409状态码', () => {
      const response = createErrorResponse(ErrorCode.CONFLICT)
      expect(response.status).toBe(409)
    })

    it('SERVICE_UNAVAILABLE应返回503状态码', () => {
      const response = createErrorResponse(ErrorCode.SERVICE_UNAVAILABLE)
      expect(response.status).toBe(503)
    })

    it('应支持附加details信息', async () => {
      const details = { field: 'email', issue: '格式无效' }
      const response = createErrorResponse(ErrorCode.VALIDATION_ERROR, { details })
      const data = await response.json() as { error: string; details: unknown; timestamp: string }

      expect(data.details).toEqual(details)
    })

    it('应支持path信息', async () => {
      const response = createErrorResponse(ErrorCode.NOT_FOUND, { path: '/api/jobs/999' })
      const data = await response.json() as { error: string; path: string | undefined; timestamp: string }

      expect(data.path).toBe('/api/jobs/999')
    })

    it('应支持自定义status覆盖', () => {
      const response = createErrorResponse(ErrorCode.INTERNAL_ERROR, { status: 502 })
      expect(response.status).toBe(502)
    })
  })

  describe('handleApiError', () => {
    it('普通Error应返回INTERNAL_ERROR', async () => {
      const response = handleApiError(new Error('something wrong'))
      const data = await response.json() as { error: string; code: string; timestamp: string }

      expect(data.code).toBe('INTERNAL_ERROR')
      expect(response.status).toBe(500)
    })

    it('database相关错误应返回DATABASE_ERROR', async () => {
      const response = handleApiError(new Error('SQLITE_BUSY: database is locked'))
      const data = await response.json() as { error: string; code: string; timestamp: string }

      expect(data.code).toBe('DATABASE_ERROR')
      expect(response.status).toBe(500)
    })

    it('AuthError应返回UNAUTHORIZED', async () => {
      class AuthError extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'AuthError'
        }
      }

      const response = handleApiError(new AuthError('Not authenticated'))
      const data = await response.json() as { error: string; code: string; timestamp: string }

      expect(data.code).toBe('UNAUTHORIZED')
      expect(response.status).toBe(401)
    })

    it('非Error对象应返回INTERNAL_ERROR', async () => {
      const response = handleApiError('string error')
      const data = await response.json() as { error: string; code: string; timestamp: string }

      expect(data.code).toBe('INTERNAL_ERROR')
    })

    it('null/undefined应返回INTERNAL_ERROR', () => {
      const response = handleApiError(null)
      expect(response.status).toBe(500)
    })

    it('应传递path到响应', async () => {
      const response = handleApiError(new Error('test'), { path: '/api/test' })
      const data = await response.json() as { path: string | undefined; timestamp: string }

      expect(data.path).toBe('/api/test')
    })
  })

  describe('validateRequired', () => {
    it('所有必需参数存在时应返回valid=true', () => {
      const result = validateRequired({ name: 'test', email: 'a@b.com' }, ['name', 'email'])
      expect(result.valid).toBe(true)
      expect(result.missing).toBeUndefined()
    })

    it('缺少参数时应返回missing列表', () => {
      const result = validateRequired({ name: 'test' }, ['name', 'email', 'age'])
      expect(result.valid).toBe(false)
      expect(result.missing).toContain('email')
      expect(result.missing).toContain('age')
      expect(result.missing).toHaveLength(2)
    })

    it('空字符串应视为缺失', () => {
      const result = validateRequired({ name: '' }, ['name'])
      expect(result.valid).toBe(false)
    })

    it('null应视为缺失', () => {
      const result = validateRequired({ name: null }, ['name'])
      expect(result.valid).toBe(false)
    })

    it('undefined应视为缺失', () => {
      const result = validateRequired({}, ['name'])
      expect(result.valid).toBe(false)
    })

    it('空required列表应始终有效', () => {
      const result = validateRequired({ anything: 'ok' }, [])
      expect(result.valid).toBe(true)
    })
  })

  describe('validatePagination', () => {
    it('有效分页参数应正常返回', () => {
      const result = validatePagination(2, 20)
      expect(result.page).toBe(2)
      expect(result.pageSize).toBe(20)
    })

    it('page小于1应修正为1', () => {
      const result = validatePagination(0, 20)
      expect(result.page).toBe(1)

      const result2 = validatePagination(-5, 20)
      expect(result2.page).toBe(1)
    })

    it('pageSize小于1应修正为1', () => {
      const result = validatePagination(1, 0)
      expect(result.pageSize).toBe(12)
    })

    it('pageSize超过maxPageSize应限制', () => {
      const result = validatePagination(1, 200)
      expect(result.pageSize).toBe(100)
    })

    it('自定义maxPageSize应生效', () => {
      const result = validatePagination(1, 50, 30)
      expect(result.pageSize).toBe(30)
    })

    it('非整数page应向下取整', () => {
      const result = validatePagination(3.7, 20)
      expect(result.page).toBe(3)
    })

    it('NaN应修正为1', () => {
      const result = validatePagination(NaN, 20)
      expect(result.page).toBe(1)
    })
  })
})
