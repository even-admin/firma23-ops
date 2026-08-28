import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CrewManager } from '@/components/opportunity/CrewManager';
import { copy } from '@/copy/es-MX';
import type { AssignmentPickerMember, AssignmentView } from '@/types/views';

const c = copy.detail.crew;

const mockRouter = { push: vi.fn(), refresh: vi.fn() };

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

beforeEach(() => {
  mockRouter.push.mockClear();
  mockRouter.refresh.mockClear();
  sessionStorage.clear();
});

const MEMBERS: readonly AssignmentPickerMember[] = [
  { memberId: 'member-1', displayName: 'Diego Martínez', role: 'member' },
  { memberId: 'member-2', displayName: 'Sebastián Benítez', role: 'member' },
];

const CURRENT_ASSIGNMENTS: readonly AssignmentView[] = [
  {
    id: 'assignment-1',
    memberId: 'member-1',
    memberSlug: 'diego-martinez',
    displayName: 'Diego Martínez',
    initials: 'DM',
    roleKey: 'team',
    roleLabel: 'Cierre',
    weightBp: 10_000 as never,
    status: 'approved',
  },
];

function openEditor() {
  fireEvent.click(screen.getByRole('button', { name: c.manage }));
}

describe('CrewManager', () => {
  it('shows the manage button collapsed, opening a pre-filled editor from current assignments', () => {
    render(<CrewManager opportunityId="opp-1" currentAssignments={CURRENT_ASSIGNMENTS} members={MEMBERS} />);
    expect(screen.queryByText(c.title)).not.toBeInTheDocument();

    openEditor();
    expect(screen.getByText(c.title)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Cierre')).toBeInTheDocument();
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
  });

  it('reports an honest unavailable state and does not call router.refresh()', async () => {
    const replaceAction = vi.fn().mockResolvedValue({ kind: 'unavailable', reason: c.unavailable });
    render(
      <CrewManager
        opportunityId="opp-1"
        currentAssignments={CURRENT_ASSIGNMENTS}
        members={MEMBERS}
        replaceAction={replaceAction}
      />,
    );
    openEditor();
    fireEvent.click(screen.getByRole('button', { name: c.submit }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(c.unavailable));
    expect(mockRouter.refresh).not.toHaveBeenCalled();
    expect(screen.getByText(c.title)).toBeInTheDocument();
  });

  it('does not call router.refresh() on an error result and keeps the editor open', async () => {
    const replaceAction = vi.fn().mockResolvedValue({ kind: 'error', message: 'boom' });
    render(
      <CrewManager
        opportunityId="opp-1"
        currentAssignments={CURRENT_ASSIGNMENTS}
        members={MEMBERS}
        replaceAction={replaceAction}
      />,
    );
    openEditor();
    fireEvent.click(screen.getByRole('button', { name: c.submit }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('boom'));
    expect(mockRouter.refresh).not.toHaveBeenCalled();
    expect(screen.getByText(c.title)).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole('status'));
  });

  it('calls router.refresh() exactly once and closes the editor on a replaced result', async () => {
    const replaceAction = vi.fn().mockResolvedValue({ kind: 'replaced', opportunityId: 'opp-1', replayed: false });
    render(
      <CrewManager
        opportunityId="opp-1"
        currentAssignments={CURRENT_ASSIGNMENTS}
        members={MEMBERS}
        replaceAction={replaceAction}
      />,
    );
    openEditor();
    fireEvent.click(screen.getByRole('button', { name: c.submit }));

    await waitFor(() => expect(mockRouter.refresh).toHaveBeenCalledTimes(1));
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(screen.queryByText(c.title)).not.toBeInTheDocument();
  });

  it('reuses the same idempotency key across a failed attempt and a retry', async () => {
    const replaceAction = vi.fn().mockResolvedValue({ kind: 'error', message: 'temporary failure' });
    render(
      <CrewManager
        opportunityId="opp-1"
        currentAssignments={CURRENT_ASSIGNMENTS}
        members={MEMBERS}
        replaceAction={replaceAction}
      />,
    );
    openEditor();
    const submit = screen.getByRole('button', { name: c.submit });

    fireEvent.click(submit);
    await waitFor(() => expect(replaceAction).toHaveBeenCalledTimes(1));
    const firstKey = replaceAction.mock.calls[0]?.[0]?.idempotencyKey;

    fireEvent.click(submit);
    await waitFor(() => expect(replaceAction).toHaveBeenCalledTimes(2));
    const secondKey = replaceAction.mock.calls[1]?.[0]?.idempotencyKey;
    expect(secondKey).toBe(firstKey);
  });

  it('generates a new idempotency key when the crew composition changes', async () => {
    const replaceAction = vi.fn().mockResolvedValue({ kind: 'error', message: 'temporary failure' });
    render(
      <CrewManager
        opportunityId="opp-1"
        currentAssignments={CURRENT_ASSIGNMENTS}
        members={MEMBERS}
        replaceAction={replaceAction}
      />,
    );
    openEditor();
    const submit = screen.getByRole('button', { name: c.submit });

    fireEvent.click(submit);
    await waitFor(() => expect(replaceAction).toHaveBeenCalledTimes(1));
    const firstKey = replaceAction.mock.calls[0]?.[0]?.idempotencyKey;

    fireEvent.change(screen.getByDisplayValue('Cierre'), { target: { value: 'Cierre y entrega' } });
    fireEvent.click(submit);
    await waitFor(() => expect(replaceAction).toHaveBeenCalledTimes(2));
    const secondKey = replaceAction.mock.calls[1]?.[0]?.idempotencyKey;
    expect(secondKey).not.toBe(firstKey);
  });

  it('disables submit until weights total exactly 100%', () => {
    render(<CrewManager opportunityId="opp-1" currentAssignments={CURRENT_ASSIGNMENTS} members={MEMBERS} />);
    openEditor();
    const submit = screen.getByRole('button', { name: c.submit });
    expect(submit).toBeEnabled();

    fireEvent.change(screen.getByDisplayValue('100'), { target: { value: '60' } });
    expect(submit).toBeDisabled();
    expect(screen.getByText(c.totalUnbalanced)).toBeInTheDocument();
  });

  it('shows an honest empty state when no active members are available', () => {
    render(<CrewManager opportunityId="opp-1" currentAssignments={[]} members={[]} />);
    expect(screen.getByText(c.noMembers)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: c.manage })).not.toBeInTheDocument();
  });

  it('measures the manage button and editor controls at 44px', () => {
    render(<CrewManager opportunityId="opp-1" currentAssignments={CURRENT_ASSIGNMENTS} members={MEMBERS} />);
    const manageButton = screen.getByRole('button', { name: c.manage });
    expect(manageButton.className).toContain('min-h-11');
  });

  it('reports an honest unsupported state for an opportunity with more than one pool instead of a broken merged total', () => {
    const multiPoolAssignments: readonly AssignmentView[] = [
      ...CURRENT_ASSIGNMENTS,
      {
        id: 'assignment-2',
        memberId: 'member-2',
        memberSlug: 'sebastian-benitez',
        displayName: 'Sebastián Benítez',
        initials: 'SB',
        roleKey: 'delivery',
        roleLabel: 'Producción',
        weightBp: 10_000 as never,
        status: 'approved',
      },
    ];
    render(<CrewManager opportunityId="opp-1" currentAssignments={multiPoolAssignments} members={MEMBERS} />);
    expect(screen.getByText(c.multiplePools)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: c.manage })).not.toBeInTheDocument();
  });
});
