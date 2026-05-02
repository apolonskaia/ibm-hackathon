import { NextRequest, NextResponse } from 'next/server';
import {
  getArchitecture,
  getArchitectureComponents,
  getArchitectureImplementationGuide,
  getArchitectureJustifications,
  getProject,
  saveArchitectureComponents,
  saveArchitectureImplementationGuide,
  saveArchitectureJustifications,
} from '@/lib/database';
import {
  generateComponentBreakdown,
  generateImplementationGuide,
  generateJustifications,
} from '@/lib/watsonx-client';
import { APIError } from '@/types';

/**
 * GET /api/architecture/[id]/implementation-guide
 * Get or generate an implementation guide for the selected architecture
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const architecture = getArchitecture(params.id);
    if (!architecture) {
      const errorResponse: APIError = {
        error: 'NOT_FOUND',
        message: 'Architecture not found',
      };

      return NextResponse.json(errorResponse, { status: 404 });
    }

    const project = getProject(architecture.projectId);
    if (!project) {
      const errorResponse: APIError = {
        error: 'NOT_FOUND',
        message: 'Project not found',
      };

      return NextResponse.json(errorResponse, { status: 404 });
    }

    const cachedGuide = getArchitectureImplementationGuide(architecture.id);
    if (cachedGuide) {
      return NextResponse.json({
        guide: cachedGuide,
        cached: true,
      });
    }

    let components = getArchitectureComponents(architecture.id);
    if (components.length === 0) {
      components = await generateComponentBreakdown(
        architecture.name,
        architecture.techStack,
        architecture.overview,
        project.skillLevel
      );
      saveArchitectureComponents(architecture.id, components);
    }

    let justifications = getArchitectureJustifications(architecture.id);
    if (justifications.length === 0) {
      justifications = await generateJustifications(
        architecture.name,
        architecture.techStack,
        project.requirements ?? {
          functionalRequirements: [],
          nonFunctionalRequirements: [],
          constraints: [],
          assumptions: [],
          keyFeatures: [],
        },
        project.skillLevel
      );
      saveArchitectureJustifications(architecture.id, justifications);
    }

    const guide = await generateImplementationGuide(
      project.description,
      architecture.name,
      architecture.overview,
      architecture.techStack,
      project.requirements ?? {
        functionalRequirements: [],
        nonFunctionalRequirements: [],
        constraints: [],
        assumptions: [],
        keyFeatures: [],
      },
      components,
      justifications,
      project.skillLevel
    );

    saveArchitectureImplementationGuide(architecture.id, guide);

    return NextResponse.json({
      guide,
      cached: false,
    });
  } catch (error) {
    console.error('Error fetching implementation guide:', error);

    const errorResponse: APIError = {
      error: 'FETCH_FAILED',
      message: 'Failed to fetch implementation guide',
      details: error instanceof Error ? error.message : 'Unknown error',
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}