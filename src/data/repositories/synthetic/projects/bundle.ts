/**
 * A project's raw fixture bundle.
 *
 * Every field is the unvalidated envelope straight from JSON. Validation happens
 * once, centrally, in dataset.ts, so a new project cannot quietly skip it.
 */
export interface ProjectFixtureBundle {
  readonly slug: string;
  readonly project: unknown;
  readonly serviceVersions: unknown;
  readonly allocationRuleVersions: unknown;
  readonly milestoneTemplates: unknown;
  readonly opportunities: unknown;
  readonly assignments: unknown;
  readonly opportunityMilestones: unknown;
  readonly evidenceLinks: unknown;
  readonly cashEvents: unknown;
  readonly settlements: unknown;
  readonly settlementLines: unknown;
  readonly settlementLinePayouts: unknown;
}
