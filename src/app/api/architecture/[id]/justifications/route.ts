import { NextRequest, NextResponse } from 'next/server';
import { getArchitecture, getArchitectureJustifications, getProject, saveArchitectureJustifications } from '@/lib/database';
import { generateJustifications, normalizeJustifications } from '@/lib/watsonx-client';
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
    
    const project = getProject(architecture.projectId);
    const cachedJustifications = getArchitectureJustifications(architecture.id);

    if (cachedJustifications.length > 0) {
      const normalizedCachedJustifications = normalizeJustifications(cachedJustifications);

      if (JSON.stringify(normalizedCachedJustifications) !== JSON.stringify(cachedJustifications)) {
        saveArchitectureJustifications(architecture.id, normalizedCachedJustifications);
      }

      return NextResponse.json({
        justifications: normalizedCachedJustifications,
        count: normalizedCachedJustifications.length,
        cached: true,
      });
    }

    // Generate justifications using watsonx.ai
    const justifications = await generateJustifications(
      architecture.name,
      architecture.techStack,
      project?.requirements ?? {
        functionalRequirements: [],
        nonFunctionalRequirements: [],
        constraints: [],
        assumptions: [],
        keyFeatures: [],
      },
      project?.skillLevel ?? 'beginner'
    );

    saveArchitectureJustifications(architecture.id, justifications);
    
    return NextResponse.json({
      justifications,
      count: justifications.length,
      cached: false,
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
