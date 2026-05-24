'use client';

import { useState, useCallback, useRef } from 'react';
import type { ResumeProfile, ParseResult } from '@/lib/resume-types';
import { API } from '@/lib/api';
import { getFriendlyErrorMessage } from '@/lib/error-messages';
import { ResumeParseSummary, type ResumeParseSummaryMeta } from '@/components/ResumeParseSummary';
import dynamic from 'next/dynamic';
import styles from './resume-uploader.module.css';

const ProfileEditor = dynamic(() => import('./ProfileEditor'), {
  ssr: false,
  loading: () => <div className={styles.loadingEditor}>加载编辑器...</div>,
});

interface ResumeUploaderProps {
  onParseSuccess: (profile: ResumeProfile) => void;
  onParseError: (error: string) => void;
  acceptedFormats?: string[];
  maxSize?: number;
}

export default function ResumeUploader({
  onParseSuccess,
  onParseError,
  acceptedFormats = ['.pdf', '.doc', '.docx', '.txt'],
  maxSize = 10,
}: ResumeUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parseProgress, setParseProgress] = useState(0);
  const [resumeText, setResumeText] = useState('');
  const [parseSummary, setParseSummary] = useState<ResumeParseSummaryMeta | null>(null);
  const [parseMessage, setParseMessage] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<ResumeProfile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
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

  const validateFile = (file: File): string | null => {
    const fileName = file.name.toLowerCase();
    const supportedExtensions = ['.pdf', '.doc', '.docx', '.txt'];
    const isSupported = supportedExtensions.some(ext => fileName.endsWith(ext));

    if (!isSupported) {
      return getFriendlyErrorMessage('Invalid file type');
    }

    if (file.size > maxSize * 1024 * 1024) {
      return getFriendlyErrorMessage('File too large');
    }

    return null;
  };

  const uploadWithProgress = async (file: File): Promise<any> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            reject(new Error('解析响应失败'));
          }
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            reject(new Error(errorResponse.error || '上传失败'));
          } catch (e) {
            reject(new Error(`上传失败 (${xhr.status})`));
          }
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error(getFriendlyErrorMessage('Upload failed')));
      });

      xhr.open('POST', '/api/resume/upload');

      const formData = new FormData();
      formData.append('resume', file);

      xhr.send(formData);
    });
  };

  const handleFile = async (file: File) => {
    const validationError = validateFile(file);
    
    if (validationError) {
      setParseMessage(validationError);
      setParseSummary(null);
      onParseError(validationError);
      return;
    }

    setIsParsing(true);
    setUploadProgress(0);
    setParseProgress(0);
    setParseMessage('正在上传简历文件…');
    setParseSummary(null);

    try {
      setUploadProgress(10);
      
      const result: ParseResult = await API.parseResumeFile(file);
      setUploadProgress(100);
      
      setResumeText(result.profile.resumeText || '');
      setParseProgress(30);
      setParseMessage('正在解析简历内容…');

      await new Promise(resolve => setTimeout(resolve, 300));
      setParseProgress(70);
      setParseMessage('正在构建用户画像…');

      await new Promise(resolve => setTimeout(resolve, 300));
      setParseProgress(100);

      setParseSummary(result.meta || null);
      setParseMessage(result.meta ? '✅ 简历解析成功!' : '简历解析已完成');

      if (result.warnings.length > 0) {
        console.warn('解析警告:', result.warnings);
      }

      setCurrentProfile(result.profile);
      onParseSuccess(result.profile);
      
      if (result.meta?.profile_saved) {
        setShowEditor(true);
      }
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? getFriendlyErrorMessage(error.message)
        : getFriendlyErrorMessage('Upload failed');
      
      setParseMessage(errorMessage);
      setParseSummary(null);
      onParseError(errorMessage);
    } finally {
      setIsParsing(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const handleTextSubmit = async () => {
    if (!resumeText.trim()) {
      const errorMessage = '请输入简历内容';
      setParseMessage(errorMessage);
      setParseSummary(null);
      onParseError(errorMessage);
      return;
    }

    setIsParsing(true);
    setParseProgress(0);
    setParseMessage('正在解析文本简历…');
    setParseSummary(null);

    try {
      setParseProgress(30);

      const result: ParseResult = await API.parseResumeText(resumeText);

      setParseProgress(70);
      setParseMessage('正在构建用户画像…');

      await new Promise(resolve => setTimeout(resolve, 300));
      setParseProgress(100);

      setParseSummary(result.meta || null);
      setParseMessage(result.meta ? '✅ 文本简历解析成功!' : '简历解析已完成');

      if (result.warnings.length > 0) {
        console.warn('解析警告:', result.warnings);
      }

      setCurrentProfile(result.profile);
      onParseSuccess(result.profile);
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? getFriendlyErrorMessage(error.message)
        : '简历解析失败';
      
      setParseMessage(errorMessage);
      setParseSummary(null);
      onParseError(errorMessage);
    } finally {
      setIsParsing(false);
    }
  };

  const formatIcons = [
    { icon: '📄', name: 'PDF文档', ext: '.pdf' },
    { icon: '📝', name: 'Word文档', ext: '.doc/.docx' },
    { icon: '📃', name: '纯文本', ext: '.txt' },
  ];

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
            fileInputRef.current?.click();
          }
        }}
      >
        {isParsing ? (
          <div className={styles.parsing}>
            <div className={styles.parsingText}>
              {uploadProgress < 100 ? '正在上传文件...' : '正在解析简历...'}
            </div>
            
            {(uploadProgress > 0 && uploadProgress < 100) && (
              <>
                <div className={styles.progressBarBg}
                  role="progressbar"
                  aria-label="上传进度"
                  aria-valuenow={uploadProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className={`${styles.progressBarFill} ${styles.uploadProgress}`}
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <div className={styles.progressPercent}>
                  {uploadProgress}% 
                  {uploadProgress === 100 && <span className={styles.successText}> ✅ 上传成功!</span>}
                </div>
              </>
            )}

            {uploadProgress === 0 || uploadProgress >= 100 ? (
              <>
                <div className={styles.progressBarBg}
                  role="progressbar"
                  aria-label="解析进度"
                  aria-valuenow={parseProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className={styles.progressBarFill}
                    style={{ width: `${parseProgress}%` }}
                  />
                </div>
                <div className={styles.progressPercent}>{parseProgress}%</div>
              </>
            ) : null}
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
            
            <p className={styles.uploadTitle}>
              {isDragging ? '📂 松开以上传简历' : '📄 点击或拖拽PDF/Word简历到这里'}
            </p>
            
            <div className={styles.formatIcons}>
              {formatIcons.map(format => (
                <div key={format.ext} className={styles.formatItem}>
                  <span className={styles.formatIcon}>{format.icon}</span>
                  <span className={styles.formatName}>{format.name}</span>
                  <span className={styles.formatExt}>{format.ext}</span>
                </div>
              ))}
            </div>

            <p className={styles.uploadHint}>
              最大文件大小: {maxSize}MB
            </p>

            <input
              type="file"
              ref={fileInputRef}
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

      {parseSummary && currentProfile && (
        <div className={styles.previewSection}>
          <div className={styles.previewHeader}>
            <h3>✅ 简历解析成功!</h3>
          </div>
          <div className={styles.previewContent}>
            <div className={styles.previewDivider}>──────────────</div>
            
            {currentProfile.name && (
              <div className={styles.previewRow}>
                <span className={styles.previewLabel}>👤 姓名:</span>
                <span className={styles.previewValue}>{currentProfile.name}</span>
              </div>
            )}
            
            {currentProfile.education.length > 0 && (
              <div className={styles.previewRow}>
                <span className={styles.previewLabel}>🎓 学历:</span>
                <span className={styles.previewValue}>
                  {currentProfile.education[0]?.degree} - {currentProfile.education[0]?.school}
                </span>
              </div>
            )}
            
            {currentProfile.skills.length > 0 && (
              <div className={styles.previewRow}>
                <span className={styles.previewLabel}>💻 技能:</span>
                <span className={styles.previewValue}>{currentProfile.skills.join(', ')}</span>
              </div>
            )}
            
            {currentProfile.internships.length > 0 && (
              <div className={styles.previewRow}>
                <span className={styles.previewLabel}>💼 经验:</span>
                <span className={styles.previewValue}>
                  {currentProfile.internships.length}段实习/工作经验
                </span>
              </div>
            )}

            <button
              className={styles.matchButton}
              onClick={() => {
                onParseSuccess(currentProfile);
              }}
            >
              开始智能匹配 →
            </button>
          </div>
        </div>
      )}

      <ResumeParseSummary
        status={isParsing ? 'loading' : parseSummary ? 'success' : parseMessage ? 'error' : 'idle'}
        meta={parseSummary}
        message={parseMessage}
      />

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

      {showEditor && currentProfile && (
        <div className={styles.editorSection}>
          <div className={styles.editorHeader}>
            <h3>✏️ 编辑和补充画像信息</h3>
            <p className={styles.editorHint}>
              解析结果已自动保存。您可以修改、补充或添加遗漏的信息，这些修改将用于更精准的岗位匹配。
            </p>
          </div>
          
          <ProfileEditor
            initialProfile={currentProfile}
            onProfileUpdate={(updatedProfile) => {
              setCurrentProfile(updatedProfile);
              onParseSuccess(updatedProfile);
            }}
          />
        </div>
      )}
    </div>
  );
}
