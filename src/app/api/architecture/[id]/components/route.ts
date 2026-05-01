import { NextRequest, NextResponse } from 'next/server';
import { getArchitecture } from '@/lib/database';
import { generateComponentBreakdown } from '@/lib/watsonx-client';
import { APIError } from '@/types';

/**
 * GET /api/architecture/[id]/components
 * Get component breakdown for an architecture
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get architecture
    const architecture = getArchitecture(params.id);
    if (!architecture) {
      const errorResponse: APIError = {
        error: 'NOT_FOUND',
        message: 'Architecture not found',
      };
      
      return NextResponse.json(errorResponse, { status: 404 });
    }
    
    // Generate component breakdown using watsonx.ai
    const components = await generateComponentBreakdown(
      architecture.name,
      architecture.techStack,
      architecture.overview
    );
    
    return NextResponse.json({
      components,
      count: components.length,
    });
  } catch (error) {
    console.error('Error fetching components:', error);
    
    const errorResponse: APIError = {
      error: 'FETCH_FAILED',
      message: 'Failed to fetch components',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// Made with Bob
