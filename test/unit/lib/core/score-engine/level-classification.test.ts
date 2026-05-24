import { describe, it, expect } from 'vitest'
import { ScoreEngine } from '@/lib/score-engine'

describe('ScoreEngine - 等级分类 (getMatchLevel)', () => {
  let scoreEngine: ScoreEngine

  beforeEach(() => {
    scoreEngine = new ScoreEngine()
  })

  describe('冲刺岗边界值测试 (score >= 85)', () => {
    it('分数100应该返回"冲刺岗"', () => {
      const result = scoreEngine.getMatchLevel(100)
      expect(result).toBe('冲刺岗')
    })

    it('分数85应该返回"冲刺岗"（精确边界值）', () => {
      const result = scoreEngine.getMatchLevel(85)
      expect(result).toBe('冲刺岗')
    })

    it('分数86应该返回"冲刺岗"', () => {
      const result = scoreEngine.getMatchLevel(86)
      expect(result).toBe('冲刺岗')
    })

    it('分数99.99应该返回"冲刺岗"', () => {
      const result = scoreEngine.getMatchLevel(99.99)
      expect(result).toBe('冲刺岗')
    })

    it('分数90应该返回"冲刺岗"', () => {
      const result = scoreEngine.getMatchLevel(90)
      expect(result).toBe('冲刺岗')
    })
  })

  describe('匹配岗边界值测试 (70 <= score < 85)', () => {
    it('分数84.99应该返回"匹配岗"（冲刺岗下界-0.01）', () => {
      const result = scoreEngine.getMatchLevel(84.99)
      expect(result).toBe('匹配岗')
    })

    it('分数84应该返回"匹配岗"', () => {
      const result = scoreEngine.getMatchLevel(84)
      expect(result).toBe('匹配岗')
    })

    it('分数70应该返回"匹配岗"（精确边界值）', () => {
      const result = scoreEngine.getMatchLevel(70)
      expect(result).toBe('匹配岗')
    })

    it('分数75应该返回"匹配岗"', () => {
      const result = scoreEngine.getMatchLevel(75)
      expect(result).toBe('匹配岗')
    })

    it('分数80应该返回"匹配岗"', () => {
      const result = scoreEngine.getMatchLevel(80)
      expect(result).toBe('匹配岗')
    })
  })

  describe('潜力岗边界值测试 (55 <= score < 70)', () => {
    it('分数69.99应该返回"潜力岗"（匹配岗下界-0.01）', () => {
      const result = scoreEngine.getMatchLevel(69.99)
      expect(result).toBe('潜力岗')
    })

    it('分数55应该返回"潜力岗"（精确边界值）', () => {
      const result = scoreEngine.getMatchLevel(55)
      expect(result).toBe('潜力岗')
    })

    it('分数60应该返回"潜力岗"', () => {
      const result = scoreEngine.getMatchLevel(60)
      expect(result).toBe('潜力岗')
    })

    it('分数65应该返回"潜力岗"', () => {
      const result = scoreEngine.getMatchLevel(65)
      expect(result).toBe('潜力岗')
    })
  })

  describe('挑战岗边界值测试 (score < 55)', () => {
    it('分数54.99应该返回"挑战岗"（潜力岗下界-0.01）', () => {
      const result = scoreEngine.getMatchLevel(54.99)
      expect(result).toBe('挑战岗')
    })

    it('分数0应该返回"挑战岗"', () => {
      const result = scoreEngine.getMatchLevel(0)
      expect(result).toBe('挑战岗')
    })

    it('分数-1应该返回"挑战岗"（负数处理）', () => {
      const result = scoreEngine.getMatchLevel(-1)
      expect(result).toBe('挑战岗')
    })

    it('分数30应该返回"挑战岗"', () => {
      const result = scoreEngine.getMatchLevel(30)
      expect(result).toBe('挑战岗')
    })

    it('分数54应该返回"挑战岗"', () => {
      const result = scoreEngine.getMatchLevel(54)
      expect(result).toBe('挑战岗')
    })
  })
})

