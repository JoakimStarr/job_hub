'use client';

import { useCallback, useEffect, useMemo, useRef, useState, memo, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import type { JobItem } from '@/lib/types';
import { API } from '@/lib/api';
import MarkdownRenderer from '@/components/MarkdownRenderer';

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export const SectionCard = memo(function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={joinClassNames('panel', className)}>
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
});

export const MetricCard = memo(function MetricCard({ label, value, hint, tone = 'blue' }: { label: string; value: string | number; hint?: string; tone?: 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' }) {
  const numericValue = typeof value === 'number' ? value : (Number.isNaN(Number(value)) ? null : Number(value));
  const [displayed, setDisplayed] = useState(numericValue !== null ? 0 : null);
  const [animating, setAnimating] = useState(numericValue !== null);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (numericValue === null) {
      setDisplayed(null);
      setAnimating(false);
      return;
    }
    const target = numericValue;
    const duration = 800;
    startRef.current = performance.now();
    setAnimating(true);

    function animate(now: number) {
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);
      setDisplayed(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayed(target);
        setAnimating(false);
      }
    }

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [numericValue]);

  const displayValue = numericValue !== null ? (displayed ?? numericValue) : value;

  return (
    <article className={joinClassNames('metric-card', `tone-${tone}`, animating && 'animate-countup')}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{displayValue}</div>
      {hint ? <div className="metric-hint">{hint}</div> : null}
    </article>
  );
});

export function Button({ children, variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  const hasTextContent = typeof children === 'string' && children.trim().length > 0;
  const ariaLabel = props['aria-label'] || (!hasTextContent && !Array.isArray(children) ? props.title || '按钮' : undefined);

  return (
    <button
      {...props}
      aria-label={ariaLabel || props['aria-label']}
      className={joinClassNames('btn', `btn-${variant}`, props.className)}
    >
      {children}
    </button>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={joinClassNames('input', props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={joinClassNames('select', props.className)} />;
}

export const Badge = memo(function Badge({ children, tone = 'slate', style, onClick }: { children: ReactNode; tone?: 'slate' | 'blue' | 'emerald' | 'amber' | 'rose' | 'violet'; style?: React.CSSProperties; onClick?: (e: React.MouseEvent<HTMLSpanElement>) => void }) {
  return <span className={joinClassNames('badge', `badge-${tone}`)} style={style} onClick={onClick}>{children}</span>;
});

export const EmptyState = memo(function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
});

export const StarButton = memo(function StarButton({ active, onClick, size = 'md' }: { active: boolean; onClick: () => void; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      className={joinClassNames('star-btn', `star-btn-${size}`)}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      aria-label={active ? '取消收藏' : '收藏'}
      title={active ? '取消收藏' : '收藏'}
    >
      <span className={joinClassNames('star-icon', active && 'star-icon-active')}>
        {active ? '★' : '☆'}
      </span>
    </button>
  );
});

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const JobCard = memo(function JobCard({ job, onToggleFavorite, onClick, onTagClick }: { job: JobItem; onToggleFavorite?: (job: JobItem) => void; onClick?: (job: JobItem) => void; onTagClick?: (type: string, value: string) => void }) {
  const handleClick = useCallback(() => {
    if (onClick) onClick(job);
  }, [onClick, job]);

  const dateStr = formatDate(job.publish_date || job.created_at);

  return (
    <article
      className={joinClassNames('job-card', onClick && 'job-card-clickable')}
      onClick={handleClick}
      role="article"
      aria-label={`岗位: ${job.title}${job.company ? ` - ${job.company}` : ''}`}
    >
      <div className="job-card-main">
        <div className="job-title-row">
          <h3>{job.title}</h3>
          {job.is_favorite ? <Badge tone="amber">收藏</Badge> : null}
        </div>
        <div className="job-meta">
          {job.company ? <span style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onTagClick?.('company', job.company!); }}>{job.company}</span> : null}
          {job.location ? <span style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onTagClick?.('location', job.location!); }}>📍 {job.location}</span> : null}
          {job.salary ? <span>💰 {job.salary}</span> : null}
          {dateStr ? <span>📅 {dateStr}</span> : null}
        </div>
        <p className="job-description">{job.description}</p>
        <div className="job-tags">
          {job.source ? <Badge tone="blue" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onTagClick?.('source', job.source!); }}>{job.source}</Badge> : null}
          {job.job_type ? <Badge tone="slate" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onTagClick?.('job_type', job.job_type!); }}>{job.job_type}</Badge> : null}
          {job.industry ? <Badge tone="violet" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onTagClick?.('industry', job.industry!); }}>{job.industry}</Badge> : null}
          {job.education ? <Badge tone="emerald" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onTagClick?.('education', job.education!); }}>{job.education}</Badge> : null}
        </div>
      </div>
      {onToggleFavorite ? (
        <div className="job-card-star">
          <StarButton active={!!job.is_favorite} onClick={() => onToggleFavorite(job)} />
        </div>
      ) : null}
    </article>
  );
});

