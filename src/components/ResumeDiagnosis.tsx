'use client';

import type { ResumeProfile, ResumeDiagnosis } from '@/lib/resume-types';
import { useState, useEffect } from 'react';

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
      const response = await fetch('/api/resume/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile }),
      });

      if (!response.ok) {
        throw new Error('简历诊断失败');
      }

      const result = await response.json();
      setDiagnosis(result);
    } catch (error) {
      console.error('简历诊断错误:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-2xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-4" />
          <div className="h-32 bg-gray-200 rounded mb-4" />
          <div className="h-24 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!diagnosis) {
    return null;
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-blue-100';
    if (score >= 40) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">简历诊断报告</h2>

      <div className={`${getScoreBgColor(diagnosis.score)} rounded-lg p-6 mb-6`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm text-gray-600">简历诊断分</div>
            <div className={`text-5xl font-bold ${getScoreColor(diagnosis.score)}`}>
              {diagnosis.score}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">满分</div>
            <div className="text-2xl font-bold text-gray-400">100</div>
          </div>
        </div>
        <div className="w-full bg-white bg-opacity-50 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${
              diagnosis.score >= 80 ? 'bg-green-500' :
              diagnosis.score >= 60 ? 'bg-blue-500' :
              diagnosis.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${diagnosis.score}%` }}
          />
        </div>
      </div>

      {diagnosis.highlights.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center">
            <span className="text-green-500 mr-2">✓</span>
            优势亮点
          </h3>
          <ul className="space-y-2">
            {diagnosis.highlights.map((highlight, index) => (
              <li key={index} className="flex items-start">
                <span className="text-green-500 mr-2">•</span>
                <span className="text-gray-700">{highlight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {diagnosis.risks.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center">
            <span className="text-yellow-500 mr-2">⚠</span>
            风险提示
          </h3>
          <ul className="space-y-2">
            {diagnosis.risks.map((risk, index) => (
              <li key={index} className="flex items-start">
                <span className="text-yellow-500 mr-2">•</span>
                <span className="text-gray-700">{risk}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {diagnosis.gaps.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center">
            <span className="text-red-500 mr-2">✗</span>
            主要缺口
          </h3>
          <ul className="space-y-2">
            {diagnosis.gaps.map((gap, index) => (
              <li key={index} className="flex items-start">
                <span className="text-red-500 mr-2">•</span>
                <span className="text-gray-700">{gap}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {diagnosis.suggestions.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center">
            <span className="text-blue-500 mr-2">💡</span>
            优化建议
          </h3>
          <ul className="space-y-2">
            {diagnosis.suggestions.map((suggestion, index) => (
              <li key={index} className="flex items-start">
                <span className="text-blue-500 mr-2">•</span>
                <span className="text-gray-700">{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {onImprove && diagnosis.suggestions.length > 0 && (
        <button
          onClick={() => onImprove(diagnosis.suggestions)}
          className="w-full bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
        >
          查看改进方案
        </button>
      )}
    </div>
  );
}
