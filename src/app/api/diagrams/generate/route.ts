import { NextRequest, NextResponse } from 'next/server';
import { getArchitecture } from '@/lib/database';
import { generateMermaidDiagram } from '@/lib/watsonx-client';
import { GenerateDiagramRequest, GenerateDiagramResponse, APIError } from '@/types';

/**
 * POST /api/diagrams/generate
 * Generate a Mermaid diagram for an architecture
 */
export async function POST(request: NextRequest) {
  try {
    const body: GenerateDiagramRequest = await request.json();
    const { architectureId, type, components } = body;
    
    // Validate input
    if (!architectureId || !type) {
      const errorResponse: APIError = {
        error: 'VALIDATION_ERROR',
        message: 'Architecture ID and diagram type are required',
      };
      
      return NextResponse.json(errorResponse, { status: 400 });
    }
    
    // Get architecture
    const architecture = getArchitecture(architectureId);
    if (!architecture) {
      const errorResponse: APIError = {
        error: 'NOT_FOUND',
        message: 'Architecture not found',
      };
      
      return NextResponse.json(errorResponse, { status: 404 });
    }
    
    // Prepare component list
    let componentList: string[] = [];
    if (components && components.length > 0) {
      componentList = components.map(c => c.name);
    } else {
      // Use tech stack as components
      componentList = [
        ...(architecture.techStack.frontend || []),
        ...(architecture.techStack.backend || []),
        ...(architecture.techStack.database || []),
        ...(architecture.techStack.infrastructure || []),
      ];
    }
    
    // Generate diagram using watsonx.ai
    const mermaidCode = await generateMermaidDiagram(
      architecture.name,
      componentList,
      architecture.overview
    );
    
    // Create diagram object
    const diagram = {
      id: `diagram_${Date.now()}`,
      architectureId,
      type,
      title: `${architecture.name} - ${type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
      mermaidCode,
      description: `Generated ${type} diagram for ${architecture.name}`,
      createdAt: new Date().toISOString(),
    };
    
    const response: GenerateDiagramResponse = {
      diagram,
      message: 'Diagram generated successfully',
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error generating diagram:', error);
    
    const errorResponse: APIError = {
      error: 'GENERATION_FAILED',
      message: 'Failed to generate diagram',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// Made with Bob
