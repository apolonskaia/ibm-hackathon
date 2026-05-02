import { NextRequest, NextResponse } from 'next/server';
import { getProject, getArchitectures, reorderArchitectures, updateProject, createArchitecture, deleteArchitectures } from '@/lib/database';
import { generateArchitectureOptions, generateMermaidDiagram } from '@/lib/watsonx-client';
import { GenerateArchitectureRequest, GenerateArchitectureResponse, APIError } from '@/types';

/**
 * POST /api/architecture/generate
 * Generate architecture options based on requirements
 */
export async function POST(request: NextRequest) {
  try {
    const body: GenerateArchitectureRequest = await request.json();
    const { projectId, requirements, append = false } = body;
    
    // Validate input
    if (!projectId || !requirements) {
      const errorResponse: APIError = {
        error: 'VALIDATION_ERROR',
        message: 'Project ID and requirements are required',
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

    const existingArchitectures = getArchitectures(projectId);

    if (!append && existingArchitectures.length > 0) {
      const response: GenerateArchitectureResponse = {
        options: existingArchitectures,
        message: 'Using previously generated architecture options',
      };

      return NextResponse.json(response);
    }
    
    // Generate architecture options using watsonx.ai
    const optionsData = await generateArchitectureOptions(
      project.description,
      requirements,
      project.skillLevel
    );

    if (!append) {
      deleteArchitectures(projectId);
    }

    const baseDisplayOrder = append ? existingArchitectures.length : 0;
    
    // Save options to database and generate diagrams
    const savedOptions = await Promise.all(
      optionsData.map(async (option) => {
        // Generate Mermaid diagram for this option
        let diagram: string | undefined;
        try {
          const components = Object.values(option.techStack || {})
            .filter((value): value is string[] => Array.isArray(value))
            .flat();

          diagram = await generateMermaidDiagram(
            option.name,
            components,
            option.overview
          );
        } catch (error) {
          console.error('Error generating diagram:', error);
          // Continue without diagram if generation fails
        }
        
        // Save to database
        return createArchitecture({
          projectId,
          name: option.name,
          description: option.description,
          overview: option.overview,
          techStack: option.techStack,
          pros: option.pros,
          cons: option.cons,
          complexity: option.complexity,
          estimatedCost: option.estimatedCost,
          diagram,
          selected: false,
          displayOrder: baseDisplayOrder + optionsData.indexOf(option),
        });
      })
    );

    if (append) {
      reorderArchitectures(projectId, savedOptions.map((option) => option.id));
    }

    const orderedOptions = getArchitectures(projectId);
    
    // Update project status
    updateProject(projectId, { status: 'selecting_architecture' });
    
    const response: GenerateArchitectureResponse = {
      options: append ? orderedOptions : savedOptions,
      message: 'Architecture options generated successfully',
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error generating architecture options:', error);
    
    const errorResponse: APIError = {
      error: 'GENERATION_FAILED',
      message: 'Failed to generate architecture options',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// Made with Bob
