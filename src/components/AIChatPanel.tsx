'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Button, Input } from '@/components/ui';
import MarkdownRenderer from './MarkdownRenderer';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

const friendlyErrors: Record<string, string> = {
  '请求失败 (401)': '登录已过期，请重新登录后再试',
  '请求失败 (429)': 'AI服务繁忙，请稍等几秒再问',
  '请求失败 (500)': 'AI服务暂时不可用，请稍后重试',
  'Failed to fetch': '网络连接失败，请检查网络',
  'timeout': 'AI响应超时，请简化问题后重试',
};

const quickQuestions = [
  '这个岗位的面试流程是怎样的？',
  '我的薪资谈判空间有多大？',
  '需要准备哪些技术面试题？',
  '这家公司的文化如何？',
];

interface AIChatPanelProps {
  jobId: number;
  sessionId?: string;
  onSessionIdChange?: (sessionId: string) => void;
  initialMessages?: ChatMessage[];
  placeholder?: string;
  disabled?: boolean;
  onMessageSent?: () => void;
  isMockData?: boolean;  // 新增: 标识是否为Mock数据
}

export default function AIChatPanel({
  jobId,
  sessionId: externalSessionId,
  onSessionIdChange,
  initialMessages = [],
  placeholder = '输入追问内容，如：这个岗位的面试流程是怎样的？',
  disabled = false,
  onMessageSent,
  isMockData = false,  // 新增参数
}: AIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState(externalSessionId || '');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  useEffect(() => {
    if (externalSessionId && externalSessionId !== currentSessionId) {
      setCurrentSessionId(externalSessionId);
    }
  }, [externalSessionId]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleSendWithMessage = useCallback(async (message: string) => {
    if (!message.trim() || loading || disabled) return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userMessage: ChatMessage = { role: 'user', content: message.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);
    setStreamingContent('');

    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
      const response = await fetch(`/api/jobs/${jobId}/ai-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: userMessage.content,
          session_id: currentSessionId || undefined,
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`请求失败 (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.done) {
              if (parsed.session_id && onSessionIdChange) {
                onSessionIdChange(parsed.session_id);
                setCurrentSessionId(parsed.session_id);
              }
              break;
            }

            if (parsed.error) {
              throw new Error(parsed.error);
            }

            fullContent += parsed.content || '';
            setStreamingContent(fullContent);
          } catch (e) {
            if (e instanceof Error && e.message !== 'Unexpected end of JSON input') {
              throw e;
            }
          }
        }
      }

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: fullContent },
      ]);
      setStreamingContent('');
      onMessageSent?.();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      const errorMsg = err instanceof Error ? err.message : '发送失败';
      const displayMsg = friendlyErrors[errorMsg] || errorMsg || 'AI暂时无法回答';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `❌ ${displayMsg}` },
      ]);
    } finally {
      setLoading(false);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [loading, disabled, jobId, currentSessionId, onSessionIdChange, onMessageSent]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && e.nativeEvent.isComposing) {
      e.preventDefault();
    }
  };

  return (
    <div className="ai-chat-panel" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 400,
      border: '1px solid #e5e7eb',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        background: '#fafafa',
      }}>
        {isMockData && (
          <div style={{
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <strong style={{ color: '#92400e', fontSize: '13px' }}>当前使用模拟数据分析</strong>
              <p style={{ color: '#b45309', fontSize: '12px', margin: '4px 0 0 0' }}>
                AI分析功能未配置，显示的是模板化建议（非真实AI分析）。请在 .env 文件中设置 AI_API_KEY 以获得个性化分析结果。
              </p>
            </div>
          </div>
        )}

        {messages.length === 0 && !streamingContent && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            gap: 24,
          }}>
            <div style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 40,
              boxShadow: '0 10px 30px rgba(102, 126, 234, 0.3)',
            }}>
              🤖
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{
                margin: 0,
                color: '#1f2937',
                fontSize: 18,
                fontWeight: 600,
                marginBottom: 8,
              }}>
                我是你的AI求职助手
              </h3>
              <p style={{
                margin: 0,
                color: '#6b7280',
                fontSize: 14,
                lineHeight: 1.6,
              }}>
                选择下方问题快速开始，或直接输入你想了解的内容
              </p>
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              width: '100%',
              maxWidth: 400,
            }}>
              {quickQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => {
                    void handleSendWithMessage(question);
                  }}
                  style={{
                    padding: '12px 16px',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    background: '#fff',
                    color: '#374151',
                    fontSize: 13,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.borderColor = '#667eea';
                    (e.target as HTMLElement).style.background = '#f9fafb';
                    (e.target as HTMLElement).style.transform = 'translateX(4px)';
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.borderColor = '#e5e7eb';
                    (e.target as HTMLElement).style.background = '#fff';
                    (e.target as HTMLElement).style.transform = 'translateX(0)';
                  }}
                >
                  💬 {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatBubble key={i} message={msg} />
        ))}

        {streamingContent && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              maxWidth: '85%',
              padding: '10px 14px',
              borderRadius: '4px 16px 16px 16px',
              background: '#fff',
              color: '#1f2937',
              fontSize: 14,
              lineHeight: 1.7,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              wordBreak: 'break-word',
              position: 'relative',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>AI正在思考</span>
                <span className="dot-flashing" style={{
                  display: 'inline-block',
                  width: 20,
                  height: 20,
                  position: 'relative',
                }}>
                  <style>{`
                    @keyframes dotFlashing {
                      0%, 20% { opacity: 0; }
                      50% { opacity: 1; }
                      80%, 100% { opacity: 0; }
                    }
                    .dot-flashing::before, .dot-flashing::after {
                      content: '';
                      position: absolute;
                      width: 4px;
                      height: 4px;
                      border-radius: 50%;
                      background: #667eea;
                    }
                    .dot-flashing::before {
                      left: 0;
                      animation: dotFlashing 1.5s infinite;
                    }
                    .dot-flashing::after {
                      left: 8px;
                      animation: dotFlashing 1.5s infinite 0.3s;
                    }
                  `}</style>
                </span>
              </div>
              <MarkdownRenderer content={streamingContent + '▌'} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form style={{
        padding: '12px 16px',
        borderTop: '1px solid #e5e7eb',
        background: '#fff',
        display: 'flex',
        gap: 8,
      }} onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const msg = (fd.get('message') as string) || '';
        if (!msg.trim() || loading || disabled) return;
        void handleSendWithMessage(msg);
        e.currentTarget.reset();
      }}>
        <Input
          name="message"
          defaultValue=""
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          style={{ flex: 1 }}
        />
        <Button
          variant="primary"
          type="submit"
          disabled={loading || disabled}
        >
          {loading ? '思考中...' : '发送'}
        </Button>
      </form>
    </div>
  );
}

function ChatBubble({ message, isStreaming }: { message: ChatMessage; isStreaming?: boolean }) {
  const isUser = message.role === 'user';

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
    }}>
      <div style={{
        maxWidth: '85%',
        padding: '10px 14px',
        borderRadius: isUser
          ? '16px 4px 16px 16px'
          : '4px 16px 16px 16px',
        background: isUser ? '#3b82f6' : '#fff',
        color: isUser ? '#fff' : '#1f2937',
        fontSize: 14,
        lineHeight: 1.7,
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        wordBreak: 'break-word',
      }}>
        {isUser ? (
          message.content
        ) : (
          <MarkdownRenderer content={message.content + (isStreaming ? '▌' : '')} />
        )}
      </div>
    </div>
  );
}