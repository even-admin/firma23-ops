import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/network' }));

import { CashLedger } from '@/components/finance/CashLedger';
import { FilterChips } from '@/components/filter/FilterChips';
import { AssignmentList } from '@/components/opportunity/AssignmentList';
import { MilestoneChecklist } from '@/components/opportunity/MilestoneChecklist';
import { StatusPill } from '@/components/opportunity/StatusPill';
import { AvailabilityBadge } from '@/components/operator/AvailabilityBadge';
import { OperatorCard } from '@/components/operator/OperatorCard';
import { SkillChips } from '@/components/operator/SkillChips';
import { StatGrid } from '@/components/operator/StatGrid';
import { RevenueRail, type RevenueRailVariant } from '@/components/revenue-rail/RevenueRail';
import { copy } from '@/copy/es-MX';
import { PROTOTYPE_FOUNDER } from '@/data/prototype-viewers';
import { syntheticSettlementRepository } from '@/data/repositories/synthetic/settlements';
import { basisPoints, money } from '@/lib/money';
import type {
  AssignmentView,
  MemberStats,
  MilestoneView,
  OperatorCardView,
  PoolWeightView,
  SkillView,
} from '@/types/views';

const cards = await syntheticSettlementRepository.listOpportunityRails(PROTOTYPE_FOUNDER);
const projectedCard = cards.find((card) => card.rail.kind === 'projection');
const settledCard = cards.find((card) => card.rail.kind === 'settlement');
if (projectedCard === undefined || settledCard === undefined) {
  throw new Error('fixtures must provide a projected and a settled rail');
}

const VARIANTS: readonly RevenueRailVariant[] = [
  'row',
  'detail',
  'dashboard',
  'approval',
  'provenance',
];

describe('RevenueRail across all five contexts', () => {
  it.each(VARIANTS)('never shows projected money as approved in the %s variant', (variant) => {
    const { container } = render(<RevenueRail model={projectedCard.rail} variant={variant} />);
    expect(container.querySelectorAll('[class*="money"]')).toHaveLength(0);
    expect(screen.getByText(copy.money.projected)).toBeInTheDocument();
    expect(screen.queryByText(copy.money.paid)).not.toBeInTheDocument();
  });

  it.each(VARIANTS)('carries approval provenance in the %s variant', (variant) => {
    render(<RevenueRail model={settledCard.rail} variant={variant} />);
    expect(screen.getByText(new RegExp(copy.money.approvedBy))).toBeInTheDocument();
    expect(screen.queryByText(copy.money.projectedLong)).not.toBeInTheDocument();
  });

  it('spells out the distributable base only where there is room for it', () => {
    const dense = render(<RevenueRail model={settledCard.rail} variant="row" />);
    expect(dense.container.textContent).not.toContain(copy.money.base);
    dense.unmount();
    const roomy = render(<RevenueRail model={settledCard.rail} variant="detail" />);
    expect(roomy.container.textContent).toContain(copy.money.base);
  });

  it('does not put the rail label in the heading outline', () => {
    // The section is named by aria-label; a heading here would skip a level.
    const { container } = render(<RevenueRail model={settledCard.rail} variant="detail" />);
    expect(container.querySelectorAll('h1,h2,h3,h4,h5,h6')).toHaveLength(0);
  });
});

const OPERATOR: OperatorCardView = {
  memberId: 'm1',
  slug: 'sebastian-benitez',
  displayName: 'Sebastián Benítez',
  initials: 'SB',
  role: 'member',
  bio: 'Cierra beneficiarios en campo.',
  availability: 'open',
  nextCapability: 'Motion graphics',
  joinedAt: '2026-02-03',
  skills: [
    {
      id: 's1',
      name: 'Cierre comercial',
      family: 'Comercial',
      level: 'strong',
      verification: 'verified',
    },
    {
      id: 's2',
      name: 'Frontend',
      family: 'Producto',
      level: 'learning',
      verification: 'self_reported',
    },
  ],
  stats: {
    closed: 2,
    delivered: 2,
    onTime: 1,
    late: 1,
    revisionsRequested: 0,
    acceptedFirstPass: 1,
    onTimeRateBp: basisPoints(5_000),
    acceptanceRateBp: basisPoints(10_000),
  },
  progression: {
    rulesetVersion: 1,
    level: 3,
    xp: 620,
    currentLevelXp: 480,
    nextLevelXp: 900,
    progressBp: basisPoints(3_333),
  },
  approvedEarnings: money(179_454),
  paidEarnings: money(0),
  activeWorkCount: 2,
};

