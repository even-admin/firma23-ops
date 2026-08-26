'use client';

import { useId, useMemo, useState } from 'react';

import { Amount } from '@/components/money/Amount';
import { copy } from '@/copy/es-MX';
import { formatDate } from '@/lib/date';
import { formatMoney, money, type Money } from '@/lib/money';
import type {
  HomeCountPerformancePoint,
  HomeMoneyPerformancePoint,
  HomePerformanceHistory,
  HomePerformanceMetricKey,
  HomePerformanceSeries,
} from '@/types/views';

type PeriodKey = 'days30' | 'months3' | 'months6' | 'year' | 'all';
type ChartMode = 'balance' | 'events';
type PerformancePoint = HomeMoneyPerformancePoint | HomeCountPerformancePoint;

interface PerformanceInstrumentProps {
  readonly performance: HomePerformanceHistory;
  readonly recovery: Money;
}

interface MetricCopy {
  readonly label: string;
  readonly shortLabel: string;
  readonly definition: string;
}

interface PlottedPoint {
  readonly point: PerformancePoint;
  readonly x: number;
  readonly y: number;
  readonly barTop: number;
  readonly barHeight: number;
}

interface ChartGeometry {
  readonly path: string;
  readonly areaPath: string;
  readonly points: readonly PlottedPoint[];
  readonly visiblePoints: readonly PerformancePoint[];
  readonly hasAnyHistory: boolean;
  readonly hasPeriodEvents: boolean;
  readonly startLabel: string;
  readonly endLabel: string;
  readonly baseline: number;
  readonly maximum: number;
  readonly minimum: number;
  readonly average: number;
  readonly change: number;
}

const METRIC_ORDER: readonly HomePerformanceMetricKey[] = [
  'approved',
  'paid',
  'approved_unpaid',
  'projected',
  'closed',
];

const PERIOD_ORDER: readonly PeriodKey[] = ['days30', 'months3', 'months6', 'year', 'all'];

function metricCopy(key: HomePerformanceMetricKey): MetricCopy {
  if (key === 'approved') return copy.home.commandStrip.metrics.approved;
  if (key === 'paid') return copy.home.commandStrip.metrics.paid;
  if (key === 'approved_unpaid') return copy.home.commandStrip.metrics.approvedUnpaid;
  if (key === 'projected') return copy.home.commandStrip.metrics.projected;
  return copy.home.commandStrip.metrics.closed;
}

function periodLabel(key: PeriodKey): string {
  return copy.home.commandStrip.periods[key];
}

function toTimestamp(value: string): number {
  return new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value).getTime();
}

function periodStart(asOf: number, period: PeriodKey): number | null {
  if (period === 'all') return null;
  const start = new Date(asOf);
  if (period === 'days30') start.setUTCDate(start.getUTCDate() - 30);
  if (period === 'months3') start.setUTCMonth(start.getUTCMonth() - 3);
  if (period === 'months6') start.setUTCMonth(start.getUTCMonth() - 6);
  if (period === 'year') start.setUTCFullYear(start.getUTCFullYear() - 1);
  return start.getTime();
}

function pointValue(point: PerformancePoint): number {
  return typeof point.value === 'number' ? point.value : point.value.amount;
}

function pointDelta(point: PerformancePoint): number {
  return typeof point.delta === 'number' ? point.delta : point.delta.amount;
}

function pointValueLabel(point: PerformancePoint): string {
  return typeof point.value === 'number' ? String(point.value) : formatMoney(point.value);
}

