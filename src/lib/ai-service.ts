export interface AIConfig {
  provider: 'openai' | 'zhipu' | 'siliconflow' | 'deepseek' | 'custom';
  apiKey: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

export interface AIStreamChunk {
  content: string;
  reasoning_content?: string;
  done: boolean;
  model?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface EmbeddingResponse {
  embedding: number[];
  model: string;
  usage?: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export class AIService {
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
  }

  async chat(messages: AIMessage[]): Promise<AIResponse> {
    switch (this.config.provider) {
      case 'openai':
        return this.chatOpenAI(messages);
      case 'zhipu':
        return this.chatZhipu(messages);
      case 'siliconflow':
        return this.chatSiliconFlow(messages);
      case 'deepseek':
        return this.chatDeepSeek(messages);
      default:
        return this.chatCustom(messages);
    }
  }

  async *chatStream(messages: AIMessage[]): AsyncGenerator<AIStreamChunk> {
    switch (this.config.provider) {
      case 'openai':
        yield* this.chatStreamOpenAI(messages);
        break;
      case 'zhipu':
        yield* this.chatStreamZhipu(messages);
        break;
      case 'siliconflow':
        yield* this.chatStreamSiliconFlow(messages);
        break;
      case 'deepseek':
        yield* this.chatStreamDeepSeek(messages);
        break;
      default:
        yield* this.chatStreamCustom(messages);
    }
  }

  async embedding(text: string): Promise<EmbeddingResponse> {
    switch (this.config.provider) {
      case 'zhipu':
        return this.embeddingZhipu(text);
      case 'siliconflow':
        return this.embeddingSiliconFlow(text);
      case 'openai':
        return this.embeddingOpenAI(text);
      default:
        return this.embeddingSiliconFlow(text);
    }
  }

  private async chatCompletion(messages: AIMessage[], defaultBaseUrl: string, defaultModel: string): Promise<AIResponse> {
    const baseUrl = this.config.baseUrl || defaultBaseUrl;
    const model = this.config.model || defaultModel;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 65536,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`AI API 请求失败 (${response.status})，请检查配置或稍后重试`);
    }

    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      usage: data.usage,
      model: data.model,
    };
  }

  private async doStreamFetch(
    messages: AIMessage[],
    defaultBaseUrl: string,
    defaultModel: string,
    extraBody: Record<string, unknown> = {}
  ): Promise<Response> {
    const baseUrl = this.config.baseUrl || defaultBaseUrl;
    const model = this.config.model || defaultModel;

    return fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 65536,
        stream: true,
        ...extraBody,
      }),
    });
  }

  private async *streamResponse(
    response: Response,
    parseChunk: (line: string) => { content: string; reasoning_content?: string } | null
  ): AsyncGenerator<AIStreamChunk> {
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`AI 流式请求失败 (${response.status})`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('响应体不可读');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            yield { content: '', done: true };
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            if (!delta) continue;

            const chunk = parseChunk(data);
            if (chunk) {
              yield {
                content: chunk.content || '',
                reasoning_content: chunk.reasoning_content,
                done: false,
                model: parsed.model,
                usage: parsed.usage,
              };
            }
          } catch {
            continue;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { content: '', done: true };
  }

  private async *streamOpenAICompatible(
    messages: AIMessage[],
    defaultBaseUrl: string,
    defaultModel: string,
    extraBody: Record<string, unknown> = {}
  ): AsyncGenerator<AIStreamChunk> {
    const response = await this.doStreamFetch(messages, defaultBaseUrl, defaultModel, extraBody);
    yield* this.streamResponse(response, (data) => {
      const parsed = JSON.parse(data);
      const delta = parsed.choices?.[0]?.delta;
      if (!delta) return null;
      return {
        content: delta.content || '',
        reasoning_content: delta.reasoning_content,
      };
    });
  }

  private async *chatStreamOpenAI(messages: AIMessage[]): AsyncGenerator<AIStreamChunk> {
    yield* this.streamOpenAICompatible(messages, 'https://api.openai.com/v1', '');
  }

  private async *chatStreamZhipu(messages: AIMessage[]): AsyncGenerator<AIStreamChunk> {
    const baseUrl = this.config.baseUrl || 'https://open.bigmodel.cn/api/paas/v4';
    const model = this.config.model || 'glm-4.7-flash';
    const response = await this.doStreamFetch(messages, baseUrl, model, {
      thinking: { type: 'enabled' },
    });
    yield* this.streamResponse(response, (data) => {
      const parsed = JSON.parse(data);
      const delta = parsed.choices?.[0]?.delta;
      if (!delta) return null;
      return {
        content: delta.content || '',
        reasoning_content: delta.reasoning_content,
      };
    });
  }

  private async *chatStreamSiliconFlow(messages: AIMessage[]): AsyncGenerator<AIStreamChunk> {
    yield* this.streamOpenAICompatible(messages, 'https://api.siliconflow.cn/v1', 'Qwen/Qwen2.5-7B-Instruct');
  }

  private async *chatStreamDeepSeek(messages: AIMessage[]): AsyncGenerator<AIStreamChunk> {
    yield* this.streamOpenAICompatible(messages, 'https://api.deepseek.com/v1', 'deepseek-chat');
  }

  private async *chatStreamCustom(messages: AIMessage[]): AsyncGenerator<AIStreamChunk> {
    if (!this.config.baseUrl) {
      throw new Error('Custom AI provider requires baseUrl');
    }
    yield* this.streamOpenAICompatible(messages, this.config.baseUrl, '');
  }

  private async embeddingOpenAI(text: string): Promise<EmbeddingResponse> {
    const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Embedding API 请求失败 (${response.status})`);
    }

    const data = await response.json();
    return {
      embedding: data.data[0].embedding,
      model: data.model,
      usage: data.usage,
    };
  }

  private async embeddingZhipu(text: string): Promise<EmbeddingResponse> {
    const baseUrl = this.config.baseUrl || 'https://open.bigmodel.cn/api/paas/v4';
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: 'embedding-2',
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Zhipu Embedding API 请求失败 (${response.status})`);
    }

    const data = await response.json();
    return {
      embedding: data.data[0].embedding,
      model: data.model,
      usage: data.usage,
    };
  }

  private async embeddingSiliconFlow(text: string): Promise<EmbeddingResponse> {
    const baseUrl = this.config.baseUrl || 'https://api.siliconflow.cn/v1';
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: 'BAAI/bge-m3',
        input: text,
        encoding_format: 'float',
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`SiliconFlow Embedding API 请求失败 (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    return {
      embedding: data.data[0].embedding,
      model: data.model,
      usage: data.usage,
    };
  }

  private chatOpenAI(messages: AIMessage[]): Promise<AIResponse> {
    return this.chatCompletion(messages, 'https://api.openai.com/v1', '');
  }

  private chatZhipu(messages: AIMessage[]): Promise<AIResponse> {
    return this.chatCompletion(messages, 'https://open.bigmodel.cn/api/paas/v4', 'glm-4.7-flash');
  }

  private chatSiliconFlow(messages: AIMessage[]): Promise<AIResponse> {
    return this.chatCompletion(messages, 'https://api.siliconflow.cn/v1', 'Qwen/Qwen2.5-7B-Instruct');
  }

  private chatDeepSeek(messages: AIMessage[]): Promise<AIResponse> {
    return this.chatCompletion(messages, 'https://api.deepseek.com/v1', 'deepseek-chat');
  }

  private chatCustom(messages: AIMessage[]): Promise<AIResponse> {
    if (!this.config.baseUrl) {
      throw new Error('Custom AI provider requires baseUrl');
    }
    return this.chatCompletion(messages, this.config.baseUrl, '');
  }
}

export function createAIService(): AIService | null {
  const provider = (process.env.AI_PROVIDER || 'siliconflow') as AIConfig['provider'];
  const temperature = parseFloat(process.env.AI_TEMPERATURE || '0.7');
  const maxTokens = parseInt(process.env.AI_MAX_TOKENS || '65536');

  let apiKey = '';
  let model = process.env.AI_MODEL || '';
  let baseUrl = process.env.AI_BASE_URL;

  if (provider === 'zhipu') {
    apiKey = process.env.ZHIPU_API_KEY || process.env.AI_API_KEY || '';
    if (!model) model = 'glm-4.7-flash';
    if (!baseUrl) baseUrl = 'https://open.bigmodel.cn/api/paas/v4';
  } else if (provider === 'siliconflow') {
    apiKey = process.env.SILICONFLOW_API_KEY || process.env.AI_API_KEY || '';
    if (!model) model = 'Qwen/Qwen2.5-7B-Instruct';
    if (!baseUrl) baseUrl = 'https://api.siliconflow.cn/v1';
  } else if (provider === 'openai') {
    apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '';
    if (!baseUrl) baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  } else if (provider === 'deepseek') {
    apiKey = process.env.DEEPSEEK_API_KEY || process.env.AI_API_KEY || '';
    if (!baseUrl) baseUrl = 'https://api.deepseek.com/v1';
  } else {
    apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '';
  }

  if (!apiKey) {
    return null;
  }

  return new AIService({
    provider,
    apiKey,
    baseUrl,
    model,
    temperature,
    maxTokens,
  });
}

export const aiService = createAIService();

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('向量维度不匹配');
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}