import type { ReactNode } from 'react';

import { signOutAction } from '@/app/login/actions';
import { AppShell } from '@/components/chrome/AppShell';
import { SessionPanel } from '@/components/chrome/SessionPanel';
import { ViewerSwitcher } from '@/components/chrome/ViewerSwitcher';
import { DataAuthorityNotice } from '@/components/state/DataAuthorityNotice';
import { switchPrototypeViewer } from '@/app/actions/viewer';
import { getViewer } from '@/data/viewer-session';
import { getActiveOperationalFinanceRepository } from '@/data/repositories/active/operational-finance';
import { getActiveProjectRepository } from '@/data/repositories/active/projects';
import { isSupabaseConfigured } from '@/lib/backend';
import { buildNavGroups } from '@/lib/nav';
import { isFounder } from '@/lib/viewer';

export default async function NetworkLayout({ children }: { readonly children: ReactNode }) {
  const viewer = await getViewer();
  const configured = isSupabaseConfigured();
  const projects = await (await getActiveProjectRepository()).list(viewer);

  /*
   * The rail's only badge is a real count of settlements awaiting a founder. It
   * is read here rather than invented in the component, and only for viewers who
   * can approve. M2 should replace this with a count query: getOverview builds
   * every rail, which is free against the synthetic dataset and will not be.
   */
  const pendingApprovals = isFounder(viewer)
    ? (await (await getActiveOperationalFinanceRepository()).getOverview(viewer)).pendingApprovals
    : undefined;

  const groups = buildNavGroups({
    projects: projects.map((project) => ({ slug: project.slug, name: project.name })),
    pendingApprovals,
  });

  // The prototype role switcher grants nothing and is a synthetic-mode
  // affordance only; a real session's role comes from Postgres membership,
  // never a browser control, so it never appears once Supabase is
  // configured — showing it then would be actively misleading.
  const viewerSwitcher = configured ? (
    <SessionPanel role={viewer.role} action={signOutAction} />
  ) : (
    <ViewerSwitcher role={viewer.role} action={switchPrototypeViewer} />
  );

  return (
    <AppShell
      role={viewer.role}
      memberId={viewer.viewerId}
      groups={groups}
      viewerSwitcher={viewerSwitcher}
    >
      <DataAuthorityNotice configured={configured} canonical={configured} />
      {children}
    </AppShell>
  );
}
