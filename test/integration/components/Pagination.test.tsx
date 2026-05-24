// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Pagination } from '@/components/Pagination'

describe('Pagination 组件', () => {
  const mockOnChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('基础渲染', () => {
    it('应该正确渲染分页组件并显示当前页码和总页数', () => {
      render(<Pagination current={1} total={10} onChange={mockOnChange} />)

      expect(screen.getByRole('navigation', { name: /分页导航/ })).toBeInTheDocument()
      expect(screen.getByText(/第.*\/ 10 页/)).toBeInTheDocument()
    })

    it('应该显示上一页和下一页按钮', () => {
      render(<Pagination current={5} total={10} onChange={mockOnChange} />)

      expect(screen.getByRole('button', { name: /上一页/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /下一页/ })).toBeInTheDocument()
    })
  })

  describe('边界值处理', () => {
    it('第一页时上一页按钮应该被禁用', () => {
      render(<Pagination current={1} total={10} onChange={mockOnChange} />)

      const prevButton = screen.getByRole('button', { name: /上一页/ })
      expect(prevButton).toBeDisabled()
    })

    it('最后一页时下一页按钮应该被禁用', () => {
      render(<Pagination current={10} total={10} onChange={mockOnChange} />)

      const nextButton = screen.getByRole('button', { name: /下一页/ })
      expect(nextButton).toBeDisabled()
    })

    it('只有一页时两个方向按钮都应该被禁用', () => {
      render(<Pagination current={1} total={1} onChange={mockOnChange} />)

      expect(screen.getByRole('button', { name: /上一页/ })).toBeDisabled()
      expect(screen.getByRole('button', { name: /下一页/ })).toBeDisabled()
    })

    it('中间页面时两个方向按钮都应该可用', () => {
      render(<Pagination current={5} total={10} onChange={mockOnChange} />)

      expect(screen.getByRole('button', { name: /上一页/ })).not.toBeDisabled()
      expect(screen.getByRole('button', { name: /下一页/ })).not.toBeDisabled()
    })
  })

  describe('页码切换功能', () => {
    it('点击上一页应该调用onChange并传递正确的页码', async () => {
      const user = userEvent.setup()
      render(<Pagination current={3} total={10} onChange={mockOnChange} />)

      await user.click(screen.getByRole('button', { name: /上一页/ }))
      expect(mockOnChange).toHaveBeenCalledWith(2)
    })

    it('点击下一页应该调用onChange并传递正确的页码', async () => {
      const user = userEvent.setup()
      render(<Pagination current={3} total={10} onChange={mockOnChange} />)

      await user.click(screen.getByRole('button', { name: /下一页/ }))
      expect(mockOnChange).toHaveBeenCalledWith(4)
    })
  })

  describe('跳转功能', () => {
    it('点击页码显示区域应该显示输入框', async () => {
      const user = userEvent.setup()
      render(<Pagination current={5} total={10} onChange={mockOnChange} />)

      await user.click(screen.getByRole('button', { name: /点击输入页码/ }))
      expect(screen.getByLabelText(/输入目标页码/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /跳转/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /取消/ })).toBeInTheDocument()
    })

    it('输入有效页码并点击跳转按钮应该触发跳转', async () => {
      const user = userEvent.setup()
      render(<Pagination current={1} total={10} onChange={mockOnChange} />)

      await user.click(screen.getByRole('button', { name: /点击输入页码/ }))
      const input = screen.getByLabelText(/输入目标页码/)
      
      fireEvent.change(input, { target: { value: '7' } })
      await user.click(screen.getByRole('button', { name: /跳转/ }))
      
      expect(mockOnChange).toHaveBeenCalledWith(7)
    })

    it('点击跳转按钮应该触发跳转', async () => {
      const user = userEvent.setup()
      render(<Pagination current={1} total={10} onChange={mockOnChange} />)

      await user.click(screen.getByRole('button', { name: /点击输入页码/ }))
      const input = screen.getByLabelText(/输入目标页码/)
      
      await user.clear(input)
      await user.type(input, '8')
      await user.click(screen.getByRole('button', { name: /跳转/ }))
      
      expect(mockOnChange).toHaveBeenCalledWith(8)
    })

    it('输入超出范围的页码不应该触发跳转', async () => {
      const user = userEvent.setup()
      render(<Pagination current={1} total={10} onChange={mockOnChange} />)

      await user.click(screen.getByRole('button', { name: /点击输入页码/ }))
      const input = screen.getByLabelText(/输入目标页码/)
      
      await user.type(input, '99')
      await user.click(screen.getByRole('button', { name: /跳转/ }))
      
      expect(mockOnChange).not.toHaveBeenCalled()
    })

    it('点击取消按钮应该关闭输入框并清空内容', async () => {
      const user = userEvent.setup()
      render(<Pagination current={5} total={10} onChange={mockOnChange} />)

      await user.click(screen.getByRole('button', { name: /点击输入页码/ }))
      await user.type(screen.getByLabelText(/输入目标页码/), '7')
      await user.click(screen.getByRole('button', { name: /取消/ }))
      
      expect(screen.queryByLabelText(/输入目标页码/)).not.toBeInTheDocument()
      expect(mockOnChange).not.toHaveBeenCalled()
    })
  })

  describe('可访问性 (A11y)', () => {
    it('导航元素应该有正确的role属性', () => {
      render(<Pagination current={1} total={10} onChange={mockOnChange} />)
      
      const nav = screen.getByRole('navigation')
      expect(nav).toHaveAttribute('aria-label', '分页导航')
    })

    it('按钮应该有正确的aria-label', () => {
      render(<Pagination current={5} total={10} onChange={mockOnChange} />)

      expect(screen.getByRole('button', { name: /上一页/ })).toHaveAttribute('aria-label', '上一页')
      expect(screen.getByRole('button', { name: /下一页/ })).toHaveAttribute('aria-label', '下一页')
    })

    it('输入框应该有正确的aria-label', async () => {
      const user = userEvent.setup()
      render(<Pagination current={5} total={10} onChange={mockOnChange} />)

      await user.click(screen.getByRole('button', { name: /点击输入页码/ }))
      
      const input = screen.getByLabelText(/输入目标页码/)
      expect(input).toHaveAttribute('type', 'number')
      expect(input).toHaveAttribute('min', '1')
      expect(input).toHaveAttribute('max', '10')
    })
  })

  describe('快照测试', () => {
    it('中间页面的快照应该匹配', () => {
      const { container } = render(<Pagination current={5} total={10} onChange={mockOnChange} />)
      expect(container).toMatchSnapshot()
    })

    it('第一页的快照应该匹配', () => {
      const { container } = render(<Pagination current={1} total={10} onChange={mockOnChange} />)
      expect(container).toMatchSnapshot()
    })

    it('最后一页的快照应该匹配', () => {
      const { container } = render(<Pagination current={10} total={10} onChange={mockOnChange} />)
      expect(container).toMatchSnapshot()
    })
  })
})
