'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import { Message } from '@/types';

const QUICK_REPLY_OPTIONS = [
  'Use best practices',
  "I don't know",
  'Show me options later',
] as const;

function calculateProgress(messages: Message[], maxQuestions: number): number {
  const answeredQuestionCount = messages.filter((message) => message.role === 'user').length;
  return Math.min(100, Math.round((answeredQuestionCount / maxQuestions) * 100));
}

export default function Home() {
  const router = useRouter();
  const [projectIdea, setProjectIdea] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [isSavingAnswer, setIsSavingAnswer] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState('');
  const clarificationSectionRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const maxQuestions = 5;

  useEffect(() => {
    if (!projectId) {
      return;
    }

    if (messages.length <= 1) {
      clarificationSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      return;
    }

    messagesContainerRef.current?.scrollTo({
      top: messagesContainerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, isLoadingQuestion, projectId]);

  useEffect(() => {
    setProgress(calculateProgress(messages, maxQuestions));
  }, [messages]);

  const loadNextQuestion = useCallback(async (targetProjectId?: string) => {
    const activeProjectId = targetProjectId ?? projectId;

    if (!activeProjectId) {
      return;
    }

    setIsLoadingQuestion(true);
    setError('');

    try {
      const response = await fetch('/api/clarify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProjectId }),
      });

      if (!response.ok) {
        throw new Error('Failed to load question');
      }

      const data = await response.json();

      if (data.isComplete) {
        setIsComplete(true);
        setProgress(100);
        return;
      }

      const questionMessage: Message = {
        id: data.question.id,
        projectId: activeProjectId,
        role: 'assistant',
        content: data.question.question,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];

        if (lastMessage?.role === 'assistant' && lastMessage.content === questionMessage.content) {
          return prev;
        }

        if (prev.some((message) => message.id === questionMessage.id)) {
          return prev;
        }

        return [...prev, questionMessage];
      });
      setIsComplete(false);
    } catch (err) {
      setError('Failed to load question. Please try again.');
      console.error(err);
    } finally {
      setIsLoadingQuestion(false);
    }
  }, [projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (projectIdea.length < 50) {
      setError('Please provide at least 50 characters describing your project.');
      return;
    }

    if (projectIdea.length > 500) {
      setError('Please keep your description under 500 characters.');
      return;
    }

    setIsCreatingProject(true);

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: projectIdea.substring(0, 100),
          description: projectIdea,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create project');
      }

      const data = await response.json();
      setProjectId(data.id);
      setMessages([]);
      setCurrentAnswer('');
      setIsComplete(false);
      setProgress(0);
      await loadNextQuestion(data.id);
    } catch (err) {
      setError('Failed to start project. Please try again.');
      console.error(err);
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleSubmitAnswer = async (answerOverride?: string) => {
    if (!projectId) {
      setError('Project not initialized. Please start again.');
      return;
    }

    const answerToSubmit = (answerOverride ?? currentAnswer).trim();

    if (!answerToSubmit) {
      setError('Please provide an answer');
      return;
    }

    setError('');
    setIsSavingAnswer(true);

    const answerMessage: Message = {
      id: `answer_${Date.now()}`,
      projectId,
      role: 'user',
      content: answerToSubmit,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, answerMessage]);

    try {
      const response = await fetch(`/api/projects/${projectId}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'user',
          content: answerToSubmit,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save answer');
      }

      setCurrentAnswer('');
      await loadNextQuestion(projectId);
    } catch (err) {
      setError('Failed to save answer. Please try again.');
      console.error(err);
    } finally {
      setIsSavingAnswer(false);
    }
  };

  const handleComplete = async () => {
    if (!projectId) {
      return;
    }

    setIsCompleting(true);
    setError('');

    try {
      const response = await fetch('/api/clarify/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      if (!response.ok) {
        throw new Error('Failed to complete clarification');
      }

      router.push(`/project/${projectId}/architecture`);
    } catch (err) {
      setError('Failed to complete clarification. Please try again.');
      console.error(err);
      setIsCompleting(false);
    }
  };

  const isBusy = isCreatingProject || isLoadingQuestion || isSavingAnswer || isCompleting;

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Hero Section */}
      <div className="max-w-4xl mx-auto text-center mb-10">
        <h1 className="text-4xl font-bold text-gray-900 mb-6">
          Transform Ideas into
          <span className="block text-blue-600">Clear Software Designs</span>
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          AI-powered system design assistant that guides you through options, explains trade-offs, and helps you create robust, reliable software architectures in minutes.
        </p>
        <div className="flex justify-center space-x-4 text-sm text-gray-500">
          <div className="flex items-center">
            <svg
              className="w-5 h-5 text-green-500 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>~10 minutes</span>
          </div>
          <div className="flex items-center">
            <svg
              className="w-5 h-5 text-green-500 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>AI-powered</span>
          </div>
          <div className="flex items-center">
            <svg
              className="w-5 h-5 text-green-500 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>Export ready</span>
          </div>
        </div>
      </div>

      {/* Main Form */}
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <form onSubmit={handleSubmit}>
          {/* Project Idea Input */}
          <div className="mb-6">
            <label
              htmlFor="projectIdea"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Describe What You Want to Build
            </label>
            <textarea
              id="projectIdea"
              value={projectIdea}
              onChange={(e) => setProjectIdea(e.target.value)}
              placeholder="Example: I want to build a real-time chat application that supports group conversations, file sharing, and video calls. It should handle thousands of concurrent users and work on both web and mobile platforms..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={6}
              disabled={projectId !== null || isBusy}
            />
            <div className="flex justify-between items-center mt-2">
              <span
                className={`text-sm ${
                  projectIdea.length < 50
                    ? 'text-gray-400'
                    : projectIdea.length > 500
                    ? 'text-red-500'
                    : 'text-green-500'
                }`}
              >
                {projectIdea.length} / 500 characters (min 50)
              </span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={projectId !== null || isBusy || projectIdea.length < 50}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isCreatingProject ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Starting Build...
              </span>
            ) : (
              'Start Building'
            )}
          </button>
        </form>
      </div>

      {projectId && (
        <div ref={clarificationSectionRef} className="max-w-3xl mx-auto mt-8 space-y-6 scroll-mt-24">
          <div>
            <div className="mb-2">
              <div className="text-center">
                <p className="text-xl text-gray-600 lg:whitespace-nowrap">
                  Answer a few quick questions to shape the right design for your project.
                </p>
              </div>
            </div>
          </div>

          <Card>
            <CardContent className="p-6">
              <div ref={messagesContainerRef} className="space-y-4 max-h-[500px] overflow-y-auto">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-3 ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      {message.role === 'assistant' && (
                        <div className="flex items-center mb-2">
                          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                            <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                          </svg>
                          <span className="font-semibold text-sm">AI Assistant</span>
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ))}

                {isLoadingQuestion && !isComplete && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-lg px-4 py-3">
                      <Loading size="sm" text="Thinking..." />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {!isComplete ? (
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {QUICK_REPLY_OPTIONS.map((quickReply) => (
                      <Button
                        key={quickReply}
                        type="button"
                        variant="outline"
                        disabled={isBusy}
                        onClick={() => void handleSubmitAnswer(quickReply)}
                      >
                        {quickReply}
                      </Button>
                    ))}
                  </div>
                  <textarea
                    value={currentAnswer}
                    onChange={(e) => setCurrentAnswer(e.target.value)}
                    placeholder="Reply briefly. You can also say things like 'decide yourself', 'use best practices', or 'show me options with justifications'."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={4}
                    disabled={isBusy}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.ctrlKey) {
                        void handleSubmitAnswer();
                      }
                    }}
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">
                      Keep answers brief. Focus on functionality, users, integrations, platform, and rough scale.
                    </span>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          setProgress(100);
                          setIsComplete(true);
                        }}
                        variant="outline"
                        disabled={isBusy}
                      >
                        Skip to Architecture
                      </Button>
                      <Button
                        type="button"
                        onClick={() => void handleSubmitAnswer()}
                        disabled={isBusy || !currentAnswer.trim()}
                        isLoading={isSavingAnswer}
                      >
                        Submit Answer
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <div className="mb-4">
                  <svg className="w-16 h-16 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Requirements Collected!</h2>
                <p className="text-gray-600 mb-6">
                  We have enough information to generate architecture options for your project.
                </p>
                <Button onClick={handleComplete} isLoading={isCompleting} size="lg">
                  Generate Architecture Options
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Features Section */}
      <div className="max-w-6xl mx-auto mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Guided Clarification
          </h3>
          <p className="text-gray-600">
            AI asks smart questions to understand your requirements perfectly
          </p>
        </div>

        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Multiple Options
          </h3>
          <p className="text-gray-600">
            Compare different architecture approaches with pros and cons
          </p>
        </div>

        <div className="text-center">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-purple-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Export Ready
          </h3>
          <p className="text-gray-600">
            Download professional documentation and diagrams instantly
          </p>
        </div>
      </div>
    </div>
  );
}

// Made with Bob
