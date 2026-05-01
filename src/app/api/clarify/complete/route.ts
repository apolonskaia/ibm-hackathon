import { NextRequest, NextResponse } from 'next/server';
import { getProject, updateProject, getConversation } from '@/lib/database';
import { generateRequirementsSummary } from '@/lib/watsonx-client';
import { CompleteClarificationRequest, CompleteClarificationResponse, APIError } from '@/types';

/**
 * POST /api/clarify/complete
 * Complete clarification phase and generate requirements summary
 */
export async function POST(request: NextRequest) {
  try {
    const body: CompleteClarificationRequest = await request.json();
    const { projectId } = body;
    
    // Validate input
    if (!projectId) {
      const errorResponse: APIError = {
        error: 'VALIDATION_ERROR',
        message: 'Project ID is required',
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
    
    // Get conversation history
    const conversation = getConversation(projectId);
    
    // Build Q&A history from conversation
    const qaHistory: Array<{ question: string; answer: string }> = [];
    for (let i = 0; i < conversation.length; i += 2) {
      if (conversation[i]?.role === 'assistant' && conversation[i + 1]?.role === 'user') {
        qaHistory.push({
          question: conversation[i].content,
          answer: conversation[i + 1].content,
        });
      }
    }
    
    if (qaHistory.length === 0) {
      const errorResponse: APIError = {
        error: 'INSUFFICIENT_DATA',
        message: 'No Q&A history found. Please answer at least one question.',
      };
      
      return NextResponse.json(errorResponse, { status: 400 });
    }
    
    // Generate requirements summary using watsonx.ai
    const summary = await generateRequirementsSummary(
      project.description,
      qaHistory
    );
    
    // Update project status
    updateProject(projectId, { status: 'generating_options' });
    
    const response: CompleteClarificationResponse = {
      summary,
      message: 'Clarification completed successfully',
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error completing clarification:', error);
    
    const errorResponse: APIError = {
      error: 'COMPLETION_FAILED',
      message: 'Failed to complete clarification',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// Made with Bob
