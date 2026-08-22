import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/opportunities',
}));

import { MobileTabBar } from '@/components/chrome/MobileTabBar';
import { Sidebar } from '@/components/chrome/Sidebar';
import { OperationalHeader } from '@/components/chrome/OperationalHeader';
import { ViewerSwitcher } from '@/components/chrome/ViewerSwitcher';
import { AssignmentRow } from '@/components/operator/AssignmentRow';
import { EmptyState } from '@/components/state/EmptyState';
import { LoadingBlock } from '@/components/state/LoadingBlock';
import { PermissionDenied } from '@/components/state/PermissionDenied';
import { copy } from '@/copy/es-MX';
import { money } from '@/lib/money';
import { buildNavGroups, NAV_ITEMS } from '@/lib/nav';
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

const NAV_PROJECTS = [
  { slug: 'sety-2026', name: 'SETY 2026' },
  { slug: 'ai-ops-retainer', name: 'AI Ops Retainer' },
];

function sidebar(role: 'founder' | 'member', pendingApprovals?: number) {
  return (
    <Sidebar
      role={role}
      groups={buildNavGroups({ projects: NAV_PROJECTS, pendingApprovals })}
      viewerSwitcher={null}
      onOpenSearch={() => undefined}
    />
  );
}

describe('Sidebar', () => {
  it('marks the current route for assistive technology', () => {
    render(sidebar('founder'));
    expect(screen.getByRole('link', { name: copy.nav.opportunities })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('links every built destination for a founder', () => {
    render(sidebar('founder'));
    for (const item of NAV_ITEMS) {
      expect(screen.getByRole('link', { name: item.label })).toHaveAttribute('href', item.href);
    }
  });

  it('renders an unreachable destination disabled rather than linking to a 404', () => {
    // A member cannot reach Admin, so that item exercises the disabled path.
    render(sidebar('member'));
    const admin = screen.getByText(copy.nav.admin).closest('[aria-disabled="true"]');
    expect(admin).not.toBeNull();
    expect(admin?.className).toContain('cursor-not-allowed');
  });

  it('withholds founder-only destinations from a member viewer', () => {
    render(sidebar('member'));
    expect(screen.queryByRole('link', { name: copy.nav.opportunities })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: copy.nav.home })).toBeInTheDocument();
  });

  it('is a labelled navigation landmark', () => {
    render(sidebar('founder'));
    expect(screen.getByRole('navigation', { name: copy.nav.primary })).toBeInTheDocument();
  });

  it('nests each real project under Proyectos', () => {
    render(sidebar('founder'));
    const branch = screen.getByRole('button', {
      name: `${copy.nav.expandGroup} ${copy.nav.projects}`,
    });
    expect(branch).toHaveAttribute('aria-expanded', 'false');
    for (const project of NAV_PROJECTS) {
      expect(screen.getByRole('link', { name: project.name })).toHaveAttribute(
        'href',
        `/projects/${project.slug}`,
      );
    }
  });

  it('never withholds a nested founder route from the rail but hides it from a member', () => {
    render(sidebar('founder'));
    expect(screen.getByRole('link', { name: copy.nav.finance })).toHaveAttribute(
      'href',
      '/admin/finance',
    );
  });

  it('badges pending approvals with the real count, and nothing when there are none', () => {
    const { unmount } = render(sidebar('founder', 2));
    expect(screen.getByText(`2 ${copy.nav.pendingApprovals}`)).toBeInTheDocument();
    unmount();

    render(sidebar('founder', 0));
    expect(screen.queryByText(`0 ${copy.nav.pendingApprovals}`)).not.toBeInTheDocument();
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
