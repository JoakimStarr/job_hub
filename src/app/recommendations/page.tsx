'use client';

import { useCallback, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, EmptyState, FileUpload, Input, JobCard, SectionCard, Skeleton, TabNav } from '@/components/ui';
import { API } from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import type { JobItem } from '@/lib/types';
import AIAnalysisResult, { isAnalysisResult } from '@/components/AIAnalysisResult';
import AIChatPanel from '@/components/AIChatPanel';
import MarkdownRenderer from '@/components/MarkdownRenderer';

type RecommendationMode = 'analyze' | 'resume' | 'delivery';

const TABS: { key: RecommendationMode; label: string }[] = [
  { key: 'analyze', label: '岗位分析' },
  { key: 'resume', label: '简历建议' },
  { key: 'delivery', label: '投递助手' },
];

function isJobArray(data: unknown): data is JobItem[] {
  if (!Array.isArray(data) || data.length === 0) return false;
  const first = data[0];
  return (
    typeof first === 'object' &&
    first !== null &&
    'title' in first &&
    typeof (first as Record<string, unknown>).title === 'string'
  );
}

function extractReadableContent(data: unknown): string | null {
  console.log('[renderResult] extractReadableContent called with:', JSON.stringify(data)?.slice(0, 500));

  if (!data || typeof data !== 'object') {
    console.log('[renderResult] extractReadableContent: not an object, returning null');
    return null;
  }
  const d = data as Record<string, unknown>;

  if (typeof d.result === 'string') {
    console.log('[renderResult] extractReadableContent: found result string');
    return d.result;
  }
  if (typeof d.content === 'string') {
    console.log('[renderResult] extractReadableContent: found content string');
    return d.content;
  }

  if (d.score && typeof (d.score as Record<string, unknown>).total === 'number') {
    console.log('[renderResult] extractReadableContent: found score object, building markdown');
    const score = d.score as Record<string, number>;
    const parts: string[] = [];
    if (d.recommendation) parts.push(`**推荐等级**: ${d.recommendation}`);
    if (score.total != null) parts.push(`\n**综合评分**: ${score.total}/100`);
    if (score.skills != null) parts.push(`**技能匹配**: ${score.skills}/100`);
    if (score.education != null) parts.push(`**学历匹配**: ${score.education}/100`);
    if (score.match_rate != null) parts.push(`**匹配率**: ${score.match_rate}%`);
    if (Array.isArray(d.suggestions) && d.suggestions.length > 0) {
      parts.push('\n**建议**:\n' + (d.suggestions as string[]).map((s: string) => `- ${s}`).join('\n'));
    }
    if (Array.isArray(d.risks) && d.risks.length > 0) {
      parts.push('\n**风险提示**:\n' + (d.risks as string[]).map((r: string) => `- ⚠️ ${r}`).join('\n'));
    }
    if (Array.isArray(d.action_plan) && d.action_plan.length > 0) {
      parts.push('\n**行动计划**:\n' + (d.action_plan as string[]).map((a: string, i: number) => `${i + 1}. ${a}`).join('\n'));
    }
    return parts.join('\n\n');
  }

  if (isJobArray(data)) {
    console.log('[renderResult] extractReadableContent: detected job array, returning null for JobCard rendering');
    return null;
  }

  // 尝试从常见字段提取文本内容，避免直接返回原始 JSON
  const fallbackFields = ['text', 'message', 'response', 'answer', 'output', 'summary', 'explanation'];
  for (const field of fallbackFields) {
    if (typeof d[field] === 'string' && (d[field] as string).length > 0) {
      console.log(`[renderResult] extractReadableContent: found fallback field '${field}'`);
      return d[field] as string;
    }
  }

  console.log('[renderResult] extractReadableContent: no readable content found, returning null');
  return null;
}

