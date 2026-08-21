import { LoadingBlock } from '@/components/state/LoadingBlock';

export default function OpportunitiesLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <LoadingBlock rows={3} />
    </div>
  );
}
