const DATE_FORMATTER = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Formats date-only and ISO timestamps consistently without local timezone drift. */
export function formatDate(value: string): string {
  const date = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return DATE_FORMATTER.format(date);
}
