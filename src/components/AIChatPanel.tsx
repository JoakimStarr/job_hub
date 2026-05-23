'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Button, Input } from '@/components/ui';
import MarkdownRenderer from './MarkdownRenderer';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

interface AIChatPanelProps {
  jobId: number;
  sessionId?: string;
  onSessionIdChange?: (sessionId: string) => void;
  initialMessages?: ChatMessage[];
  placeholder?: string;
  disabled?: boolean;
  onMessageSent?: () => void;
}

export default function AIChatPanel({
  jobId,
  sessionId: externalSessionId,
  onSessionIdChange,
  initialMessages = [],
  placeholder = '输入追问内容，如：这个岗位的面试流程是怎样的？',
  disabled = false,
  onMessageSent,
}: AIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
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

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading || disabled) return;

    // Cancel any existing request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userMessage: ChatMessage = { role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
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
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `❌ ${errorMsg}，请稍后重试` },
      ]);
    } finally {
      setLoading(false);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [input, loading, disabled, jobId, currentSessionId, onSessionIdChange, onMessageSent]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
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
        {messages.length === 0 && !streamingContent && (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#9ca3af',
            fontSize: 14,
          }}>
            💬 可以对分析结果进行追问，AI 会基于职位信息继续回答
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatBubble key={i} message={msg} />
        ))}

        {streamingContent && (
          <ChatBubble
            message={{ role: 'assistant', content: streamingContent }}
            isStreaming
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid #e5e7eb',
        background: '#fff',
        display: 'flex',
        gap: 8,
      }}>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          style={{ flex: 1 }}
        />
        <Button
          variant="primary"
          onClick={handleSend}
          disabled={!input.trim() || loading || disabled}
        >
          {loading ? '思考中...' : '发送'}
        </Button>
      </div>
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