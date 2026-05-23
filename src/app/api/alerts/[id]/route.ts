import { NextRequest, NextResponse } from 'next/server';
import { 
  getAlertById, 
  updateAlert, 
  deleteAlert,
  initJobAlertsTables 
} from '@/lib/job-alerts-db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    initJobAlertsTables();
    const { id } = await params;
    const alertId = parseInt(id, 10);
    
    if (isNaN(alertId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid alert ID' },
        { status: 400 }
      );
    }
    
    const alert = getAlertById(alertId);
    
    if (!alert) {
      return NextResponse.json(
        { success: false, error: 'Alert not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: alert,
    });
  } catch (error) {
    console.error('Failed to get alert:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get alert' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    initJobAlertsTables();
    const { id } = await params;
    const alertId = parseInt(id, 10);
    
    if (isNaN(alertId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid alert ID' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const { email, keywords, sources, locations, industries, education, enabled } = body;
    
    const updates: Record<string, unknown> = {};
    
    if (email !== undefined) updates.email = email;
    if (keywords !== undefined) updates.keywords = keywords;
    if (sources !== undefined) updates.sources = sources;
    if (locations !== undefined) updates.locations = locations;
    if (industries !== undefined) updates.industries = industries;
    if (education !== undefined) updates.education = education;
    if (enabled !== undefined) updates.enabled = enabled;
    
    const success = updateAlert(alertId, updates);
    
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to update alert' },
        { status: 500 }
      );
    }
    
    const updatedAlert = getAlertById(alertId);
    
    return NextResponse.json({
      success: true,
      data: updatedAlert,
    });
  } catch (error) {
    console.error('Failed to update alert:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update alert' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    initJobAlertsTables();
    const { id } = await params;
    const alertId = parseInt(id, 10);
    
    if (isNaN(alertId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid alert ID' },
        { status: 400 }
      );
    }
    
    const success = deleteAlert(alertId);
    
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Alert not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Alert deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete alert:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete alert' },
      { status: 500 }
    );
  }
}
