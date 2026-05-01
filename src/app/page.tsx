'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

export default function Home() {
  const router = useRouter();
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('intermediate');
  const [projectIdea, setProjectIdea] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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

    setIsLoading(true);

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: projectIdea.substring(0, 100),
          description: projectIdea,
          skillLevel,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create project');
      }

      const data = await response.json();
      router.push(`/project/${data.id}/clarify`);
    } catch (err) {
      setError('Failed to start project. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Hero Section */}
      <div className="max-w-4xl mx-auto text-center mb-16">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Transform Ideas into
          <span className="text-blue-600"> Professional Architectures</span>
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          AI-powered system design assistant that guides you through creating
          structured, visualized software architectures in minutes.
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
          {/* Skill Level Selection */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-4">
              Select Your Skill Level
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  value: 'beginner' as SkillLevel,
                  title: 'Beginner',
                  description: 'New to system design',
                  icon: '🌱',
                },
                {
                  value: 'intermediate' as SkillLevel,
                  title: 'Intermediate',
                  description: 'Some experience',
                  icon: '🚀',
                },
                {
                  value: 'advanced' as SkillLevel,
                  title: 'Advanced',
                  description: 'Expert level',
                  icon: '⚡',
                },
              ].map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setSkillLevel(level.value)}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    skillLevel === level.value
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-2">{level.icon}</div>
                  <div className="font-semibold text-gray-900">
                    {level.title}
                  </div>
                  <div className="text-sm text-gray-500">
                    {level.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Project Idea Input */}
          <div className="mb-6">
            <label
              htmlFor="projectIdea"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Describe Your Project Idea
            </label>
            <textarea
              id="projectIdea"
              value={projectIdea}
              onChange={(e) => setProjectIdea(e.target.value)}
              placeholder="Example: I want to build a real-time chat application that supports group conversations, file sharing, and video calls. It should handle thousands of concurrent users and work on both web and mobile platforms..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={6}
              disabled={isLoading}
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
            disabled={isLoading || projectIdea.length < 50}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
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
                Starting Design Process...
              </span>
            ) : (
              'Start Design Process'
            )}
          </button>
        </form>
      </div>

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
