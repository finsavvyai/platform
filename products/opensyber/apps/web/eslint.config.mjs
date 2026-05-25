import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Allow _-prefixed variables for intentionally unused destructured props,
  // setters, and params (e.g. _bundleSlug, _setEvents, _id).
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
    },
  },
  // Tests pragmatically use `any` for mock helpers and `_unused` patterns
  // for boilerplate fixtures. Relaxing these rules in test files keeps
  // the suite readable without compromising production type safety.
  {
    files: [
      "**/*.test.{ts,tsx}",
      "**/__tests__/**/*.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
      "src/test/**/*.{ts,tsx}",
      "e2e/**/*.{ts,tsx}",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-require-imports": "off",
      // Playwright's `use` callback in fixtures looks like React Hook `use`
      // to the linter — false-positive in e2e files.
      "react-hooks/rules-of-hooks": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // OpenNext + Cloudflare build artifacts contain bundled vendor code
    // that fails our ts/no-this-alias / no-unused-expressions rules.
    // These are generated, not source — never lint them.
    ".open-next/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
