import { Suspense } from 'react';

import { ProjectRecordTable } from '@/components/project/ProjectRecordTable';
import { EmptyState } from '@/components/state/EmptyState';
import { LoadingBlock } from '@/components/state/LoadingBlock';
import { copy } from '@/copy/es-MX';
import { getViewer } from '@/data/viewer-session';
import { getActiveProjectRepository } from '@/data/repositories/active/projects';

async function ProjectsBody() {
  const viewer = await getViewer();
  const projects = await (await getActiveProjectRepository()).list(viewer);

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-ink-strong text-3xl font-medium sm:text-4xl">
          {copy.projects.title}
        </h1>
        <p className="text-muted text-sm">{copy.projects.subtitle}</p>
      </header>

      {projects.length === 0 ? (
        <EmptyState title={copy.states.empty} />
      ) : (
        <ProjectRecordTable projects={projects} />
      )}
    </div>
  );
}

/*
 * Loading UI lives in a Suspense boundary inside the page, not a segment-level
 * loading.tsx. A loading.tsx anywhere above a dynamic route flushes the stream
 * immediately, which locks the response status at 200 and makes notFound() serve
 * the not-found UI with a 200 instead of a 404.
 */
export default function ProjectsPage() {
  return (
    <Suspense fallback={<LoadingWrap />}>
      <ProjectsBody />
    </Suspense>
  );
}

function LoadingWrap() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-8 lg:px-10">
      <LoadingBlock rows={4} />
    </div>
  );
}
