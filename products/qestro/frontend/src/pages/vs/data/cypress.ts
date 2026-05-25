import type { VsPageData } from '../vs-types';
import { QESTRO_PRICING } from '../vs-types';

export const CYPRESS_DATA: VsPageData = {
  slug: 'cypress',
  competitor: 'Cypress',
  tagline:
    'Cypress is the incumbent JavaScript browser-testing framework. Qestro is the AI-native testing copilot for teams shipping with Cursor, Claude Code, and Copilot — browser plus mobile plus API in one tool.',
  hero: {
    chooseQestro:
      'Your team uses AI coding tools, ships to web + mobile + API, and wants tests generated from plain English with self-healing selectors built in.',
    chooseCompetitor:
      'You need component testing today, rely on Cypress Studio for record-and-replay, or have a mature Cypress suite you do not want to migrate.',
    bothGreat:
      'Dev-first ergonomics, first-class debugging experiences, GitHub Actions + GitLab CI integrations, and transparent public pricing.',
  },
  features: [
    { feature: 'Browser testing (Chrome, Firefox, Safari)', qestro: 'yes', competitor: 'yes' },
    { feature: 'Mobile testing (iOS + Android)', qestro: 'yes', competitor: 'no', note: 'Cypress is browser-only.' },
    { feature: 'API testing (REST + GraphQL)', qestro: 'yes', competitor: 'partial', note: 'Cypress can hit APIs via cy.request, but no dedicated runner.' },
    { feature: 'AI test generation from plain English', qestro: 'yes', competitor: 'partial', note: 'Cypress offers Studio AI as a plugin, not the primary authoring flow.' },
    { feature: 'Self-healing selectors (all tiers)', qestro: 'yes', competitor: 'partial', note: 'Cypress has flake detection, not auto-healing.' },
    { feature: 'Self-healing on free/starter tier', qestro: 'yes', competitor: 'no' },
    { feature: 'AI failure analysis', qestro: 'yes', competitor: 'yes' },
    { feature: 'Visual regression (built-in)', qestro: 'yes', competitor: 'partial' },
    { feature: 'Load testing', qestro: 'yes', competitor: 'no' },
    { feature: 'Component testing (React, Vue)', qestro: 'no', competitor: 'yes', note: 'Cypress owns this; Qestro is E2E-first.' },
    { feature: 'Time-travel DOM snapshots', qestro: 'partial', competitor: 'yes' },
    { feature: 'Playwright-native code output', qestro: 'yes', competitor: 'no' },
    { feature: 'MCP server for AI agents', qestro: 'yes', competitor: 'yes' },
    { feature: 'Free tier', qestro: 'yes', competitor: 'yes' },
    { feature: 'Public pricing (no sales call)', qestro: 'yes', competitor: 'yes' },
  ],
  pricing: {
    qestro: QESTRO_PRICING,
    competitor: [
      { tier: 'Starter (Free)', price: '$0', seats: '50', notes: '6K results/yr (500/mo), 100 AI prompts/user/hr.' },
      { tier: 'Team', price: '$67/mo', seats: '50', notes: '120K results/yr, flake detection, Jira, email support.' },
      { tier: 'Business', price: '$267/mo', seats: '50', notes: 'SSO, spec prioritization, GH/GL Enterprise.' },
      { tier: 'Enterprise', price: 'Contact', notes: 'Dedicated support, roadmap portal.' },
    ],
  },
  wins: {
    qestroParagraphs: [
      'Qestro wins when you ship across more than one surface. Cypress is a pure browser testing framework — if your product lives on the web and on iOS, your team ends up stitching Cypress, Maestro, and Postman together with three dashboards, three billing lines, and three sets of credentials. Qestro unifies browser, mobile, and API under one runner, one set of test cases, and one results view.',
      'Qestro wins on the AI authoring flow. Cypress Studio AI is a helpful plugin for teams already invested in Cypress. Qestro was built AI-first: paste a URL, describe in English what you want tested, and get production-ready Playwright code with assertions, fixtures, and self-healing selectors. The default authoring flow is plain English, not recording clicks.',
      'Qestro wins on self-healing. Cypress ships flake detection — it tells you a test is flaky. Qestro ships a dedicated self-healing engine that detects selector rot, timing issues, and assertion drift, and fixes them automatically. Self-healing is included on every paid tier, not gated to Enterprise.',
    ],
    competitorParagraph:
      "Cypress wins on two real strengths. First, component testing — the Cypress component runner for React, Vue, and Svelte is mature, widely adopted, and Qestro does not compete there. Second, time-travel DOM debugging — Cypress's snapshot-per-command debugger is still the best-in-class UX for reproducing a browser failure. If those two capabilities are load-bearing for your team, stay on Cypress.",
  },
  seo: {
    title: 'Qestro vs Cypress — AI Testing Copilot Comparison (2026)',
    description:
      'Cypress vs Qestro compared: browser testing, mobile, API, AI generation, self-healing, pricing. Honest feature matrix for engineering teams.',
    canonical: 'https://qestro.app/vs/cypress',
  },
};
