import coreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/**
 * Layer boundaries are enforced here, not by convention.
 *
 *   components/** -> may never reach into the data layer.
 *   app/**        -> may call repositories, never import fixtures directly.
 *
 * These two rules are what keep M1's synthetic data swappable for Supabase in M2
 * without touching the component tree.
 */
const config = [
  {
    ignores: ['.context/**', '.next/**', 'coverage/**', 'node_modules/**', 'next-env.d.ts'],
  },
  ...coreWebVitals,
  ...nextTypescript,
  {
    files: ['src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/data', '@/data/*', '@/data/**', '**/data/fixtures/**'],
              message:
                'Components are presentational. Receive view models as props; never read the data layer.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/data/fixtures', '@/data/fixtures/**'],
              message:
                'Routes call repositories, not fixtures. Fixtures are private to data/repositories/synthetic.',
            },
          ],
        },
      ],
    },
  },
  {
    rules: {
      // A leading underscore marks a parameter kept deliberately. Repositories carry
      // ViewerContext in every signature even where M1 does not read it, because M2
      // will, and the call sites must not change then.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': 'error',
    },
  },
];

export default config;
