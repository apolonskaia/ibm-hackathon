import { NextRequest, NextResponse } from 'next/server';
import { getProject, updateProject, addMessage, getConversation } from '@/lib/database';
import { generateClarificationQuestion, getClarificationStrategy, hasEnoughClarificationForDesign } from '@/lib/watsonx-client';
import { ClarifyRequest, ClarifyResponse, APIError } from '@/types';

function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/["'`]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeClarificationMessage(message: string): string {
  return message
    .replace(/^\s*clarification\s+question\s*:\s*/i, '')
    .replace(/^\s*clarification\s+message\s*:\s*/i, '')
    .replace(/^\s*question\s*:\s*/i, '')
    .replace(/^\s*message\s*:\s*/i, '')
    .trim();
}

/**
 * POST /api/clarify
 * Generate next clarification question
 */
export async function POST(request: NextRequest) {
  try {
    const body: ClarifyRequest = await request.json();
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
          question: sanitizeClarificationMessage(conversation[i].content),
          answer: conversation[i + 1].content,
        });
      }
    }
    
    const clarificationStrategy = getClarificationStrategy(project.description, qaHistory);
    const maxQuestions = clarificationStrategy.maxQuestions;
    const lastMessage = conversation[conversation.length - 1];

    // Reuse the pending assistant question instead of generating a second one.
    if (lastMessage?.role === 'assistant') {
      const progress = Math.round((qaHistory.length / maxQuestions) * 100);

      const response: ClarifyResponse = {
        question: {
          id: lastMessage.id,
          question: sanitizeClarificationMessage(lastMessage.content),
        },
        progress,
        isComplete: false,
      };

      return NextResponse.json(response);
    }

    // Determine if we should continue asking questions
    const currentQuestionCount = qaHistory.length;
    const isComplete = currentQuestionCount >= maxQuestions;
    const previousQuestions = qaHistory.map((entry) => entry.question);

    const canStopEarly = currentQuestionCount >= clarificationStrategy.minimumAnswersBeforeEarlyStop
      && await hasEnoughClarificationForDesign(project.description, qaHistory);
    
    if (isComplete || canStopEarly) {
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
    let questionText = '';
    const normalizedPreviousQuestions = new Set(previousQuestions.map((question) => normalizeQuestion(question)));

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const candidateQuestion = await generateClarificationQuestion(
        project.description,
        project.skillLevel,
        qaHistory,
        previousQuestions
      );

      const sanitizedCandidateQuestion = sanitizeClarificationMessage(candidateQuestion);

      const normalizedCandidate = normalizeQuestion(sanitizedCandidateQuestion);

      if (!normalizedPreviousQuestions.has(normalizedCandidate)) {
        questionText = sanitizedCandidateQuestion;
        break;
      }
    }

    if (!questionText) {
      questionText = 'What is the most important technical or operational constraint this system must handle from day one, such as security, integrations, scale, or uptime?';
    }

    const refreshedConversation = getConversation(projectId);
    const latestMessage = refreshedConversation[refreshedConversation.length - 1];

    if (latestMessage?.role === 'assistant') {
      const progress = Math.round((currentQuestionCount / maxQuestions) * 100);

      const response: ClarifyResponse = {
        question: {
          id: latestMessage.id,
          question: sanitizeClarificationMessage(latestMessage.content),
        },
        progress,
        isComplete: false,
      };

      return NextResponse.json(response);
    }
    
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
