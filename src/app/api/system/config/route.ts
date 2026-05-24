import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { APP_VERSION } from '@/lib/constants';
import { withApiHandler, ErrorCode, createErrorResponse } from '@/lib/api-response';
import { logger } from '@/lib/logger';

const CONFIG_FILE = path.join(process.cwd(), 'data', 'system_config.json');

const DEFAULT_CONFIG = {
  app: {
    name: 'FinIntern Hub',
    version: APP_VERSION,
  },
  crawler: {
    max_jobs_per_source: 100,
    timeout_seconds: 30,
    retry_count: 3,
  },
  ai: {
    enabled: true,
    model: 'gpt-4',
    max_tokens: 2000,
  },
};

function loadConfig(): Record<string, unknown> {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch {
    return DEFAULT_CONFIG;
  }
  return DEFAULT_CONFIG;
}

function saveConfig(config: Record<string, unknown>): void {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    logger.error('Failed to save config:', error);
  }
}

export const GET = withApiHandler(async (request: NextRequest) => {
  const { requirePermissionUnified } = await import('@/lib/auth-server');
  await requirePermissionUnified(request, 'system:read');

  const config = loadConfig();
  return NextResponse.json(config);
}, { path: '/api/system/config' });

export const PUT = withApiHandler(async (request: NextRequest) => {
  const { requirePermissionUnified } = await import('@/lib/auth-server');
  await requirePermissionUnified(request, 'system:write');

  const body = await request.json();

  const currentConfig = loadConfig();
  const newConfig = { ...currentConfig, ...body };

  saveConfig(newConfig);

  return NextResponse.json({ success: true, config: newConfig });
}, { path: '/api/system/config' });
