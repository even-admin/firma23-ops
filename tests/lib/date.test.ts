import { describe, expect, it } from 'vitest';

import { formatDate } from '@/lib/date';

describe('formatDate', () => {
  it('formats date-only and timestamp values consistently in Spanish', () => {
    expect(formatDate('2026-08-25')).toMatch(/25.*ago.*2026/i);
    expect(formatDate('2026-08-25T23:30:00.000Z')).toMatch(/25.*ago.*2026/i);
  });

  it('leaves an invalid source value visible rather than inventing a date', () => {
    expect(formatDate('fecha desconocida')).toBe('fecha desconocida');
  });
});
