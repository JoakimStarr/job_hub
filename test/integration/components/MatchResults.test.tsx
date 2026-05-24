// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import MatchResults from '@/components/MatchResults'
import type { MatchResult } from '@/lib/resume-types'

vi.mock('@/lib/score-engine', () => ({
  scoreEngine: {
    getMatchLevel: vi.fn((score: number) => {
      if (score >= 85) return '冲刺岗'
      if (score >= 70) return '匹配岗'
      if (score >= 55) return '潜力岗'
      return '挑战岗'
    }),
    getMatchColor: vi.fn((score: number) => {
      if (score >= 85) return '#10b981'
      if (score >= 70) return '#3b82f6'
      if (score >= 55) return '#f59e0b'
      return '#ef4444'
    }),
  },
}))

const createMockMatchResult = (overrides: Partial<MatchResult> = {}): MatchResult => ({
  job: {
    id: 1,
    title: '高级数据分析师',
    company: '某科技公司',
    location: '北京',
    salary: '25-40K',
    description: '负责数据分析和建模工作',
    source: 'boss直聘',
    industry: '互联网',
    education: '硕士及以上学历',
    experience: '3-5年',
    tags: 'Python,SQL,机器学习',
    created_at: '2026-01-15T10:00:00Z',
  },
  score: {
    total: 88,
    breakdown: {
      skills: 25,
      education: 18,
      major: 12,
      location: 9,
      experience: 13,
      industry: 8,
    },
    matchedFields: ['Python', 'SQL', '机器学习', '数据分析'],
    gaps: ['缺乏Spark经验'],
    risks: [],
  },
  rank: 1,
  ...overrides,
})

