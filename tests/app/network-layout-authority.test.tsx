import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PROTOTYPE_FOUNDER, PROTOTYPE_MEMBER } from '@/data/prototype-viewers';

const getViewerMock = vi.fn();
const isSupabaseConfiguredMock = vi.fn(() => true);

vi.mock('@/data/viewer-session', () => ({ getViewer: getViewerMock }));
vi.mock('@/lib/backend', () => ({ isSupabaseConfigured: isSupabaseConfiguredMock }));
vi.mock('@/data/repositories/synthetic/projects', () => ({
  syntheticProjectRepository: { list: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/data/repositories/synthetic/finance', () => ({
  syntheticFinanceRepository: {
    getOverview: vi.fn().mockResolvedValue({ pendingApprovals: 0 }),
  },
}));
vi.mock('@/lib/nav', () => ({ buildNavGroups: vi.fn(() => []) }));
vi.mock('@/components/chrome/AppShell', () => ({
  AppShell: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/chrome/SessionPanel', () => ({
  SessionPanel: ({ role }: { readonly role: string }) => <span>{role}</span>,
}));
vi.mock('@/components/chrome/ViewerSwitcher', () => ({ ViewerSwitcher: () => null }));

const { default: NetworkLayout } = await import('@/app/(network)/layout');

describe('configured network layout data authority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSupabaseConfiguredMock.mockReturnValue(true);
  });

  it.each([
    ['founder', PROTOTYPE_FOUNDER],
    ['member', PROTOTYPE_MEMBER],
  ] as const)(
    'keeps the noncanonical synthetic warning around every %s route child',
    async (_, viewer) => {
      getViewerMock.mockResolvedValue(viewer);
      render(await NetworkLayout({ children: <main data-testid="route-child">route</main> }));

      expect(screen.getByTestId('route-child')).toBeInTheDocument();
      const notice = screen.getByRole('status');
      expect(notice).toHaveAttribute('data-data-authority', 'configured-synthetic');
      expect(notice).toHaveTextContent(/ningún monto mostrado proviene del ledger de Supabase/i);
    },
  );
});
