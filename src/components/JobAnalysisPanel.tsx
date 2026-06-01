'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { API } from '@/lib/api';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { Textarea } from '@/components/ui';
import { useAppStore } from '@/store';
import type { JobItem } from '@/types';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type AnalysisHistoryItem = {
  id: number;
  created_at: string;
  session_id?: string;
  model?: string;
  duration_ms?: number;
  result: unknown;
};

type HistoryResponse = {
  history: AnalysisHistoryItem[];
  total: number;
};

type AnalysisResultData = {
  score: {
    total: number;
    skills: number;
    education: number;
    match_rate: number;
  };
  recommendation: string;
  suggestions: string[];
  risks: string[];
  action_plan: string[];
  _meta?: {
    session_id?: string;
    model?: string;
    duration_ms?: number;
    usage?: { total_tokens?: number };
  };
};

function extractSessionId(result: unknown): string {
  if (!result || typeof result !== 'object') return '';
  const data = result as Record<string, unknown>;
  const meta = data._meta as Record<string, unknown> | undefined;
  if (typeof meta?.session_id === 'string') return meta.session_id;
  if (typeof data.session_id === 'string') return data.session_id;
  return '';
}

function formatTime(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN');
}

function isAnalysisResult(value: unknown): value is AnalysisResultData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  const score = data.score as Record<string, unknown> | undefined;
  return !!score && typeof score.total === 'number' && typeof data.recommendation === 'string';
}

function getRecommendationTone(recommendation: string): 'emerald' | 'amber' | 'rose' {
  if (recommendation.includes('推荐')) return 'emerald';
  if (recommendation.includes('考虑')) return 'amber';
  return 'rose';
}

function getScoreTone(score: number): 'emerald' | 'amber' | 'rose' {
  if (score >= 75) return 'emerald';
  if (score >= 55) return 'amber';
  return 'rose';
}

