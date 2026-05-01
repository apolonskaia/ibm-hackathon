import { NextRequest, NextResponse } from 'next/server';
import { getArchitecture } from '@/lib/database';
import { generateJustifications } from '@/lib/watsonx-client';
import { APIError } from '@/types';

/**
 * GET /api/architecture/[id]/justifications
 * Get justifications for architecture decisions
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
    
    // Generate justifications using watsonx.ai
    const justifications = await generateJustifications(
      architecture.name,
      architecture.techStack,
      {
        functionalRequirements: [],
        nonFunctionalRequirements: [],
        constraints: [],
        assumptions: [],
        keyFeatures: [],
      }
    );
    
    return NextResponse.json({
      justifications,
      count: justifications.length,
    });
  } catch (error) {
    console.error('Error fetching justifications:', error);
    
    const errorResponse: APIError = {
      error: 'FETCH_FAILED',
      message: 'Failed to fetch justifications',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// Made with Bob
