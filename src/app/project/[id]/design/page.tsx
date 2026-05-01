'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LoadingPage } from '@/components/ui/loading';
import { MermaidDiagram } from '@/components/visualization/mermaid-diagram';
import { ArchitectureOption } from '@/types';

export default function DesignPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  
  const [architecture, setArchitecture] = useState<ArchitectureOption | null>(null);
  const [components, setComponents] = useState<any[]>([]);
  const [justifications, setJustifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'components' | 'justifications'>('overview');
  
  useEffect(() => {
    loadArchitectureDetails();
  }, []);
  
  const loadArchitectureDetails = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // Get selected architecture
      const projectResponse = await fetch(`/api/projects/${projectId}`);
      if (!projectResponse.ok) throw new Error('Failed to load project');
      
      const { project } = await projectResponse.json();
      
      // Get architectures for this project
      const archResponse = await fetch(`/api/projects/${projectId}`);
      // Note: In a real implementation, we'd have an endpoint to get architectures
      // For now, we'll simulate this
      
      // Mock selected architecture (in production, fetch from database)
      const mockArchitecture: ArchitectureOption = {
        id: 'arch_1',
        projectId,
        name: 'Microservices Architecture',
        description: 'Scalable microservices-based system',
        overview: 'A distributed system architecture using microservices pattern for better scalability and maintainability.',
        techStack: {
          frontend: ['React', 'TypeScript', 'Tailwind CSS'],
          backend: ['Node.js', 'Express', 'TypeScript'],
          database: ['PostgreSQL', 'Redis'],
          infrastructure: ['Docker', 'Kubernetes', 'AWS'],
        },
        pros: ['Highly scalable', 'Independent deployment', 'Technology flexibility'],
        cons: ['Complex infrastructure', 'Distributed system challenges', 'Higher operational overhead'],
        complexity: 'high',
        estimatedCost: 'medium',
        diagram: `graph TB
    Client[Client Application]
    Gateway[API Gateway]
    Auth[Auth Service]
    User[User Service]
    Product[Product Service]
    Order[Order Service]
    DB1[(User DB)]
    DB2[(Product DB)]
    DB3[(Order DB)]
    Cache[Redis Cache]
    
    Client --> Gateway
    Gateway --> Auth
    Gateway --> User
    Gateway --> Product
    Gateway --> Order
    
    User --> DB1
    Product --> DB2
    Order --> DB3
    
    User --> Cache
    Product --> Cache`,
        selected: true,
        createdAt: new Date().toISOString(),
      };
      
      setArchitecture(mockArchitecture);
      
      // Load components
      const mockComponents = [
        {
          name: 'API Gateway',
          type: 'backend',
          description: 'Central entry point for all client requests',
          responsibilities: ['Request routing', 'Authentication', 'Rate limiting'],
          technologies: ['Node.js', 'Express'],
          dependencies: ['Auth Service', 'User Service'],
        },
        {
          name: 'Auth Service',
          type: 'backend',
          description: 'Handles authentication and authorization',
          responsibilities: ['User authentication', 'Token management', 'Permission checks'],
          technologies: ['Node.js', 'JWT', 'bcrypt'],
          dependencies: ['User Database'],
        },
        {
          name: 'User Service',
          type: 'backend',
          description: 'Manages user data and profiles',
          responsibilities: ['User CRUD operations', 'Profile management'],
          technologies: ['Node.js', 'TypeScript'],
          dependencies: ['User Database', 'Redis Cache'],
        },
      ];
      
      setComponents(mockComponents);
      
      // Load justifications
      const mockJustifications = [
        {
          category: 'technology',
          decision: 'Node.js for backend services',
          reasoning: 'Provides excellent performance for I/O-heavy operations and has a rich ecosystem',
          alternatives: [
            {
              name: 'Python/Django',
              description: 'Mature framework with batteries included',
              whyNotChosen: 'Slower performance for real-time operations',
            },
          ],
          tradeoffs: [
            {
              aspect: 'Performance',
              benefit: 'Fast I/O operations',
              cost: 'Single-threaded nature',
            },
          ],
        },
        {
          category: 'pattern',
          decision: 'Microservices architecture',
          reasoning: 'Enables independent scaling and deployment of services',
          alternatives: [
            {
              name: 'Monolithic',
              description: 'Single unified application',
              whyNotChosen: 'Limited scalability and deployment flexibility',
            },
          ],
          tradeoffs: [
            {
              aspect: 'Complexity',
              benefit: 'Better separation of concerns',
              cost: 'More complex infrastructure',
            },
          ],
        },
      ];
      
      setJustifications(mockJustifications);
    } catch (err) {
      setError('Failed to load architecture details. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
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
              { id: 'components', label: 'Components' },
              { id: 'justifications', label: 'Justifications' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
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
      
      {/* Components Tab */}
      {activeTab === 'components' && (
        <div className="grid grid-cols-1 gap-6">
          {components.map((component, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{component.name}</CardTitle>
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                    {component.type}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-2">{component.description}</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h4 className="font-semibold text-sm text-gray-700 mb-2">Responsibilities</h4>
                    <ul className="space-y-1 text-sm text-gray-600">
                      {component.responsibilities.map((resp: string, j: number) => (
                        <li key={j}>• {resp}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-gray-700 mb-2">Technologies</h4>
                    <div className="flex flex-wrap gap-2">
                      {component.technologies.map((tech: string, j: number) => (
                        <span key={j} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-gray-700 mb-2">Dependencies</h4>
                    <ul className="space-y-1 text-sm text-gray-600">
                      {component.dependencies.map((dep: string, j: number) => (
                        <li key={j}>→ {dep}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Justifications Tab */}
      {activeTab === 'justifications' && (
        <div className="space-y-6">
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
                        {just.alternatives.map((alt: any, j: number) => (
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
                        {just.tradeoffs.map((tradeoff: any, j: number) => (
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
