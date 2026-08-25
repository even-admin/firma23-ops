import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AvailabilityBadge } from '@/components/operator/AvailabilityBadge';
import { OperatorCard } from '@/components/operator/OperatorCard';
import { copy } from '@/copy/es-MX';
import { basisPoints, money } from '@/lib/money';
import type { OperatorCardView } from '@/types/views';

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
    { id: 's1', name: 'Cierre comercial', family: 'Comercial', level: 'strong', verification: 'verified' },
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
  approvedEarnings: money(179_454),
  paidEarnings: money(0),
  activeWorkCount: 2,
};

describe('OperatorCard as the Player identity surface', () => {
  it('shows the real handle only on the profile hero, never in the dense directory', () => {
    const list = render(<OperatorCard operator={OPERATOR} />);
    expect(screen.queryByText('@sebastian-benitez')).not.toBeInTheDocument();
    list.unmount();

    render(<OperatorCard operator={OPERATOR} headingLevel="h1" linkToProfile={false} />);
    expect(screen.getByText('@sebastian-benitez')).toBeInTheDocument();
  });

  it('surfaces real active work as a count, never an invented streak or XP label', () => {
    const { container } = render(<OperatorCard operator={OPERATOR} />);
    const line = [...container.querySelectorAll('span')].find(
      (node) => node.textContent === `2 ${copy.home.activeWork}`,
    );
    expect(line).not.toBeUndefined();
  });

  it('omits the active-work line entirely when there is none, rather than showing a zero', () => {
    render(<OperatorCard operator={{ ...OPERATOR, activeWorkCount: 0 }} />);
    expect(screen.queryByText(copy.home.activeWork)).not.toBeInTheDocument();
  });

  it('never renders a projection on the identity surface', () => {
    render(<OperatorCard operator={OPERATOR} />);
    expect(screen.queryByText(copy.money.projected)).not.toBeInTheDocument();
    expect(document.querySelectorAll('[class*="money"]')).toHaveLength(1);
  });
});

describe('AvailabilityBadge as an instrument-style status', () => {
  it('pairs the label with a decorative status dot, not a photo or remote asset', () => {
    const { container } = render(<AvailabilityBadge availability="open" />);
    expect(screen.getByText(copy.network.availability.open)).toBeInTheDocument();
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).not.toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it.each(['open', 'limited', 'unavailable'] as const)(
    'renders %s without an inline hex colour, only tokenised classes',
    (availability) => {
      const { container } = render(<AvailabilityBadge availability={availability} />);
      const badge = container.firstElementChild as HTMLElement;
      expect(badge.getAttribute('style')).toBeNull();
    },
  );
});
