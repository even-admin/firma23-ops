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
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-8 lg:px-10">
      <ErrorState detail={error.message} onRetry={reset} />
    </div>
  );
}
