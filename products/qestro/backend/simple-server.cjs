const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3020;
const DEV_ACCESS_TOKEN = 'qestro-dev-access-token';
const DEV_REFRESH_TOKEN = 'qestro-dev-refresh-token';
const onboardingState = new Set(['create_project']);
const repositoryScanUsage = new Map();
const REPOSITORY_SCAN_FEATURE = 'github_repository_scan';
const REPOSITORY_SCAN_USAGE_TYPE = 'repositoryScans';

const planRanks = {
  free: 0,
  pro: 1,
  team: 2,
  enterprise: 3
};

const paidFeatureCatalog = {
  [REPOSITORY_SCAN_FEATURE]: {
    name: 'GitHub Repository Scenario Builder',
    minimumPlan: 'pro',
    includedPlans: ['pro', 'team', 'enterprise'],
    upgradeUrl: '/billing',
    description: 'Connect a GitHub repository reference, generate an AI scan prompt, and build developer, PM, BA, and QA scenario starters.'
  }
};

const planCatalog = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    currency: 'usd',
    interval: 'month',
    description: 'Core Qestro workspace for manual setup and lightweight generation.',
    features: [
      'Workspace dashboard',
      'Test case management',
      'Basic AI test generation',
      'Local recording shell'
    ]
  },
  {
    id: 'pro',
    name: 'Professional',
    price: 4900,
    currency: 'usd',
    interval: 'month',
    description: 'AI-powered test design for active product and engineering teams.',
    features: [
      'GitHub repository scenario builder',
      'AI scan prompt generation',
      'Playwright and API scenario drafts',
      'PM and BA release summaries',
      'Priority support'
    ],
    highlighted: true,
    badge: 'Repository AI'
  },
  {
    id: 'team',
    name: 'Team',
    price: 12900,
    currency: 'usd',
    interval: 'month',
    description: 'Shared governance, higher limits, and cross-functional AI planning.',
    features: [
      'Everything in Professional',
      'Private repository workflows',
      'Team scenario libraries',
      'Usage controls',
      'Audit history'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: -1,
    currency: 'usd',
    interval: 'month',
    description: 'Security, compliance, and custom deployment support.',
    features: [
      'GitHub App install controls',
      'SSO and SCIM',
      'Custom repository indexing policies',
      'Enterprise SLA',
      'Dedicated success team'
    ],
    badge: 'Contact Sales'
  }
];

const planLimits = {
  free: {
    testExecutionCount: 100,
    recordingCount: 10,
    apiCallCount: 500,
    storageUsedMB: 250,
    repositoryScans: 0
  },
  pro: {
    testExecutionCount: 1000,
    recordingCount: 100,
    apiCallCount: 10000,
    storageUsedMB: 1000,
    repositoryScans: 50
  },
  team: {
    testExecutionCount: 5000,
    recordingCount: 500,
    apiCallCount: 50000,
    storageUsedMB: 10000,
    repositoryScans: 250
  },
  enterprise: {
    testExecutionCount: -1,
    recordingCount: -1,
    apiCallCount: -1,
    storageUsedMB: -1,
    repositoryScans: -1
  }
};

const demoUser = {
  id: 'user_dev_qestro',
  email: 'demo@qestro.dev',
  name: 'Qestro Demo Operator',
  role: 'manager',
  roles: ['manager', 'developer', 'tester'],
  subscription: 'team'
};

const ok = (data, extra = {}) => ({ success: true, data, ...extra });
const authPayload = (user = demoUser) => ok({
  user,
  tokens: {
    accessToken: DEV_ACCESS_TOKEN,
    refreshToken: DEV_REFRESH_TOKEN
  }
});

function resolveUser(req) {
  const auth = req.get('authorization') || '';
  if (auth === `Bearer ${DEV_ACCESS_TOKEN}` || auth === `Bearer ${DEV_REFRESH_TOKEN}`) {
    return demoUser;
  }
  return null;
}

