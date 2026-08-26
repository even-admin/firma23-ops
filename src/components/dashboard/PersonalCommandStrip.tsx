import { PersonalIdentityField } from '@/components/dashboard/PersonalIdentityField';
import { PerformanceInstrument } from '@/components/dashboard/PerformanceInstrument';
import type { HomePerformanceHistory, MemberMoney } from '@/types/views';

interface PersonalCommandStripProps {
  readonly displayName: string;
  readonly activeWorkCount: number;
  readonly money: MemberMoney;
  readonly performance: HomePerformanceHistory;
}

export function PersonalCommandStrip({
  displayName,
  activeWorkCount,
  money,
  performance,
}: PersonalCommandStripProps) {
  return (
    <header
      className="grid min-w-0 gap-4 lg:grid-cols-[minmax(17rem,0.35fr)_minmax(0,0.65fr)]"
      data-personal-command-strip
    >
      <PersonalIdentityField
        displayName={displayName}
        activeWorkCount={activeWorkCount}
      />
      <PerformanceInstrument performance={performance} recovery={money.recovery} />
    </header>
  );
}
