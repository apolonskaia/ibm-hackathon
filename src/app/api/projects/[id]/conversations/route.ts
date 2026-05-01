import { NextRequest, NextResponse } from 'next/server';
import { getProject, getConversation, addMessage } from '@/lib/database';
import { APIError } from '@/types';

/**
 * GET /api/projects/[id]/conversations
 * Get conversation history for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if project exists
    const project = getProject(params.id);
    if (!project) {
      const errorResponse: APIError = {
        error: 'NOT_FOUND',
        message: 'Project not found',
      };
      
      return NextResponse.json(errorResponse, { status: 404 });
    }
    
    // Get conversation history
    const messages = getConversation(params.id);
    
    return NextResponse.json({
      messages,
      count: messages.length,
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    
    const errorResponse: APIError = {
      error: 'FETCH_FAILED',
      message: 'Failed to fetch conversation',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * POST /api/projects/[id]/conversations
 * Add a message to the conversation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { role, content } = body;
    
    // Validate input
    if (!role || !content) {
      const errorResponse: APIError = {
        error: 'VALIDATION_ERROR',
        message: 'Role and content are required',
      };
      
      return NextResponse.json(errorResponse, { status: 400 });
    }
    
    if (!['user', 'assistant', 'system'].includes(role)) {
      const errorResponse: APIError = {
        error: 'VALIDATION_ERROR',
        message: 'Invalid role. Must be user, assistant, or system',
      };
      
      return NextResponse.json(errorResponse, { status: 400 });
    }
    
    // Check if project exists
    const project = getProject(params.id);
    if (!project) {
      const errorResponse: APIError = {
        error: 'NOT_FOUND',
        message: 'Project not found',
      };
      
      return NextResponse.json(errorResponse, { status: 404 });
    }
    
    // Add message to conversation
    const message = addMessage({
      projectId: params.id,
      role,
      content,
    });
    
    return NextResponse.json({
      message,
      success: true,
    }, { status: 201 });
  } catch (error) {
    console.error('Error adding message:', error);
    
    const errorResponse: APIError = {
      error: 'CREATE_FAILED',
      message: 'Failed to add message',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// Made with Bob
