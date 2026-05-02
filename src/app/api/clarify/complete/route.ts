import { NextRequest, NextResponse } from 'next/server';
import { getProject, updateProject, getConversation } from '@/lib/database';
import { generateRequirementsSummary } from '@/lib/watsonx-client';
import { CompleteClarificationRequest, CompleteClarificationResponse, APIError, RequirementsSummary } from '@/types';

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
    
    // Generate requirements summary using watsonx.ai
    // If no Q&A history, use just the project description
    let summary: RequirementsSummary;
    
    if (qaHistory.length === 0) {
      // User skipped clarification - create basic summary from project description
      summary = {
        functionalRequirements: [project.description],
        nonFunctionalRequirements: ['To be determined based on architecture selection'],
        constraints: ['No specific constraints identified'],
        assumptions: ['System type and delivery model should be inferred from the project description instead of assuming a web application'],
        keyFeatures: ['Core functionality as described in project description'],
      };
    } else {
      // Generate summary from Q&A history
      summary = await generateRequirementsSummary(
        project.description,
        qaHistory
      );
    }
    
    // Update project status and save requirements summary
    const updated = updateProject(projectId, {
      status: 'generating_options',
      requirements: summary  // Save summary to project
    });
    
    console.log('✅ Requirements saved:', updated);
    console.log('📝 Summary:', JSON.stringify(summary, null, 2));
    
    // Verify it was saved
    const verifyProject = getProject(projectId);
    console.log('🔍 Verify project has requirements:', !!verifyProject?.requirements);
    
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
