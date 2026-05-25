module.exports = {
  env: {
    browser: true,
    es2022: true,
    worker: true
  },
  extends: [
    'eslint:recommended',
    '@cloudflare/workers-types',
    'prettier'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  plugins: [
    'cloudflare-workers'
  ],
  rules: {
    // General JavaScript rules
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    'prefer-const': 'error',
    'no-var': 'error',

    // Cloudflare Workers specific
    'cloudflare-workers/no-env-in-context': 'error',
    'cloudflare-workers/no-unhandled-promise-rejection': 'error',

    // Code style
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'comma-dangle': ['error', 'never'],
    'object-curly-spacing': ['error', 'always'],
    'indent': ['error', 2],

    // Security
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error'
  },
  overrides: [
    {
      files: ['tests/**/*.js'],
      env: {
        jest: true
      },
      rules: {
        'no-console': 'off'
      }
    },
    {
      files: ['adapters/**/*.js'],
      rules: {
        'no-unused-vars': ['error', { argsIgnorePattern: '^_|context|config' }]
      }
    }
  ],
  globals: {
    // Cloudflare Workers globals
    'fetch': 'readonly',
    'Response': 'readonly',
    'Request': 'readonly',
    'addEventListener': 'readonly',
    'caches': 'readonly',
    'crypto': 'readonly'
  }
};