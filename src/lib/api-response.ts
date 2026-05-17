import { NextResponse } from 'next/server';
import type { ApiErrorResponse, ApiSuccessResponse } from '@/types';

export enum ErrorCode {
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.BAD_REQUEST]: '请求参数错误',
  [ErrorCode.UNAUTHORIZED]: '未授权访问',
  [ErrorCode.FORBIDDEN]: '禁止访问',
  [ErrorCode.NOT_FOUND]: '资源不存在',
  [ErrorCode.CONFLICT]: '资源冲突',
  [ErrorCode.VALIDATION_ERROR]: '数据验证失败',
  [ErrorCode.INTERNAL_ERROR]: '服务器内部错误',
  [ErrorCode.DATABASE_ERROR]: '数据库操作失败',
  [ErrorCode.SERVICE_UNAVAILABLE]: '服务暂时不可用',
};

export function createErrorResponse(
  error: string | ErrorCode,
  options?: {
    code?: ErrorCode;
    status?: number;
    details?: unknown;
    path?: string;
  }
): NextResponse<ApiErrorResponse> {
  const errorCode = typeof error === 'string' && Object.values(ErrorCode).includes(error as ErrorCode)
    ? (error as ErrorCode)
    : options?.code || ErrorCode.INTERNAL_ERROR;
  
  const errorMessage = typeof error === 'string' && !Object.values(ErrorCode).includes(error as ErrorCode)
    ? error
    : ERROR_MESSAGES[errorCode];
  
  const statusCode = options?.status || getStatusCode(errorCode);
  
  const response: ApiErrorResponse = {
    error: errorMessage,
    code: errorCode,
    details: options?.details,
    timestamp: new Date().toISOString(),
    path: options?.path,
  };
  
  return NextResponse.json(response, { status: statusCode });
}

export function createSuccessResponse<T>(
  data: T,
  status = 200
): NextResponse<ApiSuccessResponse<T>> {
  const response: ApiSuccessResponse<T> = {
    data,
    timestamp: new Date().toISOString(),
  };
  
  return NextResponse.json(response, { status });
}

function getStatusCode(code: ErrorCode): number {
  switch (code) {
    case ErrorCode.BAD_REQUEST:
    case ErrorCode.VALIDATION_ERROR:
      return 400;
    case ErrorCode.UNAUTHORIZED:
      return 401;
    case ErrorCode.FORBIDDEN:
      return 403;
    case ErrorCode.NOT_FOUND:
      return 404;
    case ErrorCode.CONFLICT:
      return 409;
    case ErrorCode.SERVICE_UNAVAILABLE:
      return 503;
    default:
      return 500;
  }
}

export function handleApiError(
  error: unknown,
  context?: { path?: string; operation?: string }
): NextResponse<ApiErrorResponse> {
  if (error instanceof Error) {
    if (error.message.includes('database') || error.message.includes('SQLITE')) {
      return createErrorResponse(ErrorCode.DATABASE_ERROR, {
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        path: context?.path,
      });
    }
    
    return createErrorResponse(error.message, {
      code: ErrorCode.INTERNAL_ERROR,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      path: context?.path,
    });
  }
  
  return createErrorResponse(ErrorCode.INTERNAL_ERROR, {
    path: context?.path,
  });
}

export function validateRequired(
  params: Record<string, unknown>,
  required: string[]
): { valid: boolean; missing?: string[] } {
  const missing = required.filter(key => {
    const value = params[key];
    return value === undefined || value === null || value === '';
  });
  
  return {
    valid: missing.length === 0,
    missing: missing.length > 0 ? missing : undefined,
  };
}

export function validatePagination(
  page: number,
  pageSize: number,
  maxPageSize = 100
): { page: number; pageSize: number } {
  return {
    page: Math.max(1, Math.floor(page) || 1),
    pageSize: Math.min(Math.max(1, Math.floor(pageSize) || 12), maxPageSize),
  };
}