describe('ScoreEngine - 英文等级分类 (getMatchLevelEn)', () => {
  let scoreEngine: ScoreEngine

  beforeEach(() => {
    scoreEngine = new ScoreEngine()
  })

  describe('Sprint Position 边界值 (score >= 85)', () => {
    it('分数100应该返回"Sprint Position"', () => {
      const result = scoreEngine.getMatchLevelEn(100)
      expect(result).toBe('Sprint Position')
    })

    it('分数85应该返回"Sprint Position"', () => {
      const result = scoreEngine.getMatchLevelEn(85)
      expect(result).toBe('Sprint Position')
    })

    it('分数90应该返回"Sprint Position"', () => {
      const result = scoreEngine.getMatchLevelEn(90)
      expect(result).toBe('Sprint Position')
    })
  })

  describe('Match Position 边界值 (70 <= score < 85)', () => {
    it('分数84.99应该返回"Match Position"', () => {
      const result = scoreEngine.getMatchLevelEn(84.99)
      expect(result).toBe('Match Position')
    })

    it('分数70应该返回"Match Position"', () => {
      const result = scoreEngine.getMatchLevelEn(70)
      expect(result).toBe('Match Position')
    })

    it('分数75应该返回"Match Position"', () => {
      const result = scoreEngine.getMatchLevelEn(75)
      expect(result).toBe('Match Position')
    })
  })

  describe('Potential Position 边界值 (55 <= score < 70)', () => {
    it('分数69.99应该返回"Potential Position"', () => {
      const result = scoreEngine.getMatchLevelEn(69.99)
      expect(result).toBe('Potential Position')
    })

    it('分数55应该返回"Potential Position"', () => {
      const result = scoreEngine.getMatchLevelEn(55)
      expect(result).toBe('Potential Position')
    })

    it('分数60应该返回"Potential Position"', () => {
      const result = scoreEngine.getMatchLevelEn(60)
      expect(result).toBe('Potential Position')
    })
  })

  describe('Challenge Position 边界值 (score < 55)', () => {
    it('分数54.99应该返回"Challenge Position"', () => {
      const result = scoreEngine.getMatchLevelEn(54.99)
      expect(result).toBe('Challenge Position')
    })

    it('分数0应该返回"Challenge Position"', () => {
      const result = scoreEngine.getMatchLevelEn(0)
      expect(result).toBe('Challenge Position')
    })

    it('分数-1应该返回"Challenge Position"', () => {
      const result = scoreEngine.getMatchLevelEn(-1)
      expect(result).toBe('Challenge Position')
    })
  })

  describe('中英文等级对应关系验证', () => {
    it('同一分数的中英文等级应该语义一致', () => {
      const testScores = [100, 85, 84.99, 70, 69.99, 55, 54.99, 0]

      for (const score of testScores) {
        const cnLevel = scoreEngine.getMatchLevel(score)
        const enLevel = scoreEngine.getMatchLevelEn(score)

        if (cnLevel === '冲刺岗') {
          expect(enLevel).toBe('Sprint Position')
        } else if (cnLevel === '匹配岗') {
          expect(enLevel).toBe('Match Position')
        } else if (cnLevel === '潜力岗') {
          expect(enLevel).toBe('Potential Position')
        } else if (cnLevel === '挑战岗') {
          expect(enLevel).toBe('Challenge Position')
        }
      }
    })

    it('所有可能的分数都应该返回有效的等级字符串', () => {
      for (let i = -10; i <= 110; i += 0.5) {
        const cnResult = scoreEngine.getMatchLevel(i)
        const enResult = scoreEngine.getMatchLevelEn(i)

        expect(['冲刺岗', '匹配岗', '潜力岗', '挑战岗']).toContain(cnResult)
        expect(['Sprint Position', 'Match Position', 'Potential Position', 'Challenge Position']).toContain(enResult)
      }
    })
  })
})
