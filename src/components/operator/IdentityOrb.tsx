import { MeshDriftCanvas } from '@/components/visual/MeshDriftCanvas';
import {
  MESH_DRIFT_PALETTE_COUNT,
  type MeshDriftPalette,
} from '@/components/visual/mesh-drift-config';
import { cn } from '@/lib/cn';

interface IdentityOrbProps {
  readonly memberId: string;
  readonly size?: 'compact' | 'card' | 'hero';
  readonly className?: string;
}

const SIZE_CLASSES: Record<NonNullable<IdentityOrbProps['size']>, string> = {
  compact: 'size-6',
  card: 'size-9',
  hero: 'size-13 sm:size-14',
};

/** Stable visual variety without assigning semantic meaning to colour. */
export function identityOrbVariant(memberId: string): MeshDriftPalette {
  let hash = 2_166_136_261;
  for (const character of memberId) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return ((hash >>> 0) % MESH_DRIFT_PALETTE_COUNT) as MeshDriftPalette;
}

/** Decorative member identity artwork. Names and statuses remain textual. */
export function IdentityOrb({ memberId, size = 'card', className }: IdentityOrbProps) {
  const variant = identityOrbVariant(memberId);

  return (
    <span
      aria-hidden="true"
      data-identity-orb
      data-orb-variant={variant}
      className={cn(
        'identity-orb shrink-0 rounded-full',
        SIZE_CLASSES[size],
        className,
      )}
    >
      <MeshDriftCanvas palette={variant} />
    </span>
  );
}
