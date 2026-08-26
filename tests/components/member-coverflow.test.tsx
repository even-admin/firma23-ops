import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MemberCoverflow } from '@/components/operator/MemberCoverflow';
import { copy } from '@/copy/es-MX';
import { basisPoints, money } from '@/lib/money';
import type { OperatorCardView } from '@/types/views';

function operator(memberId: string, displayName: string): OperatorCardView {
  return {
    memberId,
    slug: displayName.toLowerCase().replaceAll(' ', '-'),
    displayName,
    initials: '',
    role: 'member',
    bio: 'Trabajo comprobable dentro de FIRMA23.',
    availability: 'open',
    nextCapability: 'Sistemas operativos',
    joinedAt: '2026-02-03',
    skills: [
      {
        id: `${memberId}-skill`,
        name: 'Producción',
        family: 'Entrega',
        level: 'strong',
        verification: 'verified',
      },
    ],
    stats: {
      closed: 1,
      delivered: 2,
      onTime: 2,
      late: 0,
      revisionsRequested: 0,
      acceptedFirstPass: 2,
      onTimeRateBp: basisPoints(10_000),
      acceptanceRateBp: basisPoints(10_000),
    },
    approvedEarnings: money(100_00),
    paidEarnings: money(50_00),
    activeWorkCount: 1,
  };
}

const OPERATORS = [operator('m1', 'Ana Norte'), operator('m2', 'Beto Sur'), operator('m3', 'Caro Este')];

describe('MemberCoverflow', () => {
  it('starts with one accessible real member and no projected money', () => {
    const { container } = render(<MemberCoverflow operators={OPERATORS} />);
    expect(screen.getByRole('group', { name: copy.network.carouselLabel })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ana Norte' })).toHaveAttribute('href', '/network/ana-norte');
    expect(container.querySelectorAll('[data-selected="true"]')).toHaveLength(1);
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByText(copy.money.projected)).not.toBeInTheDocument();
  });

  it('moves with arrow keys and restores the selected member as the only interactive slide', () => {
    const { container } = render(<MemberCoverflow operators={OPERATORS} />);
    const carousel = screen.getByRole('group', { name: copy.network.carouselLabel });
    fireEvent.keyDown(carousel, { key: 'ArrowRight' });

    expect(screen.getByRole('link', { name: 'Beto Sur' })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-selected="true"]')).toHaveLength(1);
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('uses bare 48px directional controls without pagination chrome', () => {
    render(<MemberCoverflow operators={OPERATORS} />);
    expect(screen.getByRole('button', { name: copy.network.previousMember }).className).toContain('size-12');
    expect(screen.getByRole('button', { name: copy.network.nextMember }).className).toContain('size-12');
    expect(screen.getByRole('heading', { name: 'Network' })).toHaveClass('sr-only');
  });

  it('moves an adjacent card into focus before its profile becomes the primary link', () => {
    render(<MemberCoverflow operators={OPERATORS} />);

    fireEvent.click(screen.getByRole('button', { name: `${copy.network.showMember}: Beto Sur` }));

    expect(screen.getByRole('link', { name: 'Beto Sur' })).toHaveAttribute(
      'href',
      '/network/beto-sur',
    );
    expect(screen.getByRole('button', { name: `${copy.network.showMember}: Ana Norte` })).toBeInTheDocument();
  });

  it('does not frame the carousel with decorative top or bottom rules', () => {
    render(<MemberCoverflow operators={OPERATORS} />);
    expect(screen.getByRole('group', { name: copy.network.carouselLabel })).not.toHaveClass(
      'border-y',
    );
  });

  it('makes the complete selected card the member profile link', () => {
    render(<MemberCoverflow operators={OPERATORS} />);
    const link = screen.getByRole('link', { name: 'Ana Norte' });

    expect(link).toHaveAttribute('href', '/network/ana-norte');
    expect(link.querySelector('article')).not.toBeNull();
  });
});
