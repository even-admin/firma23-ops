import Link from 'next/link';

import { RailBaseExplainer } from '@/components/revenue-rail/RailBaseExplainer';
import { RevenueRail } from '@/components/revenue-rail/RevenueRail';
import { StatusPill } from '@/components/opportunity/StatusPill';
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
    <article className="border-line bg-surface/40 flex flex-col gap-4 rounded-lg border p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-ink-strong truncate text-lg font-medium">
            <Link
              href={`/opportunities/${id}`}
              className="hover:text-ink underline-offset-4 hover:underline"
            >
              {beneficiaryName}
            </Link>
          </h2>
          <p className="text-faint text-sm">
            {code} · {beneficiaryLocation} · {projectName} · {serviceName} v{serviceVersion}
          </p>
        </div>
        <StatusPill status={status} />
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
