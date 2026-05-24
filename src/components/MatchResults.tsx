'use client';

import { useMemo, useState, memo } from 'react';
import type { MatchResult } from '@/lib/resume-types';
import { scoreEngine } from '@/lib/score-engine';
import { SCORE_THRESHOLDS } from '@/lib/constants';
import styles from './match-results.module.css';

interface MatchResultsProps {
  matches: MatchResult[];
  loading?: boolean;
  onViewDetail: (jobId: number) => void;
  onExportReport?: (jobId: number) => void;
}

export default function MatchResults({
  matches,
  loading = false,
  onViewDetail,
  onExportReport,
}: MatchResultsProps) {
  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.skeletonHeader}>
          <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
          <div className={`${styles.skeleton} ${styles.skeletonSubtitle}`} />
        </div>

        <div className={styles.statsGrid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${styles.statCard} ${styles.skeletonStatCard}`}>
              <div className={`${styles.skeleton} ${styles.skeletonCircle}`} />
              <div className={`${styles.skeleton} ${styles.skeletonText}`} />
            </div>
          ))}
        </div>

        <div className={styles.cardList}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`${styles.card} ${styles.skeletonCard}`}>
              <div className={styles.skeletonCardHeader}>
                <div>
                  <div className={`${styles.skeleton} ${styles.skeletonJobTitle}`} />
                  <div className={`${styles.skeleton} ${styles.skeletonJobMeta}`} />
                </div>
                <div className={`${styles.skeleton} ${styles.skeletonScore}`} />
              </div>
              <div className={`${styles.skeleton} ${styles.skeletonProgress}`} />
              <div className={styles.skeletonBreakdownGrid}>
                {Array.from({ length: 6 }).map((_, j) => (
                  <div key={j} className={`${styles.skeleton} ${styles.skeletonSmallText}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyText}>暂无匹配结果</p>
      </div>
    );
  }

  const groupedResults = useMemo(() => ({
    sprintJobs: matches.filter(m => m.score.total >= SCORE_THRESHOLDS.SPRINT),
    matchJobs: matches.filter(m => m.score.total >= SCORE_THRESHOLDS.MATCH && m.score.total < SCORE_THRESHOLDS.SPRINT),
    potentialJobs: matches.filter(m => m.score.total >= SCORE_THRESHOLDS.POTENTIAL && m.score.total < SCORE_THRESHOLDS.MATCH),
    challengeJobs: matches.filter(m => m.score.total < SCORE_THRESHOLDS.POTENTIAL),
  }), [matches]);

  const { sprintJobs, matchJobs, potentialJobs, challengeJobs } = groupedResults;

  return (
    <div className={`${styles.container} ${!loading && matches.length > 0 ? styles.fadeIn : ''}`}>
      <div className={styles.header}>
        <h2 className={styles.title}>匹配结果</h2>
        <p className={styles.subtitle}>找到 {matches.length} 个匹配岗位</p>
      </div>

      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} ${styles.statCardGreen}`}>
          <div className={`${styles.statValue} ${styles.statValueGreen}`}>{sprintJobs.length}</div>
          <div className={`${styles.statLabel} ${styles.statLabelGreen}`}>冲刺岗</div>
        </div>
        <div className={`${styles.statCard} ${styles.statCardBlue}`}>
          <div className={`${styles.statValue} ${styles.statValueBlue}`}>{matchJobs.length}</div>
          <div className={`${styles.statLabel} ${styles.statLabelBlue}`}>匹配岗</div>
        </div>
        <div className={`${styles.statCard} ${styles.statCardYellow}`}>
          <div className={`${styles.statValue} ${styles.statValueYellow}`}>{potentialJobs.length}</div>
          <div className={`${styles.statLabel} ${styles.statLabelYellow}`}>潜力岗</div>
        </div>
        <div className={`${styles.statCard} ${styles.statCardRed}`}>
          <div className={`${styles.statValue} ${styles.statValueRed}`}>{challengeJobs.length}</div>
          <div className={`${styles.statLabel} ${styles.statLabelRed}`}>挑战岗</div>
        </div>
      </div>

      <div className={styles.cardList}>
        {matches.map((match) => (
          <MatchCard
            key={match.job.id}
            match={match}
            onViewDetail={onViewDetail}
            onExportReport={onExportReport}
          />
        ))}
      </div>
    </div>
  );
}

interface MatchCardProps {
  match: MatchResult;
  onViewDetail: (jobId: number) => void;
  onExportReport?: (jobId: number) => void;
}

const MatchCard = memo(function MatchCard({ match, onViewDetail, onExportReport }: MatchCardProps) {
  const { job, score, rank } = match;
  const level = scoreEngine.getMatchLevel(score.total);
  const color = scoreEngine.getMatchColor(score.total);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);

  const hasDetailedData = score.matchedFields && score.gaps && score.breakdown;

  const handleRipple = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    setRipples(prev => [...prev, { x, y, id }]);
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== id));
    }, 600);
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/jobs/${job.id}`;
    try {
      await navigator.clipboard.writeText(url);
      alert('链接已复制到剪贴板');
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  return (
    <div
      className={styles.card}
      onClick={(e) => handleRipple(e)}
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="ripple-effect"
          style={{
            position: 'absolute',
            borderRadius: '50%',
            background: 'rgba(102, 126, 234, 0.3)',
            transform: 'scale(0)',
            animation: 'rippleEffect 0.6s linear',
            width: 20,
            height: 20,
            left: ripple.x - 10,
            top: ripple.y - 10,
            pointerEvents: 'none',
          }}
        />
      ))}
      <style>{`
        @keyframes rippleEffect {
          to {
            transform: scale(4);
            opacity: 0;
          }
        }
        @keyframes heartBeat {
          0%, 100% { transform: scale(1); }
          25% { transform: scale(1.3); }
          50% { transform: scale(1); }
          75% { transform: scale(1.15); }
        }
        .favorite-btn.liked {
          animation: heartBeat 0.6s ease;
          color: #ef4444 !important;
        }
        .hover-actions {
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .card-wrapper:hover .hover-actions {
          opacity: 1;
        }
      `}</style>

      <div className={`${styles.cardHeader} card-wrapper`} style={{ position: 'relative' }}>
        <div className={styles.cardInfo}>
          <div className={styles.cardTitleRow}>
            <span className={styles.rank}>#{rank}</span>
            <h3 className={styles.jobTitle}>{job.title}</h3>
          </div>
          <div className={styles.jobMeta}>
            <span>{job.company}</span>
            <span>•</span>
            <span>{job.location}</span>
            {job.salary && (
              <>
                <span>•</span>
                <span className={styles.salary}>{job.salary}</span>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className={styles.scoreBlock}>
            <div
              className={styles.scoreValue}
              style={{ color }}
            >
              {score.total}
            </div>
            <div className={styles.scoreLabel}>{level}</div>
          </div>

          <div className="hover-actions" style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowPreview(!showPreview);
              }}
              title="快速预览"
              style={{
                background: '#f3f4f6',
                border: 'none',
                borderRadius: '50%',
                width: 32,
                height: 32,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.background = '#e5e7eb';
                (e.target as HTMLElement).style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.background = '#f3f4f6';
                (e.target as HTMLElement).style.transform = 'scale(1)';
              }}
            >
              👁️
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsFavorite(!isFavorite);
              }}
              className={`favorite-btn ${isFavorite ? 'liked' : ''}`}
              title={isFavorite ? '取消收藏' : '添加收藏'}
              style={{
                background: '#f3f4f6',
                border: 'none',
                borderRadius: '50%',
                width: 32,
                height: 32,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                color: isFavorite ? '#ef4444' : '#9ca3af',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.background = '#fee2e2';
                (e.target as HTMLElement).style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                if (!isFavorite) {
                  (e.target as HTMLElement).style.background = '#f3f4f6';
                  (e.target as HTMLElement).style.color = '#9ca3af';
                }
                (e.target as HTMLElement).style.transform = 'scale(1)';
              }}
            >
              {isFavorite ? '❤️' : '🤍'}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleShare();
              }}
              title="分享职位"
              style={{
                background: '#f3f4f6',
                border: 'none',
                borderRadius: '50%',
                width: 32,
                height: 32,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.background = '#e5e7eb';
                (e.target as HTMLElement).style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.background = '#f3f4f6';
                (e.target as HTMLElement).style.transform = 'scale(1)';
              }}
            >
              🔗
            </button>
          </div>
        </div>
      </div>

      <div className={styles.progressBarBg}>
        <div
          className={styles.progressBarFill}
          style={{ width: `${score.total}%`, backgroundColor: color }}
        />
      </div>

      <div className={styles.breakdownGrid}>
        <div>
          <span className={styles.breakdownLabel}>技能:</span>
          <span className={styles.breakdownValue}>{Math.round(score.breakdown.skills)}/30</span>
        </div>
        <div>
          <span className={styles.breakdownLabel}>学历:</span>
          <span className={styles.breakdownValue}>{Math.round(score.breakdown.education)}/20</span>
        </div>
        <div>
          <span className={styles.breakdownLabel}>专业:</span>
          <span className={styles.breakdownValue}>{Math.round(score.breakdown.major)}/15</span>
        </div>
        <div>
          <span className={styles.breakdownLabel}>地点:</span>
          <span className={styles.breakdownValue}>{Math.round(score.breakdown.location)}/10</span>
        </div>
        <div>
          <span className={styles.breakdownLabel}>经验:</span>
          <span className={styles.breakdownValue}>{Math.round(score.breakdown.experience)}/15</span>
        </div>
        <div>
          <span className={styles.breakdownLabel}>行业:</span>
          <span className={styles.breakdownValue}>{Math.round(score.breakdown.industry)}/10</span>
        </div>
      </div>

      {hasDetailedData && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={styles.toggleDetailsBtn}
        >
          {isExpanded ? '收起详情' : '查看为什么匹配'}
          <span className={`${styles.toggleIcon} ${isExpanded ? styles.toggleIconExpanded : ''}`}>
            ▼
          </span>
        </button>
      )}

      <div className={`${styles.detailsPanel} ${isExpanded ? styles.detailsPanelExpanded : ''}`}>
        {hasDetailedData ? (
          <>
            {score.matchedFields.length > 0 && (
              <div className={styles.detailSection}>
                <h4 className={styles.detailSectionTitle}>
                  <span className={styles.checkIcon}>✅</span>
                  匹配项列表
                </h4>
                <ul className={styles.detailList}>
                  {score.matchedFields.map((field, index) => (
                    <li key={index} className={styles.detailListItemMatched}>
                      <span className={styles.listItemIcon}>✓</span>
                      {field}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {score.gaps.length > 0 && (
              <div className={styles.detailSection}>
                <h4 className={styles.detailSectionTitle}>
                  <span className={styles.crossIcon}>❌</span>
                  能力缺口列表
                </h4>
                <ul className={styles.detailList}>
                  {score.gaps.map((gap, index) => (
                    <li key={index} className={styles.detailListItemGap}>
                      <span className={styles.listItemIcon}>✗</span>
                      {gap}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className={styles.detailSection}>
              <h4 className={styles.detailSectionTitle}>
                <span className={styles.chartIcon}>📈</span>
                各维度得分详情
              </h4>
              <div className={styles.dimensionBars}>
                {Object.entries(score.breakdown).map(([key, value]) => {
                  const dimensionConfig: Record<string, { label: string; max: number }> = {
                    skills: { label: '技能', max: 30 },
                    education: { label: '学历', max: 20 },
                    major: { label: '专业', max: 15 },
                    location: { label: '地点', max: 10 },
                    experience: { label: '经验', max: 15 },
                    industry: { label: '行业', max: 10 },
                  };
                  
                  const config = dimensionConfig[key];
                  if (!config) return null;
                  
                  const percentage = (value / config.max) * 100;
                  
                  return (
                    <div key={key} className={styles.dimensionBarRow}>
                      <span className={styles.dimensionLabel}>{config.label}</span>
                      <div className={styles.dimensionBarContainer}>
                        <div
                          className={styles.dimensionBarFill}
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: percentage >= 80 ? 'var(--success)' :
                                           percentage >= 60 ? 'var(--primary)' :
                                           percentage >= 40 ? 'var(--warning)' : 'var(--danger)',
                          }}
                        />
                      </div>
                      <span className={styles.dimensionValue}>
                        {Math.round(value)}/{config.max}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className={styles.noDataMessage}>
            暂无详细分析数据
          </div>
        )}
      </div>

      <div className={styles.actions}>
        <button
          onClick={() => onViewDetail(job.id)}
          className={styles.viewBtn}
        >
          查看详情
        </button>
        {onExportReport && (
          <button
            onClick={() => onExportReport(job.id)}
            className={styles.exportBtn}
          >
            导出报告
          </button>
        )}
      </div>
    </div>
  );
});
