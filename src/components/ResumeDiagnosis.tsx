'use client';

import type { ResumeProfile, ResumeDiagnosis } from '@/lib/resume-types';
import { API } from '@/lib/api';
import { DIAGNOSIS_SCORE_LEVELS } from '@/lib/constants';
import { useState, useEffect } from 'react';
import styles from './resume-diagnosis.module.css';

function getScoreColor(score: number): string {
  const level = DIAGNOSIS_SCORE_LEVELS.find(l => score >= l.min);
  switch (level?.colorKey) {
    case 'green': return styles.scoreValueGreen;
    case 'blue': return styles.scoreValueBlue;
    case 'yellow': return styles.scoreValueYellow;
    default: return styles.scoreValueRed;
  }
}

function getScoreBgColor(score: number): string {
  const level = DIAGNOSIS_SCORE_LEVELS.find(l => score >= l.min);
  switch (level?.colorKey) {
    case 'green': return styles.scoreCardGreen;
    case 'blue': return styles.scoreCardBlue;
    case 'yellow': return styles.scoreCardYellow;
    default: return styles.scoreCardRed;
  }
}

function getScoreBarColor(score: number): string {
  const level = DIAGNOSIS_SCORE_LEVELS.find(l => score >= l.min);
  switch (level?.colorKey) {
    case 'green': return styles.scoreBarGreen;
    case 'blue': return styles.scoreBarBlue;
    case 'yellow': return styles.scoreBarYellow;
    default: return styles.scoreBarRed;
  }
}

interface ResumeDiagnosisProps {
  profile: ResumeProfile;
  onImprove?: (suggestions: string[]) => void;
}

export default function ResumeDiagnosis({ profile, onImprove }: ResumeDiagnosisProps) {
  const [diagnosis, setDiagnosis] = useState<ResumeDiagnosis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    diagnoseResume();
  }, [profile]);

  const diagnoseResume = async () => {
    try {
      setLoading(true);
      const result = await API.request('/api/resume/diagnose', {
        method: 'POST',
        body: JSON.stringify({ profile }),
      });
      setDiagnosis(result as ResumeDiagnosis | null);
    } catch (error) {
      console.error('简历诊断错误:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.pulse}>
          <div className={`${styles.pulseLine} ${styles.pulseLineSm}`} />
          <div className={`${styles.pulseLine} ${styles.pulseLineMd}`} />
          <div className={`${styles.pulseLine} ${styles.pulseLineLg}`} />
        </div>
      </div>
    );
  }

  if (!diagnosis) {
    return null;
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>简历诊断报告</h2>

      <div className={`${styles.scoreCard} ${getScoreBgColor(diagnosis.score)}`}>
        <div className={styles.scoreCardHeader}>
          <div>
            <div className={styles.scoreLabel}>简历诊断分</div>
            <div className={`${styles.scoreValue} ${getScoreColor(diagnosis.score)}`}>
              {diagnosis.score}
            </div>
          </div>
          <div className={styles.scoreMax}>
            <div className={styles.scoreMaxLabel}>满分</div>
            <div className={styles.scoreMaxValue}>100</div>
          </div>
        </div>
        <div className={styles.scoreBarBg}>
          <div
            className={`${styles.scoreBarFill} ${getScoreBarColor(diagnosis.score)}`}
            style={{ width: `${diagnosis.score}%` }}
          />
        </div>
      </div>

      {diagnosis.highlights.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <span className={`${styles.sectionIcon} ${styles.sectionIconGreen}`}>✓</span>
            优势亮点
          </h3>
          <ul className={styles.sectionList}>
            {diagnosis.highlights.map((highlight, index) => (
              <li key={index} className={styles.sectionItem}>
                <span className={`${styles.sectionBullet} ${styles.sectionBulletGreen}`}>•</span>
                <span className={styles.sectionText}>{highlight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {diagnosis.risks.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <span className={`${styles.sectionIcon} ${styles.sectionIconYellow}`}>⚠</span>
            风险提示
          </h3>
          <ul className={styles.sectionList}>
            {diagnosis.risks.map((risk, index) => (
              <li key={index} className={styles.sectionItem}>
                <span className={`${styles.sectionBullet} ${styles.sectionBulletYellow}`}>•</span>
                <span className={styles.sectionText}>{risk}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {diagnosis.gaps.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <span className={`${styles.sectionIcon} ${styles.sectionIconRed}`}>✗</span>
            主要缺口
          </h3>
          <ul className={styles.sectionList}>
            {diagnosis.gaps.map((gap, index) => (
              <li key={index} className={styles.sectionItem}>
                <span className={`${styles.sectionBullet} ${styles.sectionBulletRed}`}>•</span>
                <span className={styles.sectionText}>{gap}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {diagnosis.suggestions.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <span className={`${styles.sectionIcon} ${styles.sectionIconBlue}`}>💡</span>
            优化建议
          </h3>
          <ul className={styles.sectionList}>
            {diagnosis.suggestions.map((suggestion, index) => (
              <li key={index} className={styles.sectionItem}>
                <span className={`${styles.sectionBullet} ${styles.sectionBulletBlue}`}>•</span>
                <span className={styles.sectionText}>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {onImprove && diagnosis.suggestions.length > 0 && (
        <button
          onClick={() => onImprove(diagnosis.suggestions)}
          className={styles.actionBtn}
        >
          查看改进方案
        </button>
      )}
    </div>
  );
}