describe('OperatorCard', () => {
  it('shows approved and paid earnings, and no projection', () => {
    render(<OperatorCard operator={OPERATOR} />);
    expect(screen.getByText('$1,794.54')).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.queryByText(copy.money.projected)).not.toBeInTheDocument();
  });

  it('renders as h2 inside a directory and h1 when it is the page subject', () => {
    const list = render(<OperatorCard operator={OPERATOR} />);
    expect(list.container.querySelector('h2')).not.toBeNull();
    list.unmount();
    const page = render(
      <OperatorCard operator={OPERATOR} headingLevel="h1" linkToProfile={false} />,
    );
    expect(page.container.querySelector('h1')?.textContent).toBe('Sebastián Benítez');
    expect(page.container.querySelector('a')).toBeNull();
  });

  it('distinguishes verified skills from self-reported ones', () => {
    const { container } = render(<OperatorCard operator={OPERATOR} />);
    const dashed = [...container.querySelectorAll('li')].filter((node) =>
      node.className.includes('border-dashed'),
    );
    expect(dashed.length).toBeGreaterThan(0);
  });
});

describe('SkillChips', () => {
  it('collapses beyond the limit rather than overflowing', () => {
    const skills: SkillView[] = Array.from({ length: 6 }, (_, i) => ({
      id: String(i),
      name: `Habilidad ${i}`,
      family: 'Familia',
      level: 'working',
      verification: 'verified',
    }));
    render(<SkillChips skills={skills} limit={2} />);
    expect(screen.getByText('+4')).toBeInTheDocument();
  });
});

