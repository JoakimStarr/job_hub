'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Badge, Skeleton, EmptyState } from '@/components/ui';
import type { AnalysisProgress } from '@/lib/subscription-analyzer';

interface AnalysisJobResult {
  job_id: number;
  title: string;
  company: string;
  location: string;
  salary: string;
  education: string;
  match_score: number;
  skill_match: number;
  education_match: number;
  location_match: number;
  ai_reasoning?: string;
  ai_suggestions?: string;
  is_new: boolean;
}

interface AnalysisSummary {
  total_scanned: number;
  filtered_count?: number;
  new_jobs: number;
  matched: number;
  ai_summary?: string;
}

interface SubscriptionAnalysisPanelProps {
  subscriptionId: number;
  subscriptionName: string;
  analysisResult: {
    analysis_id: number;
    status: 'completed' | 'running' | 'failed' | 'cached' | 'no_analysis';
    summary: AnalysisSummary | null;
    results: AnalysisJobResult[];
    cached_at?: string;
  };
  onReanalyze?: () => void;
  onViewHistory?: () => void;
  onClose: () => void;
}

function getScoreColor(score: number): string {
  if (score >= 85) return 'emerald';
  if (score >= 70) return 'blue';
  if (score >= 55) return 'amber';
  return 'rose';
}

function getScoreLabel(score: number): string {
  if (score >= 85) return '冲刺岗';
  if (score >= 70) return '匹配岗';
  if (score >= 55) return '潜力岗';
  return '挑战岗';
}

