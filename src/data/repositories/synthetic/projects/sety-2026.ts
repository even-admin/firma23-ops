import type { ProjectFixtureBundle } from '@/data/repositories/synthetic/projects/bundle';

import project from '@/data/fixtures/projects/sety-2026/project.json';
import serviceVersions from '@/data/fixtures/projects/sety-2026/service-versions.json';
import allocationRuleVersions from '@/data/fixtures/projects/sety-2026/allocation-rule-versions.json';
import milestoneTemplates from '@/data/fixtures/projects/sety-2026/milestone-templates.json';
import opportunities from '@/data/fixtures/projects/sety-2026/opportunities.json';
import assignments from '@/data/fixtures/projects/sety-2026/assignments.json';
import opportunityMilestones from '@/data/fixtures/projects/sety-2026/opportunity-milestones.json';
import evidenceLinks from '@/data/fixtures/projects/sety-2026/evidence-links.json';
import cashEvents from '@/data/fixtures/projects/sety-2026/cash-events.json';
import settlements from '@/data/fixtures/projects/sety-2026/settlements.json';
import settlementLines from '@/data/fixtures/projects/sety-2026/settlement-lines.json';

export const SETY_2026: ProjectFixtureBundle = {
  slug: 'sety-2026',
  project,
  serviceVersions,
  allocationRuleVersions,
  milestoneTemplates,
  opportunities,
  assignments,
  opportunityMilestones,
  evidenceLinks,
  cashEvents,
  settlements,
  settlementLines,
};
