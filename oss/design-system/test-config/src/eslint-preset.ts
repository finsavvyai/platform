interface EslintConfigItem {
  files: string[];
  languageOptions: Record<string, unknown>;
  rules: Record<string, unknown>;
}

interface EslintConfig {
  plugins?: Record<string, unknown>;
  configs?: EslintConfigItem[];
}

export function getEslintPreset(): EslintConfig {
  return {
    plugins: {
      '@typescript-eslint': {},
    },
    configs: [
      {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
          parser: '@typescript-eslint/parser',
          parserOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
          },
        },
        rules: {
          'no-console': ['warn', { allow: ['warn', 'error'] }],
          'no-debugger': 'warn',
          'prefer-const': 'warn',
          'no-var': 'error',
          '@typescript-eslint/strict-boolean-expressions': 'warn',
          '@typescript-eslint/no-explicit-any': 'warn',
        },
      },
    ],
  };
}
