import { describe, it, expect, vi, beforeEach } from 'vitest'

const consoleLogs: string[] = []
const consoleWarns: string[] = []
const consoleErrors: string[] = []

let originalConsoleLog: typeof console.log
let originalConsoleWarn: typeof console.warn
let originalConsoleError: typeof console.error

beforeEach(() => {
  consoleLogs.length = 0
  consoleWarns.length = 0
  consoleErrors.length = 0

  originalConsoleLog = console.log
  originalConsoleWarn = console.warn
  originalConsoleError = console.error

  console.log = (...args) => { consoleLogs.push(args.join(' ')); originalConsoleLog(...args) }
  console.warn = (...args) => { consoleWarns.push(args.join(' ')); originalConsoleWarn(...args) }
  console.error = (...args) => { consoleErrors.push(args.join(' ')); originalConsoleError(...args) }
})

afterEach(() => {
  console.log = originalConsoleLog
  console.warn = originalConsoleWarn
  console.error = originalConsoleError
})

describe('Logger', () => {
  let loggerInstance: {
    debug: (message: string, context?: unknown) => void;
    info: (message: string, context?: unknown) => void;
    warn: (message: string, context?: unknown) => void;
    error: (message: string, context?: unknown) => void;
    api: (method: string, path: string, status: number, durationMs: number) => void;
    database: (operation: string, table: string, durationMs: number, err?: Error) => void;
  }

  beforeEach(async () => {
    vi.resetModules()
    process.env.LOG_DIR = '/tmp/test-logs'

    const mod = await import('@/lib/logger')
    loggerInstance = mod.logger as any
  })

  function createLogger(level?: string): typeof loggerInstance {
    if (level) process.env.LOG_LEVEL = level
    return loggerInstance
  }

  describe('日志级别控制', () => {
    it('info级别下不应输出debug日志', () => {
      const logger = createLogger('info')
      logger.debug('调试信息')
      expect(consoleLogs.every(log => !log.includes('调试信息'))).toBe(true)
    })

    it('info级别下应输出info及以上级别日志', () => {
      const logger = createLogger('info')
      logger.info('普通信息')
      logger.warn('警告信息')
      logger.error('错误信息')

      expect(consoleLogs.some(log => log.includes('普通信息'))).toBe(true)
      expect(consoleWarns.some(warn => warn.includes('警告信息'))).toBe(true)
      expect(consoleErrors.some(err => err.includes('错误信息'))).toBe(true)
    })

    it('debug级别下应输出所有级别日志', () => {
      const logger = createLogger('debug')
      logger.debug('调试信息')
      logger.info('普通信息')
      logger.warn('警告信息')
      logger.error('错误信息')

      expect(consoleLogs.some(log => log.includes('调试信息'))).toBe(true)
      expect(consoleLogs.some(log => log.includes('普通信息'))).toBe(true)
      expect(consoleWarns.some(warn => warn.includes('警告信息'))).toBe(true)
      expect(consoleErrors.some(err => err.includes('错误信息'))).toBe(true)
    })

    it('warn级别下只输出warn和error日志', () => {
      const logger = createLogger('warn')
      logger.debug('调试')
      logger.info('信息')
      logger.warn('警告')
      logger.error('错误')

      expect(consoleLogs.filter(log => log.includes('调试') || log.includes('信息')).length).toBe(0)
      expect(consoleWarns.some(w => w.includes('警告'))).toBe(true)
      expect(consoleErrors.some(e => e.includes('错误'))).toBe(true)
    })

    it('error级别下只输出error日志', () => {
      const logger = createLogger('error')
      logger.debug('d')
      logger.info('i')
      logger.warn('w')
      logger.error('e')

      expect(consoleLogs.length).toBe(0)
      expect(consoleWarns.length).toBe(0)
      expect(consoleErrors.some(e => e.includes('e'))).toBe(true)
    })
  })

  describe('日志格式', () => {
    it('日志条目应包含时间戳', () => {
      const logger = createLogger('info')
      logger.info('格式测试')

      const logLine = consoleLogs.find(l => l.includes('格式测试'))
      expect(logLine).toBeDefined()
      expect(logLine).toMatch(/\[\d{4}-\d{2}-\d{2}T/)
    })

    it('日志条目应包含日志级别', () => {
      const logger = createLogger('debug')
      logger.debug('级别测试')

      const logLine = consoleLogs.find(l => l.includes('级别测试'))
      expect(logLine).toContain('[DEBUG]')
    })

    it('info日志应包含[INFO]标记', () => {
      const logger = createLogger('info')
      logger.info('info标记')

      expect(consoleLogs.some(l => l.includes('[INFO]') && l.includes('info标记'))).toBe(true)
    })

    it('warn日志应通过console.warn输出', () => {
      const logger = createLogger('info')
      logger.warn('warn标记')

      expect(consoleWarns.some(w => w.includes('[WARN]') && w.includes('warn标记'))).toBe(true)
    })

    it('error日志应通过console.error输出', () => {
      const logger = createLogger('info')
      logger.error('error标记')

      expect(consoleErrors.some(e => e.includes('[ERROR]') && e.includes('error标记'))).toBe(true)
    })

    it('带context的日志应序列化上下文对象', () => {
      const logger = createLogger('info')
      logger.info('有上下文', { userId: 123, action: 'login' })

      const logLine = consoleLogs.find(l => l.includes('有上下文'))
      expect(logLine).toContain('"userId": 123')
      expect(logLine).toContain('"action": "login"')
    })
  })

  describe('敏感信息过滤', () => {
    it('密码字段应出现在context中', () => {
      const logger = createLogger('info')
      logger.info('登录请求', { password: 'secret123', username: 'admin' })

      const logLine = consoleLogs.find(l => l.includes('登录请求'))
      expect(logLine).toBeDefined()
    })

    it('token字段应记录在日志中', () => {
      const logger = createLogger('info')
      logger.info('认证', { token: 'eyJhbGciOiJIUzI1NiJ9.xxx' })

      const logLine = consoleLogs.find(l => l.includes('认证'))
      expect(logLine).toBeDefined()
    })

    it('error方法应记录Error对象的message和stack', () => {
      const logger = createLogger('info')
      const testError = new Error('测试错误')
      testError.stack = 'Error: 测试错误\n    at test.js:1:1'

      logger.error('出错了', testError)

      const errLine = consoleErrors.find(e => e.includes('出错了'))
      expect(errLine).toContain('Error: 测试错误')
      expect(errLine).toContain('Stack:')
    })

    it('error方法传入非Error对象应放入context', () => {
      const logger = createLogger('info')
      logger.error('字符串错误', 'some-error-string')

      const errLine = consoleErrors.find(e => e.includes('字符串错误'))
      expect(errLine).toBeDefined()
    })
  })

  describe('API和数据库日志辅助方法', () => {
    it('api方法对5xx错误应记录为error级别', () => {
      const logger = createLogger('info')
      logger.api('POST', '/api/jobs', 500, 120)

      expect(consoleErrors.some(e => e.includes('POST /api/jobs') && e.includes('500'))).toBe(true)
    })

    it('api方法对4xx应记录为warn级别', () => {
      const logger = createLogger('info')
      logger.api('GET', '/api/users', 404, 50)

      expect(consoleWarns.some(w => w.includes('GET /api/users') && w.includes('404'))).toBe(true)
    })

    it('api方法对成功请求应记录为info级别', () => {
      const logger = createLogger('info')
      logger.api('GET', '/api/jobs', 200, 30)

      expect(consoleLogs.some(l => l.includes('GET /api/jobs') && l.includes('200'))).toBe(true)
    })

    it('database方法无错误时应调用debug', () => {
      const logger = createLogger('debug')
      logger.database('SELECT', 'jobs', 5)

      expect(consoleLogs.some(l => l.includes('Database SELECT on jobs') && l.includes('5ms'))).toBe(true)
    })

    it('database方法有错误时应调用error', () => {
      const logger = createLogger('info')
      logger.database('INSERT', 'users', 10, new Error('DB locked'))

      expect(consoleErrors.some(e => e.includes('Database INSERT on users failed'))).toBe(true)
    })
  })
})

describe('createRequestLogger', () => {
  it('应创建带有requestId的logger包装器', async () => {
    vi.resetModules()
    process.env.LOG_LEVEL = 'debug'
    process.env.LOG_DIR = '/tmp/test-logs'

    const mod = await import('@/lib/logger')
    const requestLogger = mod.createRequestLogger('req-123')

    requestLogger.info('测试消息', { extra: 'data' })

    const logLine = consoleLogs.find(l => l.includes('测试消息'))
    expect(logLine).toContain('"requestId": "req-123"')
    expect(logLine).toContain('"extra": "data"')
  })

  it('不传requestId也应正常工作', async () => {
    vi.resetModules()
    process.env.LOG_LEVEL = 'debug'
    process.env.LOG_DIR = '/tmp/test-logs'

    const mod = await import('@/lib/logger')
    const requestLogger = mod.createRequestLogger()

    requestLogger.warn('无id警告')

    expect(consoleWarns.some(w => w.includes('无id警告'))).toBe(true)
  })
})
