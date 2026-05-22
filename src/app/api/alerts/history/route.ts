import { NextRequest, NextResponse } from 'next/server';
import { getAlertHistory, initJobAlertsTables } from '@/lib/job-alerts-db';

export async function GET(request: NextRequest) {
  try {
    initJobAlertsTables();
    
    const { searchParams } = new URL(request.url);
    const alertId = searchParams.get('alert_id');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    
    const history = getAlertHistory(alertId ? parseInt(alertId, 10) : undefined, limit);
    
    return NextResponse.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('Failed to get alert history:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get alert history' },
      { status: 500 }
    );
  }
}
