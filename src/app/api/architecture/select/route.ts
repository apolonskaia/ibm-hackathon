import { NextRequest, NextResponse } from 'next/server';
import { 
  getProject, 
  updateProject, 
  getArchitecture, 
  selectArchitecture 
} from '@/lib/database';
import { 
  generateComponentBreakdown, 
  generateJustifications 
} from '@/lib/watsonx-client';
import { SelectArchitectureRequest, SelectArchitectureResponse, APIError } from '@/types';

/**
 * POST /api/architecture/select
 * Select an architecture option and generate detailed breakdown
 */
export async function POST(request: NextRequest) {
  try {
    const body: SelectArchitectureRequest = await request.json();
    const { projectId, architectureId } = body;
    
    // Validate input
    if (!projectId || !architectureId) {
      const errorResponse: APIError = {
        error: 'VALIDATION_ERROR',
        message: 'Project ID and architecture ID are required',
      };
      
      return NextResponse.json(errorResponse, { status: 400 });
    }
    
    // Get project
    const project = getProject(projectId);
    if (!project) {
      const errorResponse: APIError = {
        error: 'NOT_FOUND',
        message: 'Project not found',
      };
      
      return NextResponse.json(errorResponse, { status: 404 });
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
    
    // Verify architecture belongs to project
    if (architecture.projectId !== projectId) {
      const errorResponse: APIError = {
        error: 'FORBIDDEN',
        message: 'Architecture does not belong to this project',
      };
      
      return NextResponse.json(errorResponse, { status: 403 });
    }
    
    // Select the architecture
    selectArchitecture(projectId, architectureId);
    
    // Generate component breakdown using watsonx.ai
    let components: any[] = [];
    try {
      components = await generateComponentBreakdown(
        architecture.name,
        architecture.techStack,
        architecture.overview
      );
    } catch (error) {
      console.error('Error generating components:', error);
      // Continue without components if generation fails
    }
    
    // Generate justifications using watsonx.ai
    let justifications: any[] = [];
    try {
      justifications = await generateJustifications(
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
    } catch (error) {
      console.error('Error generating justifications:', error);
      // Continue without justifications if generation fails
    }
    
    // Update project status
    updateProject(projectId, { status: 'designing' });
    
    // Get updated architecture
    const updatedArchitecture = getArchitecture(architectureId);
    
    const response: SelectArchitectureResponse = {
      architecture: updatedArchitecture!,
      components,
      justifications,
      diagrams: architecture.diagram ? [{
        id: `diagram_${architectureId}`,
        architectureId,
        type: 'system_overview',
        title: `${architecture.name} - System Overview`,
        mermaidCode: architecture.diagram,
        createdAt: new Date().toISOString(),
      }] : [],
      message: 'Architecture selected successfully',
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error selecting architecture:', error);
    
    const errorResponse: APIError = {
      error: 'SELECTION_FAILED',
      message: 'Failed to select architecture',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// Made with Bob
