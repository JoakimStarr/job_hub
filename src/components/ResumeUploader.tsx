'use client';

import { useState, useCallback } from 'react';
import type { ResumeProfile, ParseResult } from '@/lib/resume-types';
import { API } from '@/lib/api';

interface ResumeUploaderProps {
  onParseSuccess: (profile: ResumeProfile) => void;
  onParseError: (error: string) => void;
  acceptedFormats?: string[];
  maxSize?: number;
}

export default function ResumeUploader({
  onParseSuccess,
  onParseError,
  acceptedFormats = ['.txt'],
  maxSize = 5,
}: ResumeUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [resumeText, setResumeText] = useState('');

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, []);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.txt')) {
      onParseError('目前仅支持TXT格式的简历文件');
      return;
    }

    if (file.size > maxSize * 1024 * 1024) {
      onParseError(`文件大小超过${maxSize}MB限制`);
      return;
    }

    setIsParsing(true);
    setParseProgress(0);

    try {
      const text = await file.text();
      setResumeText(text);
      setParseProgress(30);

      const result: ParseResult = await API.request<ParseResult>('/api/resume/parse', {
        method: 'POST',
        body: JSON.stringify({ text }),
      });

      setParseProgress(70);
      setParseProgress(100);

      if (result.warnings.length > 0) {
        console.warn('解析警告:', result.warnings);
      }

      onParseSuccess(result.profile);
    } catch (error) {
      onParseError(error instanceof Error ? error.message : '简历解析失败');
    } finally {
      setIsParsing(false);
    }
  };

  const handleTextSubmit = async () => {
    if (!resumeText.trim()) {
      onParseError('请输入简历内容');
      return;
    }

    setIsParsing(true);
    setParseProgress(0);

    try {
      setParseProgress(30);

      const result: ParseResult = await API.request<ParseResult>('/api/resume/parse', {
        method: 'POST',
        body: JSON.stringify({ text: resumeText }),
      });

      setParseProgress(70);
      setParseProgress(100);

      if (result.warnings.length > 0) {
        console.warn('解析警告:', result.warnings);
      }

      onParseSuccess(result.profile);
    } catch (error) {
      onParseError(error instanceof Error ? error.message : '简历解析失败');
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6 text-center">上传简历</h2>
      
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isParsing ? (
          <div className="py-8">
            <div className="mb-4 text-lg">正在解析简历...</div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-blue-500 h-4 rounded-full transition-all duration-300"
                style={{ width: `${parseProgress}%` }}
              />
            </div>
            <div className="mt-2 text-sm text-gray-600">{parseProgress}%</div>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="text-lg mb-2">拖拽或点击上传简历</p>
            <p className="text-sm text-gray-500 mb-4">
              支持格式: {acceptedFormats.join(', ')} | 最大: {maxSize}MB
            </p>
            <input
              type="file"
              accept={acceptedFormats.join(',')}
              onChange={handleFileSelect}
              className="hidden"
              id="resume-upload"
            />
            <label
              htmlFor="resume-upload"
              className="cursor-pointer bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors inline-block"
            >
              选择文件
            </label>
          </>
        )}
      </div>

      <div className="mt-6">
        <div className="flex items-center mb-4">
          <div className="flex-1 border-t border-gray-300" />
          <span className="px-4 text-sm text-gray-500">或者直接粘贴简历内容</span>
          <div className="flex-1 border-t border-gray-300" />
        </div>
        
        <textarea
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          placeholder="请粘贴简历文本内容..."
          className="w-full h-64 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          disabled={isParsing}
        />
        
        <button
          onClick={handleTextSubmit}
          disabled={isParsing || !resumeText.trim()}
          className="mt-4 w-full bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isParsing ? '解析中...' : '开始解析'}
        </button>
      </div>
    </div>
  );
}