function ProgressStep({ phase, currentPhase, label }: { phase: string; currentPhase: string; label: string }) {
  const phases = ['scanning', 'matching', 'ai_analyzing', 'completed'];
  const idx = phases.indexOf(phase);
  const curIdx = phases.indexOf(currentPhase);
  const isActive = phase === currentPhase;
  const isDone = idx < curIdx || (curIdx === -1 && idx < 3);
  const isFailed = currentPhase === 'failed';

  let bg = 'var(--surface)';
  let border = 'var(--border)';
  let textColor = 'var(--muted)';
  let icon = '⏳';

  if (isFailed && isActive) {
    bg = 'var(--rose-subtle)';
    border = 'var(--rose)';
    textColor = 'var(--rose)';
    icon = '✕';
  } else if (isActive) {
    bg = 'var(--sky-subtle)';
    border = 'var(--sky)';
    textColor = 'var(--sky)';
    icon = '🔄';
  } else if (isDone) {
    bg = 'var(--emerald-subtle)';
    border = 'var(--emerald)';
    textColor = 'var(--emerald)';
    icon = '✓';
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 14px',
      borderRadius: 12,
      background: bg,
      border: `1.5px solid ${border}`,
      fontSize: 13,
      fontWeight: isActive ? 700 : 400,
      color: textColor,
      transition: 'all 0.3s',
      opacity: isDone && !isActive ? 0.8 : 1,
    }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function ProgressBar({ progress, message }: { progress: number; message: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>{message}</span>
        <span style={{ fontSize: 13, color: 'var(--sky)', fontWeight: 700 }}>{Math.round(progress)}%</span>
      </div>
      <div style={{
        width: '100%',
        height: 6,
        background: 'var(--surface)',
        borderRadius: 3,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${Math.min(progress, 100)}%`,
          height: '100%',
          background: 'linear-gradient(90deg, var(--sky), var(--violet))',
          borderRadius: 3,
          transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  );
}

export function SubscriptionAnalysisPanel({
  subscriptionName,
  analysisResult,
  onReanalyze,
  onViewHistory,
  onClose,
}: SubscriptionAnalysisPanelProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);

  const { status, summary, results } = analysisResult;

  useEffect(() => {
    if (status !== 'running') setProgress(null);
  }, [status]);

  const isLoading = status === 'running';

  const phaseOrder = ['scanning', 'matching', 'ai_analyzing'] as const;

  const calcProgress = useCallback((): number => {
    if (!progress) return 0;
    const phaseIdx = phaseOrder.indexOf(progress.phase as any);
    if (phaseIdx === -1) return progress.phase === 'completed' ? 100 : 0;
    const baseProgress = (phaseIdx / phaseOrder.length) * 80;
    const phaseProgress = progress.total > 0 ? (progress.current / progress.total) * (100 / phaseOrder.length) : 0;
    return Math.min(baseProgress + phaseProgress, 95);
  }, [progress]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 860, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="modal-head">
          <div>
            <h3>分析结果 · {subscriptionName}</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>
              {status === 'cached' && `缓存于 ${analysisResult.cached_at}`}
              {status === 'completed' && '分析完成'}
              {status === 'running' && (progress?.message || '正在分析中...')}
              {status === 'failed' && '分析失败'}
              {status === 'no_analysis' && '暂无分析记录'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {onViewHistory && (
              <Button variant="ghost" onClick={onViewHistory}>历史</Button>
            )}
            {onReanalyze && (
              <Button variant="ghost" onClick={onReanalyze}>重新分析</Button>
            )}
            <Button variant="ghost" onClick={onClose}>关闭</Button>
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            {/* 步骤指示器 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
              marginBottom: 24,
              maxWidth: 480,
              margin: '0 auto 24px auto',
            }}>
              <ProgressStep phase="scanning" currentPhase={progress?.phase || ''} label="扫描岗位数据" />
              <ProgressStep phase="matching" currentPhase={progress?.phase || ''} label="本地规则匹配" />
              <ProgressStep phase="ai_analyzing" currentPhase={progress?.phase || ''} label="AI 深度分析" />
            </div>

            {/* 进度条 */}
            <ProgressBar progress={calcProgress()} message={progress?.message || '准备中...'} />

            {/* 统计信息 */}
            {(summary || progress) && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12,
                marginTop: 16,
              }}>
                <div style={{ padding: 12, background: 'var(--surface)', borderRadius: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--fg)' }}>
                    {progress?.current ?? summary?.total_scanned ?? 0}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>已处理</div>
                </div>
                <div style={{ padding: 12, background: 'var(--surface)', borderRadius: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--fg)' }}>
                    {progress?.total ?? summary?.total_scanned ?? 0}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>总计</div>
                </div>
                <div style={{ padding: 12, background: 'var(--surface)', borderRadius: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--violet)' }}>
                    {Math.round(calcProgress())}%
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>进度</div>
                </div>
              </div>
            )}

            <p style={{ marginTop: 24, color: 'var(--muted)', fontSize: 13 }}>
              分析过程中请勿关闭此窗口...
            </p>
          </div>
        ) : status === 'failed' ? (
          <EmptyState title="分析失败" description="请稍后重试或检查配置。" />
        ) : !summary || results.length === 0 ? (
          <EmptyState title={status === 'no_analysis' ? '暂无分析记录' : '未找到匹配岗位'} description={
            status === 'no_analysis'
              ? '点击"预览分析"按钮开始'
              : '当前订阅条件没有匹配到岗位，建议调整筛选条件'
          } />
        ) : (
          <>
            {/* 统计摘要 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: summary?.filtered_count && summary.filtered_count !== summary?.total_scanned ? 'repeat(5, 1fr)' : 'repeat(4, 1fr)',
              gap: 12,
              padding: 16,
              background: 'var(--surface)',
              borderRadius: 16,
              marginBottom: 20,
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{summary.total_scanned}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>扫描总数</div>
              </div>
              {summary?.filtered_count != null && summary.filtered_count > 0 && summary.filtered_count !== summary.total_scanned && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--amber)' }}>{summary.filtered_count}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>筛选通过</div>
                </div>
              )}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--sky)' }}>{summary.new_jobs}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>新增岗位</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--emerald)' }}>{summary.matched}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>匹配岗位</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{summary.total_scanned > 0 ? Math.round((summary.matched / summary.total_scanned) * 100) : 0}%</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>命中率</div>
              </div>
            </div>

            {/* AI 摘要 */}
            {summary.ai_summary && (
              <div style={{
                padding: 16,
                background: 'linear-gradient(135deg, var(--sky-subtle), var(--violet-subtle))',
                borderRadius: 16,
                marginBottom: 20,
                border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>🤖</span>
                  <strong>AI 分析摘要</strong>
                </div>
                <p style={{ margin: 0, lineHeight: 1.7, color: 'var(--fg)' }}>{summary.ai_summary}</p>
              </div>
            )}

            {/* 结果列表 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {results.map((job) => (
                <div
                  key={job.job_id}
                  onClick={() => setExpandedId(expandedId === job.job_id ? null : job.job_id)}
                  style={{
                    padding: 16,
                    background: 'var(--surface)',
                    borderRadius: 16,
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        {job.is_new && <Badge tone="blue">新</Badge>}
                        <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {job.title}
                        </strong>
                      </div>
                      <div style={{ color: 'var(--muted)', fontSize: 13 }}>{job.company}</div>
                      <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 13, color: 'var(--muted)' }}>
                        {job.location && <span>📍 {job.location}</span>}
                        <span>💰 {job.salary}</span>
                        {job.education && <span>🎓 {job.education}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', flexShrink: 0 }}>
                      <div style={{
                        width: 52,
                        height: 52,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 16,
                        fontWeight: 800,
                        background: `var(--${getScoreColor(job.match_score)}-subtle)`,
                        color: `var(--${getScoreColor(job.match_score)})`,
                      }}>
                        {job.match_score}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        {getScoreLabel(job.match_score)}
                      </div>
                    </div>
                  </div>

                  {expandedId === job.job_id && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                        <div style={{ padding: 8, background: 'var(--bg)', borderRadius: 10, textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>技能匹配</div>
                          <div style={{ fontWeight: 700 }}>{job.skill_match}/30</div>
                        </div>
                        <div style={{ padding: 8, background: 'var(--bg)', borderRadius: 10, textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>学历匹配</div>
                          <div style={{ fontWeight: 700 }}>{job.education_match}/20</div>
                        </div>
                        <div style={{ padding: 8, background: 'var(--bg)', borderRadius: 10, textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>地点匹配</div>
                          <div style={{ fontWeight: 700 }}>{job.location_match}/10</div>
                        </div>
                      </div>

                      {job.ai_reasoning && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--muted)' }}>匹配理由</div>
                          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{job.ai_reasoning}</p>
                        </div>
                      )}
                      {job.ai_suggestions && (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--muted)' }}>建议</div>
                          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{job.ai_suggestions}</p>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <Button variant="primary">查看详情</Button>
                        <Button variant="secondary">感兴趣</Button>
                        <Button variant="secondary">投递</Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
