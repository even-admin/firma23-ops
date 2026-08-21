import type { ProjectFixtureBundle } from '@/data/repositories/synthetic/projects/bundle';

import project from '@/data/fixtures/projects/ai-ops-retainer/project.json';
import serviceVersions from '@/data/fixtures/projects/ai-ops-retainer/service-versions.json';
import allocationRuleVersions from '@/data/fixtures/projects/ai-ops-retainer/allocation-rule-versions.json';
import milestoneTemplates from '@/data/fixtures/projects/ai-ops-retainer/milestone-templates.json';
import opportunities from '@/data/fixtures/projects/ai-ops-retainer/opportunities.json';
import assignments from '@/data/fixtures/projects/ai-ops-retainer/assignments.json';
import opportunityMilestones from '@/data/fixtures/projects/ai-ops-retainer/opportunity-milestones.json';
import evidenceLinks from '@/data/fixtures/projects/ai-ops-retainer/evidence-links.json';
import cashEvents from '@/data/fixtures/projects/ai-ops-retainer/cash-events.json';
import settlements from '@/data/fixtures/projects/ai-ops-retainer/settlements.json';
import settlementLines from '@/data/fixtures/projects/ai-ops-retainer/settlement-lines.json';

export const AI_OPS_RETAINER: ProjectFixtureBundle = {
  slug: 'ai-ops-retainer',
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
