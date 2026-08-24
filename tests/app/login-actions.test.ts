/**
 * Tests for resolveOrigin() in src/app/login/actions.ts — the host-allowlist
 * check a forged Host/X-Forwarded-Host header must not bypass.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const headersMock = vi.fn();

vi.mock('next/headers', () => ({
  headers: headersMock,
}));

const { resolveOrigin } = await import('@/app/login/actions');

function headerMap(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.VERCEL_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('resolveOrigin', () => {
  it('trusts localhost:3000 for local dev', async () => {
    headersMock.mockResolvedValue(headerMap({ host: 'localhost:3000', 'x-forwarded-proto': 'http' }));
    await expect(resolveOrigin()).resolves.toBe('http://localhost:3000');
  });

  it('trusts a host matching VERCEL_URL (this exact deployment)', async () => {
    process.env.VERCEL_URL = 'firma23-ops-abc123.vercel.app';
    headersMock.mockResolvedValue(
      headerMap({ 'x-forwarded-host': 'firma23-ops-abc123.vercel.app', 'x-forwarded-proto': 'https' }),
    );
    await expect(resolveOrigin()).resolves.toBe('https://firma23-ops-abc123.vercel.app');
  });

  it('trusts VERCEL_PROJECT_PRODUCTION_URL', async () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'firma23-ops.vercel.app';
    headersMock.mockResolvedValue(
      headerMap({ host: 'firma23-ops.vercel.app', 'x-forwarded-proto': 'https' }),
    );
    await expect(resolveOrigin()).resolves.toBe('https://firma23-ops.vercel.app');
  });

  it('rejects a forged Host/X-Forwarded-Host header not in the allowlist', async () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'firma23-ops.vercel.app';
    headersMock.mockResolvedValue(
      headerMap({ 'x-forwarded-host': 'attacker.example.com', 'x-forwarded-proto': 'https' }),
    );
    // Never the attacker's host — falls back to the known-good production URL.
    await expect(resolveOrigin()).resolves.toBe('https://firma23-ops.vercel.app');
  });

  it('falls back to localhost when no host header and no Vercel env are present', async () => {
    headersMock.mockResolvedValue(headerMap({}));
    await expect(resolveOrigin()).resolves.toBe('http://localhost:3000');
  });
});
