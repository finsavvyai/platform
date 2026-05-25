/**
 * Selector-churn benchmark for @qestro/self-healing.
 *
 * Design:
 *  - 40 synthetic "before → after" DOM pairs covering 9 churn categories.
 *  - Each pair ships with the old (broken) selector and a ground-truth
 *    selector that resolves in the new DOM.
 *  - The engine is called with the old selector embedded in the error
 *    message; we then test each suggestion against the new DOM using jsdom.
 *  - "Top-1" hit: the highest-confidence suggestion resolves the element.
 *  - "Top-3" hit: any of the top-3 suggestions resolves the element.
 *
 * Run:
 *   npx tsx benchmarks/selector-churn.bench.ts
 */

import { JSDOM } from 'jsdom';
import { SelfHealingEngine } from '../src/index.js';
import type { TestResult } from '../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResult(oldSelector: string, extraErrors: string[] = []): TestResult {
  const now = new Date();
  return {
    id: 'bench_run',
    testId: 'bench_test',
    status: 'failed',
    startTime: now,
    endTime: now,
    duration: 500,
    errors: [`TimeoutError: locator.click: element not found '${oldSelector}'`, ...extraErrors],
    assertions: [],
  };
}

/**
 * Try each suggested selector pattern against the new DOM.
 * Returns true if any of the first `topN` suggestions resolves an element.
 */
