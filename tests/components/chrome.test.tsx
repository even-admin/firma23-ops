import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/opportunities',
}));

import { MobileTabBar } from '@/components/chrome/MobileTabBar';
import { NavRail } from '@/components/chrome/NavRail';
import { OperationalHeader } from '@/components/chrome/OperationalHeader';
import { ViewerSwitcher } from '@/components/chrome/ViewerSwitcher';
import { AssignmentRow } from '@/components/operator/AssignmentRow';
import { EmptyState } from '@/components/state/EmptyState';
import { LoadingBlock } from '@/components/state/LoadingBlock';
import { PermissionDenied } from '@/components/state/PermissionDenied';
import { copy } from '@/copy/es-MX';
import { money } from '@/lib/money';
import type { HomeAssignment, MemberMoney } from '@/types/views';

const memberMoney: MemberMoney = {
  approved: money(179_454),
  paid: money(50_000),
  approvedUnpaid: money(129_454),
  projected: money(403_772),
};

function header(overrides: Partial<Parameters<typeof OperationalHeader>[0]> = {}) {
  return (
    <OperationalHeader
      displayName="Sebastián Benítez"
      initials="SB"
      money={memberMoney}
      activeWorkCount={2}
      primaryActionLabel={copy.home.primaryAction}
      primaryActionEnabled
      {...overrides}
    />
  );
}

describe('OperationalHeader', () => {
  it('is one header, not four disconnected KPI cards', () => {
    const { container } = render(header());
    expect(container.querySelectorAll('header')).toHaveLength(1);
  });

  it('leads with approved money in the ledger colour', () => {
    render(header());
    const block = screen.getByText(copy.home.approved).parentElement;
    const amount = block?.querySelector('[class*="text-money"]');
    expect(amount?.textContent).toBe('$1,794.54');
  });

  it('shows money still owed without the ledger colour', () => {
    render(header());
    const block = screen.getByText(copy.home.pendingPayout).parentElement;
    expect(block?.querySelector('[class*="text-money"]')).toBeNull();
    expect(block?.textContent).toContain('$1,294.54');
  });

  it('shows projected money muted, labelled, and never in the ledger colour', () => {
    render(header());
    const projected = screen.getByText('$4,037.72');
    expect(projected.parentElement?.className).not.toContain('text-money');
    expect(screen.getByText(copy.home.projectedAside)).toBeInTheDocument();
    expect(screen.getByText(copy.money.notEarnedYet)).toBeInTheDocument();
  });

  it('separates projected money from approved money in the DOM, not just visually', () => {
    render(header());
    const approvedLabel = screen.getByText(copy.home.approved);
    const projectedLabel = screen.getByText(copy.home.projectedAside);
    expect(approvedLabel.closest('div')).not.toBe(projectedLabel.closest('div'));
  });

  it('disables the primary action when there is no active work', () => {
    render(header({ activeWorkCount: 0, primaryActionEnabled: false }));
    const button = screen.getByRole('button', { name: copy.home.primaryAction });
    expect(button).toBeDisabled();
    expect(button.className).toContain('cursor-not-allowed');
  });
});

describe('NavRail', () => {
  it('marks the current route for assistive technology', () => {
    render(<NavRail role="founder" />);
    expect(screen.getByRole('link', { name: copy.nav.opportunities })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('disables routes that do not exist yet instead of linking to a 404', () => {
    render(<NavRail role="founder" />);
    for (const label of [copy.nav.network, copy.nav.leaderboard, copy.nav.admin]) {
      const item = screen.getByText(label).closest('[aria-disabled="true"]');
      expect(item).not.toBeNull();
    }
    expect(screen.queryByRole('link', { name: copy.nav.network })).not.toBeInTheDocument();
  });

  it('withholds founder-only destinations from a member viewer', () => {
    render(<NavRail role="member" />);
    expect(screen.queryByRole('link', { name: copy.nav.opportunities })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: copy.nav.home })).toBeInTheDocument();
  });

  it('is a labelled navigation landmark', () => {
    render(<NavRail role="founder" />);
    expect(screen.getByRole('navigation', { name: copy.nav.primary })).toBeInTheDocument();
  });
});

describe('MobileTabBar', () => {
  it('does not share an accessible name with the desktop rail', () => {
    render(<MobileTabBar role="member" />);
    expect(screen.getByRole('navigation', { name: copy.nav.mobile })).toBeInTheDocument();
    expect(copy.nav.mobile).not.toBe(copy.nav.primary);
  });

  it('keeps the primary destinations reachable and gates the founder route', () => {
    render(<MobileTabBar role="member" />);
    expect(screen.getByRole('link', { name: copy.nav.home })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: copy.nav.opportunities })).not.toBeInTheDocument();
  });
});

describe('ViewerSwitcher', () => {
  it('states plainly that it grants no permissions', () => {
    render(<ViewerSwitcher role="founder" action={() => undefined} />);
    expect(screen.getByText(copy.viewer.warning)).toBeInTheDocument();
  });

  it('reflects the active viewer', () => {
    render(<ViewerSwitcher role="member" action={() => undefined} />);
    expect(screen.getByRole('button', { name: copy.viewer.member })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: copy.viewer.founder })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});

function assignment(money_: HomeAssignment['money']): HomeAssignment {
  return {
    opportunityId: 'opp',
    code: 'SETY-0142',
    beneficiaryName: 'Tortillería La Ceiba',
    beneficiaryLocation: 'Mérida, Yucatán',
    projectName: 'SETY 2026',
    serviceName: 'Kit de contenido social',
    roleLabel: 'Cierre',
    status: 'in_delivery',
    active: true,
    money: money_,
  };
}

describe('AssignmentRow', () => {
  it('badges a projected row as a projection, with no ledger colour', () => {
    const { container } = render(
      <AssignmentRow assignment={assignment({ kind: 'projected', amount: money(179_454) })} />,
    );
    expect(screen.getByText(copy.money.projected)).toBeInTheDocument();
    expect(container.querySelectorAll('[class*="money"]')).toHaveLength(0);
  });

  it('badges an approved unpaid row as approved, not paid', () => {
    render(
      <AssignmentRow
        assignment={assignment({
          kind: 'approved',
          amount: money(179_454),
          payoutStatus: 'unpaid',
        })}
      />,
    );
    expect(screen.getByText(copy.money.approved)).toBeInTheDocument();
    expect(screen.queryByText(copy.money.paid)).not.toBeInTheDocument();
  });

  it('badges a paid row as paid', () => {
    render(
      <AssignmentRow
        assignment={assignment({ kind: 'approved', amount: money(179_454), payoutStatus: 'paid' })}
      />,
    );
    expect(screen.getByText(copy.money.paid)).toBeInTheDocument();
  });
});

describe('state components', () => {
  it('announces loading to assistive technology', () => {
    render(<LoadingBlock rows={2} />);
    expect(screen.getByRole('status', { name: copy.states.loading })).toBeInTheDocument();
  });

  it('renders an empty state with an explanation', () => {
    render(<EmptyState title={copy.home.noAssignments} detail={copy.home.noAssignmentsDetail} />);
    expect(screen.getByText(copy.home.noAssignments)).toBeInTheDocument();
    expect(screen.getByText(copy.home.noAssignmentsDetail)).toBeInTheDocument();
  });

  it('renders the permission denied state', () => {
    render(<PermissionDenied />);
    expect(screen.getByText(copy.states.permissionDenied)).toBeInTheDocument();
  });
});
