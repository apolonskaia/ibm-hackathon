'use client';

import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { normalizeMermaidDiagram } from '@/lib/mermaid';

export interface MermaidDiagramProps {
  code: string;
  className?: string;
}

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ code, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Initialize mermaid
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      fontFamily: 'Arial, sans-serif',
    });
  }, []);
  
  useEffect(() => {
    const renderDiagram = async () => {
      if (!containerRef.current) {
        return;
      }

      if (!code) {
        setError('No diagram is available for this architecture.');
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      setError(null);
      
      try {
        const normalizedCode = normalizeMermaidDiagram(code);
        const diagramElement = document.createElement('div');
        diagramElement.className = 'mermaid';
        diagramElement.textContent = normalizedCode;
        diagramElement.style.width = '100%';

        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(diagramElement);

        await mermaid.init(undefined, diagramElement);

        const renderedSvg = diagramElement.querySelector('svg');
        if (renderedSvg) {
          renderedSvg.removeAttribute('width');
          renderedSvg.style.width = '100%';
          renderedSvg.style.maxWidth = 'none';
          renderedSvg.style.height = 'auto';
          renderedSvg.style.display = 'block';
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        setError('Failed to render diagram. The diagram syntax may be invalid.');
        setIsLoading(false);
      }
    };
    
    renderDiagram();
  }, [code]);
  
  return (
    <div className={`relative min-h-40 ${className ?? ''}`}>
      <div
        ref={containerRef}
        className={`mermaid-container flex items-center justify-center p-6 bg-white rounded-lg border border-gray-200 ${isLoading || error ? 'invisible' : ''}`}
      />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center p-12 bg-gray-50 rounded-lg">
          <div className="text-center">
            <svg
              className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-2"
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
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <p className="text-sm text-gray-600">Rendering diagram...</p>
          </div>
        </div>
      )}

      {error && !isLoading && (
        <div className="absolute inset-0 p-6 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-red-500 mr-2 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <h3 className="font-semibold text-red-800">Diagram Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Made with Bob
