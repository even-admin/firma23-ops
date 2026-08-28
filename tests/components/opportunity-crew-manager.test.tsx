import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CrewManager } from '@/components/opportunity/CrewManager';
import { copy } from '@/copy/es-MX';
import type { AssignmentPickerMember, AssignmentView, PoolWeightView } from '@/types/views';

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
  { memberId: 'member-3', displayName: 'Pablo Heisenberg', role: 'member' },
];

const POOLS: readonly PoolWeightView[] = [
  { key: 'closer', label: 'Cierre', totalBp: 10_000, balanced: true },
  { key: 'delivery', label: 'Entrega', totalBp: 10_000, balanced: true },
];

const ASSIGNMENTS: readonly AssignmentView[] = [
  {
    id: 'assignment-1',
    memberId: 'member-1',
    memberSlug: 'diego-martinez',
    displayName: 'Diego Martínez',
    initials: 'DM',
    roleKey: 'closer',
    roleLabel: 'Cierre',
    weightBp: 10_000 as never,
    status: 'approved',
  },
  {
    id: 'assignment-2',
    memberId: 'member-2',
    memberSlug: 'sebastian-benitez',
    displayName: 'Sebastián Benítez',
    initials: 'SB',
    roleKey: 'delivery',
    roleLabel: 'Entrega inicial',
    weightBp: 10_000 as never,
    status: 'approved',
  },
];

function openEditor(poolLabel: string) {
  fireEvent.click(screen.getByRole('button', { name: `${c.manage} · ${poolLabel}` }));
}

