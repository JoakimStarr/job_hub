'use client';

import { useState } from 'react';
import { Button, Badge, Skeleton, EmptyState } from '@/components/ui';

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
  if (score >= 70) return 'sky';
  if (score >= 55) return 'amber';
  return 'rose';
}

function getScoreLabel(score: number): string {
  if (score >= 85) return '冲刺岗';
  if (score >= 70) return '匹配岗';
  if (score >= 55) return '潜力岗';
  return '挑战岗';
}

export function SubscriptionAnalysisPanel({
  subscriptionName,
  analysisResult,
  onReanalyze,
  onViewHistory,
  onClose,
}: SubscriptionAnalysisPanelProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { status, summary, results } = analysisResult;

  const isLoading = status === 'running';

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
              {status === 'running' && '正在分析中...'}
              {status === 'failed' && '分析失败'}
              {status === 'no_analysis' && '暂无分析记录'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {onViewHistory && (
              <Button variant="ghost" size="sm" onClick={onViewHistory}>
                历史
              </Button>
            )}
            {onReanalyze && (
              <Button variant="ghost" size="sm" onClick={onReanalyze}>
                重新分析
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              关闭
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Skeleton type="card" />
            <p style={{ marginTop: 16, color: 'var(--muted)' }}>正在分析岗位数据，请稍候...</p>
          </div>
        ) : status === 'failed' ? (
          <EmptyState title="分析失败" description="请稍后重试或检查配置。" />
        ) : !summary || results.length === 0 ? (
          <EmptyState title={status === 'no_analysis' ? '暂无分析记录' : '未找到匹配岗位'} description={
            status === 'no_analysis'
              ? '点击"预览"按钮开始分析'
              : '当前订阅条件没有匹配到岗位，建议调整筛选条件'
          } />
        ) : (
          <>
            {/* 统计摘要 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
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
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--sky)' }}>{summary.new_jobs}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>新增岗位</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--emerald)' }}>{summary.matched}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>匹配岗位</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{Math.round((summary.matched / summary.total_scanned) * 100)}%</div>
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
                        {job.is_new && <Badge tone="sky">新</Badge>}
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

                  {/* 展开的详情 */}
                  {expandedId === job.job_id && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                      {/* 匹配详情 */}
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

                      {/* AI 分析 */}
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

                      {/* 操作按钮 */}
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <Button variant="primary" size="sm">查看详情</Button>
                        <Button variant="secondary" size="sm">感兴趣</Button>
                        <Button variant="secondary" size="sm">投递</Button>
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
