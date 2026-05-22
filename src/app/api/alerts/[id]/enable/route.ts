import { NextRequest, NextResponse } from 'next/server';
import { enableAlert, getAlertById, initJobAlertsTables } from '@/lib/job-alerts-db';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    initJobAlertsTables();
    
    const { id } = await params;
    const alertId = parseInt(id, 10);
    
    if (isNaN(alertId)) {
      return NextResponse.json(
        { success: false, error: '无效的订阅ID' },
        { status: 400 }
      );
    }
    
    const alert = getAlertById(alertId);
    
    if (!alert) {
      return NextResponse.json(
        { success: false, error: '订阅不存在' },
        { status: 404 }
      );
    }
    
    if (alert.enabled) {
      return NextResponse.json(
        { success: false, error: '订阅已处于启用状态' },
        { status: 400 }
      );
    }
    
    enableAlert(alertId);
    
    logger.info(`Alert ${alertId} re-enabled`);
    
    return NextResponse.json({
      success: true,
      message: '订阅已重新启用',
    });
  } catch (error) {
    console.error('Failed to enable alert:', error);
    return NextResponse.json(
      { success: false, error: '启用失败' },
      { status: 500 }
    );
  }
}
