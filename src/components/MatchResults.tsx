'use client';

import type { MatchResult } from '@/lib/resume-types';
import { scoreEngine } from '@/lib/score-engine';

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
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">暂无匹配结果</p>
      </div>
    );
  }

  const sprintJobs = matches.filter(m => m.score.total >= 85);
  const matchJobs = matches.filter(m => m.score.total >= 70 && m.score.total < 85);
  const potentialJobs = matches.filter(m => m.score.total >= 55 && m.score.total < 70);
  const challengeJobs = matches.filter(m => m.score.total < 55);

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">匹配结果</h2>
        <p className="text-gray-600">找到 {matches.length} 个匹配岗位</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">{sprintJobs.length}</div>
          <div className="text-sm text-green-700">冲刺岗</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600">{matchJobs.length}</div>
          <div className="text-sm text-blue-700">匹配岗</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-600">{potentialJobs.length}</div>
          <div className="text-sm text-yellow-700">潜力岗</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-600">{challengeJobs.length}</div>
          <div className="text-sm text-red-700">挑战岗</div>
        </div>
      </div>

      <div className="space-y-4">
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
    <div className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-gray-500">#{rank}</span>
            <h3 className="text-xl font-semibold">{job.title}</h3>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>{job.company}</span>
            <span>•</span>
            <span>{job.location}</span>
            {job.salary && (
              <>
                <span>•</span>
                <span className="text-green-600 font-medium">{job.salary}</span>
              </>
            )}
          </div>
        </div>
        
        <div className="text-right">
          <div
            className="text-3xl font-bold"
            style={{ color }}
          >
            {score.total}
          </div>
          <div className="text-sm text-gray-500">{level}</div>
        </div>
      </div>

      <div className="mb-4">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="h-2 rounded-full transition-all"
            style={{ width: `${score.total}%`, backgroundColor: color }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4 text-sm">
        <div>
          <span className="text-gray-500">技能:</span>
          <span className="ml-1 font-medium">{Math.round(score.breakdown.skills)}/30</span>
        </div>
        <div>
          <span className="text-gray-500">学历:</span>
          <span className="ml-1 font-medium">{Math.round(score.breakdown.education)}/20</span>
        </div>
        <div>
          <span className="text-gray-500">专业:</span>
          <span className="ml-1 font-medium">{Math.round(score.breakdown.major)}/15</span>
        </div>
        <div>
          <span className="text-gray-500">地点:</span>
          <span className="ml-1 font-medium">{Math.round(score.breakdown.location)}/10</span>
        </div>
        <div>
          <span className="text-gray-500">经验:</span>
          <span className="ml-1 font-medium">{Math.round(score.breakdown.experience)}/15</span>
        </div>
        <div>
          <span className="text-gray-500">行业:</span>
          <span className="ml-1 font-medium">{Math.round(score.breakdown.industry)}/10</span>
        </div>
      </div>

      {score.matchedFields.length > 0 && (
        <div className="mb-4">
          <div className="text-sm text-gray-500 mb-1">匹配项:</div>
          <div className="flex flex-wrap gap-2">
            {score.matchedFields.map((field, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs"
              >
                {field}
              </span>
            ))}
          </div>
        </div>
      )}

      {score.gaps.length > 0 && (
        <div className="mb-4">
          <div className="text-sm text-gray-500 mb-1">能力缺口:</div>
          <div className="flex flex-wrap gap-2">
            {score.gaps.map((gap, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs"
              >
                {gap}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => onViewDetail(job.id)}
          className="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
        >
          查看详情
        </button>
        {onExportReport && (
          <button
            onClick={() => onExportReport(job.id)}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            导出报告
          </button>
        )}
      </div>
    </div>
  );
}
