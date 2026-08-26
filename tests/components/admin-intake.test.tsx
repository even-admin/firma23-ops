import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmContractControl } from '@/components/admin/ConfirmContractControl';
import { ContractDraftSummary } from '@/components/admin/ContractDraftSummary';
import { DocumentIntakePanel } from '@/components/admin/DocumentIntakePanel';
import { copy } from '@/copy/es-MX';
import { PROTOTYPE_FOUNDER } from '@/data/prototype-viewers';
import { syntheticIntakeRepository } from '@/data/repositories/synthetic/intake';
import type { IntakeRunView } from '@/types/views';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const RUN_INPUT = {
  sourceDocumentFilename: 'EVEN Collective Servicios SETY 2026.pdf',
  idempotencyKey: 'test-1',
};

const run = await syntheticIntakeRepository.runIntake(RUN_INPUT, PROTOTYPE_FOUNDER);
const draft = run.draft;
if (draft === null) throw new Error('fixture must produce a ready draft');

describe('ContractDraftSummary', () => {
  it('shows every extracted field with its confidence and evidence', () => {
    const { container } = render(<ContractDraftSummary draft={draft} />);
    for (const field of draft.fields) {
      expect(screen.getAllByText(field.value).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText(copy.admin.intake.evidence).length).toBeGreaterThan(0);
    expect(container.querySelector('h2')).toHaveTextContent(copy.admin.intake.draftTitle);
    expect(container.querySelectorAll('h4')).toHaveLength(0);
  });

  it('lists missing and ambiguous fields separately from extracted fields', () => {
    render(<ContractDraftSummary draft={draft} />);
    expect(screen.getByText(copy.admin.intake.missing)).toBeInTheDocument();
    expect(screen.getByText(copy.admin.intake.ambiguous)).toBeInTheDocument();
  });

  it('renders the projected allocation as a projection, never as approved money', () => {
    const { container } = render(<ContractDraftSummary draft={draft} />);
    expect(screen.getByText(copy.money.projected)).toBeInTheDocument();
    expect(container.querySelectorAll('[class*="money"]')).toHaveLength(0);
  });

  it('renders an enabled confirmation control, reading "confirm existing" for a matched contract', () => {
    // The SETY fixture draft matches an existing project, so the control
    // reads "confirm existing", not "create". Interactive behavior is
    // covered directly on ConfirmContractControl below, with an injected
    // action — this component always wires the real Server Action, which
    // needs a Next.js request scope this test environment does not have.
    render(<ContractDraftSummary draft={draft} />);
    const button = screen.getByRole('button', { name: copy.admin.intake.confirmMatched });
    expect(button).not.toBeDisabled();
    expect(screen.getByText(copy.admin.intake.confirmHint)).toBeInTheDocument();
  });
});

describe('ConfirmContractControl', () => {
  const baseProps = {
    draftId: '91000000-0000-4000-8000-000000000001',
    sponsorName: 'Secretaría de Economía y Trabajo de Yucatán',
    programName: 'SETY 2026',
    currency: 'MXN' as const,
    matchedProjectSlug: 'sety-2026',
    readyToConfirm: true,
  };

  it('shows a real confirmed result and a link to the project', async () => {
    const confirmAction = vi
      .fn()
      .mockResolvedValue({ kind: 'confirmed', projectId: 'p1', projectSlug: 'sety-2026' });
    render(<ConfirmContractControl {...baseProps} confirmAction={confirmAction} />);
    fireEvent.click(screen.getByRole('button', { name: copy.admin.intake.confirmMatched }));
    await waitFor(() => {
      expect(screen.getByText(copy.admin.intake.confirmed)).toBeInTheDocument();
    });
    expect(document.activeElement).toBe(screen.getByRole('status'));
    expect(screen.getByRole('status')).toHaveAttribute('aria-atomic', 'true');
    expect(confirmAction).toHaveBeenCalledWith({
      draftId: baseProps.draftId,
      sponsorName: baseProps.sponsorName,
      programName: baseProps.programName,
      currency: 'MXN',
    });
    expect(screen.getByRole('link')).toHaveAttribute('href', '/projects/sety-2026');
  });

  it('shows the unavailable reason without pretending the write succeeded', async () => {
    const confirmAction = vi
      .fn()
      .mockResolvedValue({ kind: 'unavailable', reason: copy.admin.intake.confirmBlockedReason });
    render(<ConfirmContractControl {...baseProps} confirmAction={confirmAction} />);
    fireEvent.click(screen.getByRole('button', { name: copy.admin.intake.confirmMatched }));
    await waitFor(() => {
      expect(screen.getByText(copy.admin.intake.confirmBlockedReason)).toBeInTheDocument();
    });
    expect(screen.queryByText(copy.admin.intake.confirmed)).not.toBeInTheDocument();
    expect(document.activeElement).toHaveAttribute('data-admin-outcome', 'confirm-unavailable');
  });

  it('announces confirmation progress while the action is pending', async () => {
    let resolveAction: ((result: { kind: 'unavailable'; reason: string }) => void) | undefined;
    const confirmAction = vi.fn(
      () =>
        new Promise<{ kind: 'unavailable'; reason: string }>((resolve) => {
          resolveAction = resolve;
        }),
    );
    render(<ConfirmContractControl {...baseProps} confirmAction={confirmAction} />);
    fireEvent.click(screen.getByRole('button', { name: copy.admin.intake.confirmMatched }));
    await waitFor(() => expect(screen.getByText(copy.admin.intake.confirmPending)).toBeVisible());
    const pending = screen.getByRole('status');
    expect(pending).toHaveAttribute('aria-live', 'polite');
    expect(pending.closest('section')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: copy.admin.intake.confirmMatched })).toBeDisabled();
    resolveAction?.({ kind: 'unavailable', reason: 'No disponible.' });
    await waitFor(() => expect(screen.getByText('No disponible.')).toBeInTheDocument());
  });

  it('surfaces a real error with a retry that calls the action again', async () => {
    const confirmAction = vi
      .fn()
      .mockResolvedValueOnce({ kind: 'error', message: 'conflicto de red' })
      .mockResolvedValueOnce({ kind: 'confirmed', projectId: 'p1', projectSlug: 'sety-2026' });
    render(<ConfirmContractControl {...baseProps} confirmAction={confirmAction} />);
    fireEvent.click(screen.getByRole('button', { name: copy.admin.intake.confirmMatched }));
    await waitFor(() => {
      expect(screen.getByText('conflicto de red')).toBeInTheDocument();
    });
    expect(document.activeElement).toHaveAttribute('data-admin-outcome', 'confirm-error');
    fireEvent.click(screen.getByRole('button', { name: copy.admin.intake.retry }));
    await waitFor(() => {
      expect(screen.getByText(copy.admin.intake.confirmed)).toBeInTheDocument();
    });
    expect(confirmAction).toHaveBeenCalledTimes(2);
  });

  it('maps a rejected confirmation promise to a focused error and retains retry', async () => {
    const confirmAction = vi.fn().mockRejectedValue(new Error('network down'));
    render(<ConfirmContractControl {...baseProps} confirmAction={confirmAction} />);
    fireEvent.click(screen.getByRole('button', { name: copy.admin.intake.confirmMatched }));
    await waitFor(() => {
      expect(screen.getByText(copy.admin.intake.confirmRejected)).toBeInTheDocument();
    });
    expect(document.activeElement).toHaveAttribute('data-admin-outcome', 'confirm-error');
    expect(screen.getByRole('button', { name: copy.admin.intake.retry })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.admin.intake.discard })).toBeInTheDocument();
  });

  it('requires a second explicit activation before discarding a draft', async () => {
    const confirmAction = vi.fn();
    const discardAction = vi.fn().mockResolvedValue({ kind: 'discarded' });
    render(
      <ConfirmContractControl
        {...baseProps}
        confirmAction={confirmAction}
        discardAction={discardAction}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: copy.admin.intake.discard }));
    expect(discardAction).not.toHaveBeenCalled();
    expect(screen.getByText(copy.admin.intake.discardWarning)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: copy.admin.intake.confirmDiscard }));
    await waitFor(() => {
      expect(screen.getByText(copy.admin.intake.discarded)).toBeInTheDocument();
    });
    expect(confirmAction).not.toHaveBeenCalled();
    expect(discardAction).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(screen.getByRole('status'));
    expect(screen.getByRole('status')).toHaveAttribute('aria-atomic', 'true');
  });

  it('announces discard progress while the action is pending', async () => {
    let resolveAction: ((result: { kind: 'unavailable'; reason: string }) => void) | undefined;
    const discardAction = vi.fn(
      () =>
        new Promise<{ kind: 'unavailable'; reason: string }>((resolve) => {
          resolveAction = resolve;
        }),
    );
    render(
      <ConfirmContractControl
        {...baseProps}
        confirmAction={vi.fn()}
        discardAction={discardAction}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: copy.admin.intake.discard }));
    fireEvent.click(screen.getByRole('button', { name: copy.admin.intake.confirmDiscard }));
    await waitFor(() => expect(screen.getByText(copy.admin.intake.discardPending)).toBeVisible());
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('button', { name: copy.admin.intake.confirmMatched })).toBeDisabled();
    resolveAction?.({ kind: 'unavailable', reason: 'No disponible.' });
    await waitFor(() => expect(screen.getByText('No disponible.')).toBeInTheDocument());
  });

  it.each([
    ['unavailable', { kind: 'unavailable', reason: copy.admin.intake.discardUnavailable } as const],
    ['error', { kind: 'error', message: 'falló el descarte' } as const],
  ])(
    'focuses and disarms a typed discard %s result while retaining the draft',
    async (_, outcome) => {
      const discardAction = vi.fn().mockResolvedValue(outcome);
      render(
        <ConfirmContractControl
          {...baseProps}
          confirmAction={vi.fn()}
          discardAction={discardAction}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: copy.admin.intake.discard }));
      fireEvent.click(screen.getByRole('button', { name: copy.admin.intake.confirmDiscard }));
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: copy.admin.intake.retryDiscard }),
        ).toBeInTheDocument();
      });
      expect(document.activeElement).toHaveAttribute(
        'data-admin-outcome',
        outcome.kind === 'error' ? 'discard-error' : 'discard-unavailable',
      );
      expect(screen.queryByText(copy.admin.intake.discardWarning)).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: copy.admin.intake.confirmMatched }),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: copy.admin.intake.retryDiscard }));
      await waitFor(() => expect(discardAction).toHaveBeenCalledTimes(2));
    },
  );

  it('maps a rejected discard promise to a focused error and disarms the action', async () => {
    const discardAction = vi.fn().mockRejectedValue(new Error('network down'));
    render(
      <ConfirmContractControl
        {...baseProps}
        confirmAction={vi.fn()}
        discardAction={discardAction}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: copy.admin.intake.discard }));
    fireEvent.click(screen.getByRole('button', { name: copy.admin.intake.confirmDiscard }));
    await waitFor(() => {
      expect(screen.getByText(copy.admin.intake.discardError)).toBeInTheDocument();
    });
    expect(document.activeElement).toHaveAttribute('data-admin-outcome', 'discard-error');
    expect(screen.getByRole('button', { name: copy.admin.intake.discard })).toBeInTheDocument();
  });

  it('cancels an armed discard, restores its trigger, and does not call the action', async () => {
    const discardAction = vi.fn();
    render(
      <ConfirmContractControl
        {...baseProps}
        confirmAction={vi.fn()}
        discardAction={discardAction}
      />,
    );
    const discardTrigger = screen.getByRole('button', { name: copy.admin.intake.discard });
    fireEvent.click(discardTrigger);
    fireEvent.click(screen.getByRole('button', { name: copy.admin.intake.cancelDiscard }));
    expect(discardAction).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: copy.admin.intake.discard })).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(discardTrigger));
  });

  it('disables confirmation until the manual form is ready, and never shows a discard control for it', () => {
    const confirmAction = vi.fn();
    render(
      <ConfirmContractControl
        {...baseProps}
        draftId={null}
        matchedProjectSlug={null}
        readyToConfirm={false}
        confirmAction={confirmAction}
      />,
    );
    expect(screen.getByRole('button', { name: copy.admin.intake.confirm })).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: copy.admin.intake.discard }),
    ).not.toBeInTheDocument();
  });
});

