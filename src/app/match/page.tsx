'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ResumeUploader from '@/components/ResumeUploader';
import MatchResults from '@/components/MatchResults';
import ResumeDiagnosis from '@/components/ResumeDiagnosis';
import type { ResumeProfile, MatchResult } from '@/lib/resume-types';
import { API } from '@/lib/api';

type Step = 'upload' | 'confirm' | 'match' | 'results';

export default function MatchPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('upload');
  const [profile, setProfile] = useState<ResumeProfile | null>(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            maxResults: 50,
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

    try {
      const result = await API.request<{ score: any; recommendation: string; suggestions: string[]; actionPlan: string[] }>('/api/match/job/' + jobId, {
        method: 'POST',
        body: JSON.stringify({ profile }),
      });
      
      console.log('匹配报告:', result);
      alert(`匹配报告已生成！\n匹配度: ${result.score.total}分\n推荐等级: ${result.recommendation}`);
    } catch (err) {
      console.error('导出报告错误:', err);
      alert('导出报告失败');
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
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-center mb-2">简历智能匹配</h1>
          <p className="text-center text-gray-600">
            上传简历，自动匹配最适合的岗位
          </p>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-center">
            {['upload', 'confirm', 'match', 'results'].map((step, index) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    currentStep === step || 
                    (index < ['upload', 'confirm', 'match', 'results'].indexOf(currentStep))
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {index + 1}
                </div>
                {index < 3 && (
                  <div
                    className={`w-20 h-1 ${
                      index < ['upload', 'confirm', 'match', 'results'].indexOf(currentStep)
                        ? 'bg-blue-500'
                        : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-center mt-2">
            <span className="text-sm text-gray-600">
              {currentStep === 'upload' && '上传简历'}
              {currentStep === 'confirm' && '确认画像'}
              {currentStep === 'match' && '开始匹配'}
              {currentStep === 'results' && '查看结果'}
            </span>
          </div>
        </div>

        {error && (
          <div className="max-w-2xl mx-auto mb-6">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          </div>
        )}

        {currentStep === 'upload' && (
          <ResumeUploader
            onParseSuccess={handleParseSuccess}
            onParseError={handleParseError}
          />
        )}

        {currentStep === 'confirm' && profile && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-2xl font-bold mb-6">确认简历画像</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">基本信息</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-gray-500">姓名:</span>
                      <span className="ml-2">{profile.name || '未识别'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">电话:</span>
                      <span className="ml-2">{profile.phone || '未识别'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">邮箱:</span>
                      <span className="ml-2">{profile.email || '未识别'}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">教育背景</h3>
                  {profile.education.length > 0 ? (
                    <div className="space-y-2">
                      {profile.education.map((edu, index) => (
                        <div key={index} className="text-sm">
                          <div className="font-medium">{edu.school}</div>
                          <div className="text-gray-600">
                            {edu.degree} - {edu.major}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-500">未识别</div>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">技能列表</h3>
                  {profile.skills.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {profile.skills.map((skill, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-500">未识别</div>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">实习经历</h3>
                  {profile.internships.length > 0 ? (
                    <div className="space-y-2">
                      {profile.internships.map((intern, index) => (
                        <div key={index} className="text-sm">
                          <div className="font-medium">{intern.company}</div>
                          <div className="text-gray-600">{intern.position}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-500">未识别</div>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <ResumeDiagnosis profile={profile} />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleBack}
                className="flex-1 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                重新上传
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
              >
                开始匹配
              </button>
            </div>
          </div>
        )}

        {currentStep === 'match' && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4" />
            <p className="text-lg text-gray-600">正在匹配岗位...</p>
            <p className="text-sm text-gray-500 mt-2">这可能需要几秒钟时间</p>
          </div>
        )}

        {currentStep === 'results' && (
          <div>
            <div className="mb-6">
              <button
                onClick={handleBack}
                className="text-blue-500 hover:text-blue-600"
              >
                ← 返回修改
              </button>
            </div>

            <MatchResults
              matches={matches}
              onViewDetail={handleViewDetail}
              onExportReport={handleExportReport}
            />

            <div className="text-center mt-8">
              <button
                onClick={handleReset}
                className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-colors"
              >
                重新开始
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