describe('CrewManager', () => {
  it('renders one independent manage button per real pool from the view model', () => {
    render(<CrewManager opportunityId="opp-1" pools={POOLS} assignments={ASSIGNMENTS} members={MEMBERS} />);
    expect(screen.getByRole('button', { name: `${c.manage} · Cierre` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `${c.manage} · Entrega` })).toBeInTheDocument();
  });

  it('opens each pool editor pre-filled from that pool\'s own current assignments only', () => {
    render(<CrewManager opportunityId="opp-1" pools={POOLS} assignments={ASSIGNMENTS} members={MEMBERS} />);

    openEditor('Cierre');
    expect(screen.getByText(`${c.title} · Cierre`)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Cierre')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Entrega inicial')).not.toBeInTheDocument();

    openEditor('Entrega');
    expect(screen.getByText(`${c.title} · Entrega`)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Entrega inicial')).toBeInTheDocument();
  });

  it('editing pool A does not mutate pool B: typing in Cierre leaves the open Entrega editor untouched', () => {
    render(<CrewManager opportunityId="opp-1" pools={POOLS} assignments={ASSIGNMENTS} members={MEMBERS} />);
    openEditor('Cierre');
    openEditor('Entrega');

    fireEvent.change(screen.getByDisplayValue('Cierre'), { target: { value: 'Cierre renombrado' } });

    expect(screen.getByDisplayValue('Cierre renombrado')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Entrega inicial')).toBeInTheDocument();
  });

  it('submits the correct roleKey for each pool', async () => {
    const replaceAction = vi.fn().mockResolvedValue({ kind: 'replaced', opportunityId: 'opp-1', replayed: false });
    render(
      <CrewManager
        opportunityId="opp-1"
        pools={POOLS}
        assignments={ASSIGNMENTS}
        members={MEMBERS}
        replaceAction={replaceAction}
      />,
    );

    openEditor('Entrega');
    const deliverySection = screen.getByText(`${c.title} · Entrega`).closest('section');
    if (deliverySection === null) throw new Error('delivery section not found');
    fireEvent.click(within(deliverySection).getByRole('button', { name: c.submit }));

    await waitFor(() => expect(replaceAction).toHaveBeenCalledTimes(1));
    expect(replaceAction.mock.calls[0]?.[0]?.roleKey).toBe('delivery');
  });

  it('pool A edit does not mutate pool B\'s submitted payload', async () => {
    const replaceAction = vi.fn().mockResolvedValue({ kind: 'replaced', opportunityId: 'opp-1', replayed: false });
    render(
      <CrewManager
        opportunityId="opp-1"
        pools={POOLS}
        assignments={ASSIGNMENTS}
        members={MEMBERS}
        replaceAction={replaceAction}
      />,
    );

    openEditor('Cierre');
    openEditor('Entrega');
    fireEvent.change(screen.getByDisplayValue('Cierre'), { target: { value: 'Cierre nuevo' } });

    const deliverySection = screen.getByText(`${c.title} · Entrega`).closest('section');
    if (deliverySection === null) throw new Error('delivery section not found');
    fireEvent.click(within(deliverySection).getByRole('button', { name: c.submit }));

    await waitFor(() => expect(replaceAction).toHaveBeenCalledTimes(1));
    expect(replaceAction.mock.calls[0]?.[0]?.roleKey).toBe('delivery');
    expect(replaceAction.mock.calls[0]?.[0]?.assignments).toEqual([
      { memberId: 'member-2', roleLabel: 'Entrega inicial', weightBp: 10_000 },
    ]);
  });

  it('reports an honest unavailable state and does not call router.refresh()', async () => {
    const replaceAction = vi.fn().mockResolvedValue({ kind: 'unavailable', reason: c.unavailable });
    render(
      <CrewManager
        opportunityId="opp-1"
        pools={POOLS}
        assignments={ASSIGNMENTS}
        members={MEMBERS}
        replaceAction={replaceAction}
      />,
    );
    openEditor('Cierre');
    fireEvent.click(screen.getByRole('button', { name: c.submit }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(c.unavailable));
    expect(mockRouter.refresh).not.toHaveBeenCalled();
    expect(screen.getByText(`${c.title} · Cierre`)).toBeInTheDocument();
  });

  it('does not call router.refresh() on an error result and keeps the editor open', async () => {
    const replaceAction = vi.fn().mockResolvedValue({ kind: 'error', message: 'boom' });
    render(
      <CrewManager
        opportunityId="opp-1"
        pools={POOLS}
        assignments={ASSIGNMENTS}
        members={MEMBERS}
        replaceAction={replaceAction}
      />,
    );
    openEditor('Cierre');
    fireEvent.click(screen.getByRole('button', { name: c.submit }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('boom'));
    expect(mockRouter.refresh).not.toHaveBeenCalled();
    expect(screen.getByText(`${c.title} · Cierre`)).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole('status'));
  });

  it('calls router.refresh() exactly once and closes the editor on a replaced result', async () => {
    const replaceAction = vi.fn().mockResolvedValue({ kind: 'replaced', opportunityId: 'opp-1', replayed: false });
    render(
      <CrewManager
        opportunityId="opp-1"
        pools={POOLS}
        assignments={ASSIGNMENTS}
        members={MEMBERS}
        replaceAction={replaceAction}
      />,
    );
    openEditor('Cierre');
    fireEvent.click(screen.getByRole('button', { name: c.submit }));

    await waitFor(() => expect(mockRouter.refresh).toHaveBeenCalledTimes(1));
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(screen.queryByText(`${c.title} · Cierre`)).not.toBeInTheDocument();
  });

  it('reuses the same idempotency key across a failed attempt and a retry', async () => {
    const replaceAction = vi.fn().mockResolvedValue({ kind: 'error', message: 'temporary failure' });
    render(
      <CrewManager
        opportunityId="opp-1"
        pools={POOLS}
        assignments={ASSIGNMENTS}
        members={MEMBERS}
        replaceAction={replaceAction}
      />,
    );
    openEditor('Cierre');
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
        pools={POOLS}
        assignments={ASSIGNMENTS}
        members={MEMBERS}
        replaceAction={replaceAction}
      />,
    );
    openEditor('Cierre');
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
    render(<CrewManager opportunityId="opp-1" pools={POOLS} assignments={ASSIGNMENTS} members={MEMBERS} />);
    openEditor('Cierre');
    const submit = screen.getByRole('button', { name: c.submit });
    expect(submit).toBeEnabled();

    fireEvent.change(screen.getByDisplayValue('100'), { target: { value: '60' } });
    expect(submit).toBeDisabled();
    expect(screen.getByText(c.totalUnbalanced)).toBeInTheDocument();
  });

  it('shows an honest empty state per pool when no active members are available', () => {
    render(<CrewManager opportunityId="opp-1" pools={POOLS} assignments={[]} members={[]} />);
    expect(screen.getAllByText(c.noMembers)).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Gestionar equipo/ })).not.toBeInTheDocument();
  });

  it('renders nothing when the opportunity has no real pools', () => {
    const { container } = render(<CrewManager opportunityId="opp-1" pools={[]} assignments={[]} members={MEMBERS} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('measures each manage button at 44px', () => {
    render(<CrewManager opportunityId="opp-1" pools={POOLS} assignments={ASSIGNMENTS} members={MEMBERS} />);
    const manageButton = screen.getByRole('button', { name: `${c.manage} · Cierre` });
    expect(manageButton.className).toContain('min-h-11');
  });
});
