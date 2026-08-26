import type { ManualContractSetupInput } from '@/types/views';

/**
 * A stable representation shared by retries. JSON, rather than delimiter
 * concatenation, keeps distinct values such as ["a|b", "c"] from colliding
 * with ["a", "b|c"]. Assignment order is presentation-only, so it is sorted.
 */
export function canonicalManualContractSetupRequest(input: ManualContractSetupInput): string {
  return JSON.stringify({
    assignments: [...input.assignments]
      .map((assignment) => ({
        memberId: assignment.memberId,
        roleLabel: assignment.roleLabel.trim(),
        weightBp: assignment.weightBp,
      }))
      .sort(
        (left, right) =>
          left.memberId.localeCompare(right.memberId) ||
          left.roleLabel.localeCompare(right.roleLabel) ||
          left.weightBp - right.weightBp,
      ),
    clientName: input.clientName.trim(),
    contractName: input.contractName.trim(),
    currency: input.currency,
    firma23ShareBp: input.firma23ShareBp,
    orgScoped: true,
    projectedBaseCentavos: input.projectedBaseCentavos,
    serviceScope: input.serviceScope.trim(),
  });
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, '0')).join('');
}