function resolvePlan(req) {
  const requestedPlan = String(req.get('x-qestro-plan') || '').toLowerCase();
  if (Object.prototype.hasOwnProperty.call(planRanks, requestedPlan)) {
    return requestedPlan;
  }

  const user = resolveUser(req);
  const userPlan = String(user?.subscription || '').toLowerCase();
  if (Object.prototype.hasOwnProperty.call(planRanks, userPlan)) {
    return userPlan;
  }

  return 'free';
}

function hasPlanAccess(planId, minimumPlan) {
  return (planRanks[planId] || 0) >= (planRanks[minimumPlan] || 0);
}

function getUsageKey(req, type) {
  const user = resolveUser(req);
  return `${user?.id || req.ip || 'anonymous'}:${type}`;
}

function getUsage(req, type) {
  return repositoryScanUsage.get(getUsageKey(req, type)) || 0;
}

function incrementUsage(req, type) {
  const key = getUsageKey(req, type);
  const next = (repositoryScanUsage.get(key) || 0) + 1;
  repositoryScanUsage.set(key, next);
  return next;
}

function buildFeatureAccess(req, feature) {
  const featureConfig = paidFeatureCatalog[feature];
  const planId = resolvePlan(req);

  if (!featureConfig) {
    return {
      feature,
      planId,
      hasAccess: true,
      minimumPlan: 'free',
      upgradeUrl: '/billing'
    };
  }

  const limit = planLimits[planId]?.[REPOSITORY_SCAN_USAGE_TYPE] ?? 0;
  const used = getUsage(req, REPOSITORY_SCAN_USAGE_TYPE);
  const planAllowed = hasPlanAccess(planId, featureConfig.minimumPlan);
  const usageAllowed = limit === -1 || used < limit;

  return {
    ...featureConfig,
    feature,
    planId,
    hasAccess: planAllowed && usageAllowed,
    usage: {
      type: REPOSITORY_SCAN_USAGE_TYPE,
      used,
      limit,
      remaining: limit === -1 ? -1 : Math.max(limit - used, 0)
    },
    denialReason: !planAllowed
      ? 'plan_required'
      : !usageAllowed
        ? 'usage_limit_reached'
        : null
  };
}

function buildChatReply(messages = []) {
  const last = [...messages].reverse().find((message) => message?.role === 'user')?.content || '';
  const request = String(last).trim();

  if (!request) {
    return 'Tell me the product area, user role, and risk you want covered. I will turn it into test scenarios, acceptance criteria, and an execution plan.';
  }

  const lower = request.toLowerCase();
  if (lower.includes('pm') || lower.includes('product') || lower.includes('business')) {
    return `For product and business review, I would turn "${request}" into: 1) success metrics, 2) acceptance criteria, 3) user journey risks, 4) release blockers, and 5) test evidence for stakeholders.`;
  }
  if (lower.includes('api') || lower.includes('database') || lower.includes('sql')) {
    return `For "${request}", I would generate API/database checks covering contract shape, auth boundaries, empty states, migration safety, latency budgets, and rollback signals.`;
  }
  return `I can help build a test plan for "${request}". Recommended next steps: capture the happy path, add edge cases, generate Playwright/API tests, run them across environments, and summarize risk for the release owner.`;
}

function parseGitHubRepository(input) {
  const raw = String(input || '').trim();
  if (!raw) {
    return null;
  }

  const normalized = raw.startsWith('github.com/') ? `https://${raw}` : raw;

  try {
    const url = new URL(normalized);
    if (url.hostname !== 'github.com') {
      return null;
    }

    const [owner, repository] = url.pathname
      .replace(/^\/+|\/+$/g, '')
      .split('/');

    if (!owner || !repository) {
      return null;
    }

    const cleanRepository = repository.replace(/\.git$/i, '');

    return {
      url: `https://github.com/${owner}/${cleanRepository}`,
      owner,
      name: cleanRepository,
      fullName: `${owner}/${cleanRepository}`
    };
  } catch {
    return null;
  }
}

