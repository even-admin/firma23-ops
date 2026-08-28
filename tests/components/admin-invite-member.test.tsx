import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InviteMemberForm } from '@/components/admin/InviteMemberForm';
import { copy } from '@/copy/es-MX';

const mockRouter = { push: vi.fn(), refresh: vi.fn() };

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

beforeEach(() => {
  mockRouter.push.mockClear();
  mockRouter.refresh.mockClear();
  sessionStorage.clear();
});

function fillForm(name: string, email: string) {
  fireEvent.change(screen.getByLabelText(copy.admin.members.nameLabel), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(copy.admin.members.emailLabel), { target: { value: email } });
}

describe('InviteMemberForm', () => {
  it('creates a pending local invite without claiming that an email was sent', async () => {
    const createAction = vi.fn().mockResolvedValue({
      kind: 'created',
      memberId: 'member-1',
      inviteId: 'invite-1',
      replayed: false,
    });
    render(<InviteMemberForm createAction={createAction} />);

    const button = screen.getByRole('button', { name: copy.admin.members.create });
    expect(button).toBeDisabled();
    fillForm('Diego Martínez', 'diego@example.com');
    expect(button).toBeEnabled();
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(copy.admin.members.created));
    expect(createAction).toHaveBeenCalledWith(expect.objectContaining({ displayName: 'Diego Martínez', email: 'diego@example.com' }));
    expect(screen.getByText(copy.admin.members.deliveryNote)).toBeInTheDocument();
    expect(screen.queryByText(/correo enviado/i)).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole('status'));
  });

  it('announces a pending command and preserves an authoritative error', async () => {
    let resolveAction: ((result: { kind: 'error'; message: string }) => void) | undefined;
    const createAction = vi.fn(
      () => new Promise<{ kind: 'error'; message: string }>((resolve) => { resolveAction = resolve; }),
    );
    render(<InviteMemberForm createAction={createAction} />);
    fillForm('Diego Martínez', 'diego@example.com');
    fireEvent.click(screen.getByRole('button', { name: copy.admin.members.create }));

    await waitFor(() => expect(screen.getByRole('button', { name: copy.admin.members.creating })).toBeDisabled());
    expect(screen.getByRole('button', { name: copy.admin.members.creating }).closest('section')).toHaveAttribute('aria-busy', 'true');
    resolveAction?.({ kind: 'error', message: 'an invitation already exists for this email' });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('an invitation already exists for this email'));
  });

  it('reuses the same idempotency key across a failed attempt and a retry', async () => {
    const createAction = vi.fn().mockResolvedValue({ kind: 'error', message: 'temporary failure' });
    render(<InviteMemberForm createAction={createAction} />);
    fillForm('Diego Martínez', 'diego@example.com');
    const button = screen.getByRole('button', { name: copy.admin.members.create });

    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('temporary failure'));
    const firstKey = createAction.mock.calls[0]?.[0]?.idempotencyKey;
    expect(typeof firstKey).toBe('string');

    fireEvent.click(button);
    await waitFor(() => expect(createAction).toHaveBeenCalledTimes(2));
    const secondKey = createAction.mock.calls[1]?.[0]?.idempotencyKey;
    expect(secondKey).toBe(firstKey);
  });

  it('reuses the same idempotency key after a simulated reload via sessionStorage', async () => {
    const createAction = vi.fn().mockResolvedValue({ kind: 'error', message: 'temporary failure' });
    const { unmount } = render(<InviteMemberForm createAction={createAction} />);
    fillForm('Diego Martínez', 'diego@example.com');
    fireEvent.click(screen.getByRole('button', { name: copy.admin.members.create }));
    await waitFor(() => expect(createAction).toHaveBeenCalledTimes(1));
    const firstKey = createAction.mock.calls[0]?.[0]?.idempotencyKey;
    unmount();

    render(<InviteMemberForm createAction={createAction} />);
    fillForm('Diego Martínez', 'diego@example.com');
    fireEvent.click(screen.getByRole('button', { name: copy.admin.members.create }));
    await waitFor(() => expect(createAction).toHaveBeenCalledTimes(2));
    const secondKey = createAction.mock.calls[1]?.[0]?.idempotencyKey;
    expect(secondKey).toBe(firstKey);
  });

  it('generates a new idempotency key when the canonical name or email changes', async () => {
    const createAction = vi.fn().mockResolvedValue({ kind: 'error', message: 'temporary failure' });
    render(<InviteMemberForm createAction={createAction} />);
    const button = screen.getByRole('button', { name: copy.admin.members.create });

    fillForm('Diego Martínez', 'diego@example.com');
    fireEvent.click(button);
    await waitFor(() => expect(createAction).toHaveBeenCalledTimes(1));
    const firstKey = createAction.mock.calls[0]?.[0]?.idempotencyKey;

    fillForm('Diego Martínez', 'otro@example.com');
    fireEvent.click(button);
    await waitFor(() => expect(createAction).toHaveBeenCalledTimes(2));
    const secondKey = createAction.mock.calls[1]?.[0]?.idempotencyKey;
    expect(secondKey).not.toBe(firstKey);

    fillForm('Otro Nombre', 'otro@example.com');
    fireEvent.click(button);
    await waitFor(() => expect(createAction).toHaveBeenCalledTimes(3));
    const thirdKey = createAction.mock.calls[2]?.[0]?.idempotencyKey;
    expect(thirdKey).not.toBe(secondKey);
  });

  it('calls router.refresh() exactly once after a created result', async () => {
    const createAction = vi.fn().mockResolvedValue({
      kind: 'created',
      memberId: 'member-1',
      inviteId: 'invite-1',
      replayed: false,
    });
    render(<InviteMemberForm createAction={createAction} />);
    fillForm('Diego Martínez', 'diego@example.com');
    fireEvent.click(screen.getByRole('button', { name: copy.admin.members.create }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(copy.admin.members.created));
    expect(mockRouter.refresh).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('does not call router.refresh() on an error result', async () => {
    const createAction = vi.fn().mockResolvedValue({ kind: 'error', message: 'an invitation already exists for this email' });
    render(<InviteMemberForm createAction={createAction} />);
    fillForm('Diego Martínez', 'diego@example.com');
    fireEvent.click(screen.getByRole('button', { name: copy.admin.members.create }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('an invitation already exists for this email'));
    expect(mockRouter.refresh).not.toHaveBeenCalled();
  });

  it('does not call router.refresh() on an unavailable result', async () => {
    const createAction = vi.fn().mockResolvedValue({ kind: 'unavailable', reason: copy.admin.members.error });
    render(<InviteMemberForm createAction={createAction} />);
    fillForm('Diego Martínez', 'diego@example.com');
    fireEvent.click(screen.getByRole('button', { name: copy.admin.members.create }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(copy.admin.members.error));
    expect(mockRouter.refresh).not.toHaveBeenCalled();
  });

  it('clears the stored idempotency key only after an authoritative created result', async () => {
    const createAction = vi.fn().mockResolvedValueOnce({ kind: 'error', message: 'temporary failure' }).mockResolvedValueOnce({
      kind: 'created',
      memberId: 'member-1',
      inviteId: 'invite-1',
      replayed: false,
    });
    render(<InviteMemberForm createAction={createAction} />);
    const button = screen.getByRole('button', { name: copy.admin.members.create });
    fillForm('Diego Martínez', 'diego@example.com');

    fireEvent.click(button);
    await waitFor(() => expect(createAction).toHaveBeenCalledTimes(1));
    const firstKey = createAction.mock.calls[0]?.[0]?.idempotencyKey;

    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(copy.admin.members.created));
    const secondKey = createAction.mock.calls[1]?.[0]?.idempotencyKey;
    expect(secondKey).toBe(firstKey);

    fireEvent.click(button);
    await waitFor(() => expect(createAction).toHaveBeenCalledTimes(3));
    const thirdKey = createAction.mock.calls[2]?.[0]?.idempotencyKey;
    expect(thirdKey).not.toBe(firstKey);
  });
});
