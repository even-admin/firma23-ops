import { notFound } from 'next/navigation';

import { AssignmentList } from '@/components/opportunity/AssignmentList';
import { StatusPill } from '@/components/opportunity/StatusPill';
import { Amount } from '@/components/money/Amount';
import { AvailabilityBadge } from '@/components/operator/AvailabilityBadge';
import { AssignmentRow } from '@/components/operator/AssignmentRow';
import { SkillChips } from '@/components/operator/SkillChips';
import { StatGrid } from '@/components/operator/StatGrid';
import { RailStateBadge } from '@/components/revenue-rail/RailStateBadge';
import { RevenueRail, type RevenueRailVariant } from '@/components/revenue-rail/RevenueRail';
import { EmptyState } from '@/components/state/EmptyState';
import { ErrorState } from '@/components/state/ErrorState';
import { LoadingBlock } from '@/components/state/LoadingBlock';
import { PermissionDenied } from '@/components/state/PermissionDenied';
import { PROTOTYPE_FOUNDER } from '@/data/prototype-viewers';
import { syntheticSettlementRepository } from '@/data/repositories/synthetic/settlements';
import { basisPoints, money } from '@/lib/money';
import type { Availability, MilestoneStatus, OpportunityStatus } from '@/types/domain';
import type { MemberStats, SkillView } from '@/types/views';

/**
 * State gallery.
 *
 * Every data component in every state, on one page, so a reviewer never has to
 * contrive data to see an empty, error, disabled, or loading state.
 *
 * Development only. Returns 404 in a production build.
 */