function personaLabel(persona) {
  const labels = {
    developer: 'developer',
    product: 'product manager',
    business: 'business analyst',
    qa: 'QA lead'
  };

  return labels[persona] || labels.developer;
}

function buildRepositoryScanPrompt({ repository, branch, focus, persona }) {
  const audience = personaLabel(persona);
  const focusText = focus || 'core user journeys, API contracts, data handling, release risks, and automation candidates';

  return [
    'You are Qestro Repository Scenario Architect.',
    '',
    `Repository: ${repository.url}`,
    `Branch: ${branch}`,
    `Primary audience: ${audience}`,
    `Testing focus: ${focusText}`,
    '',
    'Mission:',
    '1. Connect to the GitHub repository and inspect the file tree, package manifests, routes, API handlers, database schema, auth boundaries, and deployment configuration.',
    '2. Infer the product domain, critical user journeys, system integrations, business rules, and release risks from code and docs.',
    '3. Build scenarios that work for developers, product managers, QA, and business analysts. Use plain language for intent and precise technical details for automation.',
    '4. Identify gaps where the repository lacks tests, observability, fixtures, seed data, accessibility coverage, or rollback evidence.',
    '',
    'Return strict JSON with this shape:',
    '{',
    '  "repository": "owner/name",',
    '  "branch": "branch-name",',
    '  "summary": "what the project does and where risk lives",',
    '  "scenarios": [',
    '    {',
    '      "id": "repo-scenario-1",',
    '      "title": "short scenario title",',
    '      "persona": "developer | product | business | qa",',
    '      "type": "E2E | API | Visual | Data | Security | Accessibility",',
    '      "priority": "critical | high | medium | low",',
    '      "sourcePaths": ["likely/files/or/routes"],',
    '      "businessReason": "why PMs and analysts care",',
    '      "technicalReason": "why engineers care",',
    '      "steps": ["actionable test step"],',
    '      "assertions": ["observable expected result"],',
    '      "automationTarget": "Playwright | API contract | Maestro | unit/integration"',
    '    }',
    '  ],',
    '  "openQuestions": ["missing repo detail to confirm"]',
    '}',
    '',
    'Prioritize scenarios that prove customer value, revenue or data risk, permission boundaries, and production readiness. Do not invent unavailable secrets or private services; call out assumptions explicitly.'
  ].join('\n');
}

function buildRepositoryScenarios(repository, focus, persona) {
  const focusLabel = focus || 'repository-critical flows';
  const audience = personaLabel(persona);

  return [
    {
      id: 'repo-scan-journey',
      name: 'Critical user journey from repository routes',
      type: 'E2E',
      priority: 'critical',
      persona: audience,
      rationale: `Map ${repository.fullName} routes and screens into a happy path plus failure path that validates ${focusLabel}.`,
      sourcePaths: ['README.md', 'package.json', 'src/routes/**', 'src/pages/**'],
      steps: [
        'Scan app entry points, route definitions, and navigation labels.',
        'Build the primary user journey with setup, action, expected state, and rollback evidence.',
        'Generate Playwright coverage for success, empty state, permission denied, and recovery.'
      ],
      selected: true
    },
    {
      id: 'repo-scan-api-contracts',
      name: 'API and data contract risk scan',
      type: 'API',
      priority: 'high',
      persona: 'developer',
      rationale: `Identify handlers, schemas, and persistence contracts in ${repository.fullName} that can break product workflows.`,
      sourcePaths: ['src/api/**', 'backend/**', 'schema/**', 'migrations/**'],
      steps: [
        'Discover request and response contracts from handlers, schemas, and tests.',
        'Generate positive, invalid input, unauthorized, and boundary-value checks.',
        'Attach business-readable acceptance criteria to every contract assertion.'
      ],
      selected: true
    },
    {
      id: 'repo-scan-business-rules',
      name: 'Business rule and analytics validation',
      type: 'Data',
      priority: persona === 'business' || persona === 'product' ? 'critical' : 'high',
      persona: audience,
      rationale: `Translate product logic in ${repository.fullName} into scenarios PMs and analysts can review before release.`,
      sourcePaths: ['docs/**', 'src/lib/**', 'src/services/**', 'analytics/**'],
      steps: [
        'Find calculations, flags, lifecycle states, and reporting events.',
        'Create plain-language scenarios for each rule with examples and expected metrics.',
        'Generate data fixtures and assertions for edge cases, null states, and trend changes.'
      ],
      selected: true
    },
    {
      id: 'repo-scan-production-readiness',
      name: 'Production readiness and regression shield',
      type: 'Security',
      priority: 'high',
      persona: 'qa',
      rationale: `Connect deployment, auth, accessibility, and observability signals into release-blocking scenarios for ${repository.fullName}.`,
      sourcePaths: ['.github/workflows/**', 'deploy/**', 'src/auth/**', 'src/components/**'],
      steps: [
        'Inspect CI, environment configuration, auth boundaries, and user-facing components.',
        'Create smoke, accessibility, permission, and telemetry checks for release gates.',
        'Summarize blockers in language suitable for engineering, product, and business sign-off.'
      ],
      selected: true
    }
  ];
}

