import Link from 'next/link';

import { RailBaseExplainer } from '@/components/revenue-rail/RailBaseExplainer';
import { RevenueRail } from '@/components/revenue-rail/RevenueRail';
import { StatusPill } from '@/components/opportunity/StatusPill';
import { ProjectCover } from '@/components/project/ProjectCover';
import type { RailModel } from '@/lib/allocation';
import type { Money } from '@/lib/money';
import type { OpportunityStatus } from '@/types/domain';

interface OpportunityRowProps {
  readonly id: string;
  readonly code: string;
  readonly beneficiaryName: string;
  readonly beneficiaryLocation: string;
  readonly projectName: string;
  readonly serviceName: string;
  readonly serviceVersion: number;
  readonly status: OpportunityStatus;
  readonly rail: RailModel;
  readonly base: Money;
  readonly basePolicyLabel: string;
  readonly basePolicyNote: string;
  readonly cashReceived: Money;
}

/** A board row: identity, status, where the base came from, and the rail. */
export function OpportunityRow({
  id,
  code,
  beneficiaryName,
  beneficiaryLocation,
  projectName,
  serviceName,
  serviceVersion,
  status,
  rail,
  base,
  basePolicyLabel,
  basePolicyNote,
  cashReceived,
}: OpportunityRowProps) {
  return (
    <article className="authority-record border-line bg-surface/40 flex flex-col gap-4 border p-4 sm:p-6">
      <div className="grid min-w-0 grid-cols-[4rem_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[4rem_minmax(0,1fr)_auto]">
        <ProjectCover projectId={projectName} size="thumbnail" />
        <div className="min-w-0">
          <h2 className="text-ink-strong truncate text-lg font-medium">
            <Link
              href={`/opportunities/${id}`}
              className="hover:text-ink inline-flex min-h-11 items-center underline-offset-4 hover:underline"
            >
              {beneficiaryName}
            </Link>
          </h2>
          <p className="text-faint text-sm">
            {code} · {beneficiaryLocation} · {projectName} · {serviceName} v{serviceVersion}
          </p>
        </div>
        <StatusPill status={status} className="col-start-2 justify-self-start sm:col-start-3 sm:row-start-1" />
      </div>

      <RailBaseExplainer
        base={base}
        policyLabel={basePolicyLabel}
        policyNote={basePolicyNote}
        cashReceived={cashReceived}
      />

      <RevenueRail model={rail} variant="row" />
    </article>
  );
}
