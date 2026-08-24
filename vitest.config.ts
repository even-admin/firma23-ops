import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Vitest 4 transforms with oxc, not esbuild. Stating the runtime here keeps the
  // test transform correct regardless of what Next writes into tsconfig's jsx field.
  oxc: {
    jsx: {
      runtime: 'automatic',
      importSource: 'react',
    },
  },
  resolve: {
    alias: {
      '@': new URL('./src/', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/money.ts', 'src/lib/allocation.ts'],
      // The shortfall from 100 is entirely `undefined` guards that
      // noUncheckedIndexedAccess forces on array reads whose index is derived from
      // the same array's length. They are unreachable from any caller, so they are
      // left in place as defence rather than deleted to flatter a number.
      thresholds: {
        statements: 97,
        lines: 96,
        functions: 100,
        branches: 91,
      },
    },
  },
});
