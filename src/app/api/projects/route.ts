import { NextRequest, NextResponse } from 'next/server';
import { createProject, getProjectHistorySummaries } from '@/lib/database';
import { CreateProjectRequest, CreateProjectResponse, APIError } from '@/types';
import { z } from 'zod';

// Validation schema
const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(50).max(500),
  skillLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional().default('beginner'),
});

/**
 * GET /api/projects
 * Get all projects
 */
export async function GET(request: NextRequest) {
  try {
    const projects = getProjectHistorySummaries();
    
    return NextResponse.json({
      projects,
      count: projects.length,
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    
    const errorResponse: APIError = {
      error: 'FETCH_FAILED',
      message: 'Failed to fetch projects',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * POST /api/projects
 * Create a new project
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = createProjectSchema.safeParse(body);
    
    if (!validation.success) {
      const errorResponse: APIError = {
        error: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: validation.error.errors,
      };
      
      return NextResponse.json(errorResponse, { status: 400 });
    }
    
    const { name, description, skillLevel } = validation.data;
    
    // Create project in database
    const project = createProject({
      name,
      description,
      skillLevel,
      status: 'created',
    });
    
    const response: CreateProjectResponse = {
      id: project.id,
      message: 'Project created successfully',
    };
    
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    
    const errorResponse: APIError = {
      error: 'CREATE_FAILED',
      message: 'Failed to create project',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// Made with Bob