function stubRunIntake(result: IntakeRunView) {
  return vi.fn().mockResolvedValue(result);
}

describe('DocumentIntakePanel', () => {
  it('starts idle with the primary upload action and no draft visible', () => {
    render(<DocumentIntakePanel runIntake={stubRunIntake(run)} />);
    expect(screen.getByRole('button', { name: copy.admin.intake.chooseFile })).toBeInTheDocument();
    expect(screen.queryByText(copy.admin.intake.draftTitle)).not.toBeInTheDocument();
  });

  it('moves from selecting a file through processing to the draft review', async () => {
    render(<DocumentIntakePanel runIntake={stubRunIntake(run)} />);

    const input = document.querySelector('input[type="file"]');
    if (input === null) throw new Error('expected a file input');
    const file = new File(['contenido'], 'propuesta.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(
      screen.getByText(`${copy.admin.intake.selectedFile}: propuesta.pdf`),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: copy.admin.intake.process }));

    await waitFor(() => {
      expect(screen.getByText(copy.admin.intake.draftTitle)).toBeInTheDocument();
    });
    expect(screen.getByText(copy.admin.intake.syntheticNotice)).toBeInTheDocument();
    expect(document.activeElement).toHaveAttribute(
      'aria-label',
      copy.admin.intake.readyAnnouncement,
    );
  });

  it('rejects an unsupported file type before ever calling the intake action', () => {
    const runIntake = stubRunIntake(run);
    render(<DocumentIntakePanel runIntake={runIntake} />);

    const input = document.querySelector('input[type="file"]');
    if (input === null) throw new Error('expected a file input');
    const file = new File(['x'], 'imagen.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText(copy.admin.intake.fileTypeUnsupported)).toBeInTheDocument();
    // Validation errors have no retry: the same file would fail again.
    expect(screen.queryByRole('button', { name: copy.admin.intake.retry })).not.toBeInTheDocument();
    expect(runIntake).not.toHaveBeenCalled();
    expect(document.activeElement).toHaveTextContent(copy.admin.intake.fileTypeUnsupported);
  });

  it('surfaces a server-side error with a real retry that calls the action again', async () => {
    const runIntake = vi
      .fn()
      .mockResolvedValueOnce({
        id: 'run-1',
        status: 'error',
        sourceDocumentName: 'propuesta.pdf',
        draft: null,
        errorMessage: 'No hay un borrador disponible para este documento todavía.',
        synthetic: true,
      } satisfies IntakeRunView)
      .mockResolvedValueOnce(run);

    render(<DocumentIntakePanel runIntake={runIntake} />);
    const input = document.querySelector('input[type="file"]');
    if (input === null) throw new Error('expected a file input');
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'propuesta.pdf', { type: 'application/pdf' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: copy.admin.intake.process }));

    await waitFor(() => {
      expect(
        screen.getByText('No hay un borrador disponible para este documento todavía.'),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: copy.admin.intake.retry }));

    await waitFor(() => {
      expect(screen.getByText(copy.admin.intake.draftTitle)).toBeInTheDocument();
    });
    expect(runIntake).toHaveBeenCalledTimes(2);
  });

  it('opens the manual editor with focus and restores the exact opener on cancel', async () => {
    render(<DocumentIntakePanel runIntake={stubRunIntake(run)} />);
    const opener = screen.getByRole('button', { name: copy.admin.intake.ctaManual });
    fireEvent.click(opener);
    expect(screen.getByText(copy.admin.intake.manualTitle)).toBeInTheDocument();
    // Nothing may be created until the complete V1 setup is valid.
    expect(screen.getByRole('button', { name: copy.admin.intake.manualSubmit })).toBeDisabled();
    const sponsor = screen.getByRole('textbox', { name: copy.admin.intake.manualSponsorLabel });
    expect(document.activeElement).toBe(sponsor);
    expect(sponsor).toHaveAttribute('name', 'clientName');
    expect(sponsor).toHaveAttribute('autocomplete', 'organization');
    fireEvent.click(screen.getByRole('button', { name: copy.admin.intake.manualCancel }));
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});
