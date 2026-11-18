import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    // The theme build emits JS and declarations under theme/built; they are
    // generated, not authored, and carry a triple-slash reference the rules reject.
    ignores: [
      'node_modules/**',
      'out/**',
      'release/**',
      'dist/**',
      'test-results/**',
      'tests/screenshots/**',
      '.cache/**',
      'src/renderer/src/theme/built/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-useless-assignment': 'warn',
      'prefer-const': 'warn',
      'no-console': 'off'
    }
  }
)
