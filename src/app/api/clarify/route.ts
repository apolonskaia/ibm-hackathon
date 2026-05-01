import { NextRequest, NextResponse } from 'next/server';
import { getProject, updateProject, addMessage, getConversation } from '@/lib/database';
import { generateClarificationQuestion } from '@/lib/watsonx-client';
import { ClarifyRequest, ClarifyResponse, APIError } from '@/types';

/**
 * POST /api/clarify
 * Generate next clarification question
 */
export async function POST(request: NextRequest) {
  try {
    const body: ClarifyRequest = await request.json();
    const { projectId, previousAnswers = [] } = body;
    
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
    
    // Update project status if needed
    if (project.status === 'created') {
      updateProject(projectId, { status: 'clarifying' });
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
    
    // Determine if we should continue asking questions
    const maxQuestions = 7;
    const currentQuestionCount = qaHistory.length;
    const isComplete = currentQuestionCount >= maxQuestions;
    
    if (isComplete) {
      const response: ClarifyResponse = {
        question: {
          id: 'complete',
          question: 'Clarification complete',
        },
        progress: 100,
        isComplete: true,
      };
      
      return NextResponse.json(response);
    }
    
    // Generate next question using watsonx.ai
    const questionText = await generateClarificationQuestion(
      project.description,
      project.skillLevel,
      qaHistory
    );
    
    // Save question to conversation
    const questionMessage = addMessage({
      projectId,
      role: 'assistant',
      content: questionText,
    });
    
    // Calculate progress
    const progress = Math.round((currentQuestionCount / maxQuestions) * 100);
    
    const response: ClarifyResponse = {
      question: {
        id: questionMessage.id,
        question: questionText,
      },
      progress,
      isComplete: false,
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error generating clarification question:', error);
    
    const errorResponse: APIError = {
      error: 'GENERATION_FAILED',
      message: 'Failed to generate clarification question',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// Made with Bob