export function JobDetailModal({ job, onClose, onToggleFavorite }: { job: JobItem; onClose: () => void; onToggleFavorite?: (job: JobItem) => void }) {
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  const detailDate = formatDate(job.publish_date || job.created_at);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!modalRef.current) return;

    const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableElements = Array.from(modalRef.current.querySelectorAll<HTMLElement>(focusableSelectors));
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    function handleTabKey(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    }

    document.addEventListener('keydown', handleTabKey);
    const previousActiveElement = document.activeElement as HTMLElement;
    firstElement?.focus();

    return () => {
      document.removeEventListener('keydown', handleTabKey);
      previousActiveElement?.focus();
    };
  }, []);

  const handleAnalyze = useCallback(async () => {
    setAiLoading(true);
    setAiError('');
    setAiResult(null);
    try {
      const result = await API.analyzeJob(job.id);
      let text = '';
      if (typeof result === 'string') {
        text = result;
      } else if (result && typeof result === 'object') {
        const obj = result as Record<string, unknown>;
        text = String(obj.answer || obj.result || obj.content || JSON.stringify(result, null, 2));
      }
      setAiResult(text);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI 分析失败');
    } finally {
      setAiLoading(false);
    }
  }, [job.id]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="job-detail-modal"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-detail-title"
      >
        <div className="job-detail-head">
          <div>
            <h2 id="job-detail-title">{job.title}</h2>
            <div className="job-detail-meta">
              {job.company ? <span>{job.company}</span> : null}
              {job.location ? <span>📍 {job.location}</span> : null}
              {detailDate ? <span>📅 {detailDate}</span> : null}
            </div>
          </div>
          <div className="job-detail-actions">
            {onToggleFavorite ? (
              <StarButton active={!!job.is_favorite} onClick={() => onToggleFavorite(job)} />
            ) : null}
            {job.source_url || job.apply_url ? (
              <a
                href={job.apply_url || job.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ fontSize: 13, textDecoration: 'none' }}
                aria-label="查看原网页"
              >
                查看原网页 ↗
              </a>
            ) : null}
            <button type="button" className="modal-close-btn" onClick={onClose} aria-label="关闭">
              ✕
            </button>
          </div>
        </div>

        <div className="job-detail-body">
          <div className="job-detail-info-grid">
            <div className="job-detail-info-item">
              <span className="job-detail-info-label">薪资</span>
              <span>{job.salary || '薪资面议'}</span>
            </div>
            <div className="job-detail-info-item">
              <span className="job-detail-info-label">类型</span>
              <span>{job.job_type || '未指定'}</span>
            </div>
            <div className="job-detail-info-item">
              <span className="job-detail-info-label">行业</span>
              <span>{job.industry || '未指定'}</span>
            </div>
            <div className="job-detail-info-item">
              <span className="job-detail-info-label">学历</span>
              <span>{job.education || '未指定'}</span>
            </div>
            <div className="job-detail-info-item">
              <span className="job-detail-info-label">来源</span>
              <span>{job.source || '未知'}</span>
            </div>
            {detailDate ? (
              <div className="job-detail-info-item">
                <span className="job-detail-info-label">日期</span>
                <span>{detailDate}</span>
              </div>
            ) : null}
            {(job.source_url || job.apply_url) ? (
              <div className="job-detail-info-item">
                <span className="job-detail-info-label">来源链接</span>
                <a
                  href={job.apply_url || job.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--primary)', wordBreak: 'break-all' }}
                >
                  {job.apply_url || job.source_url}
                </a>
              </div>
            ) : null}
          </div>

          <div className="job-detail-section">
            <h3>岗位描述</h3>
            <p className="job-detail-description">{job.description || '暂无描述'}</p>
          </div>

          <div className="job-detail-section">
            <h3>AI 分析</h3>
            {!aiResult && !aiLoading && !aiError ? (
              <Button variant="secondary" onClick={handleAnalyze}>AI 分析</Button>
            ) : null}
            {aiLoading ? (
              <div className="ai-loading">
                <div className="loading-orb" style={{ width: 28, height: 28, borderWidth: 3 }} />
                <span>AI 分析中...</span>
              </div>
            ) : null}
            {aiError ? (
              <div className="notice notice-error">{aiError}</div>
            ) : null}
            {aiResult ? (
              <div className="ai-result"><MarkdownRenderer content={aiResult} /></div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Skeleton({ type = 'text' }: { type?: 'text' | 'card' | 'metric' }) {
  if (type === 'metric') {
    return (
      <div className="skeleton-metric-grid">
        <div className="metric-card tone-blue skeleton">
          <div className="skeleton-text" style={{ width: '40%' }} />
          <div className="skeleton-text" style={{ width: '60%', height: 32, marginTop: 10 }} />
          <div className="skeleton-text" style={{ width: '30%', marginTop: 8 }} />
        </div>
        <div className="metric-card tone-emerald skeleton">
          <div className="skeleton-text" style={{ width: '40%' }} />
          <div className="skeleton-text" style={{ width: '60%', height: 32, marginTop: 10 }} />
          <div className="skeleton-text" style={{ width: '30%', marginTop: 8 }} />
        </div>
        <div className="metric-card tone-amber skeleton">
          <div className="skeleton-text" style={{ width: '40%' }} />
          <div className="skeleton-text" style={{ width: '60%', height: 32, marginTop: 10 }} />
          <div className="skeleton-text" style={{ width: '30%', marginTop: 8 }} />
        </div>
        <div className="metric-card tone-violet skeleton">
          <div className="skeleton-text" style={{ width: '40%' }} />
          <div className="skeleton-text" style={{ width: '60%', height: 32, marginTop: 10 }} />
          <div className="skeleton-text" style={{ width: '30%', marginTop: 8 }} />
        </div>
      </div>
    );
  }

  if (type === 'card') {
    return (
      <div className="skeleton-card-grid">
        <div className="job-card skeleton">
          <div className="skeleton-text" style={{ width: '60%', height: 20 }} />
          <div className="skeleton-text" style={{ width: '80%', marginTop: 10 }} />
          <div className="skeleton-text" style={{ width: '100%', marginTop: 10 }} />
          <div className="skeleton-text" style={{ width: '40%', marginTop: 10 }} />
        </div>
        <div className="job-card skeleton">
          <div className="skeleton-text" style={{ width: '50%', height: 20 }} />
          <div className="skeleton-text" style={{ width: '70%', marginTop: 10 }} />
          <div className="skeleton-text" style={{ width: '90%', marginTop: 10 }} />
          <div className="skeleton-text" style={{ width: '35%', marginTop: 10 }} />
        </div>
        <div className="job-card skeleton">
          <div className="skeleton-text" style={{ width: '55%', height: 20 }} />
          <div className="skeleton-text" style={{ width: '75%', marginTop: 10 }} />
          <div className="skeleton-text" style={{ width: '85%', marginTop: 10 }} />
          <div className="skeleton-text" style={{ width: '45%', marginTop: 10 }} />
        </div>
      </div>
    );
  }

  return <div className="skeleton skeleton-text" />;
}

export function FileUpload({ onFileSelect, accept, label }: { onFileSelect: (file: File) => void; accept?: string; label?: string }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    onFileSelect(file);
  }, [onFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div
      className={joinClassNames('file-upload-zone', isDragging && 'file-upload-zone-active')}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        style={{ display: 'none' }}
      />
      {fileName ? (
        <div className="file-upload-selected">
          <span className="file-upload-icon">📄</span>
          <span>{fileName}</span>
        </div>
      ) : (
        <div className="file-upload-placeholder">
          <span className="file-upload-icon">📁</span>
          <span>{label || '点击或拖拽文件到此处上传'}</span>
        </div>
      )}
    </div>
  );
}

export function TabNav<T extends string>({ tabs, active, onChange }: { tabs: { key: T; label: string }[]; active: T; onChange: (key: T) => void }) {
  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    let newIndex: number;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      newIndex = (index + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      newIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      newIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      newIndex = tabs.length - 1;
    } else {
      return;
    }
    onChange(tabs[newIndex].key);
  }, [tabs, onChange]);

  return (
    <nav className="tab-nav" role="tablist" aria-label="选项卡导航">
      {tabs.map((tab, index) => (
        <button
          key={tab.key}
          type="button"
          id={`tab-${tab.key}`}
          className={joinClassNames('tab-item', active === tab.key && 'tab-item-active')}
          onClick={() => onChange(tab.key)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          role="tab"
          aria-selected={active === tab.key}
          aria-controls={`panel-${tab.key}`}
          tabIndex={active === tab.key ? 0 : -1}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="filter-bar">{children}</div>;
}