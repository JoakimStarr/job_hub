'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import ResumeUploader from '@/components/ResumeUploader';
import MatchResults from '@/components/MatchResults';
import ResumeDiagnosis from '@/components/ResumeDiagnosis';
import type { ResumeProfile, MatchResult } from '@/lib/resume-types';
import { API } from '@/lib/api';
import { MAX_MATCH_RESULTS } from '@/lib/constants';
import styles from './match.module.css';

type Step = 'upload' | 'confirm' | 'match' | 'results';

type ReportResult = {
  score: { total: number };
  recommendation: string;
  suggestions: string[];
  actionPlan: string[];
};

const STEP_ORDER = ['upload', 'confirm', 'match', 'results'];
const STEP_LABELS: Record<Step, string> = {
  upload: '上传简历',
  confirm: '确认画像',
  match: '开始匹配',
  results: '查看结果',
};

export default function MatchPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('upload');
  const [profile, setProfile] = useState<ResumeProfile | null>(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportResult | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const currentStepIndex = STEP_ORDER.indexOf(currentStep);

  const handleParseSuccess = (parsedProfile: ResumeProfile) => {
    setProfile(parsedProfile);
    setCurrentStep('confirm');
    setError(null);
  };

  const handleParseError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleConfirm = async () => {
    if (!profile) return;

    setCurrentStep('match');
    setLoading(true);
    setError(null);

    try {
      const result = await API.request<{ matches: MatchResult[]; total: number; processingTime: number }>('/api/match/jobs', {
        method: 'POST',
        body: JSON.stringify({
          profile,
          filters: {
            maxResults: MAX_MATCH_RESULTS,
          },
        }),
      });
      setMatches(result.matches);
      setCurrentStep('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : '岗位匹配失败');
      setCurrentStep('confirm');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = (jobId: number) => {
    router.push(`/jobs?highlight=${jobId}`);
  };

  const handleExportReport = async (jobId: number) => {
    if (!profile) return;

    setReportLoading(true);
    setReport(null);
    setError(null);

    try {
      const result = await API.request<ReportResult>('/api/match/job/' + jobId, {
        method: 'POST',
        body: JSON.stringify({ profile }),
      });
      setReport(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出报告失败');
    } finally {
      setReportLoading(false);
    }
  };

  const handleBack = () => {
    if (currentStep === 'confirm') {
      setCurrentStep('upload');
    } else if (currentStep === 'results') {
      setCurrentStep('confirm');
    }
  };

  const handleReset = () => {
    setCurrentStep('upload');
    setProfile(null);
    setMatches([]);
    setError(null);
    setReport(null);
  };

  return (
    <AppShell title="简历匹配" description="上传简历分析并匹配最佳岗位" requiredPermission="view_jobs">
      <div className={styles.matchInner}>
        <div className={styles.matchHeader}>
          <h1 className={styles.matchTitle}>简历智能匹配</h1>
          <p className={styles.matchSubtitle}>
            上传简历，自动匹配最适合的岗位
          </p>
        </div>

        <div
          className={styles.steps}
          role="progressbar"
          aria-valuenow={currentStepIndex + 1}
          aria-valuemin={1}
          aria-valuemax={STEP_ORDER.length}
          aria-label="简历匹配进度"
        >
          {STEP_ORDER.map((step, index) => (
            <div key={step} className={styles.stepItem}>
              <div
                className={`${styles.stepCircle} ${
                  currentStepIndex === index ? styles.stepActive :
                  currentStepIndex > index ? styles.stepDone :
                  styles.stepPending
                }`}
              >
                {index + 1}
              </div>
              {index < 3 && (
                <div
                  className={`${styles.stepLine} ${
                    currentStepIndex > index ? styles.stepLineDone : styles.stepLinePending
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className={styles.stepLabel}>
          {STEP_LABELS[currentStep]}
        </div>

        {error && (
          <div className={styles.errorNotice}>
            {error}
          </div>
        )}

        {currentStep === 'upload' && (
          <ResumeUploader
            onParseSuccess={handleParseSuccess}
            onParseError={handleParseError}
          />
        )}

        {currentStep === 'confirm' && profile && (
          <div className={styles.confirmSection}>
            <div className={styles.profilePanel}>
              <h2>确认简历画像</h2>

              <div className={styles.profileGrid}>
                <div className={styles.profileSection}>
                  <h3>基本信息</h3>
                  <div className={styles.profileField}>
                    <span className={styles.profileFieldLabel}>姓名:</span>
                    <span className={styles.profileFieldValue}>{profile.name || '未识别'}</span>
                  </div>
                  <div className={styles.profileField}>
                    <span className={styles.profileFieldLabel}>电话:</span>
                    <span className={styles.profileFieldValue}>{profile.phone || '未识别'}</span>
                  </div>
                  <div className={styles.profileField}>
                    <span className={styles.profileFieldLabel}>邮箱:</span>
                    <span className={styles.profileFieldValue}>{profile.email || '未识别'}</span>
                  </div>
                </div>

                <div className={styles.profileSection}>
                  <h3>教育背景</h3>
                  {profile.education.length > 0 ? (
                    profile.education.map((edu, index) => (
                      <div key={index} className={styles.internItem}>
                        <div className={styles.internCompany}>{edu.school}</div>
                        <div className={styles.internPosition}>
                          {edu.degree} - {edu.major}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={styles.muted}>未识别</div>
                  )}
                </div>

                <div className={styles.profileSection}>
                  <h3>技能列表</h3>
                  {profile.skills.length > 0 ? (
                    <div className={styles.skillWrap}>
                      {profile.skills.map((skill, index) => (
                        <span key={index} className={styles.skillTag}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.muted}>未识别</div>
                  )}
                </div>

                <div className={styles.profileSection}>
                  <h3>实习经历</h3>
                  {profile.internships.length > 0 ? (
                    profile.internships.map((intern, index) => (
                      <div key={index} className={styles.internItem}>
                        <div className={styles.internCompany}>{intern.company}</div>
                        <div className={styles.internPosition}>{intern.position}</div>
                      </div>
                    ))
                  ) : (
                    <div className={styles.muted}>未识别</div>
                  )}
                </div>
              </div>

              <ResumeDiagnosis profile={profile} />
            </div>

            <div className={styles.confirmActions}>
              <button onClick={handleBack} className={styles.confirmBtnOutline}>
                重新上传
              </button>
              <button onClick={handleConfirm} className={styles.confirmBtnPrimary}>
                开始匹配
              </button>
            </div>
          </div>
        )}

        {currentStep === 'match' && (
          <div className={styles.loadingSection}>
            <div className={styles.spinner} />
            <p className={styles.loadingText}>正在匹配岗位...</p>
            <p className={styles.loadingHint}>这可能需要几秒钟时间</p>
          </div>
        )}

        {currentStep === 'results' && (
          <div className={styles.resultsSection}>
            <button onClick={handleBack} className={styles.backLink}>
              ← 返回修改
            </button>

            <MatchResults
              matches={matches}
              onViewDetail={handleViewDetail}
              onExportReport={handleExportReport}
            />

            {reportLoading && (
              <div className={styles.reportPanel}>
                <div className={styles.spinnerSmall} />
                <p className={styles.muted} style={{ textAlign: 'center' }}>正在生成匹配报告...</p>
              </div>
            )}

            {report && !reportLoading && (
              <div className={styles.reportPanel}>
                <h3>匹配报告</h3>
                <div className={styles.reportGrid}>
                  <div className={`${styles.reportMetric} ${styles.reportMetricBlue}`}>
                    <span className={styles.reportMetricLabel}>匹配度</span>
                    <div className={`${styles.reportMetricValue} ${styles.reportMetricValueBlue}`}>{report.score.total}分</div>
                  </div>
                  <div className={`${styles.reportMetric} ${styles.reportMetricGreen}`}>
                    <span className={styles.reportMetricLabel}>推荐等级</span>
                    <div className={`${styles.reportMetricValue} ${styles.reportMetricValueGreen}`}>{report.recommendation}</div>
                  </div>
                </div>
                {report.suggestions && report.suggestions.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <h4 className={styles.reportSectionTitle}>改进建议</h4>
                    <ul className={styles.reportList}>
                      {report.suggestions.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {report.actionPlan && report.actionPlan.length > 0 && (
                  <div>
                    <h4 className={styles.reportSectionTitle}>行动计划</h4>
                    <ul className={styles.reportList}>
                      {report.actionPlan.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <button onClick={handleReset} className={styles.resetBtn}>
              重新开始
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}