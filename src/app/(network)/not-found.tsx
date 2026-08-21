import Link from 'next/link';

import { copy } from '@/copy/es-MX';

export default function NetworkNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col items-start gap-4 px-4 py-16 sm:px-6">
      <h1 className="text-ink-strong text-2xl font-medium tracking-tight">
        {copy.states.notFound}
      </h1>
      <p className="text-muted text-sm">{copy.states.notFoundDetail}</p>
      <Link
        href="/"
        className="border-line-strong text-ink hover:bg-raised ease-firma flex min-h-11 items-center rounded-md border px-4 text-sm transition-colors duration-150"
      >
        {copy.nav.home}
      </Link>
    </div>
  );
}
