import { NextRequest, NextResponse } from 'next/server';
import { parseResumeText } from '@/lib/resume-parser';
import { requireAuthUnified } from '@/lib/auth-server';
import { AuthError } from '@/lib/auth';
import { logger } from '@/lib/logger';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const runtime = 'nodejs';

type ParseResumeMeta = {
  source_type: 'pdf' | 'txt' | 'text';
  file_name?: string;
  extracted_chars: number;
  extracted_words: number;
  capabilities: string[];
};

declare global {
  var pdfjsWorker: { WorkerMessageHandler: unknown } | undefined;
}

async function extractTextFromPdf(file: File): Promise<string> {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);

  if (!globalThis.pdfjsWorker?.WorkerMessageHandler) {
    try {
      const workerPath = path.resolve(process.cwd(), 'node_modules/pdf-parse/dist/pdf-parse/cjs/pdf.worker.mjs');
      const workerModule = await import(pathToFileURL(workerPath).href);
      globalThis.pdfjsWorker = { WorkerMessageHandler: (workerModule as Record<string, unknown>).WorkerMessageHandler };
    } catch (workerImportError) {
      logger.warn('PDF worker 加载失败，尝试备用方案', { error: workerImportError instanceof Error ? workerImportError.message : workerImportError });
    }
  }

  try {
    const { PDFParse } = require('pdf-parse') as { PDFParse: new (options: { data: Buffer }) => { getText: () => Promise<{ text: string }>; destroy: () => Promise<void> } };
    const buffer = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: buffer });

    try {
      const result = await parser.getText();
      return result.text || '';
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  } catch (pdfParseError) {
    logger.error('pdf-parse 主模块加载或执行失败，尝试使用备用解析', { error: pdfParseError instanceof Error ? pdfParseError.message : pdfParseError });

    return extractPdfWithFallback(file);
  }
}

async function extractPdfWithFallback(file: File): Promise<string> {
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const textContent = buffer.toString('latin1');

    const cleaned = textContent
      .replace(/[^\x20-\x7E\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleaned.length > 50 && /[\u4e00-\u9fff]/.test(cleaned)) {
      logger.info('使用备用 Latin-1 解码提取 PDF 文本成功', { length: cleaned.length });
      return cleaned;
    }
  } catch {
    // 继续尝试其他方法
  }

  throw new Error(
    'PDF 解析失败。请将简历转换为 TXT 格式后上传，' +
    '或在终端运行 npm install pdf-parse 并重启服务。'
  );
}

async function extractTextFromFile(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();
  const isPdf = file.type === 'application/pdf' || fileName.endsWith('.pdf');

  if (isPdf) {
    return extractTextFromPdf(file);
  }

  if (file.type === 'text/plain' || fileName.endsWith('.txt') || !file.type) {
    return file.text();
  }

  throw new Error('目前仅支持 PDF 和 TXT 格式的简历文件');
}

function buildParseMeta(text: string, sourceType: ParseResumeMeta['source_type'], fileName?: string): ParseResumeMeta {
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
  };
}

export async function POST(request: NextRequest) {
  try {
    await requireAuthUnified(request);

    const contentType = request.headers.get('content-type') || '';
    let text = '';
    let parseMeta: ParseResumeMeta = buildParseMeta('', 'text');

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');

      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: '缺少简历文件' },
          { status: 400 }
        );
      }

      const sourceType = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf' ? 'pdf' : 'txt';
      text = await extractTextFromFile(file);
      parseMeta = buildParseMeta(text, sourceType, file.name);
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
        { status: 400 }
      );
    }

    const result = parseResumeText(text);

    return NextResponse.json({
      ...result,
      meta: parseMeta,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('简历解析错误:', error);
    return NextResponse.json(
      { error: '简历解析失败，请检查格式是否正确' },
      { status: 500 }
    );
  }
}
