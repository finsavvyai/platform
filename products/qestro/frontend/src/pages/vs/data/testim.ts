import type { VsPageData } from '../vs-types';
import { QESTRO_PRICING } from '../vs-types';

export const TESTIM_DATA: VsPageData = {
  slug: 'testim',
  competitor: 'Testim',
  tagline:
    'Testim (now Tricentis Testim) is an enterprise codeless AI testing platform sold to QA directors through sales cycles. Qestro is a self-serve AI testing copilot for engineering teams — $99/mo on a credit card, Playwright code you own, zero sales calls.',
  hero: {
    chooseQestro:
      'You are an engineering manager or senior dev who wants to adopt self-healing AI testing today, with transparent pricing, no procurement, and code your team can commit to git.',
    chooseCompetitor:
      'You are a large enterprise with a dedicated Salesforce testing practice, a QA director with budget, and procurement processes that require SOC 2 + MSA + negotiated contracts.',
    bothGreat:
      'Self-healing selectors, cross-browser execution, CI/CD integration, and AI-assisted test maintenance.',
  },
  features: [
    { feature: 'Browser testing (Chrome, Firefox, Safari)', qestro: 'yes', competitor: 'yes' },
    { feature: 'Mobile testing (iOS + Android)', qestro: 'yes', competitor: 'no', note: 'Testim Salesforce is a separate SKU; mobile is not unified.' },
    { feature: 'API testing (REST + GraphQL)', qestro: 'yes', competitor: 'no' },
    { feature: 'AI test generation from plain English', qestro: 'yes', competitor: 'partial', note: 'Testim is record-first; AI helps maintain, not generate.' },
    { feature: 'Self-healing selectors', qestro: 'yes', competitor: 'yes', note: 'Testim pioneered this in 2016.' },
    { feature: 'Self-serve signup (no demo)', qestro: 'yes', competitor: 'no' },
    { feature: 'Public pricing', qestro: 'yes', competitor: 'no' },
    { feature: 'Free tier', qestro: 'yes', competitor: 'no', note: 'Testim offers a demo/trial, not a free tier.' },
    { feature: 'Playwright code output (own your tests)', qestro: 'yes', competitor: 'no', note: 'Testim uses a proprietary JSON step format.' },
    { feature: 'Git-committable tests', qestro: 'yes', competitor: 'no' },
    { feature: 'Salesforce-specific testing', qestro: 'no', competitor: 'yes' },
    { feature: 'Visual regression', qestro: 'yes', competitor: 'yes' },
    { feature: 'SSO / SAML', qestro: 'yes', competitor: 'yes', note: 'Qestro all tiers; Testim Enterprise.' },
    { feature: 'Starts at under $200/mo', qestro: 'yes', competitor: 'no' },
  ],
  pricing: {
    qestro: QESTRO_PRICING,
    competitor: [
      { tier: 'Demo / Trial', price: 'Free trial', notes: 'Requires demo call; no self-serve signup.' },
      { tier: 'Essentials', price: 'Contact sales', notes: 'Estimated $20K+/yr per G2 reviews.' },
      { tier: 'Pro', price: 'Contact sales', notes: 'Estimated $40K-$100K+/yr for enterprise seats.' },
      { tier: 'Enterprise', price: 'Contact sales', notes: 'Bundled into Tricentis Tosca / qTest suite.' },
    ],
  },
  wins: {
    qestroParagraphs: [
      'Qestro wins on speed to value. Testim sells to QA directors who buy on RFP — the typical purchase path is demo, PoC, security review, procurement, MSA, PO. That is a six-month cycle. Qestro is a 14-day trial on a credit card. An engineering manager can adopt Qestro before their next sprint planning meeting; adopting Testim takes a quarter.',
      'Qestro wins on code ownership. Testim stores tests in a proprietary JSON step format inside their platform. If you leave Testim, your test suite stays behind. Qestro generates standard Playwright code that your team can commit to git, version in PRs, and run in any Playwright-compatible CI. No lock-in, no migration fear.',
      'Qestro wins on the modern stack narrative. Testim was built in a pre-LLM world for record-and-replay QA workflows. Qestro is built for teams using Cursor, Claude Code, and Copilot to ship 10x faster — the test layer has to move at the same speed. AI-first generation from plain English is the default, not a plugin.',
    ],
    competitorParagraph:
      'Testim wins on two things. First, Salesforce testing — if your primary testing surface is a Salesforce org with Lightning components, custom objects, and managed packages, Testim has a dedicated SKU and a decade of specialization that Qestro does not match. Second, enterprise procurement fit — Testim is bundled into Tricentis, which means if your org already has a Tricentis master agreement, adding Testim is a paperwork exercise instead of a new vendor evaluation.',
  },
  seo: {
    title: 'Qestro vs Testim — AI Testing Copilot Comparison (2026)',
    description:
      'Testim vs Qestro compared: self-serve vs enterprise sales, Playwright code vs proprietary DSL, pricing, self-healing, mobile, and API coverage.',
    canonical: 'https://qestro.app/vs/testim',
  },
};
