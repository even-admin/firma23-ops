import type { ReactNode } from 'react';

import { switchPrototypeViewer } from '@/app/actions/viewer';
import { AppShell } from '@/components/chrome/AppShell';
import { ViewerSwitcher } from '@/components/chrome/ViewerSwitcher';
import { getPrototypeViewer } from '@/data/prototype-viewer-session';
import { syntheticFinanceRepository } from '@/data/repositories/synthetic/finance';
import { syntheticProjectRepository } from '@/data/repositories/synthetic/projects';
import { buildNavGroups } from '@/lib/nav';
import { isFounder } from '@/lib/viewer';

export default async function NetworkLayout({ children }: { readonly children: ReactNode }) {
  const viewer = await getPrototypeViewer();
  const projects = await syntheticProjectRepository.list(viewer);

  /*
   * The rail's only badge is a real count of settlements awaiting a founder. It
   * is read here rather than invented in the component, and only for viewers who
   * can approve. M2 should replace this with a count query: getOverview builds
   * every rail, which is free against the synthetic dataset and will not be.
   */
  const pendingApprovals = isFounder(viewer)
    ? (await syntheticFinanceRepository.getOverview(viewer)).pendingApprovals
    : undefined;

  const groups = buildNavGroups({
    projects: projects.map((project) => ({ slug: project.slug, name: project.name })),
    pendingApprovals,
  });

  return (
    <AppShell
      role={viewer.role}
      groups={groups}
      viewerSwitcher={<ViewerSwitcher role={viewer.role} action={switchPrototypeViewer} />}
    >
      {children}
    </AppShell>
  );
}
