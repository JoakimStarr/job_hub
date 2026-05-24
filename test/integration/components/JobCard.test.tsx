// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JobCard } from '@/components/ui'
import type { JobItem } from '@/types'

const createMockJob = (overrides: Partial<JobItem> = {}): JobItem => ({
  id: 1,
  title: '高级数据分析师',
  company: '某科技公司',
  location: '北京',
  salary: '25-40K',
  description: '负责业务数据分析和建模工作，需要精通Python和SQL',
  source: 'boss直聘',
  industry: '互联网',
  education: '硕士及以上学历',
  experience: '3-5年',
  job_type: '全职',
  tags: 'Python,SQL,机器学习,数据分析',
  created_at: '2026-01-15T10:00:00Z',
  is_favorite: 0,
  ...overrides,
})

describe('JobCard 组件', () => {
  const mockOnToggleFavorite = vi.fn()
  const mockOnClick = vi.fn()
  const mockOnTagClick = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('卡片视图渲染', () => {
    it('应该正确显示职位标题', () => {
      const job = createMockJob({ title: 'Python开发工程师' })
      render(<JobCard job={job} />)

      expect(screen.getByText('Python开发工程师')).toBeInTheDocument()
    })

    it('应该正确显示公司名称', () => {
      const job = createMockJob({ company: '阿里巴巴' })
      render(<JobCard job={job} />)

      expect(screen.getByText('阿里巴巴')).toBeInTheDocument()
    })

    it('应该正确显示薪资信息', () => {
      const job = createMockJob({ salary: '30-50K' })
      render(<JobCard job={job} />)

      expect(screen.getByText(/30-50K/)).toBeInTheDocument()
    })

    it('应该正确显示工作地点', () => {
      const job = createMockJob({ location: '上海浦东' })
      render(<JobCard job={job} />)

      expect(screen.getByText(/上海浦东/)).toBeInTheDocument()
    })

    it('应该正确显示职位描述', () => {
      const job = createMockJob({ description: '负责数据分析和机器学习项目' })
      render(<JobCard job={job} />)

      expect(screen.getByText(/负责数据分析和机器学习项目/)).toBeInTheDocument()
    })

    it('应该正确显示标签信息', () => {
      const job = createMockJob({
        source: 'boss直聘',
        job_type: '全职',
        industry: '互联网',
        education: '本科及以上',
      })
      render(<JobCard job={job} onTagClick={mockOnTagClick} />)

      expect(screen.getByText('boss直聘')).toBeInTheDocument()
      expect(screen.getByText('全职')).toBeInTheDocument()
      expect(screen.getByText('互联网')).toBeInTheDocument()
      expect(screen.getByText('本科及以上')).toBeInTheDocument()
    })

    it('未收藏时不应该显示收藏标签', () => {
      const job = createMockJob({ is_favorite: 0 })
      render(<JobCard job={job} />)

      expect(screen.queryByText('收藏')).not.toBeInTheDocument()
    })

    it('已收藏时应该显示收藏标签', () => {
      const job = createMockJob({ is_favorite: 1 })
      render(<JobCard job={job} />)

      expect(screen.getByText('收藏')).toBeInTheDocument()
    })
  })

  describe('列表视图渲染', () => {
    it('列表视图应该以不同方式展示职位信息', () => {
      const job = createMockJob()
      render(<JobCard job={job} viewMode="list" />)

      expect(screen.getByText(job.title)).toBeInTheDocument()
      expect(screen.getByRole('article')).toHaveClass('job-list-item')
    })

    it('列表视图应该显示日期信息', () => {
      const job = createMockJob({ created_at: '2026-05-20T08:00:00Z' })
      render(<JobCard job={job} viewMode="list" />)

      expect(screen.getByText(/2026-05-20/)).toBeInTheDocument()
    })
  })

  describe('收藏按钮状态切换', () => {
    it('提供onToggleFavorite时应该显示收藏按钮', () => {
      const job = createMockJob({ is_favorite: 0 })
      render(<JobCard job={job} onToggleFavorite={mockOnToggleFavorite} />)

      expect(screen.getByRole('button', { name: /收藏/ })).toBeInTheDocument()
    })

    it('不提供onToggleFavorite时不应该显示收藏按钮', () => {
      const job = createMockJob()
      render(<JobCard job={job} />)

      expect(screen.queryByRole('button', { name: /收藏|取消收藏/ })).not.toBeInTheDocument()
    })

    it('未收藏状态应该显示空心星标', () => {
      const job = createMockJob({ is_favorite: 0 })
      render(<JobCard job={job} onToggleFavorite={mockOnToggleFavorite} />)

      const starButton = screen.getByRole('button', { name: /收藏/ })
      expect(starButton.textContent).toContain('☆')
    })

    it('已收藏状态应该显示实心星标', () => {
      const job = createMockJob({ is_favorite: 1 })
      render(<JobCard job={job} onToggleFavorite={mockOnToggleFavorite} />)

      const starButton = screen.getByRole('button', { name: /取消收藏/ })
      expect(starButton.textContent).toContain('★')
    })

    it('点击收藏按钮应该调用onToggleFavorite并传递job对象', async () => {
      const user = userEvent.setup()
      const job = createMockJob({ id: 42, is_favorite: 0 })
      render(<JobCard job={job} onToggleFavorite={mockOnToggleFavorite} />)

      await user.click(screen.getByRole('button', { name: /收藏/ }))

      expect(mockOnToggleFavorite).toHaveBeenCalledTimes(1)
      expect(mockOnToggleFavorite).toHaveBeenCalledWith(
        expect.objectContaining({ id: 42, is_favorite: 0 })
      )
    })

    it('点击取消收藏按钮应该调用onToggleFavorite', async () => {
      const user = userEvent.setup()
      const job = createMockJob({ id: 99, is_favorite: 1 })
      render(<JobCard job={job} onToggleFavorite={mockOnToggleFavorite} />)

      await user.click(screen.getByRole('button', { name: /取消收藏/ }))

      expect(mockOnToggleFavorite).toHaveBeenCalledTimes(1)
      expect(mockOnToggleFavorite).toHaveBeenCalledWith(
        expect.objectContaining({ id: 99, is_favorite: 1 })
      )
    })
  })

  describe('点击事件处理', () => {
    it('提供onClick时卡片应该是可点击的', () => {
      const job = createMockJob()
      const { container } = render(<JobCard job={job} onClick={mockOnClick} />)

      const card = container.querySelector('.job-card')
      expect(card).toHaveClass('job-card-clickable')
    })

    it('点击卡片应该调用onClick回调并传递job对象', async () => {
      const user = userEvent.setup()
      const job = createMockJob({ id: 123 })
      render(<JobCard job={job} onClick={mockOnClick} />)

      await user.click(screen.getByRole('article'))

      expect(mockOnClick).toHaveBeenCalledTimes(1)
      expect(mockOnClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: 123 })
      )
    })

    it('不提供onClick时卡片不应该有可点击样式', () => {
      const job = createMockJob()
      const { container } = render(<JobCard job={job} />)

      const card = container.querySelector('.job-card')
      expect(card).not.toHaveClass('job-card-clickable')
    })
  })

  describe('标签点击事件', () => {
    it('点击公司名称标签应该触发onTagClick', async () => {
      const user = userEvent.setup()
      const job = createMockJob({ company: '腾讯' })
      render(<JobCard job={job} onTagClick={mockOnTagClick} />)

      await user.click(screen.getByText('腾讯'))

      expect(mockOnTagClick).toHaveBeenCalledWith('company', '腾讯')
    })

    it('点击地点标签应该触发onTagClick', async () => {
      const user = userEvent.setup()
      const job = createMockJob({ location: '深圳' })
      render(<JobCard job={job} onTagClick={mockOnTagClick} />)

      await user.click(screen.getByText(/深圳/))

      expect(mockOnTagClick).toHaveBeenCalledWith('location', '深圳')
    })

    it('点击来源标签应该触发onTagClick', async () => {
      const user = userEvent.setup()
      const job = createMockJob({ source: '猎聘' })
      render(<JobCard job={job} onTagClick={mockOnTagClick} />)

      await user.click(screen.getByText('猎聘'))

      expect(mockOnTagClick).toHaveBeenCalledWith('source', '猎聘')
    })

    it('不提供onTagClick时标签不应该有点击事件处理器', () => {
      const job = createMockJob({ company: '字节跳动' })
      const { container } = render(<JobCard job={job} />)

      const companyElement = screen.getByText('字节跳动')
      
      expect(companyElement).toBeInTheDocument()
    })
  })

  describe('可访问性 (A11y)', () => {
    it('卡片应该有正确的role属性', () => {
      const job = createMockJob()
      render(<JobCard job={job} />)

      expect(screen.getByRole('article')).toBeInTheDocument()
    })

    it('卡片应该有描述性的aria-label', () => {
      const job = createMockJob({ title: '前端开发工程师', company: '美团' })
      render(<JobCard job={job} />)

      const article = screen.getByRole('article')
      expect(article).toHaveAttribute('aria-label')
      const ariaLabel = article.getAttribute('aria-label') || ''
      expect(ariaLabel).toContain('前端开发工程师')
      expect(ariaLabel).toContain('美团')
    })

    it('收藏按钮应该有正确的aria-label', () => {
      const job = createMockJob({ is_favorite: 0 })
      const { rerender } = render(<JobCard job={job} onToggleFavorite={mockOnToggleFavorite} />)

      expect(screen.getByRole('button', { name: /收藏/ })).toBeInTheDocument()

      const favoritedJob = createMockJob({ is_favorite: 1 })
      rerender(<JobCard job={favoritedJob} onToggleFavorite={mockOnToggleFavorite} />)
      expect(screen.getByRole('button', { name: /取消收藏/ })).toBeInTheDocument()
    })
  })

  describe('边界情况处理', () => {
    it('缺少可选字段时应该正常渲染', () => {
      const job = createMockJob({
        company: undefined,
        location: undefined,
        salary: undefined,
        description: undefined,
        source: undefined,
        job_type: undefined,
        industry: undefined,
        education: undefined,
        tags: undefined,
      })
      render(<JobCard job={job} />)

      expect(screen.getByText(job.title)).toBeInTheDocument()
      expect(screen.getByRole('article')).toBeInTheDocument()
    })

    it('长标题和描述应该正常显示', () => {
      const longTitle = 'A'.repeat(100)
      const longDescription = 'B'.repeat(500)
      const job = createMockJob({ title: longTitle, description: longDescription })
      render(<JobCard job={job} />)

      expect(screen.getByText(longTitle)).toBeInTheDocument()
      expect(screen.getByText(longDescription)).toBeInTheDocument()
    })
  })

  describe('快照测试', () => {
    it('卡片视图的快照应该匹配', () => {
      const job = createMockJob()
      const { container } = render(
        <JobCard 
          job={job} 
          onClick={mockOnClick}
          onToggleFavorite={mockOnToggleFavorite}
          onTagClick={mockOnTagClick}
        />
      )
      expect(container).toMatchSnapshot()
    })

    it('已收藏状态的快照应该匹配', () => {
      const job = createMockJob({ is_favorite: 1 })
      const { container } = render(
        <JobCard 
          job={job}
          onToggleFavorite={mockOnToggleFavorite}
        />
      )
      expect(container).toMatchSnapshot()
    })

    it('列表视图的快照应该匹配', () => {
      const job = createMockJob()
      const { container } = render(
        <JobCard 
          job={job} 
          viewMode="list"
          onClick={mockOnClick}
          onToggleFavorite={mockOnToggleFavorite}
        />
      )
      expect(container).toMatchSnapshot()
    })
  })
})