const dashboardStats = {
  testCases: {
    total: 64,
    active: 52,
    byType: { Functional: 28, Regression: 16, API: 12, Visual: 8 }
  },
  devices: {
    total: 18,
    available: 13,
    busy: 5
  },
  projects: {
    total: 3
  },
  execution: {
    coverage: 91,
    statusBreakdown: {
      passed: 128,
      failed: 3,
      pending: 7
    }
  },
  security: {
    score: 96,
    grade: 'A',
    criticalIssues: 0,
    posture: { auth: 146, data: 142, infra: 139, api: 144, client: 141, gdpr: 145 }
  },
  aiStats: {
    selfHealed: 18,
    generated: 34,
    optimizedTimeMs: 7400
  },
  liveFeed: [
    {
      id: 'feed-ai-1',
      title: 'AI generated checkout regression',
      type: 'ai',
      timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      relativeTime: '8m ago',
      message: 'Generated 14 Playwright checks from a checkout user story.'
    },
    {
      id: 'feed-run-1',
      title: 'Release smoke run',
      type: 'run',
      timestamp: new Date(Date.now() - 21 * 60 * 1000).toISOString(),
      relativeTime: '21m ago',
      message: '128 checks passed, 3 failures triaged with suggested fixes.'
    }
  ]
};

const testCases = [
  {
    id: 'tc-login-001',
    title: 'Login accepts verified users',
    description: 'Validate email/password sign in, redirect, and session persistence.',
    type: 'Functional',
    status: 'active',
    priority: 'high',
    tags: ['auth', 'release'],
    lastRun: 'passed'
  },
  {
    id: 'tc-checkout-014',
    title: 'Checkout tax and discount rules',
    description: 'Confirm product, finance, and QA agree on business calculations.',
    type: 'API',
    status: 'active',
    priority: 'critical',
    tags: ['payments', 'business'],
    lastRun: 'failed'
  }
];

const testPlans = [
  {
    id: 'plan-release-readiness',
    name: 'Release readiness',
    description: 'Cross-functional release plan for engineering, product, and business review.',
    status: 'active',
    testCaseCount: 32,
    coverage: 91
  }
];

const cycles = [
  {
    id: 'cycle-2026-05-02',
    name: 'May release cycle',
    status: 'in_progress',
    environment: 'staging',
    progress: 74,
    passed: 128,
    failed: 3
  }
];

// Middleware
app.use(cors({
  origin(origin, callback) {
    if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      callback(null, origin || true);
      return;
    }

    callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true
}));
app.use(express.json());

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ success: false, error: 'Email and password are required' });
    return;
  }

  res.json(authPayload({
    ...demoUser,
    email: String(email),
    name: String(email).split('@')[0].replace(/[._-]+/g, ' ') || demoUser.name
  }));
});

