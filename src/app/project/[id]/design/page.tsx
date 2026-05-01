'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loading, LoadingPage } from '@/components/ui/loading';
import { MermaidDiagram } from '@/components/visualization/mermaid-diagram';
import { ArchitectureOption, Component, Justification } from '@/types';

type DesignTab = 'overview' | 'justifications';

export default function DesignPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  
  const [architecture, setArchitecture] = useState<ArchitectureOption | null>(null);
  const [components, setComponents] = useState<Component[]>([]);
  const [justifications, setJustifications] = useState<Justification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingComponents, setIsLoadingComponents] = useState(false);
  const [isLoadingJustifications, setIsLoadingJustifications] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<DesignTab>('overview');

  const loadComponents = useCallback(async (selectedArchitecture: ArchitectureOption) => {
    setIsLoadingComponents(true);

    try {
      const response = await fetch(`/api/architecture/${selectedArchitecture.id}/components`);
      if (!response.ok) {
        throw new Error('Failed to load components');
      }

      const { components: generatedComponents } = await response.json();
      setComponents(generatedComponents);
    } catch (err) {
      setError('Failed to load architecture components. Please try again.');
      console.error(err);
    } finally {
      setIsLoadingComponents(false);
    }
  }, []);
  
  useEffect(() => {
    const loadArchitectureDetails = async () => {
      setIsLoading(true);
      setError('');

      try {
        const projectResponse = await fetch(`/api/projects/${projectId}`);
        if (!projectResponse.ok) {
          throw new Error('Failed to load project');
        }

        const { architectures } = await projectResponse.json();
        const selectedArchitecture = architectures.find((option: ArchitectureOption) => option.selected) ?? null;

        setArchitecture(selectedArchitecture);

        if (!selectedArchitecture) {
          setComponents([]);
          setJustifications([]);
          return;
        }

        setComponents([]);
        setJustifications([]);
        void loadComponents(selectedArchitecture);
      } catch (err) {
        setError('Failed to load architecture details. Please try again.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    void loadArchitectureDetails();
  }, [loadComponents, projectId]);

  useEffect(() => {
    if (activeTab !== 'justifications' || !architecture || justifications.length > 0 || isLoadingJustifications) {
      return;
    }

    const loadJustifications = async () => {
      setIsLoadingJustifications(true);

      try {
        const response = await fetch(`/api/architecture/${architecture.id}/justifications`);
        if (!response.ok) {
          throw new Error('Failed to load justifications');
        }

        const { justifications: generatedJustifications } = await response.json();
        setJustifications(generatedJustifications);
      } catch (err) {
        setError('Failed to load architecture justifications. Please try again.');
        console.error(err);
      } finally {
        setIsLoadingJustifications(false);
      }
    };

    void loadJustifications();
  }, [activeTab, architecture, isLoadingJustifications, justifications.length]);
  
  const handleExport = () => {
    router.push(`/project/${projectId}/export`);
  };
  
  if (isLoading) {
    return <LoadingPage text="Loading architecture details..." />;
  }
  
  if (!architecture) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No architecture selected.</p>
          <Button onClick={() => router.push(`/project/${projectId}/architecture`)}>
            Select Architecture
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {architecture.name}
            </h1>
            <p className="text-gray-600">{architecture.description}</p>
          </div>
          <Button onClick={handleExport} size="lg">
            Export Documentation
          </Button>
        </div>
        
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'justifications', label: 'Justifications' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as DesignTab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}
      
      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,1fr)]">
            {/* System Diagram */}
            {architecture.diagram && (
              <Card>
                <CardHeader>
                  <CardTitle>System Architecture Diagram</CardTitle>
                </CardHeader>
                <CardContent>
                  <MermaidDiagram code={architecture.diagram} />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Key Components</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingComponents && components.length === 0 ? (
                  <Loading text="Loading components..." />
                ) : components.length === 0 ? (
                  <p className="text-sm text-gray-600">Component breakdown is not available yet.</p>
                ) : (
                  <div className="space-y-4">
                    {components.map((component, index) => (
                      <div key={index} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="font-semibold text-gray-900">{component.name}</h4>
                            <p className="mt-1 text-sm text-gray-600">{component.description}</p>
                          </div>
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs text-gray-600 border border-gray-200">
                            {component.type}
                          </span>
                        </div>

                        {component.dependencies.length > 0 && (
                          <p className="mt-3 text-xs text-gray-500">
                            Depends on: {component.dependencies.join(', ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Tech Stack */}
          <Card>
            <CardHeader>
              <CardTitle>Technology Stack</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(architecture.techStack).map(([category, technologies]) => (
                  technologies && technologies.length > 0 && (
                    <div key={category}>
                      <h4 className="font-semibold text-gray-700 mb-2 capitalize">
                        {category}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {(technologies as string[]).map((tech: string, i: number) => (
                          <span
                            key={i}
                            className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                ))}
              </div>
            </CardContent>
          </Card>
          
          {/* Pros and Cons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-green-700">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Advantages
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {architecture.pros.map((pro, i) => (
                    <li key={i} className="flex items-start">
                      <span className="text-green-500 mr-2">✓</span>
                      <span className="text-gray-700">{pro}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-yellow-700">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Considerations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {architecture.cons.map((con, i) => (
                    <li key={i} className="flex items-start">
                      <span className="text-yellow-500 mr-2">⚠</span>
                      <span className="text-gray-700">{con}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      
      {/* Justifications Tab */}
      {activeTab === 'justifications' && (
        <div className="space-y-6">
          {isLoadingJustifications && (
            <Card>
              <CardContent className="p-8">
                <Loading text="Generating architecture justifications..." />
              </CardContent>
            </Card>
          )}

          {!isLoadingJustifications && justifications.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-gray-600">
                Technical justifications are not available yet.
              </CardContent>
            </Card>
          )}

          {justifications.map((just, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{just.decision}</CardTitle>
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm capitalize">
                    {just.category}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-sm text-gray-700 mb-2">Reasoning</h4>
                    <p className="text-gray-600">{just.reasoning}</p>
                  </div>
                  
                  {just.alternatives.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700 mb-2">Alternatives Considered</h4>
                      <div className="space-y-2">
                        {just.alternatives.map((alt, j: number) => (
                          <div key={j} className="p-3 bg-gray-50 rounded">
                            <p className="font-medium text-gray-900">{alt.name}</p>
                            <p className="text-sm text-gray-600 mt-1">{alt.description}</p>
                            <p className="text-sm text-gray-500 mt-1">
                              <span className="font-medium">Why not chosen:</span> {alt.whyNotChosen}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {just.tradeoffs.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700 mb-2">Tradeoffs</h4>
                      <div className="space-y-2">
                        {just.tradeoffs.map((tradeoff, j: number) => (
                          <div key={j} className="flex items-start space-x-4 p-3 bg-gray-50 rounded">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{tradeoff.aspect}</p>
                              <p className="text-sm text-green-600 mt-1">
                                <span className="font-medium">✓ Benefit:</span> {tradeoff.benefit}
                              </p>
                              <p className="text-sm text-yellow-600 mt-1">
                                <span className="font-medium">⚠ Cost:</span> {tradeoff.cost}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Made with Bob
