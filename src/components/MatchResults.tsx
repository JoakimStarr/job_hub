'use client';

import type { MatchResult } from '@/lib/resume-types';
import { scoreEngine } from '@/lib/score-engine';
import styles from './match-results.module.css';

interface MatchResultsProps {
  matches: MatchResult[];
  onViewDetail: (jobId: number) => void;
  onExportReport?: (jobId: number) => void;
}

export default function MatchResults({
  matches,
  onViewDetail,
  onExportReport,
}: MatchResultsProps) {
  if (matches.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyText}>暂无匹配结果</p>
      </div>
    );
  }

  const sprintJobs = matches.filter(m => m.score.total >= 85);
  const matchJobs = matches.filter(m => m.score.total >= 70 && m.score.total < 85);
  const potentialJobs = matches.filter(m => m.score.total >= 55 && m.score.total < 70);
  const challengeJobs = matches.filter(m => m.score.total < 55);

  return (
    <div className={styles.container}>
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

function MatchCard({ match, onViewDetail, onExportReport }: MatchCardProps) {
  const { job, score, rank } = match;
  const level = scoreEngine.getMatchLevel(score.total);
  const color = scoreEngine.getMatchColor(score.total);

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
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

        <div className={styles.scoreBlock}>
          <div
            className={styles.scoreValue}
            style={{ color }}
          >
            {score.total}
          </div>
          <div className={styles.scoreLabel}>{level}</div>
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

      {score.matchedFields.length > 0 && (
        <div className={styles.tagSection}>
          <div className={styles.tagSectionLabel}>匹配项:</div>
          <div className={styles.tagList}>
            {score.matchedFields.map((field, index) => (
              <span key={index} className={styles.matchTag}>
                {field}
              </span>
            ))}
          </div>
        </div>
      )}

      {score.gaps.length > 0 && (
        <div className={styles.tagSection}>
          <div className={styles.tagSectionLabel}>能力缺口:</div>
          <div className={styles.tagList}>
            {score.gaps.map((gap, index) => (
              <span key={index} className={styles.gapTag}>
                {gap}
              </span>
            ))}
          </div>
        </div>
      )}

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
}