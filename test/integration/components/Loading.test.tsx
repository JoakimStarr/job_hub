// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import {
  LoadingSpinner,
  LoadingOverlay,
  UnifiedSkeletonCard,
  SkeletonTable,
  PageLoading,
} from '@/components/Loading'

describe('Loading 组件', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })
})

describe('LoadingSpinner 组件', () => {
  it('应该渲染加载动画元素', () => {
    render(<LoadingSpinner />)

    const spinner = document.querySelector('.loading-orb')
    expect(spinner).toBeInTheDocument()
  })

  it('默认尺寸应该是medium (40px)', () => {
    render(<LoadingSpinner />)

    const spinner = document.querySelector('.loading-orb') as HTMLElement
    expect(spinner.style.width).toBe('40px')
    expect(spinner.style.height).toBe('40px')
  })

  it('small尺寸应该是24px', () => {
    render(<LoadingSpinner size="small" />)

    const spinner = document.querySelector('.loading-orb') as HTMLElement
    expect(spinner.style.width).toBe('24px')
    expect(spinner.style.height).toBe('24px')
  })

  it('large尺寸应该是56px', () => {
    render(<LoadingSpinner size="large" />)

    const spinner = document.querySelector('.loading-orb') as HTMLElement
    expect(spinner.style.width).toBe('56px')
    expect(spinner.style.height).toBe('56px')
  })

  it('不提供text时不应该显示文本元素', () => {
    const { container } = render(<LoadingSpinner />)

    expect(container.querySelector('.loading-text')).not.toBeInTheDocument()
  })

  it('提供text时应该显示加载文本', () => {
    render(<LoadingSpinner text="正在加载数据..." />)

    expect(screen.getByText('正在加载数据...')).toBeInTheDocument()
  })

  it('提供color时应该应用自定义颜色', () => {
    render(<LoadingSpinner color="#ff0000" />)

    const spinner = document.querySelector('.loading-orb') as HTMLElement
    expect(spinner.style.borderTopColor).toBe('rgb(255, 0, 0)')
  })

  it('快照测试 - 默认状态', () => {
    const { container } = render(<LoadingSpinner />)
    expect(container).toMatchSnapshot()
  })

  it('快照测试 - 带文本和自定义颜色', () => {
    const { container } = render(
      <LoadingSpinner size="large" color="#3b82f6" text="请稍候..." />
    )
    expect(container).toMatchSnapshot()
  })
})

describe('LoadingOverlay 组件', () => {
  it('visible=true时应该显示遮罩层', () => {
    render(<LoadingOverlay visible={true} />)

    expect(document.querySelector('.loading-overlay')).toBeInTheDocument()
  })

  it('visible=false时不应该渲染任何内容', () => {
    const { container } = render(<LoadingOverlay visible={false} />)

    expect(container.innerHTML).toBe('')
  })

  it('应该显示默认的加载文本', () => {
    render(<LoadingOverlay visible={true} />)

    expect(screen.getByText('加载中...')).toBeInTheDocument()
  })

  it('应该显示自定义的加载文本', () => {
    render(<LoadingOverlay visible={true} text="正在提交数据..." />)

    expect(screen.getByText('正在提交数据...')).toBeInTheDocument()
  })

  it('应该包含一个大的LoadingSpinner', () => {
    render(<LoadingOverlay visible={true} />)

    const spinner = document.querySelector('.loading-orb') as HTMLElement
    expect(spinner).toBeInTheDocument()
    expect(spinner.style.width).toBe('56px')
  })

  it('快照测试 - 显示状态', () => {
    const { container } = render(<LoadingOverlay visible={true} text="处理中..." />)
    expect(container).toMatchSnapshot()
  })
})

