'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, EmptyState, FileUpload, Input, JobCard, SectionCard, Skeleton, TabNav } from '@/components/ui';
import { API } from '@/lib/api';
import type { JobItem } from '@/lib/types';

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

function renderResult(data: unknown, submitting: boolean) {
  if (submitting) {
    return <Skeleton type="card" />;
  }

  if (!data) {
    return <EmptyState title="等待生成" description="提交一次推荐请求后，这里会显示返回结果。" />;
  }

  if (typeof data === 'string') {
    return (
      <div className="ai-result">
        <pre className="textarea" style={{ whiteSpace: 'pre-wrap', minHeight: 280 }}>{data}</pre>
      </div>
    );
  }

  if (isJobArray(data)) {
    return (
      <div className="grid" style={{ gap: 14 }}>
        {data.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    );
  }

  return (
    <pre className="textarea" style={{ whiteSpace: 'pre-wrap', minHeight: 280 }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export default function RecommendationsPage() {
  const [mode, setMode] = useState<RecommendationMode>('analyze');
  const [jobId, setJobId] = useState('');
  const [profile, setProfile] = useState('');
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState<unknown>(null);
  const [history, setHistory] = useState<unknown[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeContent, setResumeContent] = useState('');

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const nextHistory = await API.getRecommendationHistory(5);
      setHistory(Array.isArray(nextHistory) ? nextHistory : []);
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : '加载推荐历史失败');
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    void loadHistory();
  }, []);

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
      } else if (mode === 'resume') {
        result = await API.getResumeAdvice({ profile: combinedProfile, prompt });
      } else {
        result = await API.getDeliveryAssistant({ profile: combinedProfile, prompt });
      }
      setResponse(result);
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : '请求失败');
    } finally {
      setSubmitting(false);
    }
  }

  const hasResumeFile = resumeFile !== null;
  const activeTabLabel = TABS.find((t) => t.key === mode)?.label || '岗位分析';

  return (
    <AppShell title="智能推荐" description="AI 分析、简历建议和投递辅助" requiredPermission="use_recommendations">
      {message ? <div className="notice notice-error" style={{ marginBottom: 20 }}>{message}</div> : null}

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
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
                <Button variant="secondary" onClick={() => void loadHistory()}>
                  刷新历史
                </Button>
              </div>
            </SectionCard>
          </div>
        </div>

        <div style={{ flex: '1 1 60%', minWidth: 0 }}>
          <TabNav tabs={TABS} active={mode} onChange={setMode} />
          <div style={{ marginTop: 0 }}>
            <SectionCard title="AI 推荐结果" description={`当前模式：${activeTabLabel}`}>
              {renderResult(response, submitting)}
            </SectionCard>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <SectionCard title="历史记录" description="近期推荐请求与结果">
          {historyLoading ? <Skeleton type="card" /> : null}
          {!historyLoading && history.length === 0 ? (
            <EmptyState title="暂无历史" description="生成过推荐后会在这里显示历史记录。" />
          ) : null}
          {!historyLoading && history.length > 0 ? (
            <div className="grid" style={{ gap: 12 }}>
              {history.map((item, index) => {
            if (typeof item !== 'object' || item === null) return null;
            const historyItem = item as Record<string, unknown>;
            const modeLabel = historyItem.mode === 'analyze' ? '岗位分析' :
                              historyItem.mode === 'resume' ? '简历建议' : '投递助手';
            const timestamp = historyItem.created_at ?
              new Date(historyItem.created_at as string).toLocaleString('zh-CN') :
              `记录 ${index + 1}`;
                
                return (
                  <div key={index} className="history-card" onClick={() => setResponse(historyItem.result)}>
                    <div className="history-card-header">
                      <div className="history-card-title">{modeLabel}</div>
                      <Badge tone="blue">{timestamp}</Badge>
                    </div>
                    <div className="history-card-content">
                      {historyItem.profile ? 
                        String(historyItem.profile).substring(0, 100) + '...' : 
                        '点击查看详情'}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </SectionCard>
      </div>
    </AppShell>
  );
}