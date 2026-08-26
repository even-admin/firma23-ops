import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProjectRecordTable } from '@/components/project/ProjectRecordTable';
import { copy } from '@/copy/es-MX';
import { PROTOTYPE_FOUNDER } from '@/data/prototype-viewers';
import { syntheticProjectRepository } from '@/data/repositories/synthetic/projects';

const projects = await syntheticProjectRepository.list(PROTOTYPE_FOUNDER);

describe('ProjectRecordTable', () => {
  it('renders one semantic table row per project with a link to its detail page', () => {
    render(<ProjectRecordTable projects={projects} />);
    const table = screen.getByRole('table');
    for (const project of projects) {
      expect(within(table).getByText(project.name)).toBeInTheDocument();
      expect(within(table).getByRole('link', { name: new RegExp(project.name) })).toHaveAttribute(
        'href',
        `/projects/${project.slug}`,
      );
    }
  });

  it('renders a structured list row for every project below the table breakpoint', () => {
    render(<ProjectRecordTable projects={projects} />);
    const lists = screen.getAllByRole('list');
    const mobileList = lists.find(
      (list) => list.tagName === 'UL' && list.className.includes('project-record-list'),
    );
    expect(mobileList).toBeDefined();
    for (const project of projects) {
      expect(within(mobileList!).getByText(project.name)).toBeInTheDocument();
    }
  });

  it('uses a named content container instead of a viewport breakpoint', () => {
    const { container } = render(<ProjectRecordTable projects={projects} />);
    expect(container.querySelector('[data-project-records]')).toHaveClass('project-records');
    expect(screen.getByRole('table')).toHaveClass('project-record-table');
    expect(screen.getByRole('table').className).not.toContain('md:table');
  });

  it('never invents money: every displayed amount is the project approvedSettled value', () => {
    const { container } = render(<ProjectRecordTable projects={projects} />);
    const moneyNodes = container.querySelectorAll('[class*="money"] data');
    expect(moneyNodes.length).toBeGreaterThan(0);
    expect(moneyNodes.length).toBe(projects.length * 2);
  });

  it('shows the active rule version, or the no-rule copy, without inventing a rule', () => {
    render(<ProjectRecordTable projects={projects} />);
    const draftProject = projects.find((project) => project.activeRule === null);
    expect(draftProject).toBeDefined();
    expect(screen.getAllByText(copy.projects.noRule).length).toBeGreaterThan(0);

    const ruledProject = projects.find((project) => project.activeRule !== null);
    expect(ruledProject).toBeDefined();
    expect(
      screen.getAllByText(`${copy.projects.versionPrefix}${ruledProject!.activeRule!.version}`)
        .length,
    ).toBeGreaterThan(0);
  });
});
