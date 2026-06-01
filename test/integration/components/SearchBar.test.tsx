// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SearchBar } from '@/components/SearchBar'

describe('SearchBar 组件', () => {
  const mockOnSearch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('基础渲染', () => {
    it('应该正确渲染搜索输入框和按钮', () => {
      render(<SearchBar onSearch={mockOnSearch} />)

      expect(screen.getByRole('search')).toBeInTheDocument()
      expect(screen.getByLabelText(/搜索关键词/)).toBeInTheDocument()
      expect(screen.getByText('搜索')).toBeInTheDocument()
    })

    it('应该显示自定义的占位符文本', () => {
      render(<SearchBar onSearch={mockOnSearch} placeholder="请输入职位名称..." />)

      const input = screen.getByPlaceholderText('请输入职位名称...')
      expect(input).toBeInTheDocument()
    })
  })

  describe('搜索输入功能', () => {
    it('输入文本时不应该触发搜索', () => {
      render(<SearchBar onSearch={mockOnSearch} />)

      const input = screen.getByLabelText(/搜索关键词/)
      fireEvent.change(input, { target: { value: '数据分析师' } })

      expect(mockOnSearch).not.toHaveBeenCalled()
    })

    it('提交表单应该触发搜索', () => {
      render(<SearchBar onSearch={mockOnSearch} />)

      const input = screen.getByLabelText(/搜索关键词/)
      fireEvent.change(input, { target: { value: 'Python开发' } })

      const form = input.closest('form')
      if (form) fireEvent.submit(form)

      expect(mockOnSearch).toHaveBeenCalledWith('Python开发')
      expect(mockOnSearch).toHaveBeenCalledTimes(1)
    })

    it('按回车键应该通过表单提交触发搜索', () => {
      render(<SearchBar onSearch={mockOnSearch} />)

      const input = screen.getByLabelText(/搜索关键词/)
      fireEvent.change(input, { target: { value: '机器学习' } })

      const form = input.closest('form')
      if (form) fireEvent.submit(form)

      expect(mockOnSearch).toHaveBeenCalledWith('机器学习')
      expect(mockOnSearch).toHaveBeenCalledTimes(1)
    })
  })

  describe('清空功能', () => {
    it('清空按钮应该始终可见', () => {
      render(<SearchBar onSearch={mockOnSearch} />)

      expect(screen.getByLabelText(/清空搜索/)).toBeInTheDocument()
    })

    it('点击清空按钮应该清空输入并触发空搜索', () => {
      render(<SearchBar onSearch={mockOnSearch} />)

      const input = screen.getByLabelText(/搜索关键词/) as HTMLInputElement
      fireEvent.change(input, { target: { value: '测试内容' } })

      fireEvent.click(screen.getByLabelText(/清空搜索/))

      expect(input.value).toBe('')
      expect(mockOnSearch).toHaveBeenCalledWith('')
    })
  })

  describe('筛选器展开/收起', () => {
    it('showFilters=false时不应该显示筛选器切换按钮', () => {
      render(<SearchBar onSearch={mockOnSearch} showFilters={false} />)

      expect(screen.queryByRole('button', { name: /展开筛选|收起筛选/ })).not.toBeInTheDocument()
    })

    it('showFilters=true时应该显示筛选器切换按钮', () => {
      render(<SearchBar onSearch={mockOnSearch} showFilters={true} />)

      expect(screen.getByRole('button', { name: /展开筛选/ })).toBeInTheDocument()
    })

    it('点击筛选器按钮应该切换展开/收起状态', () => {
      render(
        <SearchBar
          onSearch={mockOnSearch}
          showFilters={true}
          filterContent={<div data-testid="filter-content">筛选选项</div>}
        />
      )

      const toggleButton = screen.getByRole('button', { name: /展开筛选/ })
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByTestId('filter-content')).not.toBeInTheDocument()

      fireEvent.click(toggleButton)

      expect(screen.getByRole('button', { name: /收起筛选/ })).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByTestId('filter-content')).toBeInTheDocument()
    })

    it('再次点击筛选器按钮应该收起筛选面板', () => {
      render(
        <SearchBar
          onSearch={mockOnSearch}
          showFilters={true}
          filterContent={<div data-testid="filter-content">筛选选项</div>}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /展开筛选/ }))
      expect(screen.getByTestId('filter-content')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /收起筛选/ }))
      expect(screen.queryByTestId('filter-content')).not.toBeInTheDocument()
    })

    it('没有filterContent时展开筛选器不应该显示内容区域', () => {
      render(<SearchBar onSearch={mockOnSearch} showFilters={true} />)

      fireEvent.click(screen.getByRole('button', { name: /展开筛选/ }))

      expect(screen.queryByRole('region', { name: /筛选选项/ })).not.toBeInTheDocument()
    })
  })

  describe('可访问性 (A11y)', () => {
    it('搜索容器应该有正确的role属性', () => {
      render(<SearchBar onSearch={mockOnSearch} />)

      expect(screen.getByRole('search')).toHaveAttribute('aria-label', '搜索栏')
    })

    it('输入框应该有正确的aria-label', () => {
      render(<SearchBar onSearch={mockOnSearch} />)

      expect(screen.getByLabelText(/搜索关键词/)).toBeInTheDocument()
    })

    it('清空按钮应该有正确的aria-label', () => {
      render(<SearchBar onSearch={mockOnSearch} />)

      expect(screen.getByLabelText(/清空搜索/)).toBeInTheDocument()
    })

    it('筛选器按钮应该有正确的aria-expanded属性', () => {
      render(
        <SearchBar
          onSearch={mockOnSearch}
          showFilters={true}
          filterContent={<div>筛选</div>}
        />
      )

      const button = screen.getByRole('button', { name: /展开筛选/ })
      expect(button).toHaveAttribute('aria-expanded', 'false')
      expect(button).toHaveAttribute('aria-label', '展开筛选器')
    })

    it('筛选面板应该有正确的role和aria-label', () => {
      render(
        <SearchBar
          onSearch={mockOnSearch}
          showFilters={true}
          filterContent={<div data-testid="filters">筛选选项</div>}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /展开筛选/ }))

      expect(screen.getByRole('region', { name: /筛选选项/ })).toBeInTheDocument()
    })
  })

  describe('快照测试', () => {
    it('基本状态的快照应该匹配', () => {
      const { container } = render(<SearchBar onSearch={mockOnSearch} />)
      expect(container).toMatchSnapshot()
    })

    it('展开筛选器的快照应该匹配', () => {
      const { container } = render(
        <SearchBar
          onSearch={mockOnSearch}
          showFilters={true}
          filterContent={
            <div className="filters">
              <label><input type="checkbox" /> 全职</label>
              <label><input type="checkbox" /> 实习</label>
            </div>
          }
        />
      )
      fireEvent.click(screen.getByRole('button', { name: /展开筛选/ }))
      expect(container).toMatchSnapshot()
    })
  })
})
