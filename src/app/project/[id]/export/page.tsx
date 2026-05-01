'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ExportFormat } from '@/types';

export default function ExportPage() {
  const params = useParams();
  const projectId = params.id as string;
  
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('markdown');
  const [includeOptions, setIncludeOptions] = useState({
    includeDiagrams: true,
    includeJustifications: true,
    includeComponents: true,
    includeConversation: false,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');
  const [exportResult, setExportResult] = useState<any>(null);
  
  const formats = [
    {
      id: 'markdown' as ExportFormat,
      name: 'Markdown',
      description: 'Perfect for documentation and GitHub',
      icon: '📝',
    },
    {
      id: 'json' as ExportFormat,
      name: 'JSON',
      description: 'Machine-readable format for integration',
      icon: '{ }',
    },
    {
      id: 'html' as ExportFormat,
      name: 'HTML',
      description: 'Standalone web page',
      icon: '🌐',
    },
  ];
  
  const handleExport = async () => {
    setIsExporting(true);
    setError('');
    setExportResult(null);
    
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          format: selectedFormat,
          options: includeOptions,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to export project');
      }
      
      const data = await response.json();
      setExportResult(data.export);
      
      // Trigger download
      const blob = new Blob([data.export.content], {
        type: selectedFormat === 'json' ? 'application/json' : 'text/plain',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.export.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to export project. Please try again.');
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Export Documentation
        </h1>
        <p className="text-gray-600">
          Download your architecture documentation in your preferred format.
        </p>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}
      
      {exportResult && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-green-500 mr-2 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <h3 className="font-semibold text-green-800">Export Successful!</h3>
              <p className="text-sm text-green-700 mt-1">
                Your documentation has been downloaded as <strong>{exportResult.filename}</strong>
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Format Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Export Format</CardTitle>
          <CardDescription>
            Choose the format that best suits your needs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {formats.map((format) => (
              <button
                key={format.id}
                onClick={() => setSelectedFormat(format.id)}
                className={`p-4 border-2 rounded-lg text-left transition-all ${
                  selectedFormat === format.id
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-3xl mb-2">{format.icon}</div>
                <div className="font-semibold text-gray-900">{format.name}</div>
                <div className="text-sm text-gray-500 mt-1">
                  {format.description}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Include Options */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Include in Export</CardTitle>
          <CardDescription>
            Select what to include in your documentation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              {
                key: 'includeDiagrams',
                label: 'System Diagrams',
                description: 'Include Mermaid diagrams showing system architecture',
              },
              {
                key: 'includeJustifications',
                label: 'Decision Justifications',
                description: 'Include explanations for architecture decisions',
              },
              {
                key: 'includeComponents',
                label: 'Component Breakdown',
                description: 'Include detailed component descriptions',
              },
              {
                key: 'includeConversation',
                label: 'Clarification Q&A',
                description: 'Include the conversation history from clarification phase',
              },
            ].map((option) => (
              <label
                key={option.key}
                className="flex items-start space-x-3 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={includeOptions[option.key as keyof typeof includeOptions]}
                  onChange={(e) =>
                    setIncludeOptions({
                      ...includeOptions,
                      [option.key]: e.target.checked,
                    })
                  }
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{option.label}</div>
                  <div className="text-sm text-gray-500">{option.description}</div>
                </div>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Export Button */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600">
          <p>Format: <strong className="text-gray-900">{selectedFormat.toUpperCase()}</strong></p>
          <p className="mt-1">
            {Object.values(includeOptions).filter(Boolean).length} of {Object.keys(includeOptions).length} options selected
          </p>
        </div>
        <Button
          onClick={handleExport}
          isLoading={isExporting}
          size="lg"
        >
          {isExporting ? 'Exporting...' : 'Export Documentation'}
        </Button>
      </div>
      
      {/* Preview Section */}
      {selectedFormat === 'markdown' && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              This is what your Markdown export will look like
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 p-4 rounded font-mono text-sm text-gray-700 overflow-x-auto">
              <pre>{`# Project Architecture

**Generated**: ${new Date().toLocaleDateString()}

## Project Description
[Your project description]

## Selected Architecture
[Architecture name and overview]

### Technology Stack
**Frontend**: React, TypeScript, Tailwind CSS
**Backend**: Node.js, Express
**Database**: PostgreSQL, Redis

### Advantages
- Highly scalable
- Independent deployment
- Technology flexibility

### Considerations
- Complex infrastructure
- Distributed system challenges

${includeOptions.includeDiagrams ? '## System Diagram\n```mermaid\n[Diagram code]\n```\n' : ''}
${includeOptions.includeComponents ? '## Components\n[Component details]\n' : ''}
${includeOptions.includeJustifications ? '## Justifications\n[Decision justifications]\n' : ''}
${includeOptions.includeConversation ? '## Clarification Q&A\n[Conversation history]\n' : ''}`}</pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Made with Bob
