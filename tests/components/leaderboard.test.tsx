import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LeaderboardRankRow } from '@/components/leaderboard/LeaderboardRankRow';
import { ProvenanceEntryRow } from '@/components/leaderboard/ProvenanceEntryRow';
import { copy } from '@/copy/es-MX';
import { basisPoints, money } from '@/lib/money';
import type { LeaderboardRow, ProvenanceEntry } from '@/types/views';

function row(overrides: Partial<LeaderboardRow> = {}): LeaderboardRow {
  return {
    rank: 1,
    memberId: 'm1',
    slug: 'sebastian-benitez',
    displayName: 'Sebastián Benítez',
    initials: 'SB',
    approvedEarnings: money(179_454),
    paidEarnings: money(0),
    projectedEarnings: money(50_000),
    closed: 2,
    delivered: 2,
    onTimeRateBp: basisPoints(5_000),
    ...overrides,
  };
}

function entry(overrides: Partial<ProvenanceEntry> = {}): ProvenanceEntry {
  return {
    settlementId: 's1',
    opportunityId: 'o1',
    opportunityCode: 'SETY-0142',
    beneficiaryName: 'Secretaría de Economía',
    projectName: 'SETY 2026',
    roleLabel: 'Cierre',
    amount: money(179_454),
    payoutStatus: 'unpaid',
    approvedAt: '2026-08-07T00:00:00.000Z',
    approvedByName: 'Luis Ramírez',
    ...overrides,
  };
}

describe('LeaderboardRankRow', () => {
  it('shows the approved figure as the ranked amount, distinct from paid and projected', () => {
    render(
      <ul>
        <LeaderboardRankRow row={row()} showProvenance />
      </ul>,
    );
    expect(screen.getByText(copy.leaderboard.approved)).toBeInTheDocument();
    expect(screen.getByText('$1,794.54')).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.getByText('$500.00')).toBeInTheDocument();
  });

  it('never renders projected earnings with the ledger money colour', () => {
    const { container } = render(
      <ul>
        <LeaderboardRankRow row={row()} showProvenance />
      </ul>,
    );
    const projectedLabel = screen.getByText(copy.leaderboard.projected);
    const projectedValue = projectedLabel.parentElement?.querySelector('[class*="tnum"]');
    expect(projectedValue).not.toBeNull();
    expect(projectedValue?.className).not.toContain('text-money');
    expect(container.querySelectorAll('[class*="text-money"]')).toHaveLength(1);
  });

  it('renders zero-padded rank and links to the operator profile and provenance', () => {
    render(
      <ul>
        <LeaderboardRankRow row={row({ rank: 3 })} showProvenance />
      </ul>,
    );
    expect(screen.getByText('03')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sebastián Benítez' })).toHaveAttribute(
      'href',
      '/network/sebastian-benitez',
    );
    expect(screen.getByRole('link', { name: copy.leaderboard.provenance })).toHaveAttribute(
      'href',
      '/leaderboard/sebastian-benitez/provenance',
    );
  });

  it('says so when there is no on-time rate to show, rather than inventing one', () => {
    render(
      <ul>
        <LeaderboardRankRow row={row({ onTimeRateBp: null })} showProvenance />
      </ul>,
    );
    expect(screen.getByText(new RegExp(copy.network.noRate))).toBeInTheDocument();
  });

  it('withholds line-level provenance when the viewer is not allowed to inspect it', () => {
    render(
      <ul>
        <LeaderboardRankRow row={row()} showProvenance={false} />
      </ul>,
    );
    expect(screen.queryByRole('link', { name: copy.leaderboard.provenance })).toBeNull();
  });
});

describe('ProvenanceEntryRow', () => {
  it('names the approver and links to the source opportunity', () => {
    render(
      <ul>
        <ProvenanceEntryRow entry={entry()} />
      </ul>,
    );
    expect(screen.getByRole('link', { name: 'Secretaría de Economía' })).toHaveAttribute(
      'href',
      '/opportunities/o1',
    );
    expect(screen.getByText(new RegExp(copy.money.approvedBy))).toBeInTheDocument();
    expect(screen.getByText(/Luis Ramírez/)).toBeInTheDocument();
    expect(screen.getByText('$1,794.54')).toBeInTheDocument();
  });

  it('badges an unpaid approved line as approved, not paid', () => {
    render(
      <ul>
        <ProvenanceEntryRow entry={entry({ payoutStatus: 'unpaid' })} />
      </ul>,
    );
    expect(screen.getByText(copy.money.approved)).toBeInTheDocument();
    expect(screen.queryByText(copy.money.paid)).not.toBeInTheDocument();
  });

  it('badges a paid line as paid', () => {
    render(
      <ul>
        <ProvenanceEntryRow entry={entry({ payoutStatus: 'paid' })} />
      </ul>,
    );
    expect(screen.getByText(copy.money.paid)).toBeInTheDocument();
  });
});
