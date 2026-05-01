'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import { Message } from '@/types';

export default function ClarifyPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Load initial question
  useEffect(() => {
    loadNextQuestion();
  }, []);
  
  const loadNextQuestion = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/clarify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to load question');
      }
      
      const data = await response.json();
      
      if (data.isComplete) {
        setIsComplete(true);
        setProgress(100);
      } else {
        // Add question to messages
        const questionMessage: Message = {
          id: data.question.id,
          projectId,
          role: 'assistant',
          content: data.question.question,
          timestamp: new Date().toISOString(),
        };
        
        setMessages(prev => [...prev, questionMessage]);
        setProgress(data.progress);
      }
    } catch (err) {
      setError('Failed to load question. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSubmitAnswer = async () => {
    if (!currentAnswer.trim()) {
      setError('Please provide an answer');
      return;
    }
    
    setError('');
    
    // Add user answer to messages
    const answerMessage: Message = {
      id: `answer_${Date.now()}`,
      projectId,
      role: 'user',
      content: currentAnswer,
      timestamp: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, answerMessage]);
    
    // Save answer to database
    try {
      await fetch(`/api/projects/${projectId}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'user',
          content: currentAnswer,
        }),
      });
      
      setCurrentAnswer('');
      
      // Load next question
      await loadNextQuestion();
    } catch (err) {
      setError('Failed to save answer. Please try again.');
      console.error(err);
    }
  };
  
  const handleComplete = async () => {
    setIsLoading(true);
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
      
      const data = await response.json();
      
      // Navigate to architecture generation
      router.push(`/project/${projectId}/architecture`);
    } catch (err) {
      setError('Failed to complete clarification. Please try again.');
      console.error(err);
      setIsLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-2xl font-bold text-gray-900">
            Project Clarification
          </h1>
          <span className="text-sm text-gray-600">{progress}% Complete</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      
      {/* Messages */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="space-y-4 max-h-[500px] overflow-y-auto">
            {messages.length === 0 && !isLoading && (
              <div className="text-center text-gray-500 py-8">
                <p>Loading your first question...</p>
              </div>
            )}
            
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
                      <svg
                        className="w-5 h-5 mr-2"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
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
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-4 py-3">
                  <Loading size="sm" text="Thinking..." />
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </CardContent>
      </Card>
      
      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}
      
      {/* Input Area */}
      {!isComplete && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <textarea
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                placeholder="Type your answer here..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={4}
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    handleSubmitAnswer();
                  }
                }}
              />
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">
                  Press Ctrl+Enter to submit
                </span>
                <Button
                  onClick={handleSubmitAnswer}
                  disabled={isLoading || !currentAnswer.trim()}
                  isLoading={isLoading}
                >
                  Submit Answer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Complete Button */}
      {isComplete && (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="mb-4">
              <svg
                className="w-16 h-16 text-green-500 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Clarification Complete!
            </h2>
            <p className="text-gray-600 mb-6">
              We have enough information to generate architecture options for your project.
            </p>
            <Button
              onClick={handleComplete}
              isLoading={isLoading}
              size="lg"
            >
              Generate Architecture Options
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Made with Bob
