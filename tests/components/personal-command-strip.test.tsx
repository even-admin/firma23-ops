import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PersonalCommandStrip } from '@/components/dashboard/PersonalCommandStrip';
import { PerformanceInstrument } from '@/components/dashboard/PerformanceInstrument';
import { copy } from '@/copy/es-MX';
import { money } from '@/lib/money';
import type { HomePerformanceHistory, MemberMoney } from '@/types/views';

const MEMBER_MONEY: MemberMoney = {
  approved: money(179_454),
  paid: money(50_000),
  approvedUnpaid: money(129_454),
  recovery: money(0),
  projected: money(403_772),
};

const PERFORMANCE: HomePerformanceHistory = {
  asOf: '2026-08-20T00:00:00.000Z',
  series: [
    {
      kind: 'money',
      key: 'approved',
      current: MEMBER_MONEY.approved,
      historyAvailability: 'available',
      points: [
        {
          id: 'approved:1',
          occurredAt: '2026-07-18T15:05:00.000Z',
          value: money(100_000),
          delta: money(100_000),
          sourceLabel: 'Liquidación aprobada · AIOPS-0007',
          state: 'verified',
        },
        {
          id: 'approved:2',
          occurredAt: '2026-08-12T17:40:00.000Z',
          value: money(179_454),
          delta: money(79_454),
          sourceLabel: 'Liquidación aprobada · SETY-0137',
          state: 'verified',
        },
      ],
    },
    {
      kind: 'money',
      key: 'paid',
      current: MEMBER_MONEY.paid,
      historyAvailability: 'available',
      points: [
        {
          id: 'paid:1',
          occurredAt: '2026-08-14T00:00:00.000Z',
          value: money(50_000),
          delta: money(50_000),
          sourceLabel: 'Pago registrado · SETY-0137',
          state: 'verified',
        },
      ],
    },
    {
      kind: 'money',
      key: 'approved_unpaid',
      current: MEMBER_MONEY.approvedUnpaid,
      historyAvailability: 'available',
      points: [],
    },
    {
      kind: 'money',
      key: 'projected',
      current: MEMBER_MONEY.projected,
      historyAvailability: 'unavailable',
      points: [],
    },
    {
      kind: 'count',
      key: 'closed',
      current: 1,
      historyAvailability: 'available',
      points: [
        {
          id: 'closed:1',
          occurredAt: '2026-07-28',
          value: 1,
          delta: 1,
          sourceLabel: 'Cierre verificado · SETY-0142',
          state: 'verified',
        },
      ],
    },
  ],
};

describe('PersonalCommandStrip', () => {
  it('renders exactly one identity field and one performance instrument', () => {
    const { container } = render(
      <PersonalCommandStrip
        displayName="Sebastián Benítez"
        activeWorkCount={2}
        money={MEMBER_MONEY}
        performance={PERFORMANCE}
      />,
    );

    const strip = container.querySelector('[data-personal-command-strip]');
    expect(strip?.querySelectorAll(':scope > section')).toHaveLength(2);
    expect(screen.getByRole('heading', { level: 1, name: 'Sebastián Benítez' })).toBeInTheDocument();
    expect(container.querySelector('.identity-orb')).toBeNull();
  });
});

describe('PerformanceInstrument', () => {
  it('exposes all five truthful metric definitions', () => {
    render(<PerformanceInstrument performance={PERFORMANCE} recovery={money(0)} />);

    const metricSelect = screen.getByRole('combobox', { name: copy.home.commandStrip.metricLabel });
    for (const label of ['Ganado confirmado', 'Cobrado', 'Por cobrar', 'Proyección', 'Cierres']) {
      expect(metricSelect).toHaveTextContent(label);
    }
    expect(screen.getByText(copy.home.commandStrip.metrics.approved.definition)).toBeInTheDocument();
  });

  it('switches metrics without giving projection a money class or fake line', () => {
    const { container } = render(
      <PerformanceInstrument performance={PERFORMANCE} recovery={money(0)} />,
    );
    fireEvent.change(screen.getByRole('combobox', { name: copy.home.commandStrip.metricLabel }), {
      target: { value: 'projected' },
    });

    const projected = container.querySelector('[data-projected-metric]');
    expect(projected).not.toBeNull();
    expect(projected?.querySelectorAll('[class*="money"]')).toHaveLength(0);
    expect(screen.getByText(copy.home.commandStrip.historyUnavailable)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Evolución/ })).not.toBeInTheDocument();
  });

  it('uses focusable event markers to reveal date, value and source', () => {
    render(<PerformanceInstrument performance={PERFORMANCE} recovery={money(0)} />);
    const firstEvent = screen.getByRole('button', {
      name: /Liquidación aprobada · AIOPS-0007/,
    });
    fireEvent.focus(firstEvent);

    const readout = screen.getByText('Liquidación aprobada · AIOPS-0007').closest('[data-event-readout]');
    expect(readout).not.toBeNull();
    expect(readout).toHaveTextContent('$1,000.00');
  });

  it('changes period through real pressed controls', () => {
    render(<PerformanceInstrument performance={PERFORMANCE} recovery={money(0)} />);
    const period = screen.getByRole('combobox', { name: copy.home.commandStrip.periodLabel });
    fireEvent.change(period, { target: { value: 'days30' } });
    expect(period).toHaveValue('days30');
  });

  it('switches between balance and individual event views', () => {
    const { container } = render(
      <PerformanceInstrument performance={PERFORMANCE} recovery={money(0)} />,
    );
    const eventView = screen.getByRole('button', { name: copy.home.commandStrip.eventsMode });
    fireEvent.click(eventView);
    expect(eventView).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('[data-chart-mode="events"] rect')).not.toBeNull();
  });

  it('keeps recovery visible as a distinct attention state', () => {
    render(<PerformanceInstrument performance={PERFORMANCE} recovery={money(25_000)} />);
    expect(screen.getByText(copy.home.commandStrip.recovery)).toBeInTheDocument();
    expect(screen.getByText('$250.00')).toBeInTheDocument();
  });
});