app.post('/api/auth/register', (req, res) => {
  const email = String(req.body?.email || demoUser.email);
  res.status(201).json(authPayload({
    ...demoUser,
    id: `user_${Date.now()}`,
    email,
    name: String(req.body?.name || email.split('@')[0] || demoUser.name)
  }));
});

app.post('/api/auth/refresh', (_req, res) => {
  res.json(authPayload());
});

app.get('/api/auth/me', (req, res) => {
  const user = resolveUser(req);
  if (!user) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  res.json(ok({ user }));
});

app.post('/api/auth/logout', (_req, res) => {
  res.json(ok({ loggedOut: true }));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Qestro Backend is running',
    timestamp: new Date().toISOString(),
    features: {
      voiceToText: true,
      recording: true,
      aiServices: true,
      dataValidation: true,
      apiTesting: true
    }
  });
});

app.get('/api/dashboard/stats', (_req, res) => {
  res.json(ok(dashboardStats));
});

app.get('/api/dashboard/health', (_req, res) => {
  res.json(ok({
    status: 'Healthy',
    checkedAt: new Date().toISOString(),
    services: [
      { name: 'AI planner', status: 'online' },
      { name: 'Execution engine', status: 'online' },
      { name: 'Evidence store', status: 'online' }
    ]
  }));
});

app.get('/api/billing/plans', (_req, res) => {
  res.json({
    success: true,
    plans: planCatalog
  });
});

app.get('/api/billing/subscription', (req, res) => {
  const planId = resolvePlan(req);
  res.json({
    success: true,
    subscription: {
      planId,
      status: planId === 'free' ? 'free' : 'active',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      default_payment_method: planId === 'free'
        ? undefined
        : {
            card: {
              last4: '4242',
              brand: 'visa',
              exp_month: 12,
              exp_year: 2027
            }
          }
    },
    plan: planCatalog.find((plan) => plan.id === planId) || planCatalog[0]
  });
});

app.get('/api/billing/usage', (req, res) => {
  const planId = resolvePlan(req);
  res.json({
    success: true,
    usage: {
      testExecutionCount: 42,
      recordingCount: 6,
      apiCallCount: 128,
      storageUsedMB: 96,
      repositoryScans: getUsage(req, REPOSITORY_SCAN_USAGE_TYPE)
    },
    limits: planLimits[planId] || planLimits.free
  });
});

app.get('/api/billing/invoices', (_req, res) => {
  res.json({
    success: true,
    invoices: []
  });
});

app.post('/api/billing/checkout', (req, res) => {
  const planId = String(req.body?.planId || 'pro');
  res.json({
    success: true,
    checkoutUrl: `/billing?checkout=${encodeURIComponent(planId)}`,
    planId
  });
});

app.post('/api/billing/portal', (_req, res) => {
  res.json({
    success: true,
    portalUrl: '/billing?portal=local'
  });
});

app.get('/api/billing/feature-access/:feature', (req, res) => {
  res.json({
    success: true,
    access: buildFeatureAccess(req, req.params.feature)
  });
});

app.get('/api/test-cases', (_req, res) => {
  res.json(ok(testCases));
});

app.post('/api/test-cases', (req, res) => {
  res.status(201).json(ok({ id: `tc-${Date.now()}`, ...req.body }));
});

app.get('/api/test-plans', (_req, res) => {
  res.json(ok(testPlans));
});

app.post('/api/test-plans', (req, res) => {
  res.status(201).json(ok({ id: `plan-${Date.now()}`, ...req.body }));
});

app.get('/api/cycles', (_req, res) => {
  res.json(ok(cycles));
});

app.get('/api/cycles/stats/summary', (_req, res) => {
  res.json(ok({
    total: cycles.length,
    inProgress: cycles.filter((cycle) => cycle.status === 'in_progress').length,
    passRate: 97.7
  }));
});