function shortDate(value: number): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function chartGeometry(
  allPoints: readonly PerformancePoint[],
  asOfValue: string,
  period: PeriodKey,
): ChartGeometry {
  const asOf = toTimestamp(asOfValue);
  const cutoff = periodStart(asOf, period);
  const before = cutoff === null ? [] : allPoints.filter((point) => toTimestamp(point.occurredAt) < cutoff);
  const baseline = before.at(-1) === undefined ? 0 : pointValue(before.at(-1) as PerformancePoint);
  const visiblePoints = allPoints.filter((point) => {
    const occurredAt = toTimestamp(point.occurredAt);
    return (cutoff === null || occurredAt >= cutoff) && occurredAt <= asOf;
  });

  const firstEventTime = visiblePoints[0] === undefined ? cutoff ?? asOf : toTimestamp(visiblePoints[0].occurredAt);
  const lastEventTime = visiblePoints.at(-1) === undefined ? asOf : toTimestamp(visiblePoints.at(-1)?.occurredAt ?? asOfValue);
  const naturalSpan = Math.max(86_400_000, lastEventTime - firstEventTime);
  const start = cutoff ?? firstEventTime - Math.max(86_400_000, naturalSpan * 0.12);
  const end = Math.max(lastEventTime, start + 86_400_000);

  const balanceValues = [baseline, ...visiblePoints.map(pointValue)];
  const deltas = visiblePoints.map(pointDelta);
  const chartValues = [...balanceValues, 0, ...deltas];
  const rawMinimum = Math.min(...chartValues);
  const rawMaximum = Math.max(...chartValues);
  const spread = Math.max(1, rawMaximum - rawMinimum);
  const padding = Math.max(1, spread * 0.12);
  const scaleMinimum = rawMinimum - padding;
  const scaleMaximum = rawMaximum + padding;
  const scaleSpread = scaleMaximum - scaleMinimum;
  const yFor = (value: number) => 8 + (1 - (value - scaleMinimum) / scaleSpread) * 78;
  const xFor = (value: number) => {
    if (visiblePoints.length === 1) return 88;
    return 8 + ((value - firstEventTime) / Math.max(1, lastEventTime - firstEventTime)) * 84;
  };
  const zeroY = yFor(0);

  const plotted = visiblePoints.map((point) => {
    const x = Math.max(8, Math.min(92, xFor(toTimestamp(point.occurredAt))));
    const y = yFor(pointValue(point));
    const deltaY = yFor(pointDelta(point));
    return {
      point,
      x,
      y,
      barTop: Math.min(zeroY, deltaY),
      barHeight: Math.max(2, Math.abs(deltaY - zeroY)),
    };
  });

  const openingX = visiblePoints.length === 1 ? 12 : 4;
  const openingY = yFor(baseline);
  let previousX = openingX;
  let previousY = openingY;
  let path = `M ${openingX} ${openingY.toFixed(2)}`;
  for (const entry of plotted) {
    const middleX = previousX + (entry.x - previousX) / 2;
    path += ` C ${middleX.toFixed(2)} ${previousY.toFixed(2)}, ${middleX.toFixed(2)} ${entry.y.toFixed(2)}, ${entry.x.toFixed(2)} ${entry.y.toFixed(2)}`;
    previousX = entry.x;
    previousY = entry.y;
  }
  const areaPath = `${path} L ${previousX.toFixed(2)} 94 L ${openingX} 94 Z`;
  const current = visiblePoints.at(-1) === undefined ? baseline : pointValue(visiblePoints.at(-1) as PerformancePoint);
  const values = visiblePoints.map(pointValue);

  return {
    path,
    areaPath,
    points: plotted,
    visiblePoints,
    hasAnyHistory: allPoints.length > 0,
    hasPeriodEvents: visiblePoints.length > 0,
    startLabel: shortDate(start),
    endLabel: shortDate(end),
    baseline,
    maximum: values.length === 0 ? baseline : Math.max(...values),
    minimum: values.length === 0 ? baseline : Math.min(...values),
    average: values.length === 0 ? baseline : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
    change: current - baseline,
  };
}

function SeriesValue({ series, className }: { readonly series: HomePerformanceSeries; readonly className?: string }) {
  if (series.kind === 'count') return <span className={className}>{series.current}</span>;
  return className === undefined ? (
    <Amount value={series.current} />
  ) : (
    <Amount value={series.current} className={className} />
  );
}

function PointValue({ point }: { readonly point: PerformancePoint }) {
  if (typeof point.value === 'number') return <span className="tnum">{point.value}</span>;
  return <Amount value={point.value} />;
}

