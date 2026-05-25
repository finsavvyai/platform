module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: {
        node: '18'
      }
    }],
    ['@babel/preset-typescript', {
      allowDeclareFields: true,
      allowNamespaces: true,
      onlyRemoveTypeImports: true,
      allExtensions: true,
      isTSX: false
    }]
  ],
  plugins: [
    ['@babel/plugin-transform-runtime', {
      regenerator: true
    }]
  ],
  ignore: [
    '**/__tests__/**',
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/node_modules/**'
  ]
};