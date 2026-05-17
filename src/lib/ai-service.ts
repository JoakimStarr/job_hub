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

  private async chatOpenAI(messages: AIMessage[]): Promise<AIResponse> {
    const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
    
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    return {
      content: data.choices[0].message.content,
      usage: data.usage,
      model: data.model,
    };
  }

  private async chatZhipu(messages: AIMessage[]): Promise<AIResponse> {
    const baseUrl = this.config.baseUrl || 'https://open.bigmodel.cn/api/paas/v4';
    
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model || 'glm-4',
        messages,
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Zhipu AI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    return {
      content: data.choices[0].message.content,
      usage: data.usage,
      model: data.model,
    };
  }

  private async chatSiliconFlow(messages: AIMessage[]): Promise<AIResponse> {
    const baseUrl = this.config.baseUrl || 'https://api.siliconflow.cn/v1';
    
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model || 'Qwen/Qwen2.5-7B-Instruct',
        messages,
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SiliconFlow API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    return {
      content: data.choices[0].message.content,
      usage: data.usage,
      model: data.model,
    };
  }

  private async chatDeepSeek(messages: AIMessage[]): Promise<AIResponse> {
    const baseUrl = this.config.baseUrl || 'https://api.deepseek.com/v1';
    
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model || 'deepseek-chat',
        messages,
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    return {
      content: data.choices[0].message.content,
      usage: data.usage,
      model: data.model,
    };
  }

  private async chatCustom(messages: AIMessage[]): Promise<AIResponse> {
    if (!this.config.baseUrl) {
      throw new Error('Custom AI provider requires baseUrl');
    }

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Custom AI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    return {
      content: data.choices[0].message.content,
      usage: data.usage,
      model: data.model,
    };
  }
}

export function createAIService(): AIService | null {
  const provider = (process.env.AI_PROVIDER || 'siliconflow') as AIConfig['provider'];
  const apiKey = process.env.AI_API_KEY || '';
  const baseUrl = process.env.AI_BASE_URL;
  const model = process.env.AI_MODEL || '';
  const temperature = parseFloat(process.env.AI_TEMPERATURE || '0.7');
  const maxTokens = parseInt(process.env.AI_MAX_TOKENS || '2000');

  if (!apiKey) {
    console.warn('AI_API_KEY not configured, AI features will be disabled');
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
