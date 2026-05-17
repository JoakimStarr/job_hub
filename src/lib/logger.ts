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
  
  private readonly levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };
  
  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.logLevel];
  }
  
  private formatEntry(entry: LogEntry): string {
    if (this.isDevelopment) {
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
    
    return JSON.stringify(entry);
  }
  
  private output(level: LogLevel, entry: LogEntry): void {
    const formatted = this.formatEntry(entry);
    
    switch (level) {
      case 'error':
        console.error(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      default:
        console.log(formatted);
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
