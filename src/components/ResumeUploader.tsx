'use client';

import { useState, useCallback } from 'react';
import type { ResumeProfile, ParseResult } from '@/lib/resume-types';
import { API } from '@/lib/api';
import styles from './resume-uploader.module.css';

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
    <div className={styles.container}>
      <h2 className={styles.title}>上传简历</h2>

      <div
        className={`${styles.dropZone} ${isDragging ? styles.dropZoneActive : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        aria-label="上传简历"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const fileInput = document.getElementById('resume-upload') as HTMLInputElement;
            fileInput?.click();
          }
        }}
      >
        {isParsing ? (
          <div className={styles.parsing}>
            <div className={styles.parsingText}>正在解析简历...</div>
            <div className={styles.progressBarBg}
              role="progressbar"
              aria-valuenow={parseProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="解析进度"
            >
              <div
                className={styles.progressBarFill}
                style={{ width: `${parseProgress}%` }}
              />
            </div>
            <div className={styles.progressPercent}>{parseProgress}%</div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '16px' }}>
              <svg
                className={styles.uploadIcon}
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
            <p className={styles.uploadTitle}>拖拽或点击上传简历</p>
            <p className={styles.uploadHint}>
              支持格式: {acceptedFormats.join(', ')} | 最大: {maxSize}MB
            </p>
            <input
              type="file"
              accept={acceptedFormats.join(',')}
              onChange={handleFileSelect}
              className={styles.fileInput}
              id="resume-upload"
            />
            <label
              htmlFor="resume-upload"
              className={styles.uploadBtn}
            >
              选择文件
            </label>
          </>
        )}
      </div>

      <div className={styles.textareaSection}>
        <div className={styles.dividerRow}>
          <div className={styles.dividerLine} />
          <span className={styles.dividerText}>或者直接粘贴简历内容</span>
          <div className={styles.dividerLine} />
        </div>

        <textarea
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          placeholder="请粘贴简历文本内容..."
          className={styles.resumeTextarea}
          disabled={isParsing}
          aria-label="简历文本输入"
        />

        <button
          onClick={handleTextSubmit}
          disabled={isParsing || !resumeText.trim()}
          className={styles.submitBtn}
        >
          {isParsing ? '解析中...' : '开始解析'}
        </button>
      </div>
    </div>
  );
}