app.get('/api/automation-runs', (_req, res) => {
  res.json(ok([
    {
      id: 'run-release-smoke',
      name: 'Release smoke run',
      status: 'passed',
      environment: 'staging',
      startedAt: new Date(Date.now() - 24 * 60 * 1000).toISOString(),
      durationMs: 412000,
      passed: 128,
      failed: 3
    }
  ]));
});

app.post('/api/automation-runs', (req, res) => {
  res.status(201).json(ok({
    id: `run-${Date.now()}`,
    status: 'queued',
    ...req.body
  }));
});

app.get('/api/insights/overview', (_req, res) => {
  res.json(ok({
    riskScore: 14,
    trend: 'improving',
    summary: 'Release risk is low. Remaining failures cluster around checkout edge cases.',
    recommendations: [
      'Ask AI to generate negative checkout cases from current payment rules.',
      'Run the staging smoke plan before stakeholder sign-off.'
    ]
  }));
});

app.get('/api/insights/weekly', (_req, res) => {
  res.json(ok([
    { day: 'Mon', passed: 83, failed: 5 },
    { day: 'Tue', passed: 97, failed: 4 },
    { day: 'Wed', passed: 112, failed: 3 },
    { day: 'Thu', passed: 128, failed: 3 }
  ]));
});

app.get('/api/insights/trend', (_req, res) => {
  res.json(ok({
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    coverage: [74, 82, 88, 91],
    escapedDefects: [6, 4, 2, 1]
  }));
});

app.get('/api/onboarding/progress', (_req, res) => {
  res.json(ok({
    completedSteps: [...onboardingState],
    updatedAt: Date.now()
  }));
});

app.post('/api/onboarding/progress/:stepId/complete', (req, res) => {
  onboardingState.add(req.params.stepId);
  res.json(ok({
    completedSteps: [...onboardingState],
    updatedAt: Date.now()
  }));
});

app.delete('/api/onboarding/progress', (_req, res) => {
  onboardingState.clear();
  res.json(ok({
    completedSteps: [],
    updatedAt: Date.now()
  }));
});

app.post('/api/ai/chat', (req, res) => {
  res.json(ok({
    reply: buildChatReply(req.body?.messages)
  }));
});

app.post('/api/ai/generate-test', (req, res) => {
  const prompt = String(req.body?.prompt || req.body?.description || 'requested scenario');
  res.json(ok({
    title: 'AI generated release test',
    summary: `Generated from: ${prompt}`,
    framework: 'playwright',
    code: `test('generated flow', async ({ page }) => {\n  await page.goto('/');\n  await expect(page.getByText('Qestro')).toBeVisible();\n});`
  }));
});

app.post('/api/testgen/repository-scan', (req, res) => {
  const repository = parseGitHubRepository(req.body?.repositoryUrl);
  const branch = String(req.body?.branch || 'main').trim() || 'main';
  const focus = String(req.body?.focus || '').trim();
  const requestedPersona = String(req.body?.persona || 'developer');
  const persona = ['developer', 'product', 'business', 'qa'].includes(requestedPersona)
    ? requestedPersona
    : 'developer';

  if (!repository) {
    res.status(400).json({
      success: false,
      error: 'Enter a valid GitHub repository URL like https://github.com/owner/repo'
    });
    return;
  }

  const access = buildFeatureAccess(req, REPOSITORY_SCAN_FEATURE);
  if (!access.hasAccess) {
    res.status(402).json({
      success: false,
      error: access.denialReason === 'usage_limit_reached'
        ? 'Repository scan usage limit reached. Upgrade your plan to continue.'
        : 'GitHub repository scenario building is a paid feature. Upgrade to Professional to continue.',
      billing: access
    });
    return;
  }

  const used = incrementUsage(req, REPOSITORY_SCAN_USAGE_TYPE);
  const limit = planLimits[access.planId]?.[REPOSITORY_SCAN_USAGE_TYPE] ?? 0;

  res.json(ok({
    repository: {
      ...repository,
      branch
    },
    connection: {
      provider: 'github',
      status: 'prompt_ready',
      liveIndexing: false
    },
    billing: {
      feature: REPOSITORY_SCAN_FEATURE,
      planId: access.planId,
      minimumPlan: access.minimumPlan,
      usage: {
        type: REPOSITORY_SCAN_USAGE_TYPE,
        used,
        limit,
        remaining: limit === -1 ? -1 : Math.max(limit - used, 0)
      }
    },
    message: `Generated repository scan prompt and ${personaLabel(persona)} scenario starter set for ${repository.fullName}.`,
    prompt: buildRepositoryScanPrompt({ repository, branch, focus, persona }),
    scenarios: buildRepositoryScenarios(repository, focus, persona)
  }));
});

