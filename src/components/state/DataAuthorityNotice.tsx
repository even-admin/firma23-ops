import { copy } from '@/copy/es-MX';

interface DataAuthorityNoticeProps {
  readonly configured: boolean;
  readonly canonical?: boolean;
}

export function DataAuthorityNotice({ configured, canonical = false }: DataAuthorityNoticeProps) {
  return (
    <p
      role="status"
      data-data-authority={canonical ? 'configured-canonical' : configured ? 'configured-synthetic' : 'synthetic'}
      className="border-attention/40 bg-surface text-muted mx-4 mt-4 rounded-md border px-4 py-3 text-xs sm:mx-8 lg:mx-10"
    >
      {canonical
        ? copy.app.configuredCanonicalAuthority
        : configured
          ? copy.app.configuredSyntheticAuthority
          : copy.app.syntheticAuthority}
    </p>
  );
}
