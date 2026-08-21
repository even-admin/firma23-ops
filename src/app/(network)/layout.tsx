import type { ReactNode } from 'react';

import { switchPrototypeViewer } from '@/app/actions/viewer';
import { AppShell } from '@/components/chrome/AppShell';
import { ViewerSwitcher } from '@/components/chrome/ViewerSwitcher';
import { getPrototypeViewer } from '@/data/prototype-viewer-session';

export default async function NetworkLayout({ children }: { readonly children: ReactNode }) {
  const viewer = await getPrototypeViewer();

  return (
    <AppShell
      role={viewer.role}
      topBar={<ViewerSwitcher role={viewer.role} action={switchPrototypeViewer} />}
    >
      {children}
    </AppShell>
  );
}
