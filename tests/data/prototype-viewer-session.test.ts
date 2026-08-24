/**
 * Tests for getPrototypeViewer()'s default (M2 Auth adversarial review, H1).
 *
 * Least privilege first: no cookie, an unrecognized cookie value, or
 * anything other than the literal string 'founder' must resolve to
 * PROTOTYPE_MEMBER, never PROTOTYPE_FOUNDER. Only an explicit 'founder'
 * value elevates.
 */

import { describe, expect, it, vi } from 'vitest';

const cookiesMock = vi.fn();

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}));

const { getPrototypeViewer, PROTOTYPE_VIEWER_COOKIE } = await import(
  '@/data/prototype-viewer-session'
);
const { PROTOTYPE_FOUNDER, PROTOTYPE_MEMBER } = await import('@/data/prototype-viewers');

function cookieStore(value: string | undefined) {
  return {
    get: (name: string) =>
      name === PROTOTYPE_VIEWER_COOKIE && value !== undefined ? { name, value } : undefined,
  };
}

describe('getPrototypeViewer', () => {
  it('AT-H1.1: with no cookie at all, resolves to member, never founder', async () => {
    cookiesMock.mockResolvedValue(cookieStore(undefined));
    await expect(getPrototypeViewer()).resolves.toEqual(PROTOTYPE_MEMBER);
  });

  it('AT-H1.2: an unrecognized cookie value resolves to member, never founder', async () => {
    cookiesMock.mockResolvedValue(cookieStore('administrator'));
    await expect(getPrototypeViewer()).resolves.toEqual(PROTOTYPE_MEMBER);
  });

  it('an explicit "member" cookie resolves to member', async () => {
    cookiesMock.mockResolvedValue(cookieStore('member'));
    await expect(getPrototypeViewer()).resolves.toEqual(PROTOTYPE_MEMBER);
  });

  it('AT-H1.4: only an explicit "founder" cookie resolves to founder', async () => {
    cookiesMock.mockResolvedValue(cookieStore('founder'));
    await expect(getPrototypeViewer()).resolves.toEqual(PROTOTYPE_FOUNDER);
  });
});
