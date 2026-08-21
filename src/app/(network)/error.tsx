'use client';

import { ErrorState } from '@/components/state/ErrorState';

export default function NetworkError({
  error,
  reset,
}: {
  readonly error: Error;
  readonly reset: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <ErrorState detail={error.message} onRetry={reset} />
    </div>
  );
}