describe('StatGrid', () => {
  it('says so when there is nothing to rate yet', () => {
    const empty: MemberStats = {
      closed: 0,
      delivered: 0,
      onTime: 0,
      late: 0,
      revisionsRequested: 0,
      acceptedFirstPass: 0,
      onTimeRateBp: null,
      acceptanceRateBp: null,
    };
    render(<StatGrid stats={empty} />);
    expect(screen.getAllByText(copy.network.noRate)).toHaveLength(2);
  });

  it('renders a rate as a percentage', () => {
    render(<StatGrid stats={OPERATOR.stats} />);
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});

describe('AvailabilityBadge', () => {
  it('labels each availability', () => {
    render(<AvailabilityBadge availability="limited" />);
    expect(screen.getByText(copy.network.availability.limited)).toBeInTheDocument();
  });
});

describe('StatusPill', () => {
  it('reserves the ledger colour for settled and paid work', () => {
    const settled = render(<StatusPill status="settled_approved" />);
    expect(settled.container.querySelectorAll('[class*="money"]').length).toBeGreaterThan(0);
    settled.unmount();
    const inFlight = render(<StatusPill status="in_delivery" />);
    expect(inFlight.container.querySelectorAll('[class*="money"]')).toHaveLength(0);
  });

  it('marks a cancelled opportunity as a failed state', () => {
    const { container } = render(<StatusPill status="cancelled" />);
    expect(container.querySelectorAll('[class*="danger"]').length).toBeGreaterThan(0);
  });
});

function assignment(id: string, weightBp: number, roleKey = 'delivery'): AssignmentView {
  return {
    id,
    memberId: id,
    memberSlug: id,
    displayName: 'Emiliano Pasos',
    initials: 'EP',
    roleKey,
    roleLabel: 'Producción',
    weightBp: basisPoints(weightBp),
    status: 'approved',
  };
}

function pool(key: string, label: string, totalBp: number): PoolWeightView {
  return { key, label, totalBp, balanced: totalBp === 10_000 };
}

describe('AssignmentList', () => {
  it('flags a delivery pool whose weights do not total 10,000 basis points', () => {
    render(
      <AssignmentList
        assignments={[assignment('a', 6_000)]}
        pools={[pool('delivery', 'Producción', 6_000)]}
      />,
    );
    expect(screen.getByText(copy.detail.weightsUnbalanced)).toBeInTheDocument();
    // The single row reads 60% and so does the pool total; only the total is amber.
    const shown = screen.getAllByText('60%');
    expect(shown).toHaveLength(2);
    expect(shown.some((node) => node.className.includes('text-attention'))).toBe(true);
  });

  it('confirms a balanced pool', () => {
    render(
      <AssignmentList
        assignments={[assignment('a', 6_000), assignment('b', 4_000)]}
        pools={[pool('delivery', 'Producción', 10_000)]}
      />,
    );
    expect(screen.getByText(copy.detail.weightsBalanced)).toBeInTheDocument();
  });

  it('never aggregates two balanced pools into a false 200% total (SETY: closer + delivery)', () => {
    render(
      <AssignmentList
        assignments={[
          assignment('closer-1', 10_000, 'closer'),
          assignment('deliver-1', 6_000, 'delivery'),
          assignment('deliver-2', 4_000, 'delivery'),
        ]}
        pools={[pool('closer', 'Cierre', 10_000), pool('delivery', 'Producción', 10_000)]}
      />,
    );
    // Each pool reads its own 100% independently; "200%" must never appear.
    expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
    expect(screen.queryByText('200%')).not.toBeInTheDocument();
    expect(screen.getAllByText(copy.detail.weightsBalanced)).toHaveLength(2);
    expect(screen.getAllByText('Cierre').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Producción').length).toBeGreaterThan(0);
  });

  it('reports each required pool as balanced or not independently, never blocking settlement readiness on the other pool', () => {
    render(
      <AssignmentList
        assignments={[assignment('closer-1', 10_000, 'closer'), assignment('deliver-1', 6_000, 'delivery')]}
        pools={[pool('closer', 'Cierre', 10_000), pool('delivery', 'Producción', 6_000)]}
      />,
    );
    expect(screen.getByText(copy.detail.weightsBalanced)).toBeInTheDocument();
    expect(screen.getByText(copy.detail.weightsUnbalanced)).toBeInTheDocument();
  });
});

const MILESTONE: MilestoneView = {
  id: 'm1',
  position: 2,
  name: 'Guion y calendario',
  description: 'Guiones aprobados',
  status: 'done',
  dueAt: '2026-08-12',
  completedAt: '2026-08-11',
  assignedMemberName: 'Diego Martínez Hernández',
  assignedMemberInitials: 'DMN',
  evidence: [
    {
      id: 'e1',
      label: 'Guiones aprobados',
      url: 'https://evidencia.firma23.test/1/2',
      kind: 'document',
      submittedByName: 'Diego Martínez Hernández',
      submittedAt: '2026-08-11',
    },
  ],
};

describe('MilestoneChecklist', () => {
  it('renders an ordered list with status, owner and evidence', () => {
    const { container } = render(<MilestoneChecklist milestones={[MILESTONE]} />);
    expect(container.querySelector('ol')).not.toBeNull();
    expect(screen.getByText('02')).toBeInTheDocument();
    expect(screen.getByText(copy.detail.milestoneStatus.done)).toBeInTheDocument();
    expect(screen.getByText('DMN')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Guiones aprobados' })).toHaveAttribute(
      'href',
      'https://evidencia.firma23.test/1/2',
    );
  });

  it('marks a blocked milestone as needing attention, not as failed', () => {
    const { container } = render(
      <MilestoneChecklist milestones={[{ ...MILESTONE, status: 'blocked', evidence: [] }]} />,
    );
    expect(container.querySelectorAll('[class*="attention"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[class*="danger"]')).toHaveLength(0);
  });
});

describe('CashLedger', () => {
  it('states for every row whether it counts toward the base', () => {
    render(
      <CashLedger
        events={[
          {
            id: 'c1',
            type: 'deposit',
            label: 'Depósito Secretaría',
            amount: money(897_270),
            occurredAt: '2026-08-07',
            countsTowardBase: true,
          },
          {
            id: 'c2',
            type: 'contribution',
            label: 'Contribución del beneficiario',
            amount: money(160_000),
            occurredAt: '2026-08-02',
            countsTowardBase: false,
          },
        ]}
      />,
    );
    expect(screen.getByText(copy.detail.inBase)).toBeInTheDocument();
    expect(screen.getByText(copy.detail.outOfBase)).toBeInTheDocument();
    expect(screen.getByText('$8,972.70')).toBeInTheDocument();
    expect(screen.getByText('$1,600.00')).toBeInTheDocument();
  });
});

describe('FilterChips', () => {
  it('builds an href that preserves the other active filters', () => {
    render(
      <FilterChips
        legend="Estado"
        param="status"
        options={[
          { value: null, label: 'Todas' },
          { value: 'paid', label: 'Pagada', count: 1 },
        ]}
        active={null}
        current={{ project: 'sety-2026' }}
        basePath="/opportunities"
      />,
    );
    expect(screen.getByRole('link', { name: /Pagada/ })).toHaveAttribute(
      'href',
      '/opportunities?project=sety-2026&status=paid',
    );
  });

  it('clears only its own parameter', () => {
    render(
      <FilterChips
        legend="Estado"
        param="status"
        options={[{ value: null, label: 'Todas' }]}
        active="paid"
        current={{ project: 'sety-2026', status: 'paid' }}
        basePath="/opportunities"
      />,
    );
    expect(screen.getByRole('link', { name: 'Todas' })).toHaveAttribute(
      'href',
      '/opportunities?project=sety-2026',
    );
  });

  it('marks the active option for assistive technology', () => {
    render(
      <FilterChips
        legend="Estado"
        param="status"
        options={[
          { value: null, label: 'Todas' },
          { value: 'paid', label: 'Pagada' },
        ]}
        active="paid"
        current={{ status: 'paid' }}
        basePath="/opportunities"
      />,
    );
    expect(screen.getByRole('link', { name: 'Pagada' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('link', { name: 'Todas' })).not.toHaveAttribute('aria-current');
  });

  it('is a labelled group', () => {
    render(
      <FilterChips
        legend="Proyecto"
        param="project"
        options={[{ value: null, label: 'Todas' }]}
        active={null}
        current={{}}
        basePath="/opportunities"
      />,
    );
    expect(screen.getByRole('group', { name: 'Proyecto' })).toBeInTheDocument();
  });
});
