import { NextRequest, NextResponse } from 'next/server';
import { getFilterOptions, searchFilterOptions, searchLocationsByProvince, getSuggestions } from '@/lib/db-utils';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const type = searchParams.get('type') || '';
  const province = searchParams.get('province') || '';
  const suggest = searchParams.get('suggest') || '';
  const limit = parseInt(searchParams.get('limit') || '10');
  
  try {
    if (suggest) {
      const suggestions = getSuggestions(suggest, limit);
      return NextResponse.json({
        suggestions,
        query: suggest,
      });
    }
    
    if (province) {
      const cities = searchLocationsByProvince(province);
      return NextResponse.json({
        province,
        cities,
      });
    }
    
    if (query) {
      const results = searchFilterOptions(query, type || undefined);
      return NextResponse.json(results);
    }
    
    const cache = getFilterOptions();
    
    return NextResponse.json({
      locations: cache.locations,
      job_types: cache.job_types,
      industries: cache.industries,
      education: cache.education,
      sources: cache.sources,
      provinces: cache.provinces,
      education_mapping: cache.educationMapping,
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch filter options' },
      { status: 500 }
    );
  }
}
