import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores([
    'dist',
    '.cloudflare',
    '.wrangler',
    '.react-router',
    'node_modules',
    'build',
    'worker-configuration.d.ts',
  ]),
  {
    name: 'ts/base',
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      eslintConfigPrettier,
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'lucide-react',
              message:
                'Use @hugeicons/react with @hugeicons/core-free-icons instead.',
            },
            {
              name: '@radix-ui/react-icons',
              message:
                'Use @hugeicons/react with @hugeicons/core-free-icons instead.',
            },
            {
              name: '@heroicons/react',
              message:
                'Use @hugeicons/react with @hugeicons/core-free-icons instead.',
            },
            {
              name: '@tabler/icons-react',
              message:
                'Use @hugeicons/react with @hugeicons/core-free-icons instead.',
            },
            {
              name: '@fortawesome/react-fontawesome',
              message:
                'Use @hugeicons/react with @hugeicons/core-free-icons instead.',
            },
          ],
          patterns: [
            {
              group: ['react-icons/*', '@heroicons/*'],
              message:
                'Use @hugeicons/react with @hugeicons/core-free-icons instead.',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'ts/tests',
    files: ['**/*.test.{ts,tsx}', 'app/test/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.vitest,
      },
    },
  },
  {
    name: 'ts/routes',
    files: ['app/routes/**/*.tsx', 'app/tools/**/route.tsx', 'app/root.tsx'],
    rules: {
      // React Router loaders and actions legitimately throw `Response`.
      '@typescript-eslint/only-throw-error': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    name: 'ts/boundaries/platform',
    files: ['app/platform/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['~/tools/*'],
              message:
                'Platform modules must stay feature-agnostic. Move shared contracts into app/platform or app/shared instead.',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'ts/boundaries/tool-ui',
    files: ['app/shared/tool-ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['~/tools/*'],
              message:
                'Shared tool UI must not depend on individual tool slices.',
            },
          ],
        },
      ],
    },
  },
]);
