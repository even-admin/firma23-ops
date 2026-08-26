import { cn } from '@/lib/cn';

interface IdentityOrbProps {
  readonly memberId: string;
  readonly size?: 'compact' | 'card' | 'hero';
  readonly className?: string;
}

const VARIANT_CLASSES = [
  'identity-orb--0',
  'identity-orb--1',
  'identity-orb--2',
  'identity-orb--3',
  'identity-orb--4',
  'identity-orb--5',
] as const;

const SIZE_CLASSES: Record<NonNullable<IdentityOrbProps['size']>, string> = {
  compact: 'size-6',
  card: 'size-9',
  hero: 'size-13 sm:size-14',
};

/** Stable visual variety without assigning semantic meaning to colour. */
export function identityOrbVariant(memberId: string): number {
  let hash = 2_166_136_261;
  for (const character of memberId) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) % VARIANT_CLASSES.length;
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
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
    />
  );
}
