import { NextRequest, NextResponse } from 'next/server';
import { getArchitecture, getArchitectureComponents, getProject, saveArchitectureComponents } from '@/lib/database';
import { generateComponentBreakdown } from '@/lib/watsonx-client';
import { extractMermaidNodeLabels, normalizeMermaidLabel } from '@/lib/mermaid';
import { APIError } from '@/types';

function isComponentBreakdownAlignedWithDiagram(components: unknown[], diagram: string | undefined): boolean {
  if (!diagram) {
    return true;
  }

  const diagramLabels = extractMermaidNodeLabels(diagram);
  if (diagramLabels.length === 0) {
    return true;
  }

  const componentCoverageTerms = components.flatMap((component) => {
    const entry = component as { name?: string; technologies?: string[] };
    return [entry.name, ...(Array.isArray(entry.technologies) ? entry.technologies : [])]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => normalizeMermaidLabel(value));
  });

  const missingLabels = diagramLabels.filter((label) => {
    const normalizedLabel = normalizeMermaidLabel(label);
    return !componentCoverageTerms.some((term) => term.includes(normalizedLabel) || normalizedLabel.includes(term));
  });

  return missingLabels.length <= Math.floor(diagramLabels.length * 0.45);
}

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

    const project = getProject(architecture.projectId);
    const cachedComponents = getArchitectureComponents(architecture.id);

    if (cachedComponents.length > 0 && isComponentBreakdownAlignedWithDiagram(cachedComponents, architecture.diagram)) {
      return NextResponse.json({
        components: cachedComponents,
        count: cachedComponents.length,
        cached: true,
      });
    }
    
    // Generate component breakdown using watsonx.ai
    const components = await generateComponentBreakdown(
      architecture.name,
      architecture.techStack,
      architecture.overview,
      project?.skillLevel ?? 'beginner',
      architecture.diagram
    );

    saveArchitectureComponents(architecture.id, components);
    
    return NextResponse.json({
      components,
      count: components.length,
      cached: false,
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
