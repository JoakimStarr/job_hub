import { expect, vi } from 'vitest'

export async function waitFor<T>(
  callback: () => T | Promise<T>,
  options?: {
    timeout?: number
    interval?: number
  }
): Promise<T> {
  const { timeout = 5000, interval = 100 } = options || {}
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    try {
      const result = await callback()
      return result
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, interval))
    }
  }

  throw new Error(`waitFor timed out after ${timeout}ms`)
}

export function setupFakeTimers() {
  vi.useFakeTimers()
  
  return {
    advanceTime: (ms: number) => vi.advanceTimersByTime(ms),
    clearTimers: () => vi.useRealTimers(),
  }
}

export function createSpyLogger() {
  return {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }
}

expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      }
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      }
    }
  },
})

declare module 'vitest' {
  interface Assertion<T = any> {
    toBeWithinRange(floor: number, ceiling: number): T
  }
}

export function measurePerformance(fn: () => void): { elapsedMs: number } {
  const start = performance.now()
  fn()
  const end = performance.now()
  return { elapsedMs: end - start }
}

export async function measureAsyncPerformance(fn: () => Promise<void>): Promise<{ elapsedMs: number }> {
  const start = performance.now()
  await fn()
  const end = performance.now()
  return { elapsedMs: end - start }
}

export function generateRandomString(length: number = 10): string {
  return Math.random().toString(36).substring(2, length + 2)
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
