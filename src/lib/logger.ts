import { promises as fsp } from 'fs';
import path from 'path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  requestId?: string;
  path?: string;
  method?: string;
  duration?: number;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private logLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
  private logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
  private logFile: string | null = null;
  private errorLogFile: string | null = null;

  private readonly levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor() {
    this.initFileLogging();
  }

  private async initFileLogging(): Promise<void> {
    try {
      await fsp.mkdir(this.logDir, { recursive: true });
      const dateStr = new Date().toISOString().slice(0, 10);
      this.logFile = path.join(this.logDir, `app_${dateStr}.log`);
      this.errorLogFile = path.join(this.logDir, `app_errors_${dateStr}.log`);
    } catch {
      this.logFile = null;
      this.errorLogFile = null;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.logLevel];
  }

  private formatText(entry: LogEntry): string {
    const parts = [
      `[${entry.timestamp}]`,
      `[${entry.level.toUpperCase()}]`,
      entry.message,
    ];

    if (entry.context) {
      parts.push(JSON.stringify(entry.context, null, 2));
    }

    if (entry.error) {
      parts.push(`\n  Error: ${entry.error.message}`);
      if (entry.error.stack) {
        parts.push(`\n  Stack: ${entry.error.stack}`);
      }
    }

    return parts.join(' ');
  }

  private formatJSON(entry: LogEntry): string {
    return JSON.stringify(entry);
  }

  private async appendToFile(filePath: string | null, content: string): Promise<void> {
    if (!filePath) return;
    try {
      await fsp.appendFile(filePath, content + '\n', 'utf-8');
    } catch {
      // 文件写入失败不阻塞主流程
    }
  }

  private output(level: LogLevel, entry: LogEntry): void {
    const textFormatted = this.formatText(entry);
    const jsonFormatted = this.formatJSON(entry);

    switch (level) {
      case 'error':
        console.error(textFormatted);
        break;
      case 'warn':
        console.warn(textFormatted);
        break;
      default:
        console.log(textFormatted);
    }

    void this.appendToFile(this.logFile, jsonFormatted);
    if (level === 'error') {
      void this.appendToFile(this.errorLogFile, textFormatted);
    }
  }

  log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };

    this.output(level, entry);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error | unknown, context?: Record<string, unknown>): void {
    if (!this.shouldLog('error')) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      context,
    };

    if (error instanceof Error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    } else if (error) {
      entry.context = { ...entry.context, error };
    }

    this.output('error', entry);
  }

  api(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: Record<string, unknown>
  ): void {
    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    this.log(level, `API ${method} ${path}`, {
      statusCode,
      duration: `${duration}ms`,
      ...context,
    });
  }

  database(
    operation: string,
    table: string,
    duration?: number,
    error?: Error
  ): void {
    if (error) {
      this.error(`Database ${operation} on ${table} failed`, error, {
        operation,
        table,
        duration,
      });
    } else {
      this.debug(`Database ${operation} on ${table}`, {
        operation,
        table,
        duration: duration ? `${duration}ms` : undefined,
      });
    }
  }
}

export const logger = new Logger();

export function createRequestLogger(requestId?: string) {
  return {
    requestId,
    info: (message: string, context?: Record<string, unknown>) => {
      logger.info(message, { requestId, ...context });
    },
    error: (message: string, error?: Error | unknown, context?: Record<string, unknown>) => {
      logger.error(message, error, { requestId, ...context });
    },
    warn: (message: string, context?: Record<string, unknown>) => {
      logger.warn(message, { requestId, ...context });
    },
    debug: (message: string, context?: Record<string, unknown>) => {
      logger.debug(message, { requestId, ...context });
    },
  };
}