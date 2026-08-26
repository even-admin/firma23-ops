import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
  recovery: money(0),
  projected: money(403_772),
};

function header(overrides: Partial<Parameters<typeof OperationalHeader>[0]> = {}) {
  return (
    <OperationalHeader
      memberId="m1"
      displayName="Sebastián Benítez"
      money={memberMoney}
      activeWorkCount={2}
      canOpenOpportunity
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
    const block = screen.getByText(copy.home.approvedLedger).closest('[data-money-state="approved"]');
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
    const approvedLabel = screen.getByText(copy.home.approvedLedger);
    const projectedLabel = screen.getByText(copy.home.projectedAside);
    expect(approvedLabel.closest('div')).not.toBe(projectedLabel.closest('div'));
  });

  it('offers a real route instead of an inert command when no assignment is active', () => {
    render(header({ activeWorkCount: 2 }));
    expect(screen.queryByRole('button', { name: copy.home.primaryAction })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: copy.home.browseOpportunities })).toHaveAttribute(
      'href',
      '/opportunities',
    );
  });

  it('never links a member to a founder-only opportunity route', () => {
    render(
      header({
        canOpenOpportunity: false,
        primaryAssignment: {
          opportunityId: 'o1',
          code: 'F23-001',
          beneficiaryName: 'Beneficiaria',
          beneficiaryLocation: 'Merida',
          projectName: 'Proyecto',
          serviceName: 'Servicio',
          roleLabel: 'Entrega',
          status: 'assigned',
          active: true,
          money: { kind: 'projected', amount: money(10_000) },
        },
      }),
    );

    expect(screen.queryByRole('link', { name: copy.home.openOpportunity })).not.toBeInTheDocument();
    expect(screen.getByText(copy.home.nextMove)).toBeInTheDocument();
  });

  it('keeps evidence submission disabled until an authorized write path exists', () => {
    render(
      header({
        primaryAssignment: {
          opportunityId: 'o1',
          code: 'F23-001',
          beneficiaryName: 'Beneficiaria',
          beneficiaryLocation: 'Merida',
          projectName: 'Proyecto',
          serviceName: 'Servicio',
          roleLabel: 'Entrega',
          status: 'assigned',
          active: true,
          money: { kind: 'projected', amount: money(10_000) },
        },
        primaryAction: {
          key: 'evidence:o1',
          label: copy.home.actionEvidence,
          detail: 'F23-001 · Beneficiaria',
          tone: 'neutral',
        },
      }),
    );

    expect(screen.getByRole('button', { name: copy.home.primaryAction })).toBeDisabled();
    expect(screen.getByText(copy.home.primaryActionUnavailable)).toBeInTheDocument();
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
      memberId="a0000000-0000-4000-8000-000000000001"
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
    expect(screen.getByRole('link', { name: copy.nav.projects })).toHaveAttribute(
      'href',
      '/projects',
    );
    expect(screen.queryByRole('link', { name: copy.nav.opportunities })).not.toBeInTheDocument();
  });
});

/**
 * jsdom does not lay out real geometry (getBoundingClientRect is
 * all-zero) or implement elementFromPoint meaningfully, so these mock both
 * to exercise the actual hide/show decision — the thing that broke twice
 * during manual verification (once by counting any DOM element as
 * "content", once by measuring mid-transition geometry).
 */
describe('MobileTabBar hides only for real text behind its footprint', () => {
  const navRect = {
    top: 700,
    bottom: 764,
    left: 12,
    right: 363,
    width: 351,
    height: 64,
    x: 12,
    y: 700,
    toJSON() {
      return this;
    },
  } as DOMRect;

  afterEach(() => {
    vi.restoreAllMocks();
    // jsdom has no elementFromPoint at all, so it was assigned directly
    // rather than spied on; restoreAllMocks does not undo a direct
    // assignment, so each test must not leak it into the next one.
    // @ts-expect-error -- deliberately deleting a property that does not
    // exist on jsdom's Document type, to fully undo the test-only assignment.
    delete document.elementFromPoint;
  });

  it('hides when a real text leaf sits behind it', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(navRect);
    const leaf = document.createElement('span');
    leaf.textContent = '$33,972.70';
    document.elementFromPoint = vi.fn().mockReturnValue(leaf);

    render(<MobileTabBar role="member" />);
    const nav = await screen.findByRole('navigation', { name: copy.nav.mobile });
    await waitFor(() => {
      expect(nav.className).toContain('opacity-0');
    });
  });

  it('hides over an explicitly protected visual instrument even between text leaves', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(navRect);
    const instrument = document.createElement('article');
    instrument.setAttribute('data-mobile-nav-clearance', '');
    const gap = document.createElement('div');
    instrument.append(gap);
    document.body.append(instrument);
    document.elementFromPoint = vi.fn().mockReturnValue(gap);

    render(<MobileTabBar role="member" />);
    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: copy.nav.mobile })).toHaveClass('opacity-0');
    });

    instrument.remove();
  });

  it('does not hide for a wrapping container that merely contains text elsewhere', async () => {
    // Regression test: elementFromPoint returning a non-leaf container
    // (e.g. the flex row wrapping a label and an amount) must not count as
    // "real content here" — the first version of this check did exactly
    // that and left the bar hidden almost permanently on any page with
    // more content below.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(navRect);
    const wrapper = document.createElement('div');
    const child = document.createElement('span');
    child.textContent = 'Base aprobada';
    wrapper.appendChild(child);
    document.elementFromPoint = vi.fn().mockReturnValue(wrapper);

    render(<MobileTabBar role="member" />);
    const nav = await screen.findByRole('navigation', { name: copy.nav.mobile });
    await waitFor(() => {
      expect(nav.className).toContain('opacity-100');
    });
  });

  it('stays visible when nothing is behind it', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(navRect);
    document.elementFromPoint = vi.fn().mockReturnValue(null);

    render(<MobileTabBar role="member" />);
    const nav = await screen.findByRole('navigation', { name: copy.nav.mobile });
    await waitFor(() => {
      expect(nav.className).toContain('opacity-100');
    });
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
