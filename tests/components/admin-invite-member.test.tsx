import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { InviteMemberForm } from '@/components/admin/InviteMemberForm';
import { copy } from '@/copy/es-MX';

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
    fireEvent.change(screen.getByLabelText(copy.admin.members.nameLabel), { target: { value: 'Diego Martínez' } });
    fireEvent.change(screen.getByLabelText(copy.admin.members.emailLabel), { target: { value: 'diego@example.com' } });
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
    fireEvent.change(screen.getByLabelText(copy.admin.members.nameLabel), { target: { value: 'Diego Martínez' } });
    fireEvent.change(screen.getByLabelText(copy.admin.members.emailLabel), { target: { value: 'diego@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: copy.admin.members.create }));

    await waitFor(() => expect(screen.getByRole('button', { name: copy.admin.members.creating })).toBeDisabled());
    expect(screen.getByRole('button', { name: copy.admin.members.creating }).closest('section')).toHaveAttribute('aria-busy', 'true');
    resolveAction?.({ kind: 'error', message: 'an invitation already exists for this email' });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('an invitation already exists for this email'));
  });
});
