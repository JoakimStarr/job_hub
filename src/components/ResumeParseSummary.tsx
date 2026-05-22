'use client';

import styles from './ResumeParseSummary.module.css';

export type ResumeParseSummaryMeta = {
  source_type: 'pdf' | 'txt' | 'text';
  file_name?: string;
  extracted_chars: number;
  extracted_words: number;
  capabilities: string[];
};

export function ResumeParseSummary({
  status,
  meta,
  message,
}: {
  status: 'loading' | 'success' | 'error' | 'idle';
  meta?: ResumeParseSummaryMeta | null;
  message?: string;
}) {
  if (status === 'idle' && !meta && !message) return null;

  const isSuccess = status === 'success' && !!meta;
  const title = isSuccess ? '简历解析成功' : status === 'loading' ? '简历解析中' : status === 'error' ? '简历解析失败' : '解析状态';
  const statusLabel = isSuccess ? '成功' : status === 'loading' ? '处理中' : status === 'error' ? '失败' : '未开始';

  return (
    <div className={styles.card} aria-live="polite">
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <div className={styles.title}>{title}</div>
          <div className={styles.subtitle}>
            {isSuccess ? '提取结果可直接用于后续 AI 分析、岗位匹配与推荐生成' : message || '等待上传或重新解析简历'}
          </div>
          {meta?.file_name ? <div className={styles.fileName}>{meta.file_name}</div> : null}
        </div>
        <div className={`${styles.statusChip} ${status === 'success' ? styles.statusSuccess : status === 'loading' ? styles.statusLoading : status === 'error' ? styles.statusError : styles.statusLoading}`}>
          {statusLabel}
        </div>
      </div>

      {isSuccess ? (
        <>
          <div className={styles.metrics}>
            <div className={styles.metric}>
              <div className={styles.metricValue}>{meta.extracted_chars}</div>
              <div className={styles.metricLabel}>已提取字符数</div>
            </div>
            <div className={styles.metric}>
              <div className={styles.metricValue}>{meta.extracted_words}</div>
              <div className={styles.metricLabel}>字数估计</div>
            </div>
          </div>
          <div className={styles.caps}>
            {meta.capabilities.map((capability) => (
              <span key={capability} className={styles.cap}>{capability}</span>
            ))}
          </div>
          <div className={styles.message}>
            {meta.source_type === 'pdf' ? 'PDF 已解析完成，后续可直接用于岗位分析、AI 追问和推荐。' : '文本简历已解析完成，可继续进行匹配与分析。'}
          </div>
        </>
      ) : message ? (
        <div className={styles.message}>{message}</div>
      ) : null}
    </div>
  );
}
