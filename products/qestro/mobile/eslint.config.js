const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const reactPlugin = require("eslint-plugin-react");

module.exports = defineConfig([
  {
    ignores: [
      ".expo/**",
      ".eslintrc.js",
      "coverage/**",
      "eslint.config.js",
      "ios/**",
      "node_modules/**",
    ],
  },
  ...expoConfig,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      react: reactPlugin,
    },
    rules: {
      "react/react-in-jsx-scope": "off",
    },
  },
]);