export default async function StateGalleryPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const cards = await syntheticSettlementRepository.listOpportunityRails(PROTOTYPE_FOUNDER);
  const projected = cards.find((card) => card.rail.kind === 'projection');
  const settled = cards.find((card) => card.rail.kind === 'settlement');

  const statuses: readonly OpportunityStatus[] = [
    'draft',
    'assigned',
    'in_delivery',
    'delivered',
    'settled_approved',
    'paid',
    'cancelled',
  ];
  const availabilities: readonly Availability[] = ['open', 'limited', 'unavailable'];
  const variants: readonly RevenueRailVariant[] = [
    'row',
    'detail',
    'dashboard',
    'approval',
    'provenance',
  ];
  const milestoneStatuses: readonly MilestoneStatus[] = [
    'pending',
    'in_progress',
    'done',
    'blocked',
  ];

  const skills: readonly SkillView[] = [
    {
      id: '1',
      name: 'Cierre comercial',
      family: 'Comercial',
      level: 'lead',
      verification: 'verified',
    },
    {
      id: '2',
      name: 'Diseño gráfico',
      family: 'Diseño',
      level: 'strong',
      verification: 'verified',
    },
    {
      id: '3',
      name: 'Frontend',
      family: 'Producto',
      level: 'learning',
      verification: 'self_reported',
    },
  ];
  const stats: MemberStats = {
    closed: 3,
    delivered: 7,
    onTime: 6,
    late: 1,
    revisionsRequested: 1,
    acceptedFirstPass: 5,
    onTimeRateBp: basisPoints(8_571),
    acceptanceRateBp: basisPoints(8_333),
  };
  const emptyStats: MemberStats = {
    closed: 0,
    delivered: 0,
    onTime: 0,
    late: 0,
    revisionsRequested: 0,
    acceptedFirstPass: 0,
    onTimeRateBp: null,
    acceptanceRateBp: null,
  };

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-12 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-1">
        <p className="label-micro text-faint">Solo desarrollo</p>
        <h1 className="text-ink-strong text-2xl font-medium tracking-tight">Galería de estados</h1>
        <p className="text-muted text-sm">
          Cada componente de datos en cada estado. Esta ruta responde 404 en producción.
        </p>
      </header>

      <Section title="Dinero">
        <div className="flex flex-wrap items-baseline gap-6">
          <Amount value={money(0)} className="text-ink text-lg" />
          <Amount value={money(5)} className="text-ink text-lg" />
          <Amount value={money(897_270)} className="text-money text-lg" />
          <Amount value={money(-10_776)} className="text-muted text-lg" />
          <Amount value={money(1_057_270)} className="text-ink text-lg" withCurrencyCode />
        </div>
      </Section>

      <Section title="Estados de dinero">
        <div className="flex flex-wrap gap-3">
          <RailStateBadge state="projected" />
          <RailStateBadge state="approved" />
          <RailStateBadge state="paid" />
        </div>
      </Section>

      <Section title="Estados de oportunidad">
        <div className="flex flex-wrap gap-2">
          {statuses.map((status) => (
            <StatusPill key={status} status={status} />
          ))}
        </div>
      </Section>

      <Section title="Disponibilidad">
        <div className="flex flex-wrap gap-2">
          {availabilities.map((availability) => (
            <AvailabilityBadge key={availability} availability={availability} />
          ))}
        </div>
      </Section>

      <Section title="Estados de hito">
        <ul className="flex flex-wrap gap-2">
          {milestoneStatuses.map((status) => (
            <li
              key={status}
              className="label-micro border-line text-muted rounded-sm border px-2 py-0.5"
            >
              {status}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Carga, vacío, error y permisos">
        <div className="flex flex-col gap-4">
          <LoadingBlock rows={2} />
          <EmptyState
            title="Sin registros todavía"
            detail="Cuando exista trabajo, aparecerá aquí."
          />
          <ErrorState detail="La consulta falló." />
          <PermissionDenied detail="Selector de prototipo. No otorga permisos." />
        </div>
      </Section>

      <Section title="Pesos de asignación, completos e incompletos">
        <div className="flex flex-col gap-6">
          <AssignmentList
            assignments={[
              {
                id: 'a1',
                memberId: 'm1',
                memberSlug: 'a',
                displayName: 'Emiliano Pasos',
                initials: 'EP',
                roleKey: 'delivery',
                roleLabel: 'Producción audiovisual',
                weightBp: basisPoints(6_000),
                status: 'approved',
              },
              {
                id: 'a2',
                memberId: 'm2',
                memberSlug: 'b',
                displayName: 'Pablo Heisenberg',
                initials: 'PH',
                roleKey: 'delivery',
                roleLabel: 'Diseño gráfico',
                weightBp: basisPoints(4_000),
                status: 'approved',
              },
            ]}
            deliveryWeightTotalBp={10_000}
          />
          <AssignmentList
            assignments={[
              {
                id: 'a3',
                memberId: 'm1',
                memberSlug: 'a',
                displayName: 'Emiliano Pasos',
                initials: 'EP',
                roleKey: 'delivery',
                roleLabel: 'Producción audiovisual',
                weightBp: basisPoints(6_000),
                status: 'proposed',
              },
            ]}
            deliveryWeightTotalBp={6_000}
          />
        </div>
      </Section>

      <Section title="Habilidades y desempeño">
        <div className="flex flex-col gap-4">
          <SkillChips skills={skills} />
          <SkillChips skills={skills} limit={2} />
          <StatGrid stats={stats} />
          <StatGrid stats={emptyStats} />
        </div>
      </Section>

      <Section title="Filas de asignación">
        <ul className="flex flex-col gap-2">
          <AssignmentRow
            assignment={{
              opportunityId: 'o1',
              code: 'SETY-0142',
              beneficiaryName: 'Tortillería La Ceiba',
              beneficiaryLocation: 'Mérida, Yucatán',
              projectName: 'SETY 2026',
              serviceName: 'Kit de contenido social',
              roleLabel: 'Cierre',
              status: 'in_delivery',
              active: true,
              money: { kind: 'projected', amount: money(179_454) },
            }}
          />
          <AssignmentRow
            assignment={{
              opportunityId: 'o2',
              code: 'SETY-0137',
              beneficiaryName: 'Refaccionaria Maya Norte',
              beneficiaryLocation: 'Progreso, Yucatán',
              projectName: 'SETY 2026',
              serviceName: 'Kit de contenido social',
              roleLabel: 'Producción audiovisual',
              status: 'settled_approved',
              active: false,
              money: { kind: 'approved', amount: money(179_454), payoutStatus: 'unpaid' },
            }}
          />
          <AssignmentRow
            assignment={{
              opportunityId: 'o3',
              code: 'AIOPS-0007',
              beneficiaryName: 'Grupo Industrial Peninsular',
              beneficiaryLocation: 'Umán, Yucatán',
              projectName: 'AI Ops Retainer',
              serviceName: 'Implementación de agentes',
              roleLabel: 'Ingeniería de agentes',
              status: 'paid',
              active: false,
              money: { kind: 'approved', amount: money(750_000), payoutStatus: 'paid' },
            }}
          />
        </ul>
      </Section>

      {variants.map((variant) => (
        <Section key={variant} title={`Riel de Ingresos · ${variant}`}>
          <div className="flex flex-col gap-6">
            {projected === undefined ? null : (
              <RevenueRail model={projected.rail} variant={variant} />
            )}
            {settled === undefined ? null : <RevenueRail model={settled.rail} variant={variant} />}
          </div>
        </Section>
      ))}
    </main>
  );
}

function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="label-micro text-faint border-line border-b pb-2">{title}</h2>
      {children}
    </section>
  );
}
