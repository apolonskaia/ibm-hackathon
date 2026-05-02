'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { LoadingPage } from '@/components/ui/loading';
import { ProjectHistorySummary, ProjectStatus } from '@/types';
import { deriveProjectTitle } from '@/lib/utils';

const statusLabels: Record<ProjectStatus, string> = {
  created: 'Not started',
  clarifying: 'Clarification in progress',
  generating_options: 'Preparing architecture options',
  selecting_architecture: 'Architecture options ready',
  designing: 'Design in progress',
  completed: 'Completed',
};

const statusClasses: Record<ProjectStatus, string> = {
  created: 'bg-gray-100 text-gray-700',
  clarifying: 'bg-amber-100 text-amber-800',
  generating_options: 'bg-sky-100 text-sky-800',
  selecting_architecture: 'bg-blue-100 text-blue-800',
  designing: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-violet-100 text-violet-800',
};

export default function ProjectHistoryPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectHistorySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [pendingDeleteProject, setPendingDeleteProject] = useState<ProjectHistorySummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadProjects = async () => {
      setIsLoading(true);
      setError('');

      try {
        const response = await fetch('/api/projects');

        if (!response.ok) {
          throw new Error('Failed to load project history');
        }

        const data = await response.json();
        setProjects(data.projects);
      } catch (err) {
        setError('Failed to load project history. Please try again.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    void loadProjects();
  }, []);

  const handleDeleteProject = async (projectId: string) => {
    setDeletingProjectId(projectId);
    setError('');

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete project');
      }

      setProjects((currentProjects) => currentProjects.filter((entry) => entry.project.id !== projectId));
      setPendingDeleteProject(null);
    } catch (err) {
      setError('Failed to delete project. Please try again.');
      console.error(err);
    } finally {
      setDeletingProjectId(null);
    }
  };

  if (isLoading) {
    return <LoadingPage text="Loading project history..." />;
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-7xl">
      <ConfirmationModal
        isOpen={Boolean(pendingDeleteProject)}
        title="Delete project"
        description={pendingDeleteProject
          ? `Delete "${deriveProjectTitle(pendingDeleteProject.project.name, pendingDeleteProject.project.description)}"? This will remove its saved clarification history, architecture options, and generated design artifacts.`
          : ''}
        confirmLabel="Delete project"
        cancelLabel="Keep project"
        isConfirming={pendingDeleteProject ? deletingProjectId === pendingDeleteProject.project.id : false}
        onConfirm={() => {
          if (pendingDeleteProject) {
            void handleDeleteProject(pendingDeleteProject.project.id);
          }
        }}
        onCancel={() => {
          if (!deletingProjectId) {
            setPendingDeleteProject(null);
          }
        }}
      />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Project History</h1>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {projects.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <p className="text-gray-600">No saved projects yet.</p>
            <Button className="mt-4" onClick={() => router.push('/')}>
              Create Your First Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {projects.map((entry) => (
            <Card key={entry.project.id} className="border-gray-200">
              <CardHeader className="border-b-0 pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <CardTitle className="text-lg text-gray-900 leading-tight">
                      {deriveProjectTitle(entry.project.name, entry.project.description)}
                    </CardTitle>
                    <p className="mt-3 line-clamp-2 text-sm text-gray-600">{entry.project.description}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClasses[entry.project.status]}`}>
                    {statusLabels[entry.project.status]}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-0">
                <div className="space-y-1.5 text-sm text-gray-700">
                  <p className="leading-snug">
                    <span className="font-medium text-gray-900">Requirements captured:</span>{' '}
                    {entry.hasRequirements ? 'Yes' : 'Not yet'}
                  </p>
                  <p className="leading-snug">
                    <span className="font-medium text-gray-900">Conversation messages:</span>{' '}
                    {entry.conversationCount}
                  </p>
                  <p className="leading-snug">
                    <span className="font-medium text-gray-900">Last updated:</span>{' '}
                    {new Date(entry.project.updatedAt).toLocaleString()}
                  </p>
                  {entry.selectedArchitecture && (
                    <p className="leading-snug">
                      <span className="font-medium text-gray-900">Selected architecture:</span>{' '}
                      {entry.selectedArchitecture.name}
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300"
                    onClick={() => setPendingDeleteProject(entry)}
                    isLoading={deletingProjectId === entry.project.id}
                  >
                    Delete
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300"
                    onClick={() => router.push(entry.resumePath)}
                  >
                    Go to Project
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}