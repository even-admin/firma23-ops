import { describe, expect, it } from 'vitest';

import {
  BASIS_POINTS_TOTAL,
  addMoney,
  applyBasisPoints,
  basisPoints,
  centavos,
  compareMoney,
  formatBasisPoints,
  formatMoney,
  isNegativeMoney,
  isZeroMoney,
  money,
  MoneyError,
  moneyEquals,
  negateMoney,
  splitByWeights,
  subMoney,
  sumMoney,
  zeroMoney,
} from '@/lib/money';

describe('centavos', () => {
  it('rejects non-integers so a float can never become money', () => {
    expect(() => centavos(1.5)).toThrow(MoneyError);
    expect(() => centavos(897270.0000001)).toThrow(MoneyError);
  });

  it('rejects values beyond the safe integer range', () => {
    expect(() => centavos(Number.MAX_SAFE_INTEGER + 2)).toThrow(MoneyError);
  });

  it('accepts negative integers, which withholdings and payouts need', () => {
    expect(centavos(-10_776)).toBe(-10_776);
  });
});

describe('basisPoints', () => {
  it('accepts the full range', () => {
    expect(basisPoints(0)).toBe(0);
    expect(basisPoints(BASIS_POINTS_TOTAL)).toBe(BASIS_POINTS_TOTAL);
  });

  it('rejects out-of-range and fractional weights', () => {
    expect(() => basisPoints(-1)).toThrow(MoneyError);
    expect(() => basisPoints(10_001)).toThrow(MoneyError);
    expect(() => basisPoints(30.5)).toThrow(MoneyError);
  });
});

describe('arithmetic', () => {
  it('adds, subtracts and negates in integer units', () => {
    expect(addMoney(money(897_270), money(160_000)).amount).toBe(1_057_270);
    expect(subMoney(money(1_000_000), money(102_730)).amount).toBe(897_270);
    expect(negateMoney(money(269_181)).amount).toBe(-269_181);
  });

  it('reproduces the SETY invoice-to-deposit path exactly', () => {
    const invoice = money(1_000_000);
    const isr = money(-10_776);
    const vat = money(-91_954);
    expect(sumMoney([invoice, isr, vat]).amount).toBe(897_270);
  });

  it('sums an empty list to zero', () => {
    expect(sumMoney([]).amount).toBe(0);
    expect(isZeroMoney(zeroMoney())).toBe(true);
  });

  it('reports sign and equality', () => {
    expect(isNegativeMoney(money(-1))).toBe(true);
    expect(isNegativeMoney(money(0))).toBe(false);
    expect(moneyEquals(money(897_270), money(897_270))).toBe(true);
    expect(moneyEquals(money(897_270), money(897_271))).toBe(false);
    expect(compareMoney(money(2), money(1))).toBeGreaterThan(0);
  });
});

describe('applyBasisPoints', () => {
  it('computes the SETY shares exactly, because they divide evenly', () => {
    const base = money(897_270);
    expect(applyBasisPoints(base, basisPoints(3_000)).amount).toBe(269_181);
    expect(applyBasisPoints(base, basisPoints(2_000)).amount).toBe(179_454);
    expect(applyBasisPoints(base, basisPoints(5_000)).amount).toBe(448_635);
  });

  it('truncates toward zero and therefore does not guarantee a complete split', () => {
    const base = money(448_635);
    expect(applyBasisPoints(base, basisPoints(3_500)).amount).toBe(157_022);
  });

  it('refuses to overflow the safe integer range', () => {
    expect(() => applyBasisPoints(money(Number.MAX_SAFE_INTEGER - 1), basisPoints(10_000))).toThrow(
      MoneyError,
    );
  });
});

describe('splitByWeights', () => {
  it('splits the SETY base into house, closer and delivery with no remainder', () => {
    const parts = splitByWeights(money(897_270), [3_000, 2_000, 5_000].map(basisPoints));
    expect(parts.map((part) => part.amount)).toEqual([269_181, 179_454, 448_635]);
    expect(sumMoney(parts).amount).toBe(897_270);
  });

  it('distributes the leftover centavo by largest remainder', () => {
    // Naive rounding sums to 448,634 and quietly loses a centavo.
    const parts = splitByWeights(money(448_635), [4_000, 3_500, 2_500].map(basisPoints));
    expect(parts.map((part) => part.amount)).toEqual([179_454, 157_022, 112_159]);
    expect(sumMoney(parts).amount).toBe(448_635);
  });

  it('always reconstitutes the whole, across many awkward totals', () => {
    const weights = [3_333, 3_333, 3_334].map(basisPoints);
    for (let total = 0; total < 400; total += 1) {
      const parts = splitByWeights(money(total), weights);
      expect(sumMoney(parts).amount).toBe(total);
    }
  });

  it('breaks remainder ties by position, so the split is deterministic', () => {
    const parts = splitByWeights(money(1), [5_000, 5_000].map(basisPoints));
    expect(parts.map((part) => part.amount)).toEqual([1, 0]);
  });

  it('rejects weights that do not total 10,000 basis points', () => {
    expect(() => splitByWeights(money(100), [4_000, 3_500].map(basisPoints))).toThrow(
      /must total 10000 basis points/,
    );
  });

  it('rejects an empty weight list and negative totals', () => {
    expect(() => splitByWeights(money(100), [])).toThrow(MoneyError);
    expect(() => splitByWeights(money(-100), [basisPoints(10_000)])).toThrow(MoneyError);
  });

  it('refuses to overflow the safe integer range', () => {
    expect(() => splitByWeights(money(Number.MAX_SAFE_INTEGER - 1), [basisPoints(10_000)])).toThrow(
      MoneyError,
    );
  });

  it('rejects mixed currencies when summing', () => {
    const mxn = money(1);
    const fake = { amount: centavos(1), currency: 'USD' as unknown as 'MXN' };
    expect(() => addMoney(mxn, fake)).toThrow(/Currency mismatch/);
  });
});

describe('formatMoney', () => {
  it('formats the confirmed SETY figures', () => {
    expect(formatMoney(money(897_270))).toBe('$8,972.70');
    expect(formatMoney(money(269_181))).toBe('$2,691.81');
    expect(formatMoney(money(179_454))).toBe('$1,794.54');
    expect(formatMoney(money(448_635))).toBe('$4,486.35');
    expect(formatMoney(money(1_057_270))).toBe('$10,572.70');
  });

  it('pads minor units and handles zero and negatives', () => {
    expect(formatMoney(money(5))).toBe('$0.05');
    expect(formatMoney(money(100))).toBe('$1.00');
    expect(formatMoney(money(0))).toBe('$0.00');
    expect(formatMoney(money(-10_776))).toBe('-$107.76');
  });

  it('can append the currency code', () => {
    expect(formatMoney(money(897_270), { withCurrencyCode: true })).toBe('$8,972.70 MXN');
  });
});

describe('formatBasisPoints', () => {
  it('renders whole and fractional percentages', () => {
    expect(formatBasisPoints(basisPoints(3_000))).toBe('30%');
    expect(formatBasisPoints(basisPoints(10_000))).toBe('100%');
    expect(formatBasisPoints(basisPoints(3_550))).toBe('35.5%');
    expect(formatBasisPoints(basisPoints(3_505))).toBe('35.05%');
  });
});
