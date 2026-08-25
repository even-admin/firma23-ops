import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmContractControl } from '@/components/admin/ConfirmContractControl';
import { DocumentIntakePanel } from '@/components/admin/DocumentIntakePanel';
import { IntakeStepper } from '@/components/admin/IntakeStepper';
import { copy } from '@/copy/es-MX';
import { PROTOTYPE_FOUNDER } from '@/data/prototype-viewers';
import { syntheticIntakeRepository } from '@/data/repositories/synthetic/intake';

const RUN_INPUT = {
  sourceDocumentFilename: 'EVEN Collective Servicios SETY 2026.pdf',
  idempotencyKey: 'stepper-test-1',
};

const run = await syntheticIntakeRepository.runIntake(RUN_INPUT, PROTOTYPE_FOUNDER);

function stubRunIntake() {
  return vi.fn().mockResolvedValue(run);
}

describe('IntakeStepper', () => {
  it('marks exactly one step current and reflects real, non-adjacent completion', () => {
    render(
      <IntakeStepper
        statuses={{
          document: 'complete',
          extraction: 'complete',
          review: 'current',
          confirmation: 'upcoming',
        }}
      />,
    );
    expect(screen.getByText('Revisión').closest('span')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Documento').closest('span')).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Confirmación').closest('span')).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Documento').closest('span')).toHaveTextContent('Documento — completo');
    expect(screen.getByText('Revisión').closest('span')).toHaveTextContent('Revisión — actual');
    expect(screen.getByText('Confirmación').closest('span')).toHaveTextContent(
      'Confirmación — pendiente',
    );
  });
});

describe('DocumentIntakePanel intake stepper', () => {
  it('starts on the document step with the rest upcoming', () => {
    render(<DocumentIntakePanel runIntake={stubRunIntake()} />);
    expect(screen.getByText('Documento').closest('span')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Extracción').closest('span')).not.toHaveAttribute('aria-current');
  });

  it('advances to the extraction step once a valid file is selected, never skipping ahead', () => {
    render(<DocumentIntakePanel runIntake={stubRunIntake()} />);
    const input = document.querySelector('input[type="file"]');
    if (input === null) throw new Error('expected a file input');
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'propuesta.pdf', { type: 'application/pdf' })] },
    });

    expect(screen.getByText('Extracción').closest('span')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Revisión').closest('span')).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Confirmación').closest('span')).not.toHaveAttribute('aria-current');
  });

  it('never advances past document on an invalid file, since no extraction ran', () => {
    render(<DocumentIntakePanel runIntake={stubRunIntake()} />);
    const input = document.querySelector('input[type="file"]');
    if (input === null) throw new Error('expected a file input');
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'imagen.png', { type: 'image/png' })] },
    });

    expect(screen.getByText('Documento').closest('span')).toHaveAttribute('aria-current', 'step');
  });

  it('reaches review once the draft is ready, with confirmation still upcoming', async () => {
    render(<DocumentIntakePanel runIntake={stubRunIntake()} />);
    const input = document.querySelector('input[type="file"]');
    if (input === null) throw new Error('expected a file input');
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'propuesta.pdf', { type: 'application/pdf' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: copy.admin.intake.process }));

    await waitFor(() => {
      expect(screen.getByText('Revisión').closest('span')).toHaveAttribute('aria-current', 'step');
    });
    expect(screen.getByText('Documento').closest('span')).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Extracción').closest('span')).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Confirmación').closest('span')).not.toHaveAttribute('aria-current');
  });

  it('shows the selected file inside a source-document packet, not a bare line of text', () => {
    render(<DocumentIntakePanel runIntake={stubRunIntake()} />);
    const input = document.querySelector('input[type="file"]');
    if (input === null) throw new Error('expected a file input');
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'propuesta.pdf', { type: 'application/pdf' })] },
    });
    expect(
      screen.getByText(`${copy.admin.intake.selectedFile}: propuesta.pdf`),
    ).toBeInTheDocument();
  });
});

describe('ConfirmContractControl notifies confirmation only on a real confirmed result', () => {
  const baseProps = {
    draftId: '91000000-0000-4000-8000-000000000001',
    sponsorName: 'Secretaría de Economía y Trabajo de Yucatán',
    programName: 'SETY 2026',
    currency: 'MXN' as const,
    matchedProjectSlug: 'sety-2026',
    readyToConfirm: true,
  };

  it('calls onConfirmed when the action reports confirmed', async () => {
    const onConfirmed = vi.fn();
    const confirmAction = vi
      .fn()
      .mockResolvedValue({ kind: 'confirmed', projectId: 'p1', projectSlug: 'sety-2026' });
    render(
      <ConfirmContractControl
        {...baseProps}
        confirmAction={confirmAction}
        onConfirmed={onConfirmed}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: copy.admin.intake.confirmMatched }));
    await waitFor(() => {
      expect(screen.getByText(copy.admin.intake.confirmed)).toBeInTheDocument();
    });
    expect(onConfirmed).toHaveBeenCalledTimes(1);
  });

  it('never calls onConfirmed when the action reports unavailable', async () => {
    const onConfirmed = vi.fn();
    const confirmAction = vi
      .fn()
      .mockResolvedValue({ kind: 'unavailable', reason: copy.admin.intake.confirmBlockedReason });
    render(
      <ConfirmContractControl
        {...baseProps}
        confirmAction={confirmAction}
        onConfirmed={onConfirmed}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: copy.admin.intake.confirmMatched }));
    await waitFor(() => {
      expect(screen.getByText(copy.admin.intake.confirmBlockedReason)).toBeInTheDocument();
    });
    expect(onConfirmed).not.toHaveBeenCalled();
  });
});
