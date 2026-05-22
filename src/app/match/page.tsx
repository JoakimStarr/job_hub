'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import ResumeUploader from '@/components/ResumeUploader';
import ProfileEditor from '@/components/ProfileEditor';
import MatchResults from '@/components/MatchResults';
import ResumeDiagnosis from '@/components/ResumeDiagnosis';
import type { ResumeProfile, MatchResult } from '@/lib/resume-types';
import { maskPhone, maskEmail } from '@/lib/privacy';
import { API } from '@/lib/api';
import { MAX_MATCH_RESULTS } from '@/lib/constants';
import styles from './match.module.css';

type Step = 'upload' | 'confirm' | 'diagnosis' | 'match' | 'results';

type ReportResult = {
  score: { total: number };
  recommendation: string;
  suggestions: string[];
  actionPlan: string[];
};

type HistoryItem = {
  id: number;
  version: number;
  source: string;
  fileName: string | null;
  confidenceScore: number;
  updatedAt: string;
  isActive: boolean;
  profile?: ResumeProfile;
};

const STEP_ORDER = ['upload', 'confirm', 'diagnosis', 'match', 'results'];
const STEP_LABELS: Record<Step, string> = {
  upload: '上传简历',
  confirm: '确认画像',
  diagnosis: '简历诊断',
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

  // 历史记录
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const currentStepIndex = STEP_ORDER.indexOf(currentStep);

  // 加载历史记录
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const resp = await API.request<{ success: boolean; history: HistoryItem[] }>('/api/profile?action=history&limit=5');
      if (resp.history?.length > 0) {
        // 加载每个历史记录的画像数据
        const itemsWithProfile = await Promise.all(
          resp.history.map(async (item) => {
            try {
              const profileResp = await API.request<{ success: boolean; profile: ResumeProfile | null }>(`/api/profile?version=${item.version}`);
              return { ...item, profile: profileResp.profile || undefined };
            } catch {
              return item;
            }
          })
        );
        setHistory(itemsWithProfile);
      }
    } catch {
      // 未登录或无历史记录，忽略
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // 点击历史记录直接使用
  const handleHistoryClick = (item: HistoryItem) => {
    if (item.profile) {
      setProfile(item.profile);
      setCurrentStep('confirm');
      setError(null);
    }
  };

  const handleParseSuccess = (parsedProfile: ResumeProfile) => {
    setProfile(parsedProfile);
    setCurrentStep('confirm');
    setError(null);
    loadHistory(); // 刷新历史
  };

  const handleParseError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleProfileUpdate = (updatedProfile: ResumeProfile) => {
    setProfile(updatedProfile);
  };

  const handleConfirmAndDiagnose = () => {
    if (!profile) return;
    setCurrentStep('diagnosis');
  };

  const handleStartMatch = async () => {
    if (!profile) return;
    setCurrentStep('match');
    setLoading(true);
    setError(null);

    try {
      const result = await API.request<{ matches: MatchResult[]; total: number; processingTime: number }>('/api/match/jobs', {
        method: 'POST',
        body: JSON.stringify({ profile, filters: { maxResults: MAX_MATCH_RESULTS } }),
      });
      setMatches(result.matches);
      setCurrentStep('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : '岗位匹配失败');
      setCurrentStep('diagnosis');
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
    if (currentStep === 'confirm') setCurrentStep('upload');
    else if (currentStep === 'diagnosis') setCurrentStep('confirm');
    else if (currentStep === 'results') setCurrentStep('diagnosis');
  };

  const handleReset = () => {
    setCurrentStep('upload');
    setProfile(null);
    setMatches([]);
    setError(null);
    setReport(null);
    loadHistory();
  };

  return (
    <AppShell title="简历匹配" description="上传简历分析并匹配最佳岗位" requiredPermission="view_jobs">
      <div className={styles.matchInner}>
        <div className={styles.matchHeader}>
          <h1 className={styles.matchTitle}>简历智能匹配</h1>
          <p className={styles.matchSubtitle}>上传简历，自动匹配最适合的岗位</p>
        </div>

        <div className={styles.steps} role="progressbar"
          aria-valuenow={currentStepIndex + 1} aria-valuemin={1} aria-valuemax={STEP_ORDER.length} aria-label="简历匹配进度">
          {STEP_ORDER.map((step, index) => (
            <div key={step} className={styles.stepItem}>
              <div className={`${styles.stepCircle} ${
                currentStepIndex === index ? styles.stepActive :
                currentStepIndex > index ? styles.stepDone : styles.stepPending
              }`}>{index + 1}</div>
              {index < STEP_ORDER.length - 1 && (
                <div className={`${styles.stepLine} ${currentStepIndex > index ? styles.stepLineDone : styles.stepLinePending}`} />
              )}
            </div>
          ))}
        </div>
        <div className={styles.stepLabel}>{STEP_LABELS[currentStep]}</div>

        {error && <div className={styles.errorNotice}>{error}</div>}

        {/* 步骤1：上传简历 + 历史记录 */}
        {currentStep === 'upload' && (
          <>
            <ResumeUploader onParseSuccess={handleParseSuccess} onParseError={handleParseError} />

            {history.length > 0 && (
              <div className={styles.historySection}>
                <h3 className={styles.historyTitle}>历史记录</h3>
                <div className={styles.historyList}>
                  {history.map((item) => (
                    <button key={item.id} className={styles.historyCard}
                      onClick={() => handleHistoryClick(item)}>
                      <div className={styles.historyCardLeft}>
                        <div className={styles.historyName}>
                          {item.profile?.name || '未命名'}
                        </div>
                        <div className={styles.historyMeta}>
                          {item.fileName && <span>{item.fileName}</span>}
                          <span>{item.source === 'parsed' ? '解析' : '手动'}</span>
                          <span>{new Date(item.updatedAt).toLocaleDateString()}</span>
                        </div>
                        {item.profile && (
                          <div className={styles.historyTags}>
                            {item.profile.skills?.slice(0, 4).map((s, i) => (
                              <span key={i} className={styles.historyTag}>{s}</span>
                            ))}
                            {item.profile.skills?.length > 4 && (
                              <span className={styles.historyTag}>+{item.profile.skills.length - 4}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className={styles.historyCardRight}>
                        <div className={styles.historyScore}>
                          {Math.round(item.confidenceScore)}分
                        </div>
                        <div className={styles.historyScoreLabel}>完整度</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {historyLoading && (
              <div className={styles.historyLoading}>加载历史记录...</div>
            )}
          </>
        )}

        {/* 步骤2：确认画像（可编辑） */}
        {currentStep === 'confirm' && profile && (
          <div className={styles.confirmSection}>
            <div className={styles.profilePanel}>
              <div className={styles.confirmHint}>
                请确认和补充以下画像信息，隐私数据已自动脱敏（点击"显示隐私"可查看原文）
              </div>
              <ProfileEditor
                initialProfile={profile}
                onProfileUpdate={handleProfileUpdate}
              />
            </div>
            <div className={styles.confirmActions}>
              <button onClick={handleBack} className={styles.confirmBtnOutline}>重新上传</button>
              <button onClick={handleConfirmAndDiagnose} className={styles.confirmBtnPrimary}>确认并诊断简历</button>
            </div>
          </div>
        )}

        {/* 步骤3：简历诊断报告 */}
        {currentStep === 'diagnosis' && profile && (
          <div className={styles.confirmSection}>
            <div className={styles.profilePanel}>
              <ResumeDiagnosis profile={profile} />
            </div>
            <div className={styles.confirmActions}>
              <button onClick={handleBack} className={styles.confirmBtnOutline}>返回修改画像</button>
              <button onClick={handleStartMatch} className={styles.confirmBtnPrimary}>开始匹配岗位</button>
            </div>
          </div>
        )}

        {/* 步骤4：匹配中 */}
        {currentStep === 'match' && (
          <div className={styles.loadingSection}>
            <div className={styles.spinner} />
            <p className={styles.loadingText}>正在匹配岗位...</p>
            <p className={styles.loadingHint}>这可能需要几秒钟时间</p>
          </div>
        )}

        {/* 步骤5：匹配结果 */}
        {currentStep === 'results' && (
          <div className={styles.resultsSection}>
            <button onClick={handleBack} className={styles.backLink}>← 返回诊断</button>
            <MatchResults matches={matches} onViewDetail={handleViewDetail} onExportReport={handleExportReport} />
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
                {report.suggestions?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <h4 className={styles.reportSectionTitle}>改进建议</h4>
                    <ul className={styles.reportList}>{report.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </div>
                )}
                {report.actionPlan?.length > 0 && (
                  <div>
                    <h4 className={styles.reportSectionTitle}>行动计划</h4>
                    <ul className={styles.reportList}>{report.actionPlan.map((a, i) => <li key={i}>{a}</li>)}</ul>
                  </div>
                )}
              </div>
            )}
            <button onClick={handleReset} className={styles.resetBtn}>重新开始</button>
          </div>
        )}
      </div>
    </AppShell>
  );
}