function SummaryValue({ series, value }: { readonly series: HomePerformanceSeries; readonly value: number }) {
  if (series.kind === 'count') return <span className="tnum">{value}</span>;
  return <Amount value={money(value, series.current.currency)} />;
}

function ChartModeIcon({ mode }: { readonly mode: ChartMode }) {
  if (mode === 'events') {
    return (
      <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
        <path d="M4 15V9M8 15V5M12 15v-3M16 15V7" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2.5 15.5h15" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
      <path d="m3 14 4-5 3 2 6-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 15.5h15" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function SelectChevron() {
  return (
    <svg viewBox="0 0 16 16" className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2" aria-hidden="true">
      <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PerformanceInstrument({ performance, recovery }: PerformanceInstrumentProps) {
  const [metricKey, setMetricKey] = useState<HomePerformanceMetricKey>('approved');
  const [period, setPeriod] = useState<PeriodKey>('months6');
  const [chartMode, setChartMode] = useState<ChartMode>('balance');
  const [activePointId, setActivePointId] = useState<string | null>(null);
  const titleId = useId();
  const definitionId = useId();
  const chartId = useId().replace(/:/g, '');
  const series = performance.series.find((entry) => entry.key === metricKey) ?? performance.series[0];
  const geometry = useMemo(
    () => chartGeometry(series?.points ?? [], performance.asOf, period),
    [series, performance.asOf, period],
  );

  if (series === undefined) return null;

  const labels = metricCopy(series.key);
  const selectedPoint = geometry.visiblePoints.find((point) => point.id === activePointId) ?? geometry.visiblePoints.at(-1) ?? null;
  const projection = series.key === 'projected';
  const confirmedMoney = series.kind === 'money' && (series.key === 'approved' || series.key === 'paid' || series.key === 'approved_unpaid');
  const unavailable = series.historyAvailability === 'unavailable';
  const canUseEventBars = geometry.visiblePoints.length >= 2;
  const effectiveChartMode = chartMode === 'events' && !canUseEventBars ? 'balance' : chartMode;
  const chartTone = confirmedMoney ? 'var(--color-money)' : 'var(--color-ink-strong)';

  return (
    <section
      className="border-line/60 bg-surface relative flex min-w-0 flex-col overflow-hidden rounded-[28px] border"
      aria-labelledby={titleId}
      aria-describedby={definitionId}
      data-performance-instrument
      data-mobile-nav-clearance
      data-selected-metric={series.key}
      data-chart-mode={effectiveChartMode}
      data-projected-metric={projection ? '' : undefined}
    >
      {!unavailable && geometry.hasPeriodEvents ? (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-0 hidden md:block"
          style={{
            width: '62%',
            background: `linear-gradient(to left, color-mix(in srgb, ${chartTone} 11%, transparent), transparent 75%)`,
          }}
          aria-hidden="true"
        >
          <svg
            className={confirmedMoney ? 'size-full text-money/15' : 'size-full text-ink/10'}
            style={{
              WebkitMaskImage: 'linear-gradient(to right, transparent, black 55%)',
              maskImage: 'linear-gradient(to right, transparent, black 55%)',
            }}
          >
            <defs>
              <pattern id={`dots-${chartId}`} width="14" height="14" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#dots-${chartId})`} />
          </svg>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-7 sm:pt-6">
          <label className="relative min-w-0">
            <span className="sr-only">{copy.home.commandStrip.metricLabel}</span>
            <select
              aria-label={copy.home.commandStrip.metricLabel}
              value={metricKey}
              onChange={(event) => {
                setMetricKey(event.target.value as HomePerformanceMetricKey);
                setActivePointId(null);
              }}
              className="text-ink-strong min-h-11 max-w-full appearance-none border-0 bg-transparent py-2 pr-8 pl-0 text-[17px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {METRIC_ORDER.map((key) => (
                <option key={key} value={key}>{metricCopy(key).label}</option>
              ))}
            </select>
            <SelectChevron />
          </label>

          <div className="flex items-center gap-2">
            <div className="border-line/70 bg-surface flex rounded-lg border p-0.5" role="group" aria-label={copy.home.commandStrip.chartModeLabel}>
              {(['balance', 'events'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-label={mode === 'balance' ? copy.home.commandStrip.balanceMode : copy.home.commandStrip.eventsMode}
                  aria-pressed={effectiveChartMode === mode}
                  disabled={mode === 'events' && !canUseEventBars}
                  onClick={() => setChartMode(mode)}
                  className={`ease-firma relative flex size-11 items-center justify-center rounded-md transition-colors duration-150 before:absolute before:inset-2 before:rounded-md ${effectiveChartMode === mode ? 'text-ink-strong before:bg-raised/80' : 'text-faint hover:text-ink disabled:cursor-not-allowed disabled:opacity-35'}`}
                >
                  <span className="relative z-10"><ChartModeIcon mode={mode} /></span>
                </button>
              ))}
            </div>

            <label className="relative">
              <span className="sr-only">{copy.home.commandStrip.periodLabel}</span>
              <select
                aria-label={copy.home.commandStrip.periodLabel}
                value={period}
                onChange={(event) => {
                  setPeriod(event.target.value as PeriodKey);
                  setActivePointId(null);
                }}
                className="text-muted min-h-11 appearance-none border-0 bg-transparent py-2 pr-7 pl-1 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {PERIOD_ORDER.map((key) => (
                  <option key={key} value={key}>{periodLabel(key)}</option>
                ))}
              </select>
              <SelectChevron />
            </label>
          </div>
      </div>

      <div className="grid min-h-72 md:grid-cols-[minmax(12rem,0.34fr)_minmax(0,0.66fr)]">
        <div className="flex flex-col justify-between px-5 pt-7 pb-6 sm:px-7 md:pt-9">
          <div>
            <p className="text-faint font-mono text-xs">{copy.home.commandStrip.currentValue}</p>
            <h2 id={titleId} className="sr-only">{labels.label}</h2>
            <p className={`tnum mt-2 text-5xl leading-none font-medium sm:text-6xl md:text-[3.5rem] ${confirmedMoney ? 'text-money' : projection ? 'text-muted' : 'text-ink-strong'}`}>
              <SeriesValue series={series} />
            </p>
          </div>
          <p id={definitionId} className="text-faint mt-6 max-w-56 text-xs leading-5">{labels.definition}</p>
        </div>

        <div className="relative min-h-64 overflow-hidden md:min-h-72">

        {unavailable ? (
          <div className="bg-raised/25 relative flex h-full items-center justify-center rounded-tl-[var(--radius-object)] px-6 text-center">
            <p className="text-faint max-w-sm text-xs leading-5">{copy.home.commandStrip.historyUnavailable}</p>
          </div>
        ) : geometry.hasPeriodEvents ? (
          <>
            <svg
              className={`absolute inset-0 size-full ${confirmedMoney ? 'text-money' : 'text-ink-strong'}`}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              role="img"
              aria-label={`${copy.home.commandStrip.chartLabel}: ${labels.label}`}
            >
              <defs>
                <linearGradient id={`area-${chartId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
                  <stop offset="55%" stopColor="currentColor" stopOpacity="0.07" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
                <linearGradient id={`bar-${chartId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0.32" />
                </linearGradient>
              </defs>
              {effectiveChartMode === 'balance' ? (
                <>
                  <path key={`area:${series.key}:${period}`} className="instrument-area" d={geometry.areaPath} fill={`url(#area-${chartId})`} />
                  <path key={`line:${series.key}:${period}`} className="instrument-line" d={geometry.path} pathLength="1" fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                </>
              ) : (
                geometry.points.map(({ point, x, barTop, barHeight }) => (
                  <rect
                    key={`bar:${point.id}`}
                    x={Math.max(0, x - Math.min(2.25, 22 / Math.max(1, geometry.points.length)))}
                    y={barTop}
                    width={Math.min(4.5, 44 / Math.max(1, geometry.points.length))}
                    height={barHeight}
                    rx="1.4"
                    fill={`url(#bar-${chartId})`}
                    opacity={pointDelta(point) < 0 ? 0.45 : 0.9}
                  />
                ))
              )}
            </svg>

            {geometry.points.map(({ point, x, y, barTop }) => (
              <button
                key={point.id}
                type="button"
                className="group absolute z-10 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
                style={{ left: `${x}%`, top: `${effectiveChartMode === 'balance' ? y : barTop}%` }}
                onMouseEnter={() => setActivePointId(point.id)}
                onFocus={() => setActivePointId(point.id)}
                aria-label={`${formatDate(point.occurredAt)}, ${pointValueLabel(point)}, ${point.sourceLabel}`}
              >
                <span className={`block size-2.5 rounded-full border-2 bg-surface group-hover:scale-125 group-focus-visible:scale-125 ${point.state === 'verified' ? 'border-ink-strong' : 'border-attention'}`} aria-hidden="true" />
              </button>
            ))}

            <div className="text-faint absolute inset-x-4 bottom-3 flex justify-between font-mono text-[0.6875rem]" aria-hidden="true">
              <span>{geometry.startLabel}</span>
              <span>{geometry.endLabel}</span>
            </div>

            {selectedPoint === null ? null : (
              <div className="bg-surface/90 absolute top-3 right-3 max-w-[13rem] rounded-[var(--radius-control)] px-3 py-2" aria-live="polite" data-event-readout>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-faint font-mono text-[0.6875rem]">{formatDate(selectedPoint.occurredAt)}</p>
                  <p className="text-ink-strong text-xs font-medium"><PointValue point={selectedPoint} /></p>
                </div>
                <p className="text-ink mt-1 truncate text-[0.6875rem]">{selectedPoint.sourceLabel}</p>
              </div>
            )}
          </>
        ) : (
          <div className="bg-raised/25 relative flex h-full items-center justify-center rounded-tl-[var(--radius-object)] px-6 text-center">
            <p className="text-faint text-xs">{geometry.hasAnyHistory ? copy.home.commandStrip.noPeriodEvents : copy.home.commandStrip.noHistory}</p>
          </div>
        )}
        </div>
      </div>

      {unavailable || !geometry.hasPeriodEvents ? null : (
        <dl className="border-line/60 flex flex-wrap items-center gap-x-5 gap-y-2 border-t px-5 py-4 sm:px-7">
          <div>
            <dt className="sr-only">{copy.home.commandStrip.periodChange}</dt>
            <dd className="text-ink-strong text-xs font-medium"><SummaryValue series={series} value={geometry.change} /> <span className="text-faint font-normal">{copy.home.commandStrip.periodChange.toLowerCase()}</span></dd>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
            <div>
              <dt className="sr-only">{copy.home.commandStrip.periodPeak}</dt>
              <dd className="text-ink-strong text-[0.6875rem]"><SummaryValue series={series} value={geometry.maximum} /> <span className="text-faint">{copy.home.commandStrip.periodPeak.toLowerCase()}</span></dd>
            </div>
            <span className="text-line-strong" aria-hidden="true">·</span>
            <div>
              <dt className="sr-only">{copy.home.commandStrip.periodLow}</dt>
              <dd className="text-ink-strong text-[0.6875rem]"><SummaryValue series={series} value={geometry.minimum} /> <span className="text-faint">{copy.home.commandStrip.periodLow.toLowerCase()}</span></dd>
            </div>
            <span className="text-line-strong" aria-hidden="true">·</span>
            <div>
              <dt className="sr-only">{copy.home.commandStrip.periodAverage}</dt>
              <dd className="text-ink-strong text-[0.6875rem]"><SummaryValue series={series} value={geometry.average} /> <span className="text-faint">{copy.home.commandStrip.periodAverage.toLowerCase()}</span></dd>
            </div>
          </div>
        </dl>
      )}

      {recovery.amount === 0 ? null : (
        <div className="border-attention/30 bg-attention/5 mx-5 mb-4 flex items-center justify-between gap-4 rounded-[var(--radius-control)] border px-4 py-3 sm:mx-7">
          <p className="text-attention text-xs">{copy.home.commandStrip.recovery}</p>
          <Amount value={recovery} className="text-ink-strong text-sm font-medium" />
        </div>
      )}
    </section>
  );
}
