import { Amount } from '@/components/money/Amount';
import { copy } from '@/copy/es-MX';
import type { Money } from '@/lib/money';

interface RailBaseExplainerProps {
  readonly base: Money;
  readonly policyLabel: string;
  readonly policyNote: string;
  readonly cashReceived: Money;
}

/**
 * Explains where the distributable base came from.
 *
 * Cash received and distributable base are different numbers, and the difference is
 * the single most misreadable thing in this product, so it is stated in words on
 * every surface that shows a rail.
 */
export function RailBaseExplainer({
  base,
  policyLabel,
  policyNote,
  cashReceived,
}: RailBaseExplainerProps) {
  return (
    <div className="border-line bg-surface rounded-md border p-4">
      <dl className="flex flex-wrap gap-x-8 gap-y-3">
        <div>
          <dt className="label-micro text-faint">{copy.money.base}</dt>
          <dd className="text-ink-strong mt-1 text-xl font-medium">
            <Amount value={base} />
          </dd>
        </div>
        <div>
          <dt className="label-micro text-faint">{copy.money.cashReceived}</dt>
          <dd className="text-muted mt-1 text-xl font-medium">
            <Amount value={cashReceived} />
          </dd>
        </div>
      </dl>
      <p className="text-muted mt-3 text-sm">
        <span className="text-ink">{policyLabel}.</span> {policyNote}
      </p>
    </div>
  );
}