export default function JobAnalysisPanel({ job }: { job: JobItem }) {
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [expanded, setExpanded] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [activeResult, setActiveResult] = useState<unknown | null>(null);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastStreamUpdateRef = useRef(0);
  const streamRafRef = useRef<number>(0);
  const pendingStreamContentRef = useRef('');
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (streamRafRef.current) {
        cancelAnimationFrame(streamRafRef.current);
      }
    };
  }, []);

  const storageKey = useMemo(() => `job-ai-analysis-expanded:${job.id}`, [job.id]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError('');

    try {
      const response = await API.getRecommendationHistory(20, { mode: 'ai_analysis', jobId: job.id }) as HistoryResponse;
      const history = Array.isArray(response.history) ? response.history : [];
      setAnalysisHistory(history);

      if (history.length > 0) {
        const latest = history[0];
        setActiveResult((current: unknown | null) => current || latest.result);
        setActiveSessionId((current: string) => current || latest.session_id || extractSessionId(latest.result));
      }

      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem(storageKey);
        setExpanded(saved !== null ? saved === 'true' : history.length > 0);
      }
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : '获取历史记录失败');
    } finally {
      setHistoryLoading(false);
    }
  }, [job.id, storageKey]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, String(expanded));
  }, [expanded, storageKey]);

  const latestHistory = analysisHistory[0];
  const activeAnalysis = activeResult || latestHistory?.result || null;
  const isGuest = useAppStore.getState().isGuest;

  const handleAnalyze = useCallback(async () => {
    if (isGuest) {
      alert('请登录后使用此功能');
      return;
    }

    setAnalysisLoading(true);
    setAnalysisError('');

    try {
      const result = await API.analyzeJob(job.id);
      setActiveResult(result);
      const sessionId = extractSessionId(result);
      setActiveSessionId(sessionId);
      setExpanded(true);
      setShowChat(Boolean(sessionId));
      setMessages([]);
      setStreamingContent('');
      await loadHistory();
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'AI 分析失败');
    } finally {
      setAnalysisLoading(false);
    }
  }, [isGuest, job.id, loadHistory]);

  const handleSelectHistory = useCallback((item: AnalysisHistoryItem) => {
    setActiveResult(item.result);
    setActiveSessionId(item.session_id || extractSessionId(item.result));
    setShowChat(false);
    setMessages([]);
    setStreamingContent('');
    setExpanded(true);
  }, []);

  const handleSendWithMessage = useCallback(async (message: string) => {
    if (!message.trim() || chatLoading || !activeSessionId || !activeAnalysis || isGuest) {
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const msg = message.trim();
    const userMessage: ChatMessage = { role: 'user', content: msg };
    setMessages((current) => [...current, userMessage]);
    setChatLoading(true);
    setStreamingContent('');

    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
      const response = await fetch(`/api/jobs/${job.id}/ai-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: msg,
          session_id: activeSessionId,
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
              if (parsed.session_id) {
                setActiveSessionId(parsed.session_id);
              }
              break;
            }

            if (parsed.error) {
              throw new Error(parsed.error);
            }

            fullContent += parsed.content || '';
            pendingStreamContentRef.current = fullContent;

            const now = Date.now();
            if (now - lastStreamUpdateRef.current >= 100) {
              lastStreamUpdateRef.current = now;
              setStreamingContent(fullContent);
            } else if (!streamRafRef.current) {
              streamRafRef.current = requestAnimationFrame(() => {
                streamRafRef.current = 0;
                lastStreamUpdateRef.current = Date.now();
                setStreamingContent(pendingStreamContentRef.current);
              });
            }
          } catch (streamError) {
            if (streamError instanceof Error && streamError.message !== 'Unexpected end of JSON input') {
              throw streamError;
            }
          }
        }
      }

      if (pendingStreamContentRef.current) {
        setStreamingContent(pendingStreamContentRef.current);
        pendingStreamContentRef.current = '';
      }

      setMessages((current) => [...current, { role: 'assistant', content: fullContent }]);
      setStreamingContent('');
      await loadHistory();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : '发送失败';
      setMessages((current) => [...current, { role: 'assistant', content: `❌ ${errorMessage}，请稍后重试` }]);
    } finally {
      setChatLoading(false);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [activeAnalysis, activeSessionId, chatLoading, isGuest, job.id, loadHistory]);

  const handleChatKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      const form = event.currentTarget.closest('form');
      if (form) {
        form.requestSubmit();
      }
    }
  };

  const renderActiveResult = () => {
    if (!activeAnalysis) {
      return (
        <div className="empty-state">
          <h3>等待分析</h3>
          <p>点击 AI 分析后，这里会显示最新结果。</p>
        </div>
      );
    }

    if (isAnalysisResult(activeAnalysis)) {
      const resultData = activeAnalysis;
      return (
        <div style={{ display: 'grid', gap: 16 }}>
          {resultData._meta ? (
            <div className="glass-card" style={{ padding: 12, borderRadius: 14, display: 'flex', gap: 12, flexWrap: 'wrap', color: 'var(--muted)', fontSize: 12 }}>
              <span>{resultData._meta.model || 'AI'}</span>
              {resultData._meta.duration_ms != null ? <span>{resultData._meta.duration_ms}ms</span> : null}
              {resultData._meta.usage?.total_tokens != null ? <span>Token {resultData._meta.usage.total_tokens}</span> : null}
            </div>
          ) : null}

          <div className="grid-4" style={{ gap: 12 }}>
            <div className="glass-card" style={{ padding: 14, borderRadius: 16, textAlign: 'center', border: `1px solid ${getScoreTone(resultData.score.total) === 'emerald' ? '#10b98122' : getScoreTone(resultData.score.total) === 'amber' ? '#d9770622' : '#dc262622'}` }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: getScoreTone(resultData.score.total) === 'emerald' ? '#059669' : getScoreTone(resultData.score.total) === 'amber' ? '#d97706' : '#dc2626' }}>{resultData.score.total}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>综合评分</div>
            </div>
            <div className="glass-card" style={{ padding: 14, borderRadius: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#2563eb' }}>{resultData.score.skills}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>技能匹配</div>
            </div>
            <div className="glass-card" style={{ padding: 14, borderRadius: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#7c3aed' }}>{resultData.score.education}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>学历匹配</div>
            </div>
            <div className="glass-card" style={{ padding: 14, borderRadius: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#ea580c' }}>{resultData.score.match_rate}%</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>匹配率</div>
            </div>
          </div>

          <div className={`badge badge-${getRecommendationTone(resultData.recommendation)}`} style={{ display: 'inline-flex', width: 'fit-content' }}>
            {resultData.recommendation}
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {resultData.suggestions.length > 0 ? (
              <div className="glass-card" style={{ padding: 14, borderRadius: 16 }}>
                <h4 style={{ margin: '0 0 10px', fontSize: 15 }}>建议</h4>
                <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
                  {resultData.suggestions.map((item, index) => <li key={index}>{item}</li>)}
                </ul>
              </div>
            ) : null}
            {resultData.risks.length > 0 ? (
              <div className="glass-card" style={{ padding: 14, borderRadius: 16 }}>
                <h4 style={{ margin: '0 0 10px', fontSize: 15 }}>风险提示</h4>
                <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, color: '#dc2626' }}>
                  {resultData.risks.map((item, index) => <li key={index}>{item}</li>)}
                </ul>
              </div>
            ) : null}
            {resultData.action_plan.length > 0 ? (
              <div className="glass-card" style={{ padding: 14, borderRadius: 16 }}>
                <h4 style={{ margin: '0 0 10px', fontSize: 15 }}>行动计划</h4>
                <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
                  {resultData.action_plan.map((item, index) => <li key={index}>{item}</li>)}
                </ol>
              </div>
            ) : null}
          </div>
        </div>
      );
    }

    return <MarkdownRenderer content={typeof activeAnalysis === 'string' ? activeAnalysis : JSON.stringify(activeAnalysis, null, 2)} />;
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn btn-secondary" onClick={() => setExpanded((value) => !value)} disabled={historyLoading && !analysisHistory.length}>
          {expanded ? '收起历史' : '展开历史'}
        </button>
        <button type="button" className="btn btn-primary" onClick={handleAnalyze} disabled={analysisLoading}>
          {analysisLoading ? '分析中...' : activeAnalysis ? '重新分析' : 'AI 分析'}
        </button>
        {activeSessionId ? (
          <button type="button" className="btn btn-secondary" onClick={() => setShowChat((value) => !value)}>
            {showChat ? '收起追问' : '继续追问'}
          </button>
        ) : null}
        {analysisHistory.length > 0 ? <span className="badge badge-blue">历史 {analysisHistory.length} 条</span> : null}
      </div>

      {analysisError ? <div className="notice notice-error">{analysisError}</div> : null}
      {historyError ? <div className="notice notice-error">{historyError}</div> : null}

      {analysisHistory.length > 0 && latestHistory ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {expanded ? (
            <>
              {renderActiveResult()}
              <div style={{ display: 'grid', gap: 10 }}>
                {analysisHistory.map((item) => {
                  const selected = activeSessionId
                    ? item.session_id === activeSessionId
                    : item.id === latestHistory.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectHistory(item)}
                      style={{
                        textAlign: 'left',
                        padding: '12px 14px',
                        borderRadius: 14,
                        border: selected ? '1px solid var(--primary)' : '1px solid #e5e7eb',
                        background: selected ? 'rgba(59, 130, 246, 0.06)' : '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <strong>AI 分析记录</strong>
                        <span style={{ color: 'var(--muted)', fontSize: 12 }}>{formatTime(item.created_at)}</span>
                      </div>
                      <div style={{ marginTop: 6, color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>
                        {item.model ? `模型: ${item.model}` : '模型信息未知'}{item.duration_ms ? ` · ${item.duration_ms}ms` : ''}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="glass-card" style={{ padding: 16, borderRadius: 18, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <strong>最新 AI 分析</strong>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>{formatTime(latestHistory.created_at)}</span>
              </div>
              {isAnalysisResult(activeAnalysis) ? (
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                  {activeAnalysis.recommendation} · 综合评分 {activeAnalysis.score.total}/100
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : historyLoading ? (
        <div className="notice notice-info">正在加载历史分析记录...</div>
      ) : (
        <>
          {!activeAnalysis ? (
            <div className="empty-state">
              <h3>暂无历史</h3>
              <p>先执行一次 AI 分析，然后可以继续追问。</p>
            </div>
          ) : null}
          {activeAnalysis && !expanded ? renderActiveResult() : null}
        </>
      )}

      {showChat && activeSessionId ? (
        <div className="glass-card" style={{ padding: 16, borderRadius: 18, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <strong>继续追问</strong>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>{activeSessionId}</span>
          </div>
          <div style={{ minHeight: 180, maxHeight: 360, overflowY: 'auto', display: 'grid', gap: 10, padding: 12, background: '#fafafa', borderRadius: 14, border: '1px solid #e5e7eb' }}>
            {messages.length === 0 && !streamingContent ? (
              <div className="empty-state" style={{ padding: '24px 12px' }}>
                <h3>可以继续追问</h3>
                <p>例如：这个岗位的面试流程是怎样的？需要准备哪些材料？</p>
              </div>
            ) : null}
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} style={{ alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%' }}>
                <div className={`badge ${message.role === 'user' ? 'badge-blue' : 'badge-slate'}`} style={{ display: 'inline-block', marginBottom: 6 }}>
                  {message.role === 'user' ? '我' : 'AI'}
                </div>
                <div style={{ padding: '10px 12px', borderRadius: 14, background: message.role === 'user' ? 'rgba(59, 130, 246, 0.08)' : '#fff', border: '1px solid #e5e7eb', lineHeight: 1.7 }}>
                  <MarkdownRenderer content={message.content} />
                </div>
              </div>
            ))}
            {streamingContent ? (
              <div style={{ alignSelf: 'flex-start', maxWidth: '92%' }}>
                <div className="badge badge-slate" style={{ display: 'inline-block', marginBottom: 6 }}>AI</div>
                <div style={{ padding: '10px 12px', borderRadius: 14, background: '#fff', border: '1px solid #e5e7eb', lineHeight: 1.7 }}>
                  <MarkdownRenderer content={streamingContent} />
                </div>
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>
          <form style={{ display: 'flex', gap: 8, flexDirection: 'column' }} onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const msg = (fd.get('chatInput') as string) || '';
            if (!msg.trim() || chatLoading || isGuest) return;
            void handleSendWithMessage(msg);
            e.currentTarget.reset();
          }}>
            <Textarea
              name="chatInput"
              defaultValue=""
              onKeyDown={handleChatKeyDown}
              placeholder="例如：这个岗位最看重哪些经历？"
              disabled={chatLoading}
              rows={4}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="submit" className="btn btn-primary" disabled={chatLoading || isGuest}>
                {chatLoading ? '发送中...' : '发送'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowChat(false)}>
                收起追问
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}