import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { APP_VERSION } from '@/lib/constants';

const DB_PATH = path.join(process.cwd(), 'data', 'jobs.db');
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
    console.error('Failed to save config:', error);
  }
}

export async function GET() {
  try {
    const config = loadConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error('Config error:', error);
    return NextResponse.json(
      { error: 'Failed to load config' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    const currentConfig = loadConfig();
    const newConfig = { ...currentConfig, ...body };
    
    saveConfig(newConfig);
    
    return NextResponse.json({ success: true, config: newConfig });
  } catch (error) {
    console.error('Config update error:', error);
    return NextResponse.json(
      { error: 'Failed to update config' },
      { status: 500 }
    );
  }
}
