import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AIService, cosineSimilarity } from '@/lib/ai-service'

describe('AIService', () => {
  let aiService: AIService

  beforeEach(() => {
    vi.restoreAllMocks()
    aiService = new AIService({
      provider: 'siliconflow',
      apiKey: 'test-api-key',
      model: 'test-model',
    })
  })

  describe('构造函数与初始化', () => {
    it('应正确保存配置', () => {
      const service = new AIService({
        provider: 'zhipu',
        apiKey: 'zhipu-key',
        baseUrl: 'https://custom.api.com/v1',
        model: 'glm-4',
        temperature: 0.5,
        maxTokens: 1024,
      })

      expect(service.config.provider).toBe('zhipu')
      expect(service.config.apiKey).toBe('zhipu-key')
      expect(service.config.baseUrl).toBe('https://custom.api.com/v1')
      expect(service.config.model).toBe('glm-4')
      expect(service.config.temperature).toBe(0.5)
      expect(service.config.maxTokens).toBe(1024)
    })
  })

  describe('Chat功能 - 成功场景', () => {
    it('SiliconFlow provider应正确调用API并返回结果', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: '这是一个关于职位的分析结果',
            },
          }],
          usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
          model: 'Qwen/Qwen2.5-7B-Instruct',
        }),
      }

      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      const result = await aiService.chat([
        { role: 'system', content: '你是职位分析助手' },
        { role: 'user', content: '分析这个岗位' },
      ])

      expect(result.content).toBe('这是一个关于职位的分析结果')
      expect(result.usage?.total_tokens).toBe(150)
      expect(result.model).toBe('Qwen/Qwen2.5-7B-Instruct')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('Zhipu provider应使用正确的默认URL和模型', async () => {
      const zhipuService = new AIService({
        provider: 'zhipu',
        apiKey: 'zhipu-key',
      })

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: '智谱回复' } }],
          usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
          model: 'glm-4.7-flash',
        }),
      }

      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      const result = await zhipuService.chat([
        { role: 'user', content: '你好' },
      ])

      expect(result.content).toBe('智谱回复')

      const fetchUrl = (global.fetch as vi.Mock).mock.calls[0][0]
      expect(fetchUrl).toContain('open.bigmodel.cn')
    })

    it('DeepSeek provider应使用正确的默认URL', async () => {
      const deepseekService = new AIService({
        provider: 'deepseek',
        apiKey: 'ds-key',
      })

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: '深度搜索回复' } }],
          usage: { prompt_tokens: 30, completion_tokens: 15, total_tokens: 45 },
          model: 'deepseek-chat',
        }),
      }

      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      const result = await deepseekService.chat([{ role: 'user', content: 'hi' }])
      expect(result.content).toBe('深度搜索回复')

      const fetchUrl = (global.fetch as vi.Mock).mock.calls[0][0]
      expect(fetchUrl).toContain('api.deepseek.com')
    })

    it('Custom provider应使用自定义baseUrl', async () => {
      const customService = new AIService({
        provider: 'custom',
        apiKey: 'key',
        baseUrl: 'https://my-custom-api.com/v1',
        model: 'my-model',
      })

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: '自定义回复' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          model: 'my-model',
        }),
      }

      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      const result = await customService.chat([{ role: 'user', content: 'test' }])
      expect(result.content).toBe('自定义回复')

      const fetchUrl = (global.fetch as vi.Mock).mock.calls[0][0]
      expect(fetchUrl).toBe('https://my-custom-api.com/v1/chat/completions')
    })
  })

  describe('Chat功能 - 错误处理', () => {
    it('API返回非200状态码应抛出错误', async () => {
      const mockResponse = {
        ok: false,
        status: 429,
        text: vi.fn().mockResolvedValue('Rate limit exceeded'),
      }
      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      await expect(
        aiService.chat([{ role: 'user', content: 'test' }])
      ).rejects.toThrow('AI API 请求失败 (429)')
    })

    it('API超时(504)应抛出包含状态码的错误', async () => {
      const mockResponse = {
        ok: false,
        status: 504,
        text: vi.fn().mockResolvedValue('Gateway Timeout'),
      }
      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      await expect(
        aiService.chat([{ role: 'user', content: 'test' }])
      ).rejects.toThrow('AI API 请求失败 (504)')
    })

    it('服务器错误(500)应正确处理', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('Internal Server Error'),
      }
      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      await expect(
        aiService.chat([{ role: 'user', content: 'test' }])
      ).rejects.toThrow('AI API 请求失败 (500)')
    })

    it('网络错误(fetch抛异常)应传播错误', async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(
        aiService.chat([{ role: 'user', content: 'test' }])
      ).rejects.toThrow('Failed to fetch')
    })

    it('Custom provider缺少baseUrl应抛出明确错误', async () => {
      const customNoUrl = new AIService({
        provider: 'custom',
        apiKey: 'key',
      })

      await expect(
        customNoUrl.chat([{ role: 'user', content: 'test' }])
      ).rejects.toThrow('Custom AI provider requires baseUrl')
    })
  })

  describe('Embedding功能', () => {
    it('SiliconFlow embedding应返回向量', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4]
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [{ embedding: mockEmbedding }],
          model: 'BAAI/bge-m3',
          usage: { prompt_tokens: 20, total_tokens: 20 },
        }),
      }
      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      const result = await aiService.embedding('测试文本')

      expect(result.embedding).toEqual(mockEmbedding)
      expect(result.model).toBe('BAAI/bge-m3')
    })

    it('Zhipu embedding应使用正确的端点', async () => {
      const zhipuService = new AIService({ provider: 'zhipu', apiKey: 'key' })
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [{ embedding: [0.5, 0.6] }],
          model: 'embedding-2',
          usage: { prompt_tokens: 10, total_tokens: 10 },
        }),
      }
      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      const result = await zhipuService.embedding('文本')

      expect(result.embedding).toEqual([0.5, 0.6])
      const fetchUrl = (global.fetch as vi.Mock).mock.calls[0][0]
      expect(fetchUrl).toContain('/embeddings')
    })

    it('embedding API失败应抛出错误', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue('Unauthorized'),
      }
      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      await expect(aiService.embedding('text')).rejects.toThrow()
    })
  })

  describe('cosineSimilarity工具函数', () => {
    it('相同向量相似度应为1', () => {
      const v = [1, 2, 3, 4]
      expect(cosineSimilarity(v, v)).toBeCloseTo(1, 10)
    })

    it('正交向量相似度应为0', () => {
      const a = [1, 0]
      const b = [0, 1]
      expect(cosineSimilarity(a, b)).toBeCloseTo(0, 10)
    })

    it('相反向量相似度应为-1', () => {
      const a = [1, 1]
      const b = [-1, -1]
      expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 10)
    })

    it('零向量应返回0', () => {
      const a = [0, 0, 0]
      const b = [1, 2, 3]
      expect(cosineSimilarity(a, b)).toBe(0)
    })

    it('维度不匹配应抛出错误', () => {
      const a = [1, 2, 3]
      const b = [1, 2]

      expect(() => cosineSimilarity(a, b)).toThrow('向量维度不匹配')
    })

    it('实际场景的余弦相似度计算', () => {
      const resumeVec = Array.from({ length: 10 }, (_, i) => (i + 1) * 0.1)
      const jobVec = Array.from({ length: 10 }, (_, i) => (i + 1) * 0.12)
      const sim = cosineSimilarity(resumeVec, jobVec)

      expect(sim).toBeGreaterThan(0.9)
      expect(sim).toBeLessThanOrEqual(1)
    })
  })

  describe('流式Chat功能', () => {
    it('流式响应应产生多个chunk', async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"content":"你"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"好"}}]}\n\n',
        'data: [DONE]\n\n',
      ]

      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(chunks[0]) })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(chunks[1]) })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(chunks[2]) })
          .mockResolvedValueOnce({ done: true, value: undefined }),
        releaseLock: vi.fn(),
      }

      const mockResponse = {
        ok: true,
        body: { getReader: () => mockReader },
      }

      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      const collected: string[] = []
      for await (const chunk of aiService.chatStream([{ role: 'user', content: 'hi' }])) {
        if (!chunk.done && chunk.content) {
          collected.push(chunk.content)
        }
      }

      expect(collected).toEqual(['你', '好'])
    })

    it('流式响应失败应抛出错误', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        body: null,
        text: vi.fn().mockResolvedValue('Error'),
      }

      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      try {
        for await (const _chunk of aiService.chatStream([{ role: 'user', content: 'hi' }])) {
        }
        expect.unreachable('Should have thrown')
      } catch (e) {
        expect((e as Error).message).toContain('流式请求失败')
      }
    })
  })
})
