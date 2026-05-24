export const ERROR_MESSAGES: Record<string, string> = {
  'Missing user profile data': '缺少用户画像数据，请先完善简历信息后再试',
  'Unauthorized': '登录已过期，请重新登录',
  'Invalid credentials': '用户名或密码错误，请检查后重试',
  'Account locked': '账户已被锁定，请15分钟后重试或联系管理员',
  'Job not found': '该职位不存在或已被删除',
  'User not found': '用户不存在或ID无效',
  'Database error': '服务器内部错误，请稍后重试',
  'Query failed': '查询执行出错，请刷新页面重试',
  'Bad Request': '请求参数有误，请检查输入内容',
  'Too Many Requests': '操作太频繁，请稍等几秒再试',
  'Request timeout': '服务器响应超时，请检查网络后重试',
  'File too large': '文件大小超过限制(最大10MB)',
  'Invalid file type': '不支持的文件格式，仅支持PDF/Word/TXT',
  'Upload failed': '文件上传失败，请稍后重试',
  'AI service unavailable': 'AI服务暂时不可用，使用基础匹配结果',
  'AI request failed': 'AI分析失败，可尝试重新发送或简化问题',
};

export function getFriendlyErrorMessage(error: string | Error): string {
  const message = typeof error === 'string' ? error : error.message;
  
  for (const [key, value] of Object.entries(ERROR_MESSAGES)) {
    if (message.includes(key) || message.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  
  return message || '未知错误，请联系管理员';
}
