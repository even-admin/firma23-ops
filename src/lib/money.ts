/**
 * Money primitives.
 *
 * Every amount in this application is an integer count of minor units (centavos).
 * Floating point never touches a monetary value, including during formatting.
 * All arithmetic lives in this module; nothing else is permitted to add, scale,
 * or split money by hand.
 */

declare const centavosBrand: unique symbol;
declare const basisPointsBrand: unique symbol;

/** An integer count of minor currency units. */
export type Centavos = number & { readonly [centavosBrand]: never };

/** A share expressed in basis points, where 10,000 equals 100 percent. */
export type BasisPoints = number & { readonly [basisPointsBrand]: never };

export type CurrencyCode = 'MXN';

export interface Money {
  readonly amount: Centavos;
  readonly currency: CurrencyCode;
}

export const BASIS_POINTS_TOTAL = 10_000;

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = { MXN: '$' };

const GROUP_FORMATTER = new Intl.NumberFormat('es-MX', {
  useGrouping: true,
  maximumFractionDigits: 0,
});

export class MoneyError extends Error {
  override readonly name = 'MoneyError';
}

export function centavos(value: number): Centavos {
  if (!Number.isInteger(value)) {
    throw new MoneyError(`Centavos must be an integer, received ${value}`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`Centavos exceeds safe integer range: ${value}`);
  }
  return value as Centavos;
}

export function basisPoints(value: number): BasisPoints {
  if (!Number.isInteger(value)) {
    throw new MoneyError(`Basis points must be an integer, received ${value}`);
  }
  if (value < 0 || value > BASIS_POINTS_TOTAL) {
    throw new MoneyError(
      `Basis points must fall within 0..${BASIS_POINTS_TOTAL}, received ${value}`,
    );
  }
  return value as BasisPoints;
}

export function money(amount: number, currency: CurrencyCode = 'MXN'): Money {
  return { amount: centavos(amount), currency };
}

export function zeroMoney(currency: CurrencyCode = 'MXN'): Money {
  return { amount: centavos(0), currency };
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError(`Currency mismatch: ${a.currency} and ${b.currency}`);
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: centavos(a.amount + b.amount), currency: a.currency };
}

export function subMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: centavos(a.amount - b.amount), currency: a.currency };
}

export function negateMoney(a: Money): Money {
  return { amount: centavos(-a.amount), currency: a.currency };
}

export function sumMoney(items: readonly Money[], currency: CurrencyCode = 'MXN'): Money {
  return items.reduce<Money>((acc, item) => addMoney(acc, item), zeroMoney(currency));
}

export function isZeroMoney(a: Money): boolean {
  return a.amount === 0;
}

export function isNegativeMoney(a: Money): boolean {
  return a.amount < 0;
}

export function moneyEquals(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.amount === b.amount;
}

export function compareMoney(a: Money, b: Money): number {
  assertSameCurrency(a, b);
  return a.amount - b.amount;
}

/**
 * Informational share of an amount, truncated toward zero.
 *
 * This is for displaying a single share in isolation. It does not guarantee that
 * a set of shares sums back to the original amount. Use splitByWeights whenever
 * the parts must reconstitute the whole.
 */
export function applyBasisPoints(base: Money, bp: BasisPoints): Money {
  const raw = base.amount * bp;
  if (!Number.isSafeInteger(raw)) {
    throw new MoneyError(`Basis point application overflows safe integer range: ${raw}`);
  }
  return { amount: centavos(Math.trunc(raw / BASIS_POINTS_TOTAL)), currency: base.currency };
}

/**
 * Split an amount across weights using the largest-remainder method.
 *
 * The returned parts always sum to exactly the input amount. Weights must total
 * 10,000 basis points; anything else is a data error, not something to round away.
 */
export function splitByWeights(total: Money, weights: readonly BasisPoints[]): Money[] {
  if (weights.length === 0) {
    throw new MoneyError('splitByWeights requires at least one weight');
  }
  if (total.amount < 0) {
    throw new MoneyError('splitByWeights requires a non-negative total');
  }

  const weightTotal = weights.reduce<number>((acc, weight) => acc + weight, 0);
  if (weightTotal !== BASIS_POINTS_TOTAL) {
    throw new MoneyError(
      `Weights must total ${BASIS_POINTS_TOTAL} basis points, received ${weightTotal}`,
    );
  }

  const scaled = weights.map((weight) => {
    const raw = total.amount * weight;
    if (!Number.isSafeInteger(raw)) {
      throw new MoneyError(`Weight application overflows safe integer range: ${raw}`);
    }
    return raw;
  });

  const parts = scaled.map((raw) => Math.floor(raw / BASIS_POINTS_TOTAL));
  const remainders = scaled.map((raw) => raw % BASIS_POINTS_TOTAL);
  const distributed = parts.reduce<number>((acc, part) => acc + part, 0);

  let leftover = total.amount - distributed;
  const byRemainderDesc = remainders
    .map((remainder, index) => ({ remainder, index }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  for (const { index } of byRemainderDesc) {
    if (leftover <= 0) break;
    parts[index] = (parts[index] ?? 0) + 1;
    leftover -= 1;
  }

  return parts.map((amount) => ({ amount: centavos(amount), currency: total.currency }));
}

export interface FormatMoneyOptions {
  readonly withCurrencyCode?: boolean;
}

/**
 * Format money for display without leaving integer arithmetic.
 *
 * Dividing by 100 to hand a float to Intl would be the obvious implementation and
 * the one place a rounding artifact could still appear, so major and minor units
 * are split and grouped separately.
 */
export function formatMoney(value: Money, options: FormatMoneyOptions = {}): string {
  const negative = value.amount < 0;
  const absolute = Math.abs(value.amount);
  const major = Math.trunc(absolute / 100);
  const minor = absolute % 100;
  const symbol = CURRENCY_SYMBOLS[value.currency];
  const body = `${symbol}${GROUP_FORMATTER.format(major)}.${String(minor).padStart(2, '0')}`;
  const signed = negative ? `-${body}` : body;
  return options.withCurrencyCode === true ? `${signed} ${value.currency}` : signed;
}

/** Render basis points as a percentage label, e.g. 3000 -> "30%", 3550 -> "35.5%". */
export function formatBasisPoints(bp: BasisPoints): string {
  const whole = Math.trunc(bp / 100);
  const fraction = bp % 100;
  if (fraction === 0) return `${whole}%`;
  const trimmed = String(fraction).padStart(2, '0').replace(/0$/, '');
  return `${whole}.${trimmed}%`;
}
