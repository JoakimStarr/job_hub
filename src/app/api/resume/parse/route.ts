import { NextRequest, NextResponse } from 'next/server';
import { parseResumeText } from '@/lib/resume-parser';
import { createErrorResponse, ErrorCode, withApiHandler } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import {
  initUserProfileTables,
  getPdfCache,
  setPdfCache,
  saveParsedProfile,
} from '@/lib/user-profile-db';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import crypto from 'crypto';
import fs from 'node:fs';
import os from 'node:os';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);

initUserProfileTables();

type ParseResumeMeta = {
  source_type: 'pdf' | 'txt' | 'text';
  file_name?: string;
  extracted_chars: number;
  extracted_words: number;
  capabilities: string[];
  cache_hit?: boolean;
  profile_saved?: boolean;
};

async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  return crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
}

async function extractTextFromPdf(file: File, fileHash: string): Promise<{
  text: string;
  usedOcr: boolean;
  durationMs: number;
}> {
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `resume_${Date.now()}_${file.name}`);
  const startTime = Date.now();

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(tempFilePath, buffer);

    logger.info('调用 Python PDF 解析器', { 
      file: file.name, 
      hash: fileHash.substring(0, 8),
      path: tempFilePath 
    });

    const scriptPath = path.resolve(process.cwd(), 'scripts/pdf_parser.py');
    const { stdout, stderr } = await execFileAsync('python3', [scriptPath, tempFilePath], {
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (stderr) {
      logger.debug('Python PDF 解析器 stderr', { output: stderr });
    }

    const result = JSON.parse(stdout);
    const durationMs = Date.now() - startTime;

    if (!result.success) {
      if (result.need_install) {
        throw new Error(
          'PDF 解析依赖未安装。请运行：\n' +
          'sudo apt-get install tesseract-ocr tesseract-ocr-chi-sim poppler-utils\n' +
          'pip3 install pdf2image pytesseract pypdfium2'
        );
      }
      throw new Error(result.error || 'PDF 解析失败');
    }

    if (!result.text || result.text.length < 50) {
      throw new Error(
        'PDF 文本提取失败（可能是扫描质量太差或加密文档）。' +
        '请将简历转换为 TXT 格式后重试。'
      );
    }

    logger.info('Python PDF 解析成功', {
      chars: result.cleaned_length,
      pages: result.pages,
      used_ocr: result.used_ocr,
      duration: `${durationMs}ms`,
    });

    return {
      text: result.text,
      usedOcr: result.used_ocr || false,
      durationMs,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('ENOENT') || errorMessage.includes('python3')) {
      throw new Error(
        'Python 环境未找到。请确保系统已安装 Python 3，或使用 TXT 格式上传简历。'
      );
    }
    
    if (errorMessage.includes('timeout')) {
      throw new Error('PDF 解析超时（超过30秒）。请尝试较小的 PDF 文件或转换为 TXT 格式。');
    }

    logger.error('Python PDF 解析错误', { error: errorMessage });
    throw error;

  } finally {
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (cleanupError) {
      logger.warn('临时文件清理失败', { error: cleanupError instanceof Error ? cleanupError.message : cleanupError });
    }
  }
}

async function extractTextFromFile(file: File): Promise<{
  text: string;
  isPdf: boolean;
  usedOcr?: boolean;
  durationMs?: number;
}> {
  const fileName = file.name.toLowerCase();
  const isPdf = file.type === 'application/pdf' || fileName.endsWith('.pdf');

  if (isPdf) {
    const fileHash = await calculateFileHash(file);
    
    const cached = getPdfCache(fileHash);
    if (cached) {
      logger.info('PDF解析缓存命中', { 
        fileName: file.name, 
        hash: fileHash.substring(0, 8)
      });
      
      return {
        text: cached.parsedText,
        isPdf: true,
        durationMs: 0,
      };
    }

    const result = await extractTextFromPdf(file, fileHash);
    
    setPdfCache(
      fileHash,
      file.name,
      file.size,
      result.text,
      {} as any,
      result.usedOcr,
      result.durationMs
    );

    return {
      text: result.text,
      isPdf: true,
      usedOcr: result.usedOcr,
      durationMs: result.durationMs,
    };
  }

  if (file.type === 'text/plain' || fileName.endsWith('.txt') || !file.type) {
    return {
      text: await file.text(),
      isPdf: false,
    };
  }

  throw new Error('目前仅支持 PDF 和 TXT 格式的简历文件');
}

function buildParseMeta(
  text: string, 
  sourceType: ParseResumeMeta['source_type'], 
  fileName?: string,
  options?: {
    cacheHit?: boolean;
    durationMs?: number;
    usedOcr?: boolean;
  }
): ParseResumeMeta {
  const extractedChars = text.replace(/\s+/g, '').length;
  const extractedWords = text.trim()
    ? text.trim().split(/\s+/).filter(Boolean).length || extractedChars
    : 0;

  return {
    source_type: sourceType,
    file_name: fileName,
    extracted_chars: extractedChars,
    extracted_words: extractedWords,
    capabilities: ['岗位匹配', 'AI 分析', '推荐生成', '简历建议'],
    cache_hit: options?.cacheHit,
  };
}

export const POST = withApiHandler(async (request: NextRequest) => {
  const { requireAuthUnified } = await import('@/lib/auth-server');
  const user = await requireAuthUnified(request);
  const userId = user.id || 1;

  const contentType = request.headers.get('content-type') || '';
  let text = '';
  let parseMeta: ParseResumeMeta = buildParseMeta('', 'text');
  let fileHash = '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: '缺少简历文件' },
        { status: 400 }
      );
    }

    fileHash = await calculateFileHash(file);
    const sourceType = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf' ? 'pdf' : 'txt';
    
    const extractionResult = await extractTextFromFile(file);
    text = extractionResult.text;
    
    parseMeta = buildParseMeta(text, sourceType, file.name, {
      cacheHit: extractionResult.isPdf && extractionResult.durationMs === 0,
      durationMs: extractionResult.durationMs,
      usedOcr: extractionResult.usedOcr,
    });

  } else {
    const body = await request.json();
    text = body.text;
    parseMeta = buildParseMeta(text || '', 'text');
  }

  if (!text || typeof text !== 'string') {
    return NextResponse.json(
      { error: '缺少简历文本内容' },
      { status: 400 }
    );
  }

  if (text.length < 50) {
    return NextResponse.json(
      { error: '简历文本内容过短，请提供完整的简历内容' },
      { status: 400 }
    );
  }

  if (text.length > 100000) {
    return NextResponse.json(
      { error: '简历文本内容过长，请控制在100KB以内' },
      { status: 500 }
    );
  }

  const result = parseResumeText(text);

  let profileSaved = false;

  try {
    if (fileHash && parseMeta.source_type === 'pdf') {
      saveParsedProfile(
        userId,
        result.profile,
        fileHash,
        parseMeta.file_name || '',
        result.confidence
      );
      profileSaved = true;
      
      logger.info('自动保存解析后的用户画像', {
        userId,
        fileName: parseMeta.file_name,
        confidence: result.confidence,
      });
    }
  } catch (saveError) {
    logger.warn('保存用户画像失败（不影响返回结果）', {
      error: saveError instanceof Error ? saveError.message : saveError
    });
  }

  return NextResponse.json({
    ...result,
    meta: {
      ...parseMeta,
      profile_saved: profileSaved,
    },
  });
}, { requireAuth: true });