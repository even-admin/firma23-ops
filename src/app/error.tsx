'use client';

import { copy } from '@/copy/es-MX';

export default function RootError({ reset }: { readonly reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-start justify-center gap-4 px-6">
      <h1 className="text-ink-strong text-2xl font-medium">{copy.states.error}</h1>
      <button
        type="button"
        onClick={reset}
        className="border-line-strong text-ink hover:bg-raised ease-firma min-h-11 rounded-md border px-4 transition-colors duration-150"
      >
        Reintentar
      </button>
    </main>
  );
}
