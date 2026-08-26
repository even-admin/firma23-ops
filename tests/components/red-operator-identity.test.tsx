import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AvailabilityBadge } from '@/components/operator/AvailabilityBadge';
import { IdentityOrb, identityOrbVariant } from '@/components/operator/IdentityOrb';
import { OperatorCard } from '@/components/operator/OperatorCard';
import { MESH_DRIFT_PALETTES } from '@/components/visual/mesh-drift-config';
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
    {
      id: 's1',
      name: 'Cierre comercial',
      family: 'Comercial',
      level: 'strong',
      verification: 'verified',
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
  approvedEarnings: money(179_454),
  paidEarnings: money(0),
  activeWorkCount: 2,
};

describe('OperatorCard as the Player identity surface', () => {
  it('uses a decorative deterministic orb, never initials or a remote image', () => {
    const { container, rerender } = render(<OperatorCard operator={OPERATOR} />);
    const first = container.querySelector('[data-identity-orb]');
    const variant = first?.getAttribute('data-orb-variant');

    expect(first).toHaveAttribute('aria-hidden', 'true');
    expect(first).toHaveTextContent('');
    expect(container).not.toHaveTextContent('SB');
    expect(container.querySelector('img')).toBeNull();

    rerender(<OperatorCard operator={OPERATOR} />);
    expect(container.querySelector('[data-identity-orb]')).toHaveAttribute(
      'data-orb-variant',
      variant,
    );
  });

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
      (node) => node.textContent === `2 ${copy.network.activeWork}`,
    );
    expect(line).not.toBeUndefined();
  });

  it('omits the active-work line entirely when there is none, rather than showing a zero', () => {
    render(<OperatorCard operator={{ ...OPERATOR, activeWorkCount: 0 }} />);
    expect(screen.queryByText(copy.network.activeWork)).not.toBeInTheDocument();
  });

  it('never renders a projection on the identity surface', () => {
    render(<OperatorCard operator={OPERATOR} />);
    expect(screen.queryByText(copy.money.projected)).not.toBeInTheDocument();
    expect(document.querySelectorAll('[class*="money"]')).toHaveLength(1);
  });
});

describe('IdentityOrb palette selection', () => {
  it('is stable and reaches the five approved mesh variants', () => {
    expect(identityOrbVariant(OPERATOR.memberId)).toBe(identityOrbVariant(OPERATOR.memberId));
    const variants = new Set(
      Array.from({ length: 80 }, (_, index) => identityOrbVariant(`member-${index}`)),
    );
    expect([...variants].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('renders the matching welcome-shader canvas without inline values on the identity shell', () => {
    const { container } = render(<IdentityOrb memberId={OPERATOR.memberId} />);
    const orb = container.firstElementChild;
    const variant = identityOrbVariant(OPERATOR.memberId);

    expect(orb).not.toHaveAttribute('style');
    expect(orb?.querySelector('[data-mesh-drift]')).toHaveAttribute(
      'data-mesh-palette',
      String(variant),
    );
  });

  it('locks the welcome field and four supplied recipes to their exact approved shades', () => {
    const paletteBytes = MESH_DRIFT_PALETTES.map((palette) =>
      palette.colors.slice(0, 12).map((channel) => Math.round(channel * 255)),
    );

    expect(paletteBytes).toEqual([
      [3, 28, 38, 27, 108, 168, 90, 210, 244, 234, 249, 255],
      [0, 18, 25, 0, 95, 115, 148, 210, 189, 233, 216, 166],
      [16, 16, 16, 245, 245, 245, 176, 176, 176, 58, 58, 58],
      [3, 18, 14, 14, 124, 90, 124, 229, 119, 244, 255, 199],
      [16, 0, 43, 127, 0, 255, 51, 174, 185, 9, 32, 244],
    ]);
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
