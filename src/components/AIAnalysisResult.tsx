'use client';

import { Badge } from '@/components/ui';
import MarkdownRenderer from './MarkdownRenderer';

interface ScoreData {
  total: number;
  skills: number;
  education: number;
  match_rate: number;
}

interface AnalysisResult {
  score: ScoreData;
  recommendation: string;
  suggestions: string[];
  risks: string[];
  action_plan: string[];
}

interface MetaInfo {
  session_id?: string;
  model?: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  duration_ms?: number;
}

function getScoreColor(score: number): 'emerald' | 'amber' | 'rose' {
  if (score >= 75) return 'emerald';
  if (score >= 55) return 'amber';
  return 'rose';
}

function getRecommendationTone(recommendation: string): 'emerald' | 'amber' | 'rose' {
  if (recommendation.includes('推荐')) return 'emerald';
  if (recommendation.includes('考虑')) return 'amber';
  return 'rose';
}

export default function AIAnalysisResult({ data, meta }: { data: AnalysisResult; meta?: MetaInfo }) {
  const { score, recommendation, suggestions, risks, action_plan } = data;

  return (
    <div className="ai-analysis-result">
      {meta && (
        <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f8fafc', borderRadius: 6, fontSize: 12, color: '#64748b' }}>
          <span>{meta.model || 'AI'} · </span>
          <span>{meta.duration_ms}ms</span>
          {meta.usage && (
            <>
              <span> · Token: {meta.usage.total_tokens}</span>
            </>
          )}
        </div>
      )}

      <div className="analysis-score-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <ScoreCard label="综合评分" value={score.total} tone={getScoreColor(score.total)} />
        <ScoreCard label="技能匹配" value={score.skills} tone={getScoreColor(score.skills)} />
        <ScoreCard label="学历匹配" value={score.education} tone={getScoreColor(score.education)} />
        <ScoreCard label="匹配率" value={`${score.match_rate}%`} tone={getScoreColor(score.match_rate)} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <Badge tone={getRecommendationTone(recommendation)}>
          {recommendation}
        </Badge>
      </div>

      <div style={{ display: 'grid', gap: 18 }}>
        {suggestions.length > 0 && (
          <Section title="💡 建议">
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {suggestions.map((s, i) => (
                <li key={i} style={{ marginBottom: 6 }}>{s}</li>
              ))}
            </ul>
          </Section>
        )}

        {risks.length > 0 && (
          <Section title="⚠️ 风险提示">
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {risks.map((r, i) => (
                <li key={i} style={{ marginBottom: 6, color: '#dc2626' }}>{r}</li>
              ))}
            </ul>
          </Section>
        )}

        {action_plan.length > 0 && (
          <Section title="📋 行动计划">
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              {action_plan.map((a, i) => (
                <li key={i} style={{ marginBottom: 6 }}>{a}</li>
              ))}
            </ol>
          </Section>
        )}
      </div>
    </div>
  );
}

function ScoreCard({ label, value, tone }: { label: string; value: number | string; tone: 'emerald' | 'amber' | 'rose' }) {
  const numValue = typeof value === 'number' ? value : parseInt(value);
  const colors: Record<string, { bg: string; text: string }> = {
    emerald: { bg: '#ecfdf5', text: '#059669' },
    amber: { bg: '#fffbeb', text: '#d97706' },
    rose: { bg: '#fef2f2', text: '#dc2626' },
  };

  return (
    <div style={{
      textAlign: 'center',
      padding: '14px 10px',
      borderRadius: 10,
      background: colors[tone].bg,
      border: `1px solid ${colors[tone].text}22`,
    }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: colors[tone].text, lineHeight: 1.2 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      padding: '14px 16px',
      borderRadius: 10,
      background: '#fafafa',
      border: '1px solid #e5e7eb',
    }}>
      <h4 style={{ margin: '0 0 10px 0', fontSize: 15, fontWeight: 600 }}>{title}</h4>
      <div style={{ fontSize: 14, lineHeight: 1.7, color: '#374151' }}>{children}</div>
    </div>
  );
}

export function isAnalysisResult(data: unknown): data is AnalysisResult & { _meta?: MetaInfo } {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return typeof d.score === 'object' &&
    d.score !== null &&
    typeof (d.score as Record<string, unknown>).total === 'number' &&
    typeof d.recommendation === 'string';
}