// Voice-to-text health check
app.get('/api/voice-to-text/health', (req, res) => {
  res.json({
    status: 'healthy',
    services: {
      voiceRecognition: 'online',
      commandProcessing: 'online',
      voiceGuidedRecording: 'online'
    },
    providers: {
      openai: 'available',
      google: 'available',
      aws: 'available',
      azure: 'available',
      local: 'available'
    },
    languages: ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ru-RU', 'zh-CN', 'ja-JP', 'ko-KR']
  });
});

// Voice providers endpoint
app.get('/api/voice-to-text/providers', (req, res) => {
  res.json({
    providers: [
      { id: 'openai', name: 'OpenAI Whisper', status: 'available' },
      { id: 'google', name: 'Google Speech-to-Text', status: 'available' },
      { id: 'aws', name: 'AWS Transcribe', status: 'available' },
      { id: 'azure', name: 'Azure Speech Services', status: 'available' },
      { id: 'local', name: 'Local/Offline', status: 'available' }
    ]
  });
});

// Supported languages endpoint
app.get('/api/voice-to-text/languages', (req, res) => {
  res.json({
    languages: [
      { code: 'en-US', name: 'English (US)', supported: true },
      { code: 'es-ES', name: 'Spanish (Spain)', supported: true },
      { code: 'fr-FR', name: 'French (France)', supported: true },
      { code: 'de-DE', name: 'German (Germany)', supported: true },
      { code: 'it-IT', name: 'Italian (Italy)', supported: true },
      { code: 'pt-BR', name: 'Portuguese (Brazil)', supported: true },
      { code: 'ru-RU', name: 'Russian (Russia)', supported: true },
      { code: 'zh-CN', name: 'Chinese (Simplified)', supported: true },
      { code: 'ja-JP', name: 'Japanese (Japan)', supported: true },
      { code: 'ko-KR', name: 'Korean (Korea)', supported: true }
    ]
  });
});

// Command patterns endpoint
app.get('/api/voice-to-text/supported-commands', (req, res) => {
  res.json({
    commandTypes: [
      {
        type: 'navigation',
        patterns: ['navigate to {url}', 'go to {page}', 'visit {site}'],
        examples: ['navigate to google.com', 'go to login page']
      },
      {
        type: 'interaction',
        patterns: ['click {element}', 'tap {button}', 'press {link}'],
        examples: ['click submit button', 'tap login link']
      },
      {
        type: 'input',
        patterns: ['type {text}', 'enter {value} into {field}'],
        examples: ['type hello world', 'enter password in field']
      },
      {
        type: 'assertion',
        patterns: ['verify {condition}', 'check {property}', 'assert {state}'],
        examples: ['verify page title', 'check button is visible']
      },
      {
        type: 'wait',
        patterns: ['wait for {condition}', 'wait {duration}'],
        examples: ['wait for page load', 'wait 3 seconds']
      },
      {
        type: 'control',
        patterns: ['pause', 'resume', 'stop recording'],
        examples: ['pause recording', 'stop session']
      }
    ]
  });
});

// Catch all other routes
app.get('*', (req, res) => {
  res.json({ message: 'Qestro API - Endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Qestro Backend running on http://localhost:${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
  console.log(`🎤 Voice-to-Text ready: http://localhost:${PORT}/api/voice-to-text/health`);
});
