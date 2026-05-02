'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Loading, LoadingPage } from '@/components/ui/loading';
import { ArchitectureOption } from '@/types';

const INITIAL_ARCHITECTURE_COUNT = 3;

export default function ArchitecturePage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const visibleCountStorageKey = `project:${projectId}:visible-architectures`;
  
  const [options, setOptions] = useState<ArchitectureOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_ARCHITECTURE_COUNT);
  const hasRequestedInitialOptions = useRef(false);

  const updateVisibleCount = useCallback((nextVisibleCount: number) => {
    setVisibleCount(nextVisibleCount);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(visibleCountStorageKey, String(nextVisibleCount));
    }
  }, [visibleCountStorageKey]);

  const getPersistedVisibleCount = useCallback(() => {
    if (typeof window === 'undefined') {
      return INITIAL_ARCHITECTURE_COUNT;
    }

    const savedValue = window.localStorage.getItem(visibleCountStorageKey);
    const parsedValue = savedValue ? Number.parseInt(savedValue, 10) : NaN;
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : INITIAL_ARCHITECTURE_COUNT;
  }, [visibleCountStorageKey]);
  
  const generateOptions = useCallback(async ({
    requirementsOverride,
    append = false,
    showPageLoader = true,
  }: {
    requirementsOverride?: unknown;
    append?: boolean;
    showPageLoader?: boolean;
  } = {}) => {
    if (showPageLoader) {
      setIsLoading(true);
    }

    setIsGenerating(true);
    setError('');
    
    try {
      let requirements = requirementsOverride;

      if (!requirements) {
        const projectResponse = await fetch(`/api/projects/${projectId}`, { cache: 'no-store' });

        if (!projectResponse.ok) {
          throw new Error('Failed to get project');
        }

        const { project } = await projectResponse.json();
        requirements = project.requirements;
      }

      if (!requirements) {
        throw new Error('Requirements not found. Please complete clarification first.');
      }
      
      // Generate architecture options
      const archResponse = await fetch('/api/architecture/generate', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          requirements,
          append,
        }),
      });
      
      if (!archResponse.ok) {
        throw new Error('Failed to generate options');
      }
      
      const { options: generatedOptions } = await archResponse.json();
      if (append) {
        setOptions(generatedOptions);
        updateVisibleCount(Math.min(getPersistedVisibleCount() + 3, generatedOptions.length));
      } else {
        setOptions(generatedOptions);
        updateVisibleCount(Math.min(generatedOptions.length, INITIAL_ARCHITECTURE_COUNT));
      }
    } catch (err) {
      if (!append) {
        hasRequestedInitialOptions.current = false;
      }

      setError(append
        ? 'Failed to generate additional architecture options. Please try again.'
        : 'Failed to generate architecture options. Please try again.');
      console.error(err);
    } finally {
      if (showPageLoader) {
        setIsLoading(false);
      }

      setIsGenerating(false);
    }
  }, [getPersistedVisibleCount, projectId, updateVisibleCount]);

  useEffect(() => {
    const loadOptions = async () => {
      setIsLoading(true);
      setError('');

      const projectResponse = await fetch(`/api/projects/${projectId}`, { cache: 'no-store' });

      if (!projectResponse.ok) {
        setError('Failed to load project. Please try again.');
        setIsLoading(false);
        return;
      }

      const { project, architectures } = await projectResponse.json();

      if (architectures.length > 0) {
        setOptions(architectures);
        updateVisibleCount(Math.min(architectures.length, getPersistedVisibleCount()));
        hasRequestedInitialOptions.current = true;
        setIsLoading(false);
        return;
      }

      if (project.requirements && !hasRequestedInitialOptions.current) {
        hasRequestedInitialOptions.current = true;
        await generateOptions({ requirementsOverride: project.requirements });
        return;
      }

      setIsLoading(false);
    };

    void loadOptions();
  }, [generateOptions, getPersistedVisibleCount, projectId, updateVisibleCount]);
  
  const handleSelectArchitecture = async (architectureId: string) => {
    setIsSelecting(true);
    setError('');
    setSelectedId(architectureId);
    
    try {
      const response = await fetch('/api/architecture/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          architectureId,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to select architecture');
      }
      
      // Navigate to design view
      router.push(`/project/${projectId}/design`);
    } catch (err) {
      setError('Failed to select architecture. Please try again.');
      console.error(err);
      setIsSelecting(false);
      setSelectedId(null);
    }
  };
  
  if (isLoading) {
    return <LoadingPage text="Loading architecture options..." />;
  }

  const visibleOptions = options.slice(0, visibleCount);

  const handleGenerateMore = async () => {
    await generateOptions({ append: true, showPageLoader: false });
  };
  
  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'low': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'high': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };
  
  const getCostColor = (cost: string) => {
    switch (cost) {
      case 'low': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'high': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Architecture Options
        </h1>
        <p className="text-gray-600">
          Review architecture options, compare trade-offs, and choose the one that fits best.
        </p>
        {options.length > 0 && (
          <div className="mt-4">
            <Button
              variant="outline"
              onClick={() => void handleGenerateMore()}
              disabled={isGenerating || isSelecting}
              isLoading={isGenerating}
            >
              {isGenerating ? 'Generating More Architectures...' : 'Generate More Architectures'}
            </Button>
          </div>
        )}
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {visibleOptions.map((option, index) => (
          <Card
            key={option.id}
            variant="elevated"
            className={`transition-all ${
              selectedId === option.id ? 'ring-2 ring-blue-500' : ''
            }`}
          >
            <CardHeader>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <CardTitle>{option.name}</CardTitle>
                  <CardDescription className="mt-2">
                    {option.description}
                  </CardDescription>
                </div>
                <div className="ml-2 text-2xl font-bold text-blue-600">
                  #{index + 1}
                </div>
              </div>
              
              <div className="flex gap-2 mt-3">
                <span className={`px-2 py-1 rounded text-xs font-medium ${getComplexityColor(option.complexity)}`}>
                  {option.complexity} complexity
                </span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getCostColor(option.estimatedCost)}`}>
                  {option.estimatedCost} cost
                </span>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-4">
                {/* Overview */}
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 mb-2">Overview</h4>
                  <p className="text-sm text-gray-600">{option.overview}</p>
                </div>
                
                {/* Tech Stack */}
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 mb-2">Tech Stack</h4>
                  <div className="space-y-2 text-sm">
                    {Object.entries(option.techStack).map(([category, technologies]) => (
                      Array.isArray(technologies) && technologies.length > 0 ? (
                        <div key={category}>
                          <span className="font-medium text-gray-600 capitalize">{category.replace(/_/g, ' ')}:</span>{' '}
                          <span className="text-gray-700">{technologies.join(', ')}</span>
                        </div>
                      ) : null
                    ))}
                  </div>
                </div>
                
                {/* Pros */}
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 mb-2 flex items-center">
                    <svg className="w-4 h-4 text-green-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Advantages
                  </h4>
                  <ul className="space-y-1 text-sm text-gray-600">
                    {option.pros.slice(0, 3).map((pro, i) => (
                      <li key={i} className="flex items-start">
                        <span className="mr-2">•</span>
                        <span>{pro}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                {/* Cons */}
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 mb-2 flex items-center">
                    <svg className="w-4 h-4 text-yellow-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Considerations
                  </h4>
                  <ul className="space-y-1 text-sm text-gray-600">
                    {option.cons.slice(0, 3).map((con, i) => (
                      <li key={i} className="flex items-start">
                        <span className="mr-2">•</span>
                        <span>{con}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
            
            <CardFooter>
              <Button
                onClick={() => handleSelectArchitecture(option.id)}
                disabled={isSelecting}
                isLoading={isSelecting && selectedId === option.id}
                className="w-full"
              >
                {isSelecting && selectedId === option.id ? 'Selecting...' : 'Select This Architecture'}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
      
      {options.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">No architecture options available.</p>
          <Button onClick={() => generateOptions()} isLoading={isGenerating}>
            Generate Architecture Options
          </Button>
        </div>
      )}
    </div>
  );
}

// Made with Bob
