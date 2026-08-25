import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProjectHeader } from '@/components/project/ProjectHeader';
import { ProjectRuleHistory } from '@/components/project/ProjectRuleHistory';
import { copy } from '@/copy/es-MX';
import { PROTOTYPE_FOUNDER } from '@/data/prototype-viewers';
import { syntheticProjectRepository } from '@/data/repositories/synthetic/projects';

const sety = await syntheticProjectRepository.getBySlug('sety-2026', PROTOTYPE_FOUNDER);
const evenInternal = await syntheticProjectRepository.getBySlug(
  'even-internal-2026',
  PROTOTYPE_FOUNDER,
);
if (sety === null || evenInternal === null) throw new Error('fixture projects must exist');

describe('ProjectHeader', () => {
  it('renders exactly one h1 with the project name, its client, status, and approved money', () => {
    render(<ProjectHeader project={sety} />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent(sety.name);
    expect(screen.getByText(sety.sponsorName)).toBeInTheDocument();
    expect(screen.getByText(copy.projects.statusLabels[sety.status])).toBeInTheDocument();
  });
});

describe('ProjectRuleHistory', () => {
  it('tags the active rule and lists every share weight and base policy from the view model', () => {
    render(<ProjectRuleHistory activeRuleId={sety.activeRule!.id} rules={sety.rules} />);
    expect(screen.getByText(copy.projects.activeRule)).toBeInTheDocument();
    for (const share of sety.activeRule!.shares) {
      expect(screen.getByText(new RegExp(share.label))).toBeInTheDocument();
    }
    expect(screen.getByText(sety.activeRule!.basePolicyLabel, { exact: false })).toBeInTheDocument();
  });

  it('shows the empty state instead of inventing a rule when a project has none', () => {
    render(<ProjectRuleHistory activeRuleId={null} rules={evenInternal.rules} />);
    expect(evenInternal.rules).toHaveLength(0);
    expect(screen.getByText(copy.projects.noRule)).toBeInTheDocument();
    expect(screen.queryByText(copy.projects.activeRule)).not.toBeInTheDocument();
  });
});
