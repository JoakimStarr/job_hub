import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { SOURCE_NAME_MAP } from '@/lib/constants';

interface CrawlerSource {
  key: string;
  name: string;
  enabled: boolean;
  type: string;
}

const SOURCE_TYPE_MAP: Record<string, string> = {
  sufe: 'api_post',
  zuel: 'api_get',
  cufe: 'api_post',
  dufe: 'api_post',
  swufe: 'html',
  uibe: 'browser_js',
  jxufe: 'browser_js',
};

export async function GET() {
  const startTime = Date.now();
  const path = '/api/crawler/sources';

  try {
    const sources: CrawlerSource[] = Object.entries(SOURCE_NAME_MAP)
      .filter(([key]) => SOURCE_TYPE_MAP[key])
      .map(([key, name]) => ({
        key,
        name,
        enabled: true,
        type: SOURCE_TYPE_MAP[key] || 'unknown',
      }));

    logger.api('GET', path, 200, Date.now() - startTime, { sourceCount: sources.length });

    return NextResponse.json(sources);
  } catch (error) {
    logger.error('Failed to get crawler sources', error, { path });
    return handleApiError(error, { path });
  }
}
