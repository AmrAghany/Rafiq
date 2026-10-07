// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        __dirname: 'readonly',
        require: 'readonly',
        module: 'writable',
        console: 'readonly',
      },
    },
  },
  {
    ignores: [
      'dist/*',
      'reference/*',
      'supabase/functions/**',
      'src/lib/database.types.ts',
      '.expo/**',
      'web/coach/dist/**',
      'web/coach/node_modules/**',
    ],
  },
]);