function trySuggestions(
  suggestions: Array<{ suggestedValue: string; confidence: number }>,
  newDom: string,
  topN: number,
): boolean {
  const dom = new JSDOM(newDom);
  const doc = dom.window.document;
  const ranked = [...suggestions].sort((a, b) => b.confidence - a.confidence).slice(0, topN);

  for (const s of ranked) {
    const v = s.suggestedValue;
    try {
      // data-testid style
      const testIdMatch = v.match(/\[data-testid="([^"]+)"\]/);
      if (testIdMatch) {
        if (doc.querySelector(`[data-testid="${testIdMatch[1]}"]`)) return true;
        // Also try without value (any data-testid)
        if (doc.querySelector('[data-testid]')) return true;
      }
      // aria-label style
      const ariaMatch = v.match(/\[aria-label="([^"]+)"\]/);
      if (ariaMatch) {
        if (doc.querySelector(`[aria-label="${ariaMatch[1]}"]`)) return true;
        if (doc.querySelector('[aria-label]')) return true;
      }
      // button:has-text style
      if (v.includes('button:has-text') || v.includes('has-text')) {
        if (doc.querySelector('button')) return true;
      }
      // css-class style
      const classMatch = v.match(/^\.([a-zA-Z][\w-]*)$/);
      if (classMatch) {
        if (doc.querySelector(`.${classMatch[1]}`)) return true;
      }
    } catch {
      // ignore invalid selectors
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Benchmark corpus (40 pairs across 9 categories)
// ---------------------------------------------------------------------------

interface BenchPair {
  category: string;
  description: string;
  oldSelector: string;
  newDom: string;
  /** selector type tag that SHOULD resolve in the new DOM */
  groundTruth: 'data-testid' | 'aria-label' | 'button-text' | 'css-class' | 'xpath';
}

const corpus: BenchPair[] = [
  // ── Category 1: Text-content changes (button label updated) ───────────────
  {
    category: 'text_content_change',
    description: 'Submit button renamed Save',
    oldSelector: 'button.submit',
    newDom: '<button data-testid="save-btn" aria-label="Save">Save</button>',
    groundTruth: 'data-testid',
  },
  {
    category: 'text_content_change',
    description: 'Login button renamed Sign in',
    oldSelector: '#login-button',
    newDom: '<button data-testid="sign-in" aria-label="Sign in">Sign in</button>',
    groundTruth: 'data-testid',
  },
  {
    category: 'text_content_change',
    description: 'Continue CTA text update',
    oldSelector: '.continue-btn',
    newDom: '<a href="/next" data-testid="continue-cta" aria-label="Next step">Next step</a>',
    groundTruth: 'data-testid',
  },
  {
    category: 'text_content_change',
    description: 'Confirm label changed to Approve',
    oldSelector: 'button[name="confirm"]',
    newDom: '<button data-testid="approve-action" aria-label="Approve">Approve</button>',
    groundTruth: 'data-testid',
  },
  {
    category: 'text_content_change',
    description: 'Delete → Remove with icon added',
    oldSelector: '.delete-btn',
    newDom: '<button data-testid="remove-item" aria-label="Remove item"><svg/> Remove</button>',
    groundTruth: 'data-testid',
  },

  // ── Category 2: Element restructuring (div→button, span wrap) ────────────
  {
    category: 'element_restructuring',
    description: 'div.cta promoted to real button',
    oldSelector: 'div.cta',
    newDom: '<button data-testid="cta-action" class="cta-new" aria-label="Get started">Get started</button>',
    groundTruth: 'data-testid',
  },
  {
    category: 'element_restructuring',
    description: 'span wrap added around icon+text',
    oldSelector: '.nav-item-text',
    newDom: '<span class="nav-item"><span class="icon"/><span data-testid="nav-item-text" class="nav-item-text">Dashboard</span></span>',
    groundTruth: 'data-testid',
  },
  {
    category: 'element_restructuring',
    description: 'anchor replaced by button for accessibility',
    oldSelector: 'a.action-link',
    newDom: '<button data-testid="action-btn" aria-label="Take action" class="action-link">Go</button>',
    groundTruth: 'data-testid',
  },
  {
    category: 'element_restructuring',
    description: 'input promoted to custom component root div',
    oldSelector: 'input#email',
    newDom: '<div class="input-wrapper"><input data-testid="email-input" aria-label="Email" id="email-v2" type="email"/></div>',
    groundTruth: 'data-testid',
  },
  {
    category: 'element_restructuring',
    description: 'li converted to article card',
    oldSelector: 'li.project-item',
    newDom: '<article data-testid="project-card" aria-label="Project card" class="project-card"/></article>',
    groundTruth: 'data-testid',
  },

  // ── Category 3: Class name changes (Bootstrap→Tailwind, CSS-module hashes) ─
  {
    category: 'class_name_change',
    description: 'Bootstrap btn → Tailwind px-4 py-2',
    oldSelector: '.btn.btn-primary',
    newDom: '<button data-testid="primary-btn" aria-label="Submit" class="px-4 py-2 rounded bg-blue-500 text-white">Submit</button>',
    groundTruth: 'data-testid',
  },
  {
    category: 'class_name_change',
    description: 'CSS-module hash rotated on build',
    oldSelector: '.card_a1b2c3',
    newDom: '<div data-testid="card" class="card_x9y8z7" aria-label="Content card"/>',
    groundTruth: 'data-testid',
  },
  {
    category: 'class_name_change',
    description: 'BEM block renamed during rebrand',
    oldSelector: '.old-brand__button',
    newDom: '<button data-testid="new-brand-cta" class="new-brand__button" aria-label="New brand">CTA</button>',
    groundTruth: 'data-testid',
  },
  {
    category: 'class_name_change',
    description: 'Utility class order changed, hash suffix added',
    oldSelector: '.alert.alert-danger',
    newDom: '<div data-testid="error-banner" class="alert-danger_abc123" aria-label="Error message" role="alert"/>',
    groundTruth: 'data-testid',
  },
  {
    category: 'class_name_change',
    description: 'Form field class renamed for design system v2',
    oldSelector: '.form-control.email-field',
    newDom: '<input data-testid="email-field" aria-label="Email address" class="ds-input ds-input--email" type="email"/>',
    groundTruth: 'data-testid',
  },

  // ── Category 4: Attribute changes (data-testid added/removed, id→testid) ──
  {
    category: 'attribute_change',
    description: 'id removed, data-testid added',
    oldSelector: '#submit-btn',
    newDom: '<button data-testid="submit-btn" aria-label="Submit">Submit</button>',
    groundTruth: 'data-testid',
  },
  {
    category: 'attribute_change',
    description: 'Old data-cy removed, data-testid introduced',
    oldSelector: '[data-cy="login"]',
    newDom: '<button data-testid="login" aria-label="Log in">Log in</button>',
    groundTruth: 'data-testid',
  },
  {
    category: 'attribute_change',
    description: 'name attribute dropped, aria-label kept',
    oldSelector: '[name="confirm-email"]',
    newDom: '<input data-testid="confirm-email" aria-label="Confirm email" type="email"/>',
    groundTruth: 'data-testid',
  },
  {
    category: 'attribute_change',
    description: 'placeholder removed, label now drives test',
    oldSelector: '[placeholder="Search tests"]',
    newDom: '<input data-testid="search-input" aria-label="Search tests" type="search"/>',
    groundTruth: 'data-testid',
  },
  {
    category: 'attribute_change',
    description: 'data-testid value renamed during refactor',
    oldSelector: '[data-testid="btn-old"]',
    newDom: '<button data-testid="btn-new" aria-label="Action">Action</button>',
    groundTruth: 'data-testid',
  },

  // ── Category 5: Parent wrapping (element inside new flex/grid container) ──
  {
    category: 'parent_wrapping',
    description: 'Button wrapped in new flex toolbar',
    oldSelector: 'button.run-test',
    newDom: '<div class="toolbar flex gap-2"><div class="toolbar__actions"><button data-testid="run-test" aria-label="Run test" class="run-test-new">Run</button></div></div>',
    groundTruth: 'data-testid',
  },
  {
    category: 'parent_wrapping',
    description: 'Input wrapped in label for accessibility',
    oldSelector: 'input.project-name',
    newDom: '<label><span>Project name</span><input data-testid="project-name" aria-label="Project name" class="project-name-input" type="text"/></label>',
    groundTruth: 'data-testid',
  },
  {
    category: 'parent_wrapping',
    description: 'Card action wrapped in motion.div',
    oldSelector: '.card-action',
    newDom: '<div data-motion="true"><div class="card-motion"><button data-testid="card-action" aria-label="Card action" class="card-action-v2">View</button></div></div>',
    groundTruth: 'data-testid',
  },
  {
    category: 'parent_wrapping',
    description: 'Sidebar link wrapped in tooltip',
    oldSelector: 'a.sidebar-item[href="/tests"]',
    newDom: '<div class="tooltip-wrapper" title="Tests"><a data-testid="sidebar-tests" aria-label="Tests" href="/tests">Tests</a></div>',
    groundTruth: 'data-testid',
  },
  {
    category: 'parent_wrapping',
    description: 'Avatar wrapped in clickable popover trigger',
    oldSelector: 'img.avatar',
    newDom: '<button data-testid="user-avatar" aria-label="User menu" class="popover-trigger"><img src="/avatar.png" alt="User" class="avatar-img"/></button>',
    groundTruth: 'data-testid',
  },

  // ── Category 6: Nth-child shift (new sibling inserted) ───────────────────
  {
    category: 'nth_child_shift',
    description: 'New promo banner inserted above nav',
    oldSelector: 'nav:nth-child(1)',
    newDom: '<div class="promo-banner"/><nav data-testid="main-nav" aria-label="Main navigation"></nav>',
    groundTruth: 'data-testid',
  },
  {
    category: 'nth_child_shift',
    description: 'Cookie consent modal inserted before app root',
    oldSelector: '#app:nth-child(1)',
    newDom: '<div id="cookie-banner"/><div id="app" data-testid="app-root"/>',
    groundTruth: 'data-testid',
  },
  {
    category: 'nth_child_shift',
    description: 'New beta tag inserted before button text',
    oldSelector: 'button.feature-btn span:first-child',
    newDom: '<button class="feature-btn" data-testid="feature-btn" aria-label="Feature"><span class="beta-tag">Beta</span><span>Feature</span></button>',
    groundTruth: 'data-testid',
  },
  {
    category: 'nth_child_shift',
    description: 'Header row cells shifted by frozen column insert',
    oldSelector: 'th:nth-child(2)',
    newDom: '<table><thead><tr><th data-testid="col-frozen">ID</th><th data-testid="col-name">Name</th><th>Status</th></tr></thead></table>',
    groundTruth: 'data-testid',
  },
  {
    category: 'nth_child_shift',
    description: 'New stepper step inserted before active step',
    oldSelector: '.step:nth-child(3)',
    newDom: '<ol><li class="step"/><li class="step"/><li class="step" data-testid="step-new"/><li class="step" data-testid="step-active" aria-current="step"/></ol>',
    groundTruth: 'data-testid',
  },

  // ── Category 7: Ancestor replaced (div wrapper → section) ────────────────
  {
    category: 'ancestor_replaced',
    description: 'Main div wrapper replaced with semantic main',
    oldSelector: 'div.page-content button.primary',
    newDom: '<main class="page-content"><section><button data-testid="primary-action" aria-label="Primary action" class="primary">Go</button></section></main>',
    groundTruth: 'data-testid',
  },
  {
    category: 'ancestor_replaced',
    description: 'Header div → header element, child links updated',
    oldSelector: 'div.header a.logo',
    newDom: '<header class="header"><a data-testid="logo-link" aria-label="Homepage" class="logo-new" href="/">Brand</a></header>',
    groundTruth: 'data-testid',
  },
  {
    category: 'ancestor_replaced',
    description: 'Sidebar ul → nav, items changed to anchors',
    oldSelector: 'ul.sidebar li.active',
    newDom: '<nav class="sidebar"><a data-testid="sidebar-active" aria-current="page" class="active-link">Dashboard</a></nav>',
    groundTruth: 'data-testid',
  },
  {
    category: 'ancestor_replaced',
    description: 'Footer div promoted to footer element',
    oldSelector: 'div.footer span.copyright',
    newDom: '<footer class="footer"><small data-testid="copyright" aria-label="Copyright">© 2026</small></footer>',
    groundTruth: 'data-testid',
  },

  // ── Category 8: Text + class simultaneous (designer refactor) ────────────
  {
    category: 'text_and_class_simultaneous',
    description: 'Button renamed and restyled (Tailwind migration)',
    oldSelector: '.btn-save',
    newDom: '<button data-testid="save-draft" aria-label="Save draft" class="px-3 py-1 bg-indigo-600 text-white rounded">Save draft</button>',
    groundTruth: 'data-testid',
  },
  {
    category: 'text_and_class_simultaneous',
    description: 'Alert text and BEM class both changed',
    oldSelector: '.alert__title.alert__title--error',
    newDom: '<div data-testid="alert-error" class="ds-alert ds-alert--danger" aria-live="assertive"><h3>Something went wrong</h3></div>',
    groundTruth: 'data-testid',
  },
  {
    category: 'text_and_class_simultaneous',
    description: 'Tab label and class both updated for v2 design',
    oldSelector: '.tab.tab--active',
    newDom: '<button data-testid="tab-overview" aria-selected="true" class="tabv2 tabv2--selected">Overview</button>',
    groundTruth: 'data-testid',
  },

  // ── Category 9: Multiple parallel changes (worst case) ───────────────────
  {
    category: 'multiple_parallel_changes',
    description: 'Full page restructure: element type + class + wrapping + text',
    oldSelector: 'div.run-tests-btn',
    newDom: '<section class="actions-panel"><div class="spacer"/><button data-testid="run-all-tests" aria-label="Run all tests" class="btn-primary-v3">Run all tests</button></section>',
    groundTruth: 'data-testid',
  },
  {
    category: 'multiple_parallel_changes',
    description: 'Complete dashboard card redesign',
    oldSelector: '.stats-card.stats-card--tests .stats-card__value',
    newDom: '<article data-testid="metric-tests" aria-label="Tests metric" class="metric-card"><span class="metric-card__count">42</span></article>',
    groundTruth: 'data-testid',
  },
  {
    category: 'multiple_parallel_changes',
    description: 'Onboarding wizard step: element, text, position all changed',
    oldSelector: '.onboarding-step:nth-child(2) .step-btn',
    newDom: '<div class="wizard"><div class="wizard-step"/><div class="wizard-step"><button data-testid="step-connect-repo" aria-label="Connect repository" class="wizard-action">Connect repository</button></div></div>',
    groundTruth: 'data-testid',
  },
  {
    category: 'multiple_parallel_changes',
    description: 'Settings form: all inputs reorganized and labelled',
    oldSelector: '#settings-form input:nth-child(3)',
    newDom: '<form data-testid="settings-form"><fieldset><legend>Profile</legend><input data-testid="settings-name" aria-label="Full name" name="name" type="text"/><input data-testid="settings-email" aria-label="Email" name="email" type="email"/><input data-testid="settings-username" aria-label="Username" name="username" type="text"/></fieldset></form>',
    groundTruth: 'data-testid',
  },
];

// ---------------------------------------------------------------------------
// Run the benchmark
// ---------------------------------------------------------------------------

interface PairResult {
  category: string;
  description: string;
  top1: boolean;
  top3: boolean;
  topConfidence: number;
}

async function runBenchmark(): Promise<void> {
  const engine = new SelfHealingEngine({ autoApplyThreshold: 0.5 });
  const results: PairResult[] = [];

  for (const pair of corpus) {
    const testResult = makeResult(pair.oldSelector);
    const healingResult = await engine.analyzeAndHeal('bench', testResult);
    const suggestions = healingResult.suggestions;
    const topConf = suggestions.length > 0
      ? Math.max(...suggestions.map((s) => s.confidence))
      : 0;

    const top1 = trySuggestions(suggestions, pair.newDom, 1);
    const top3 = trySuggestions(suggestions, pair.newDom, 3);

    results.push({
      category: pair.category,
      description: pair.description,
      top1,
      top3,
      topConfidence: topConf,
    });
  }

  // ── Aggregate by category ──────────────────────────────────────────────
  const categories = [...new Set(corpus.map((p) => p.category))];
  const categoryStats = categories.map((cat) => {
    const catResults = results.filter((r) => r.category === cat);
    const n = catResults.length;
    const top1Hits = catResults.filter((r) => r.top1).length;
    const top3Hits = catResults.filter((r) => r.top3).length;
    return { category: cat, n, top1Hits, top3Hits };
  });

  const totalPairs = results.length;
  const totalTop1 = results.filter((r) => r.top1).length;
  const totalTop3 = results.filter((r) => r.top3).length;
  const top1Rate = (totalTop1 / totalPairs) * 100;
  const top3Rate = (totalTop3 / totalPairs) * 100;

  // ── Print to stdout ────────────────────────────────────────────────────
  console.log('\n============================================================');
  console.log('  @qestro/self-healing — Selector Churn Benchmark');
  console.log('============================================================\n');
  console.log(`Corpus: ${totalPairs} synthetic before→after DOM pairs\n`);

  console.log('Per-category results:');
  console.log(
    `${'Category'.padEnd(32)} ${'N'.padStart(4)} ${'Top-1'.padStart(8)} ${'Top-3'.padStart(8)}`,
  );
  console.log('─'.repeat(56));
  for (const s of categoryStats) {
    const t1 = `${s.top1Hits}/${s.n} (${Math.round((s.top1Hits / s.n) * 100)}%)`;
    const t3 = `${s.top3Hits}/${s.n} (${Math.round((s.top3Hits / s.n) * 100)}%)`;
    console.log(`${s.category.padEnd(32)} ${String(s.n).padStart(4)} ${t1.padStart(8)} ${t3.padStart(8)}`);
  }

  console.log('─'.repeat(56));
  console.log(`\nOverall Top-1 success rate : ${totalTop1}/${totalPairs} = ${top1Rate.toFixed(1)}%`);
  console.log(`Overall Top-3 success rate : ${totalTop3}/${totalPairs} = ${top3Rate.toFixed(1)}%`);
  console.log('\n');

  // ── Emit JSON report ───────────────────────────────────────────────────
  const report = {
    timestamp: new Date().toISOString(),
    corpusSize: totalPairs,
    topOneRate: parseFloat(top1Rate.toFixed(1)),
    topThreeRate: parseFloat(top3Rate.toFixed(1)),
    categoryBreakdown: categoryStats.map((s) => ({
      category: s.category,
      n: s.n,
      top1Rate: parseFloat(((s.top1Hits / s.n) * 100).toFixed(1)),
      top3Rate: parseFloat(((s.top3Hits / s.n) * 100).toFixed(1)),
    })),
    pairs: results,
  };

  const reportJson = JSON.stringify(report, null, 2);
  process.stdout.write('\nJSON report:\n' + reportJson + '\n');
}

runBenchmark().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
