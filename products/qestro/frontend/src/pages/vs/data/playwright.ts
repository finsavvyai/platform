import type { VsPageData } from '../vs-types';
import { QESTRO_PRICING } from '../vs-types';

export const PLAYWRIGHT_DATA: VsPageData = {
  slug: 'playwright',
  competitor: 'Playwright',
  tagline:
    'Playwright is an open-source browser automation framework from Microsoft. Qestro is built on top of Playwright and delivers the full platform: AI test generation, self-healing, mobile, API, and a managed dashboard your team can adopt in minutes.',
  hero: {
    chooseQestro:
      'You want the power of Playwright without building the platform yourself — test generation, CI, analytics, self-healing, mobile, and API already wired up.',
    chooseCompetitor:
      'You have engineering time to build your own test infrastructure, need cross-language bindings (Python, .NET, Java), or require a fully free, MIT-licensed framework.',
    bothGreat:
      'Rock-solid browser automation, auto-waiting, trace viewer, cross-browser support (Chromium, Firefox, WebKit), and MCP integration for AI agents.',
  },
  features: [
    { feature: 'Browser testing (Chrome, Firefox, Safari)', qestro: 'yes', competitor: 'yes' },
    { feature: 'Mobile testing (iOS + Android)', qestro: 'yes', competitor: 'no', note: 'Playwright targets browsers, not native apps.' },
    { feature: 'API testing (REST + GraphQL)', qestro: 'yes', competitor: 'partial', note: 'Playwright APIRequestContext exists; not a full runner.' },
    { feature: 'AI test generation from plain English', qestro: 'yes', competitor: 'no', note: 'Playwright codegen records clicks; Qestro writes from English.' },
    { feature: 'Self-healing selectors', qestro: 'yes', competitor: 'no' },
    { feature: 'AI failure analysis', qestro: 'yes', competitor: 'no' },
    { feature: 'Visual regression (built-in)', qestro: 'yes', competitor: 'partial', note: 'Playwright has toHaveScreenshot; Qestro has managed baselines.' },
    { feature: 'Managed dashboard + analytics', qestro: 'yes', competitor: 'no' },
    { feature: 'Cross-language bindings (Python, .NET, Java)', qestro: 'no', competitor: 'yes' },
    { feature: 'Trace viewer', qestro: 'yes', competitor: 'yes' },
    { feature: 'MCP server for AI agents', qestro: 'yes', competitor: 'yes' },
    { feature: 'Scheduled / cron runs', qestro: 'yes', competitor: 'no' },
    { feature: 'CI/CD out-of-the-box (no setup)', qestro: 'yes', competitor: 'no' },
    { feature: 'Zero-cost / MIT license', qestro: 'partial', competitor: 'yes', note: 'Qestro has free tier; Playwright is fully MIT.' },
  ],
  pricing: {
    qestro: QESTRO_PRICING,
    competitor: [
      { tier: 'Open Source', price: '$0', notes: 'MIT license. No paid tier. Self-managed infrastructure.' },
    ],
  },
  wins: {
    qestroParagraphs: [
      'Qestro wins when you compare total cost. Playwright the framework is free — Playwright as a working test platform is not. Setting up CI, headless browser containers, parallel sharding, video capture, test result storage, flake tracking, retry logic, Slack/Jira webhooks, and a dashboard is weeks of engineering. Qestro delivers all of that on day one for $99/mo, which is cheaper than a single afternoon of senior engineering time.',
      'Qestro wins on AI authoring. Playwright codegen records what you click and emits Playwright code — useful, but still requires a human to click through the flow. Qestro accepts "test that a new user can sign up, verify email, and create their first project" as input and generates the entire test, with assertions and fixtures.',
      "Qestro wins on the recovery path. When a selector rots in your Playwright suite, your CI goes red and an engineer has to fix it. Qestro's self-healing engine detects the break, repairs the selector, and re-runs the test. Same Playwright code output, but with an auto-repair layer on top.",
    ],
    competitorParagraph:
      'Playwright wins on raw framework quality and freedom. It is the best open-source browser automation library in the world, backed by Microsoft, with 86K+ stars, cross-language bindings (Python, .NET, Java in addition to Node), and a zero-dollar MIT license. If your team has dedicated test infrastructure engineers and wants full ownership of the stack, Playwright is the right foundation — and Qestro is literally built on it.',
  },
  seo: {
    title: 'Qestro vs Playwright — AI Testing Copilot Comparison (2026)',
    description:
      'Playwright vs Qestro: framework vs managed platform. AI test generation, self-healing, mobile, API, dashboard. Honest comparison for dev teams.',
    canonical: 'https://qestro.app/vs/playwright',
  },
};
