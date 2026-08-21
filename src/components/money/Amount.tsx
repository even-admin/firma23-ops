import { cn } from '@/lib/cn';
import { formatMoney, type Money } from '@/lib/money';

interface AmountProps {
  readonly value: Money;
  readonly className?: string;
  readonly withCurrencyCode?: boolean;
}

/**
 * The only way money reaches the DOM.
 *
 * Tabular numerals keep columns of amounts aligned, and the machine-readable value
 * stays in minor units so nothing downstream has to re-parse a formatted string.
 */
export function Amount({ value, className, withCurrencyCode = false }: AmountProps) {
  return (
    <data className={cn('tnum', className)} value={String(value.amount)}>
      {formatMoney(value, { withCurrencyCode })}
    </data>
  );
}
