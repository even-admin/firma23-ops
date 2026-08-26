import { describe, expect, it } from 'vitest';

import { canonicalManualContractSetupRequest } from '@/lib/manual-contract-request';
import { basisPoints } from '@/lib/money';

const base = {
  clientName: 'A|B',
  contractName: 'Contrato',
  serviceScope: 'Scope',
  projectedBaseCentavos: 100,
  currency: 'MXN' as const,
  firma23ShareBp: basisPoints(3000),
  idempotencyKey: 'ignored',
};

describe('manual contract request canonicalization', () => {
  it('keeps delimiter-bearing values structurally distinct', () => {
    const left = canonicalManualContractSetupRequest({
      ...base,
      assignments: [{ memberId: 'a|b', roleLabel: 'c', weightBp: basisPoints(10_000) }],
    });
    const right = canonicalManualContractSetupRequest({
      ...base,
      assignments: [{ memberId: 'a', roleLabel: 'b|c', weightBp: basisPoints(10_000) }],
    });
    expect(left).not.toBe(right);
  });

  it('normalizes presentation-only assignment ordering and whitespace', () => {
    const left = canonicalManualContractSetupRequest({
      ...base,
      assignments: [
        { memberId: 'b', roleLabel: ' Diseño ', weightBp: basisPoints(5000) },
        { memberId: 'a', roleLabel: 'Cierre', weightBp: basisPoints(5000) },
      ],
    });
    const right = canonicalManualContractSetupRequest({
      ...base,
      assignments: [
        { memberId: 'a', roleLabel: 'Cierre', weightBp: basisPoints(5000) },
        { memberId: 'b', roleLabel: 'Diseño', weightBp: basisPoints(5000) },
      ],
    });
    expect(left).toBe(right);
  });
});
