// Responsive test barrel — runs both landing and dashboard responsive tests.
// Individual suites: responsive-landing.spec.ts, responsive-dashboard.spec.ts
// Shared helpers: helpers/responsive.ts
// Config: responsive-config.ts (3 viewport projects)
//
// Run all responsive tests:
//   npx playwright test --config e2e/responsive-config.ts
//
// Run just landing:
//   npx playwright test responsive-landing --config e2e/responsive-config.ts
//
// Run just dashboard:
//   npx playwright test responsive-dashboard --config e2e/responsive-config.ts

export {};
