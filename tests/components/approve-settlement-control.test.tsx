import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApproveSettlementControl } from '@/components/finance/ApproveSettlementControl';
import { copy } from '@/copy/es-MX';

const mockRouter = { refresh: vi.fn() };

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

const PROPS = {
  opportunityId: 'opportunity-1',
  readyToApprove: true,
  disabledReason: copy.settle.approvalReady,
};

beforeEach(() => {
  mockRouter.refresh.mockClear();
  sessionStorage.clear();
});

describe('ApproveSettlementControl', () => {
  it('submits only the opportunity and a generated idempotency key, then refreshes after approval', async () => {
    const approveAction = vi.fn().mockResolvedValue({
      kind: 'approved',
      settlementId: 'settlement-1',
      replayed: false,
    });
    render(<ApproveSettlementControl {...PROPS} approveAction={approveAction} />);

    fireEvent.click(screen.getByRole('button', { name: copy.settle.approve }));

    await waitFor(() => expect(approveAction).toHaveBeenCalledTimes(1));
    expect(approveAction).toHaveBeenCalledWith({
      opportunityId: 'opportunity-1',
      idempotencyKey: expect.any(String),
    });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(copy.settle.approved));
    expect(mockRouter.refresh).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(screen.getByRole('status'));
    expect(screen.getByRole('button', { name: copy.settle.approve })).toBeDisabled();
  });

  it('keeps the idempotency key stable across an error and retry', async () => {
    const approveAction = vi.fn().mockResolvedValue({ kind: 'error', message: 'temporary failure' });
    render(<ApproveSettlementControl {...PROPS} approveAction={approveAction} />);
    const button = screen.getByRole('button', { name: copy.settle.approve });

    fireEvent.click(button);
    await waitFor(() => expect(approveAction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('temporary failure'));
    fireEvent.click(button);
    await waitFor(() => expect(approveAction).toHaveBeenCalledTimes(2));

    expect(approveAction.mock.calls[1]?.[0]?.idempotencyKey).toBe(
      approveAction.mock.calls[0]?.[0]?.idempotencyKey,
    );
    expect(mockRouter.refresh).not.toHaveBeenCalled();
  });

  it('persists a failed attempt key through a reload', async () => {
    const approveAction = vi.fn().mockResolvedValue({ kind: 'error', message: 'temporary failure' });
    const { unmount } = render(<ApproveSettlementControl {...PROPS} approveAction={approveAction} />);
    fireEvent.click(screen.getByRole('button', { name: copy.settle.approve }));
    await waitFor(() => expect(approveAction).toHaveBeenCalledTimes(1));
    const firstKey = approveAction.mock.calls[0]?.[0]?.idempotencyKey;
    unmount();

    render(<ApproveSettlementControl {...PROPS} approveAction={approveAction} />);
    fireEvent.click(screen.getByRole('button', { name: copy.settle.approve }));
    await waitFor(() => expect(approveAction).toHaveBeenCalledTimes(2));
    expect(approveAction.mock.calls[1]?.[0]?.idempotencyKey).toBe(firstKey);
  });

  it('reports unavailable honestly and never refreshes', async () => {
    const approveAction = vi.fn().mockResolvedValue({ kind: 'unavailable', reason: 'Supabase no está configurado.' });
    render(<ApproveSettlementControl {...PROPS} approveAction={approveAction} />);

    fireEvent.click(screen.getByRole('button', { name: copy.settle.approve }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Supabase no está configurado.'));
    expect(mockRouter.refresh).not.toHaveBeenCalled();
  });

  it('does not invoke approval while readiness checks are incomplete', () => {
    const approveAction = vi.fn();
    render(
      <ApproveSettlementControl
        {...PROPS}
        readyToApprove={false}
        disabledReason={copy.settle.approvalNotReady}
        approveAction={approveAction}
      />,
    );

    const button = screen.getByRole('button', { name: copy.settle.approve });
    expect(button).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(copy.settle.approvalNotReady);
    fireEvent.click(button);
    expect(approveAction).not.toHaveBeenCalled();
  });
});
