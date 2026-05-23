import { NextRequest, NextResponse } from 'next/server';
import { 
  getAllEnabledAlerts, 
  getAllAlerts,
  createAlert, 
  getAlertById,
  initJobAlertsTables 
} from '@/lib/job-alerts-db';
import { isEmailConfigured } from '@/lib/email-service';

export async function GET(request: NextRequest) {
  try {
    initJobAlertsTables();
    
    const { searchParams } = new URL(request.url);
    const includeDisabled = searchParams.get('include_disabled') === 'true';
    
    const alerts = includeDisabled ? getAllAlerts() : getAllEnabledAlerts();
    
    return NextResponse.json({
      success: true,
      data: alerts,
      emailConfigured: isEmailConfigured(),
    });
  } catch (error) {
    console.error('Failed to get alerts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get alerts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { email, keywords, sources, locations, industries, education } = body;
    
    if (!email || !keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Email and keywords are required' },
        { status: 400 }
      );
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }
    
    const alert = createAlert({
      email,
      keywords,
      sources: sources || [],
      locations: locations || [],
      industries: industries || [],
      education,
      enabled: true,
    });
    
    return NextResponse.json({
      success: true,
      data: alert,
    });
  } catch (error) {
    console.error('Failed to create alert:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create alert' },
      { status: 500 }
    );
  }
}
