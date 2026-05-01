import { NextRequest, NextResponse } from 'next/server';
import { getProject, getArchitectures, updateProject, deleteProject } from '@/lib/database';
import { APIError } from '@/types';
import { z } from 'zod';

// Validation schema for updates
const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().min(50).max(500).optional(),
  skillLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  status: z.enum(['created', 'clarifying', 'generating_options', 'selecting_architecture', 'designing', 'completed']).optional(),
});

/**
 * GET /api/projects/[id]
 * Get a specific project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const project = getProject(params.id);
    
    if (!project) {
      const errorResponse: APIError = {
        error: 'NOT_FOUND',
        message: 'Project not found',
      };
      
      return NextResponse.json(errorResponse, { status: 404 });
    }
    
    return NextResponse.json({
      project,
      architectures: getArchitectures(params.id),
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    
    const errorResponse: APIError = {
      error: 'FETCH_FAILED',
      message: 'Failed to fetch project',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * PATCH /api/projects/[id]
 * Update a project
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = updateProjectSchema.safeParse(body);
    
    if (!validation.success) {
      const errorResponse: APIError = {
        error: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: validation.error.errors,
      };
      
      return NextResponse.json(errorResponse, { status: 400 });
    }
    
    // Check if project exists
    const existingProject = getProject(params.id);
    if (!existingProject) {
      const errorResponse: APIError = {
        error: 'NOT_FOUND',
        message: 'Project not found',
      };
      
      return NextResponse.json(errorResponse, { status: 404 });
    }
    
    // Update project
    const success = updateProject(params.id, validation.data);
    
    if (!success) {
      const errorResponse: APIError = {
        error: 'UPDATE_FAILED',
        message: 'Failed to update project',
      };
      
      return NextResponse.json(errorResponse, { status: 500 });
    }
    
    // Get updated project
    const updatedProject = getProject(params.id);
    
    return NextResponse.json({
      project: updatedProject,
      message: 'Project updated successfully',
    });
  } catch (error) {
    console.error('Error updating project:', error);
    
    const errorResponse: APIError = {
      error: 'UPDATE_FAILED',
      message: 'Failed to update project',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id]
 * Delete a project
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if project exists
    const existingProject = getProject(params.id);
    if (!existingProject) {
      const errorResponse: APIError = {
        error: 'NOT_FOUND',
        message: 'Project not found',
      };
      
      return NextResponse.json(errorResponse, { status: 404 });
    }
    
    // Delete project
    const success = deleteProject(params.id);
    
    if (!success) {
      const errorResponse: APIError = {
        error: 'DELETE_FAILED',
        message: 'Failed to delete project',
      };
      
      return NextResponse.json(errorResponse, { status: 500 });
    }
    
    return NextResponse.json({
      message: 'Project deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    
    const errorResponse: APIError = {
      error: 'DELETE_FAILED',
      message: 'Failed to delete project',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// Made with Bob
