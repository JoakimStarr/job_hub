import { describe, it, expect } from 'vitest'
import {
  APP_NAME,
  APP_TAGLINE,
  APP_VERSION,
  SOURCE_NAME_MAP,
  NAV_ITEMS,
  ROUTE_TITLES,
  DEBOUNCE_MS,
  DEFAULT_PAGE_SIZE,
  FAVORITES_PAGE_SIZE,
  MAX_MATCH_RESULTS,
  SCORE_THRESHOLDS,
  DIAGNOSIS_SCORE_LEVELS,
} from '@/lib/constants'

describe('Constants - 常量定义完整性', () => {
  describe('应用基础常量', () => {
    it('APP_NAME应是非空字符串', () => {
      expect(APP_NAME).toBeDefined()
      expect(typeof APP_NAME).toBe('string')
      expect(APP_NAME.length).toBeGreaterThan(0)
    })

    it('APP_TAGLINE应是非空字符串', () => {
      expect(APP_TAGLINE).toBeDefined()
      expect(typeof APP_TAGLINE).toBe('string')
      expect(APP_TAGLINE.length).toBeGreaterThan(0)
    })

    it('APP_VERSION应以v开头', () => {
      expect(APP_VERSION).toMatch(/^v\d+/)
    })
  })

  describe('SOURCE_NAME_MAP', () => {
    it('应是有效的Record映射', () => {
      expect(SOURCE_NAME_MAP).toBeDefined()
      expect(typeof SOURCE_NAME_MAP).toBe('object')
    })

    it('应包含所有已知的数据源', () => {
      const expectedSources = ['swufe', 'dufe', 'sufe', 'jxufe', 'cufe', 'smartedu', 'zuel', 'neu', 'uibe']
      for (const source of expectedSources) {
        expect(SOURCE_NAME_MAP[source]).toBeDefined()
        expect(typeof SOURCE_NAME_MAP[source]).toBe('string')
      }
    })

    it('所有源名称应为中文字符串且不为空', () => {
      for (const [, name] of Object.entries(SOURCE_NAME_MAP)) {
        expect(name.length).toBeGreaterThan(0)
      }
    })

    it('源代码键名应为小写英文', () => {
      for (const key of Object.keys(SOURCE_NAME_MAP)) {
        expect(key).toMatch(/^[a-z]+$/)
      }
    })
  })

  describe('NAV_ITEMS导航项', () => {
    it('应是非空数组', () => {
      expect(Array.isArray(NAV_ITEMS)).toBe(true)
      expect(NAV_ITEMS.length).toBeGreaterThan(0)
    })

    it('每个导航项应包含必要字段', () => {
      for (const item of NAV_ITEMS) {
        expect(item).toHaveProperty('key')
        expect(item).toHaveProperty('label')
        expect(item).toHaveProperty('href')
        expect(item).toHaveProperty('description')
        expect(typeof item.key).toBe('string')
        expect(typeof item.label).toBe('string')
        expect(typeof item.href).toBe('string')
        expect(typeof item.description).toBe('string')
      }
    })

    it('导航项key应唯一', () => {
      const keys = NAV_ITEMS.map(item => item.key)
      const uniqueKeys = new Set(keys)
      expect(uniqueKeys.size).toBe(keys.length)
    })

    it('导航项href应唯一', () => {
      const hrefs = NAV_ITEMS.map(item => item.href)
      const uniqueHrefs = new Set(hrefs)
      expect(uniqueHrefs.size).toBe(hrefs.length)
    })

    it('guestVisible项应对游客可见', () => {
      const guestItems = NAV_ITEMS.filter(item => item.guestVisible)
      expect(guestItems.length).toBeGreaterThanOrEqual(2)
    })

    it('需要权限的项应有permission属性', () => {
      const permissionItems = NAV_ITEMS.filter(item => item.permission)
      for (const item of permissionItems) {
        expect(typeof item.permission).toBe('string')
      }
    })
  })

  describe('ROUTE_TITLES路由标题', () => {
    it('应包含首页标题', () => {
      expect(ROUTE_TITLES['/']).toBe('首页')
    })

    it('应包含所有NAV_ITEMS中定义的路由', () => {
      for (const navItem of NAV_ITEMS) {
        expect(ROUTE_TITLES[navItem.href]).toBeDefined()
      }
    })

    it('所有标题值应为非空字符串', () => {
      for (const [, title] of Object.entries(ROUTE_TITLES)) {
        expect(title.length).toBeGreaterThan(0)
      }
    })
  })

  describe('API相关常量', () => {
    it('DEBOUNCE_MS应为正整数', () => {
      expect(DEBOUNCE_MS).toBeGreaterThan(0)
      expect(Number.isInteger(DEBOUNCE_MS)).toBe(true)
    })

    it('DEFAULT_PAGE_SIZE应为合理值', () => {
      expect(DEFAULT_PAGE_SIZE).toBeGreaterThan(0)
      expect(DEFAULT_PAGE_SIZE).toBeLessThanOrEqual(100)
    })

    it('FAVORITES_PAGE_SIZE应为正整数', () => {
      expect(FAVORITES_PAGE_SIZE).toBeGreaterThan(0)
    })

    it('MAX_MATCH_RESULTS应大于DEFAULT_PAGE_SIZE', () => {
      expect(MAX_MATCH_RESULTS).toBeGreaterThan(DEFAULT_PAGE_SIZE)
    })
  })

  describe('SCORE_THRESHOLDS分数阈值', () => {
    it('应包含SPRINT/MATCH/POTENTIAL三个等级', () => {
      expect(SCORE_THRESHOLDS).toHaveProperty('SPRINT')
      expect(SCORE_THRESHOLDS).toHaveProperty('MATCH')
      expect(SCORE_THRESHOLDS).toHaveProperty('POTENTIAL')
    })

    it('SPRINT阈值应最高', () => {
      expect(SCORE_THRESHOLDS.SPRINT).toBeGreaterThan(SCORE_THRESHOLDS.MATCH)
      expect(SCORE_THRESHOLDS.MATCH).toBeGreaterThan(SCORE_THRESHOLDS.POTENTIAL)
    })

    it('所有阈值应在0-100范围内', () => {
      expect(SCORE_THRESHOLDS.SPRINT).toBeGreaterThanOrEqual(0)
      expect(SCORE_THRESHOLDS.SPRINT).toBeLessThanOrEqual(100)
      expect(SCORE_THRESHOLDS.MATCH).toBeGreaterThanOrEqual(0)
      expect(SCORE_THRESHOLDS.MATCH).toBeLessThanOrEqual(100)
      expect(SCORE_THRESHOLDS.POTENTIAL).toBeGreaterThanOrEqual(0)
      expect(SCORE_THRESHOLDS.POTENTIAL).toBeLessThanOrEqual(100)
    })
  })

  describe('DIAGNOSIS_SCORE_LEVELS诊断分数等级', () => {
    it('应是非空数组', () => {
      expect(Array.isArray(DIAGNOSIS_SCORE_LEVELS)).toBe(true)
      expect(DIAGNOSIS_SCORE_LEVELS.length).toBeGreaterThan(0)
    })

    it('应按min值降序排列', () => {
      for (let i = 1; i < DIAGNOSIS_SCORE_LEVELS.length; i++) {
        expect(DIAGNOSIS_SCORE_LEVELS[i - 1].min).toBeGreaterThanOrEqual(DIAGNOSIS_SCORE_LEVELS[i].min)
      }
    })

    it('colorKey应为有效的颜色标识', () => {
      const validColors = ['green', 'blue', 'yellow', 'red']
      for (const level of DIAGNOSIS_SCORE_LEVELS) {
        expect(validColors).toContain(level.colorKey)
      }
    })

    it('min值范围应在0-100之间', () => {
      for (const level of DIAGNOSIS_SCORE_LEVELS) {
        expect(level.min).toBeGreaterThanOrEqual(0)
        expect(level.min).toBeLessThanOrEqual(100)
      }
    })

    it('最低等级min应为0', () => {
      const lowest = DIAGNOSIS_SCORE_LEVELS[DIAGNOSIS_SCORE_LEVELS.length - 1]
      expect(lowest.min).toBe(0)
    })
  })
})
