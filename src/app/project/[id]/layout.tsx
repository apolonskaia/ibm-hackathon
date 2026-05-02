'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ArchitectureOption, Project } from '@/types';
import { deriveProjectTitle } from '@/lib/utils';

const PROJECT_STAGES = [
  {
    hrefSuffix: 'clarify',
    label: 'Requirements discussion',
    description: 'Input and clarification',
  },
  {
    hrefSuffix: 'architecture',
    label: 'Architecture Options',
    description: 'Compare solution paths',
  },
  {
    hrefSuffix: 'design',
    label: 'System Design',
    description: 'Diagram and details',
  },
] as const;

type ProjectLayoutProps = {
  children: React.ReactNode;
  params: { id: string };
};

type ProjectProgressState = {
  project: Project | null;
  architectures: ArchitectureOption[];
};

function getUnlockedStageIndex(progress: ProjectProgressState): number {
  const hasRequirements = Boolean(progress.project?.requirements);
  const hasArchitectures = progress.architectures.length > 0;
  const hasSelectedArchitecture = progress.architectures.some((architecture) => architecture.selected);
  const status = progress.project?.status;

  if (hasSelectedArchitecture || status === 'designing' || status === 'completed') {
    return 2;
  }

  if (hasRequirements || hasArchitectures || status === 'generating_options' || status === 'selecting_architecture') {
    return 1;
  }

  return 0;
}

export default function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const pathname = usePathname();
  const [progress, setProgress] = useState<ProjectProgressState>({
    project: null,
    architectures: [],
  });

  useEffect(() => {
    let isMounted = true;

    const loadProjectProgress = async () => {
      try {
        const response = await fetch(`/api/projects/${params.id}`, { cache: 'no-store' });

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        if (!isMounted) {
          return;
        }

        setProgress({
          project: data.project ?? null,
          architectures: data.architectures ?? [],
        });
      } catch (error) {
        console.error('Failed to load project workflow progress:', error);
      }
    };

    void loadProjectProgress();

    return () => {
      isMounted = false;
    };
  }, [params.id, pathname]);

  const unlockedStageIndex = useMemo(() => getUnlockedStageIndex(progress), [progress]);
  const projectTitle = useMemo(
    () => deriveProjectTitle(progress.project?.name, progress.project?.description),
    [progress.project]
  );

  return (
    <div className="pb-10">
      <div className="border-b bg-slate-50/80 backdrop-blur-sm">
        <div className="container mx-auto max-w-7xl px-4 py-5">
          <div className="mb-4">
            <h1 className="text-2xl font-semibold text-slate-900">{projectTitle}</h1>
            {progress.project?.description && (
              <p className="mt-1 max-w-3xl text-sm text-slate-600">{progress.project.description}</p>
            )}
          </div>
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Project Workflow
            </p>
          </div>
          <nav aria-label="Project stages" className="grid gap-3 md:grid-cols-3">
            {PROJECT_STAGES.map((stage, index) => {
              const href = `/project/${params.id}/${stage.hrefSuffix}`;
              const isActive = pathname === href;
              const isUnlocked = index <= unlockedStageIndex;
              const className = `rounded-xl border px-4 py-4 transition-colors ${
                isActive
                  ? 'border-blue-600 bg-white shadow-sm'
                  : isUnlocked
                    ? 'border-slate-200 bg-white/70 hover:border-slate-300 hover:bg-white'
                    : 'cursor-not-allowed border-slate-200 bg-slate-100/80 opacity-60'
              }`;
              const badgeClassName = `flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                isActive ? 'bg-blue-600 text-white' : isUnlocked ? 'bg-slate-200 text-slate-700' : 'bg-slate-300 text-slate-600'
              }`;
              const labelClassName = `text-sm font-semibold ${
                isActive ? 'text-blue-700' : isUnlocked ? 'text-slate-900' : 'text-slate-500'
              }`;

              if (!isUnlocked) {
                return (
                  <div
                    key={stage.hrefSuffix}
                    aria-disabled="true"
                    className={className}
                  >
                    <div className="mb-2 flex items-center gap-3">
                      <span className={badgeClassName}>{index + 1}</span>
                      <span className={labelClassName}>{stage.label}</span>
                    </div>
                    <p className="text-sm text-slate-600">{stage.description}</p>
                  </div>
                );
              }

              return (
                <Link
                  key={stage.hrefSuffix}
                  href={href}
                  className={className}
                >
                  <div className="mb-2 flex items-center gap-3">
                    <span className={badgeClassName}>{index + 1}</span>
                    <span className={labelClassName}>{stage.label}</span>
                  </div>
                  <p className="text-sm text-slate-600">{stage.description}</p>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      {children}
    </div>
  );
}