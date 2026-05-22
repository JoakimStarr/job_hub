import { NextRequest, NextResponse } from 'next/server';
import { disableAlert, getAlertById, initJobAlertsTables } from '@/lib/job-alerts-db';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    initJobAlertsTables();
    
    const body = await request.json();
    const { alert_id, email } = body;
    
    if (!alert_id || !email) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }
    
    const alert = getAlertById(alert_id);
    
    if (!alert) {
      return NextResponse.json(
        { success: false, error: '订阅不存在' },
        { status: 404 }
      );
    }
    
    if (alert.email !== email) {
      return NextResponse.json(
        { success: false, error: '邮箱不匹配' },
        { status: 403 }
      );
    }
    
    disableAlert(alert_id);
    
    logger.info(`Alert ${alert_id} unsubscribed by ${email}`);
    
    return NextResponse.json({
      success: true,
      message: '已成功取消订阅',
      keywords: alert.keywords,
    });
  } catch (error) {
    console.error('Failed to unsubscribe:', error);
    return NextResponse.json(
      { success: false, error: '取消订阅失败' },
      { status: 500 }
    );
  }
}