describe('MatchResults 组件', () => {
  const mockOnViewDetail = vi.fn()
  const mockOnExportReport = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('空状态渲染', () => {
    it('当没有匹配结果时应该显示空状态提示', () => {
      render(<MatchResults matches={[]} onViewDetail={mockOnViewDetail} />)

      expect(screen.getByText(/暂无匹配结果/)).toBeInTheDocument()
    })

    it('空状态时不应该显示统计卡片和列表', () => {
      render(<MatchResults matches={[]} onViewDetail={mockOnViewDetail} />)

      expect(screen.queryByText(/冲刺岗/)).not.toBeInTheDocument()
      expect(screen.queryByText(/匹配岗/)).not.toBeInTheDocument()
      expect(screen.queryByText(/潜力岗/)).not.toBeInTheDocument()
      expect(screen.queryByText(/挑战岗/)).not.toBeInTheDocument()
    })
  })

  describe('有数据时的渲染', () => {
    it('应该显示匹配结果标题和数量统计', () => {
      const matches = [createMockMatchResult(), createMockMatchResult({ rank: 2 })]
      render(<MatchResults matches={matches} onViewDetail={mockOnViewDetail} />)

      expect(screen.getByText(/匹配结果/)).toBeInTheDocument()
      expect(screen.getByText(/找到 2 个匹配岗位/)).toBeInTheDocument()
    })

    it('应该正确显示每个匹配卡片的详细信息', () => {
      const match = createMockMatchResult()
      render(<MatchResults matches={[match]} onViewDetail={mockOnViewDetail} />)

      expect(screen.getByText('#1')).toBeInTheDocument()
      expect(screen.getByText('高级数据分析师')).toBeInTheDocument()
      expect(screen.getByText('某科技公司')).toBeInTheDocument()
      expect(screen.getByText('北京')).toBeInTheDocument()
      expect(screen.getByText('25-40K')).toBeInTheDocument()
    })
  })

  describe('分数显示与颜色分级', () => {
    it('应该显示正确的分数值', () => {
      const match = createMockMatchResult({ score: { ...createMockMatchResult().score, total: 88 } })
      render(<MatchResults matches={[match]} onViewDetail={mockOnViewDetail} />)

      expect(screen.getAllByText('88').length).toBeGreaterThan(0)
    })

    it('高分数(>=85)应该在DOM中包含冲刺岗文本', () => {
      const match = createMockMatchResult({ score: { ...createMockMatchResult().score, total: 90 } })
      const { container } = render(<MatchResults matches={[match]} onViewDetail={mockOnViewDetail} />)

      expect(container.textContent).toContain('冲刺岗')
      expect(container.textContent).toContain('90')
    })

    it('中等分数(70-84)应该在DOM中包含匹配岗文本', () => {
      const match = createMockMatchResult({ score: { ...createMockMatchResult().score, total: 75 } })
      const { container } = render(<MatchResults matches={[match]} onViewDetail={mockOnViewDetail} />)

      expect(container.textContent).toContain('匹配岗')
      expect(container.textContent).toContain('75')
    })

    it('较低分数(55-69)应该在DOM中包含潜力岗文本', () => {
      const match = createMockMatchResult({ score: { ...createMockMatchResult().score, total: 60 } })
      const { container } = render(<MatchResults matches={[match]} onViewDetail={mockOnViewDetail} />)

      expect(container.textContent).toContain('潜力岗')
      expect(container.textContent).toContain('60')
    })

    it('低分数(<55)应该在DOM中包含挑战岗文本', () => {
      const match = createMockMatchResult({ score: { ...createMockMatchResult().score, total: 45 } })
      const { container } = render(<MatchResults matches={[match]} onViewDetail={mockOnViewDetail} />)

      expect(container.textContent).toContain('挑战岗')
      expect(container.textContent).toContain('45')
    })
  })

  describe('操作按钮交互', () => {
    it('提供onExportReport时应该显示导出报告按钮', () => {
      const match = createMockMatchResult()
      render(
        <MatchResults 
          matches={[match]} 
          onViewDetail={mockOnViewDetail}
          onExportReport={mockOnExportReport}
        />
      )

      expect(screen.getAllByRole('button', { name: /导出报告/ }).length).toBeGreaterThan(0)
    })

    it('不提供onExportReport时不应该显示导出报告按钮', () => {
      const match = createMockMatchResult()
      render(<MatchResults matches={[match]} onViewDetail={mockOnViewDetail} />)

      expect(screen.queryByRole('button', { name: /导出报告/ })).not.toBeInTheDocument()
    })
  })

  describe('匹配项和能力缺口显示', () => {
    it('应该显示匹配项标签', () => {
      const match = createMockMatchResult({
        score: {
          ...createMockMatchResult().score,
          matchedFields: ['Python', 'SQL', '机器学习'],
        }
      })
      render(<MatchResults matches={[match]} onViewDetail={mockOnViewDetail} />)

      expect(screen.getByText(/匹配项:/)).toBeInTheDocument()
      expect(screen.getByText('Python')).toBeInTheDocument()
      expect(screen.getByText('SQL')).toBeInTheDocument()
      expect(screen.getByText('机器学习')).toBeInTheDocument()
    })

    it('应该显示能力缺口标签', () => {
      const match = createMockMatchResult({
        score: {
          ...createMockMatchResult().score,
          gaps: ['缺乏Spark经验', '缺少分布式计算经验'],
        }
      })
      render(<MatchResults matches={[match]} onViewDetail={mockOnViewDetail} />)

      expect(screen.getByText(/能力缺口:/)).toBeInTheDocument()
      expect(screen.getByText('缺乏Spark经验')).toBeInTheDocument()
      expect(screen.getByText('缺少分布式计算经验')).toBeInTheDocument()
    })

    it('没有匹配项时不应该显示匹配项区域', () => {
      const match = createMockMatchResult({
        score: {
          ...createMockMatchResult().score,
          matchedFields: [],
        }
      })
      render(<MatchResults matches={[match]} onViewDetail={mockOnViewDetail} />)

      expect(screen.queryByText(/匹配项:/)).not.toBeInTheDocument()
    })
  })

  describe('快照测试', () => {
    it('有数据时的快照应该匹配', () => {
      const matches = [
        createMockMatchResult(),
        createMockMatchResult({ 
          score: { ...createMockMatchResult().score, total: 72 },
          job: { ...createMockMatchResult().job, id: 2, title: '数据工程师' },
          rank: 2
        }),
      ]
      const { container } = render(
        <MatchResults 
          matches={matches} 
          onViewDetail={mockOnViewDetail}
          onExportReport={mockOnExportReport}
        />
      )
      expect(container).toMatchSnapshot()
    })

    it('空状态的快照应该匹配', () => {
      const { container } = render(<MatchResults matches={[]} onViewDetail={mockOnViewDetail} />)
      expect(container).toMatchSnapshot()
    })
  })
})