function renderResult(data: unknown, submitting: boolean) {
  console.log('[renderResult] called, submitting:', submitting, ', data type:', typeof data);

  if (submitting) {
    return <Skeleton type="card" />;
  }

  if (!data) {
    return <EmptyState title="等待生成" description="提交一次推荐请求后，这里会显示返回结果。" />;
  }

  if (typeof data === 'string') {
    console.log('[renderResult] rendering as string, length:', data.length);
    return (
      <div className="ai-result">
        <MarkdownRenderer content={data} />
      </div>
    );
  }

  if (isAnalysisResult(data)) {
    console.log('[renderResult] rendering as AIAnalysisResult');
    const { _meta, ...resultData } = data;
    return (
      <AIAnalysisResult
        data={resultData}
        meta={_meta || undefined}
      />
    );
  }

  const readable = extractReadableContent(data);
  if (readable) {
    console.log('[renderResult] rendering extracted readable content, length:', readable.length);
    return (
      <div className="ai-result">
        <MarkdownRenderer content={readable} />
      </div>
    );
  }

  if (isJobArray(data)) {
    console.log('[renderResult] rendering as JobCard array, count:', data.length);
    return (
      <div className="grid" style={{ gap: 14 }}>
        {data.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    );
  }

  // 绝对不显示原始 JSON，改为显示友好的空状态或格式化后的信息摘要
  console.warn('[renderResult] WARNING: 无法识别的数据类型，将显示通用结果视图而非原始 JSON');
  const summaryText = '已生成分析结果，但当前无法以结构化方式展示。请尝试刷新页面或重新提交请求。';
  return (
    <div className="ai-result">
      <MarkdownRenderer content={summaryText} />
    </div>
  );
}

export default function RecommendationsPage() {
  const [mode, setMode] = useState<RecommendationMode>('analyze');
  const [jobId, setJobId] = useState('');
  const [profile, setProfile] = useState('');
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeContent, setResumeContent] = useState('');
  const [analysisSessionId, setAnalysisSessionId] = useState<string>('');
  const [showChat, setShowChat] = useState(false);

  const { data: historyData, loading: historyLoading, mutate: mutateHistory } = useFetch<unknown[]>(
    '/api/recommendations/history?limit=20',
    () => API.getRecommendationHistory(20) as Promise<unknown[]>,
  );

  const handleFileSelect = useCallback((file: File) => {
    setResumeFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      setResumeContent(typeof content === 'string' ? content : '');
    };
    reader.onerror = () => {
      setMessage('文件读取失败，请检查文件格式');
    };
    reader.readAsText(file);
  }, []);

  async function submitAction() {
    setMessage('');
    setShowChat(false);
    setAnalysisSessionId('');

    const trimmedJobId = jobId.trim();
    let parsedJobId: number | undefined;

    if (trimmedJobId) {
      parsedJobId = Number(trimmedJobId);
      if (isNaN(parsedJobId)) {
        setMessage('岗位 ID 必须是有效的数字，请检查输入');
        return;
      }
    }

    setSubmitting(true);
    try {
      const combinedProfile = [profile, resumeContent].filter(Boolean).join('\n\n');
      let result: unknown = null;

      if (mode === 'analyze') {
        result = await API.getRecommendations({ job_id: parsedJobId, profile: combinedProfile, prompt });
        if (result && typeof result === 'object' && '_meta' in (result as Record<string, unknown>)) {
          const meta = (result as Record<string, unknown>)._meta as Record<string, unknown>;
          if (meta?.session_id) {
            setAnalysisSessionId(meta.session_id as string);
            setShowChat(true);
          }
        }
      } else if (mode === 'resume') {
        result = await API.getResumeAdvice({ profile: combinedProfile, prompt });
      } else {
        result = await API.getDeliveryAssistant({ profile: combinedProfile, prompt });
      }

      setResponse(result);
      void mutateHistory();
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : '请求失败');
    } finally {
      setSubmitting(false);
    }
  }

  const hasResumeFile = resumeFile !== null;
  const activeTabLabel = TABS.find((t) => t.key === mode)?.label || '岗位分析';
  const currentJobIdNum = jobId ? parseInt(jobId) : undefined;
  const hasAnalysisResult = response !== null && isAnalysisResult(response);

  const historyList = Array.isArray(historyData) ? historyData : [];

  function getHistoryModeLabel(mode: string): string {
    const map: Record<string, string> = {
      ai_analysis: '岗位分析',
      analyze: '岗位分析',
      resume: '简历建议',
      delivery: '投递助手',
      chat: '追问对话',
      interview_questions: '面试题目',
    };
    return map[mode] || mode;
  }

  function renderHistoryItem(item: Record<string, unknown>) {
    const modeLabel = getHistoryModeLabel(String(item.mode || ''));

    let displayContent: React.ReactNode;
    const resultData = item.result as Record<string, unknown> | string | null;

    if (item.mode === 'chat' || item.mode === 'interview_questions') {
      const rd = typeof resultData === 'object' && resultData !== null ? resultData : {};
      const content = typeof rd.result === 'string'
        ? rd.result
        : typeof resultData === 'string'
          ? resultData
          : JSON.stringify(resultData, null, 2);
      displayContent = (
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          <MarkdownRenderer content={String(content)} />
        </div>
      );
    } else if (typeof resultData === 'object' && resultData !== null) {
      const rd = resultData as Record<string, unknown>;
      if (rd.score && typeof (rd.score as Record<string, unknown>).total === 'number') {
        displayContent = (
          <AIAnalysisResult
            data={rd as unknown as { score: { total: number; skills: number; education: number; match_rate: number }; recommendation: string; suggestions: string[]; risks: string[]; action_plan: string[] }}
            meta={(rd._meta || undefined) as { session_id?: string; model?: string; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }; duration_ms?: number } | undefined}
          />
        );
      } else if (rd.result && typeof rd.result === 'string') {
        displayContent = <MarkdownRenderer content={rd.result} />;
      } else {
        displayContent = <MarkdownRenderer content={JSON.stringify(rd, null, 2)} />;
      }
    } else {
      displayContent = <MarkdownRenderer content={String(resultData || '')} />;
    }

    const timestamp = item.created_at
      ? new Date(item.created_at as string).toLocaleString('zh-CN')
      : '';

    return (
      <div
        key={item.id as number}
        style={{
          padding: '12px 16px',
          borderRadius: 8,
          background: '#fafafa',
          border: '1px solid #e5e7eb',
          cursor: 'pointer',
          transition: 'border-color 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
        onClick={() => setResponse(item.result)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Badge tone={item.mode === 'chat' ? 'violet' : 'blue'}>{modeLabel}</Badge>
          {timestamp ? <span style={{ fontSize: 11, color: '#9ca3af' }}>{timestamp}</span> : null}
        </div>
        {(typeof item.job_id === 'number' || typeof item.job_id === 'string') ? (
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>职位 ID: {String(item.job_id)}</div>
        ) : null}
        <div style={{
          maxHeight: 120,
          overflow: 'hidden',
          opacity: 0.8,
          fontSize: 13,
          lineHeight: 1.5,
        }}>
          {displayContent}
        </div>
      </div>
    );
  }

  return (
    <AppShell title="智能推荐" description="AI 分析、简历建议和投递辅助" requiredPermission="use_recommendations">
      {message ? <div className="notice notice-error" style={{ marginBottom: 20 }}>{message}</div> : null}

      <div className="recommendations-layout" style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <div style={{ flex: '0 0 40%', minWidth: 0 }}>
          <SectionCard title="简历上传" description="上传简历文件辅助 AI 进行精准分析">
            <FileUpload
              accept=".pdf,.doc,.docx,.txt"
              label="拖拽或点击上传简历（支持 PDF、Word、TXT）"
              onFileSelect={handleFileSelect}
            />
            {hasResumeFile ? (
              <div style={{ marginTop: 10 }}>
                <Badge tone="emerald">已上传：{resumeFile.name}</Badge>
              </div>
            ) : null}
          </SectionCard>

          <div style={{ marginTop: 20 }}>
            <SectionCard title="个人画像" description="输入你的教育背景、经历和求职偏好">
              <label style={{ display: 'block' }}>
                <div style={{ marginBottom: 8, fontWeight: 700 }}>个人画像</div>
                <textarea
                  className="textarea"
                  rows={6}
                  value={profile}
                  onChange={(event) => setProfile(event.target.value)}
                  placeholder="输入教育背景、工作/实习经历、技能特长等"
                />
              </label>
              <label style={{ display: 'block', marginTop: 14 }}>
                <div style={{ marginBottom: 8, fontWeight: 700 }}>附加提示</div>
                <textarea
                  className="textarea"
                  rows={4}
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="例如：偏好上海、券商、投研方向"
                />
              </label>
              <label style={{ display: 'block', marginTop: 14 }}>
                <div style={{ marginBottom: 8, fontWeight: 700 }}>岗位 ID</div>
                <Input
                  value={jobId}
                  onChange={(event) => setJobId(event.target.value)}
                  placeholder="可选，仅岗位分析模式使用"
                />
              </label>
              <div className="row-gap" style={{ marginTop: 16 }}>
                <Button variant="primary" onClick={submitAction} disabled={submitting}>
                  {submitting ? '生成中...' : '生成结果'}
                </Button>
                <Button variant="secondary" onClick={() => { void mutateHistory(); }}>
                  刷新历史
                </Button>
              </div>
            </SectionCard>
          </div>
        </div>

        <div style={{ flex: '1 1 60%', minWidth: 0 }}>
          <TabNav tabs={TABS} active={mode} onChange={(m) => { setMode(m); setResponse(null); setShowChat(false); }} />
          <div style={{ marginTop: 0 }}>
            <SectionCard title="AI 推荐结果" description={`当前模式：${activeTabLabel}`}>
              {renderResult(response, submitting)}
            </SectionCard>

            {hasAnalysisResult && !showChat && currentJobIdNum ? (
              <div style={{ marginTop: 12 }}>
                <Button
                  variant="secondary"
                  onClick={() => setShowChat(true)}
                >
                  💬 继续追问
                </Button>
              </div>
            ) : null}

            {showChat && currentJobIdNum ? (
              <div style={{ marginTop: 12 }}>
                <SectionCard title="AI 追问对话" description="基于当前分析结果继续提问">
                  <AIChatPanel
                    jobId={currentJobIdNum}
                    sessionId={analysisSessionId || undefined}
                    onSessionIdChange={setAnalysisSessionId}
                    disabled={!hasAnalysisResult}
                    placeholder="例如：这个岗位的面试流程是怎样的？需要准备哪些材料？"
                    onMessageSent={() => void mutateHistory()}
                  />
                </SectionCard>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <SectionCard title="历史记录" description="所有AI操作记录（含分析和追问）">
          {historyLoading ? <Skeleton type="card" /> : null}
          {!historyLoading && historyList.length === 0 ? (
            <EmptyState title="暂无历史" description="使用过AI功能后会在这里显示记录。" />
          ) : null}
          {!historyLoading && historyList.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {historyList.map((item) => {
                if (typeof item !== 'object' || item === null) return null;
                return renderHistoryItem(item as Record<string, unknown>);
              })}
            </div>
          ) : null}
        </SectionCard>
      </div>
    </AppShell>
  );
}