describe('UnifiedSkeletonCard 组件', () => {
  it('默认应该渲染3个骨架卡片', () => {
    const { container } = render(<UnifiedSkeletonCard />)

    const skeletonCards = container.querySelectorAll('.job-card.skeleton')
    expect(skeletonCards).toHaveLength(3)
  })

  it('应该根据count参数渲染正确数量的骨架卡片', () => {
    const { container } = render(<UnifiedSkeletonCard count={5} />)

    const skeletonCards = container.querySelectorAll('.job-card.skeleton')
    expect(skeletonCards).toHaveLength(5)
  })

  it('每个骨架卡片应该有skeleton类名', () => {
    const { container } = render(<UnifiedSkeletonCard count={2} />)

    const skeletonCards = container.querySelectorAll('.job-card.skeleton')
    expect(skeletonCards).toHaveLength(2)
  })

  it('count=1时应该只渲染1个骨架卡片', () => {
    const { container } = render(<UnifiedSkeletonCard count={1} />)

    const skeletonCards = container.querySelectorAll('.job-card.skeleton')
    expect(skeletonCards).toHaveLength(1)
  })

  it('快照测试 - 默认数量', () => {
    const { container } = render(<UnifiedSkeletonCard />)
    expect(container).toMatchSnapshot()
  })

  it('快照测试 - 自定义数量', () => {
    const { container } = render(<UnifiedSkeletonCard count={4} />)
    expect(container).toMatchSnapshot()
  })
})

describe('SkeletonTable 组件', () => {
  it('应该渲染表格骨架结构', () => {
    render(<SkeletonTable />)

    expect(document.querySelector('.skeleton-table')).toBeInTheDocument()
  })

  it('默认应该渲染5行4列', () => {
    const { container } = render(<SkeletonTable />)

    const rows = container.querySelectorAll('.skeleton-row')
    expect(rows).toHaveLength(5)

    const headerCells = container.querySelectorAll('.skeleton-header-cell')
    expect(headerCells).toHaveLength(4)
  })

  it('应该渲染表头行', () => {
    render(<SkeletonTable />)

    expect(document.querySelector('.skeleton-header-row')).toBeInTheDocument()
  })

  it('应该支持自定义行数和列数', () => {
    const { container } = render(<SkeletonTable rows={3} columns={6} />)

    const rows = container.querySelectorAll('.skeleton-row')
    expect(rows).toHaveLength(3)

    const headerCells = container.querySelectorAll('.skeleton-header-cell')
    expect(headerCells).toHaveLength(6)
  })

  it('快照测试 - 默认配置', () => {
    const { container } = render(<SkeletonTable />)
    expect(container).toMatchSnapshot()
  })
})

describe('PageLoading 组件', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('初始状态下不应该显示任何内容', () => {
    const { container } = render(<PageLoading delay={200} />)

    expect(container.innerHTML).toBe('')
  })

  it('延迟后应该显示页面加载组件', () => {
    const { container } = render(<PageLoading delay={200} />)

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(screen.getByText('页面加载中...')).toBeInTheDocument()
  })

  it('应该包含一个大的LoadingSpinner', () => {
    render(<PageLoading delay={100} />)

    act(() => {
      vi.advanceTimersByTime(100)
    })

    const spinner = document.querySelector('.loading-orb') as HTMLElement
    expect(spinner).toBeInTheDocument()
    expect(spinner.style.width).toBe('56px')
  })

  it('在延迟完成前不应该显示内容', () => {
    render(<PageLoading delay={500} />)

    act(() => {
      vi.advanceTimersByTime(499)
    })

    expect(screen.queryByText('页面加载中...')).not.toBeInTheDocument()
  })

  it('支持自定义延迟时间', () => {
    render(<PageLoading delay={50} />)

    act(() => {
      vi.advanceTimersByTime(49)
    })
    expect(screen.queryByText('页面加载中...')).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.getByText('页面加载中...')).toBeInTheDocument()
  })

  it('快照测试 - 加载完成后', () => {
    const { container } = render(<PageLoading delay={100} />)
    
    act(() => {
      vi.advanceTimersByTime(100)
    })
    
    expect(container).toMatchSnapshot()
  })
})
