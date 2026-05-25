import { Hono } from 'hono';

const mockRoutes = new Hono();

// --- BILLING ROUTES ---
mockRoutes.get('/billing/plans', (c) => c.json({
    success: true,
    plans: [
        { id: 'free', name: 'Developer', price: 0, interval: 'month', description: 'For hobbyists', features: ['100 Test Runs', 'Community Support'] },
        { id: 'pro', name: 'Professional', price: 4900, interval: 'month', description: 'For growing teams', features: ['Unlimited Runs', 'Priority Support', 'API Access', 'Custom Domains'], highlighted: true, badge: 'Popular' },
        { id: 'team', name: 'Team', price: 19900, interval: 'month', description: 'For large engineering orgs', features: ['SSO', 'Dedicated CSM', 'Uptime SLA'] },
    ]
}));
mockRoutes.get('/billing/subscription', (c) => c.json({
    success: true,
    subscription: { status: 'active', planId: 'pro', currentPeriodEnd: new Date(Date.now() + 86400000 * 30).toISOString(), default_payment_method: { card: { last4: '4242', brand: 'visa', exp_month: 12, exp_year: 26 } } }
}));
mockRoutes.get('/billing/usage', (c) => c.json({
    success: true,
    usage: { testExecutionCount: 450, recordingCount: 12, apiCallCount: 1250, storageUsedMB: 15 }
}));
mockRoutes.get('/billing/invoices', (c) => c.json({
    success: true,
    invoices: [{ id: 'inv_1', amount_paid: 4900, status: 'paid', created: Math.floor(Date.now() / 1000) - 86400 * 5, number: 'INV-2026-001', hostedInvoiceUrl: '#' }]
}));
mockRoutes.post('/billing/portal', (c) => c.json({ success: true, portalUrl: 'https://billing.stripe.com/p/session/test' }));
mockRoutes.post('/billing/checkout', (c) => c.json({ success: true, checkoutUrl: 'https://checkout.stripe.com/pay/test' }));

// --- DASHBOARD / AI CENTER ROUTES ---
mockRoutes.get('/dashboard/stats', (c) => c.json({
    success: true,
    stats: { totalTests: 1240, passedTests: 1180, failedTests: 60, coverage: 85, activeAgents: 3 }
}));
mockRoutes.get('/dashboard/health', (c) => c.json({
    success: true,
    health: { status: 'healthy', uptime: '99.99%', lastIncident: 'None' }
}));
mockRoutes.post('/openclaw/incoming', async (c) => {
    const body = await c.req.json();
    if (body.action === 'dashboard') {
        return c.json({ success: true, stats: { totalRuns: 120, passRate: 98, activeIssues: 1, healingEvents: 5 } });
    }
    if (body.action === 'failures') {
        return c.json({ success: true, failures: [{ id: 'f1', title: 'Login Timeout', test: 'E2E-Auth' }] });
    }
    return c.json({ success: true, message: 'Action queued' });
});
mockRoutes.get('/openclaw/status', (c) => c.json({ success: true, status: 'online', connected: true, model: 'gpt-4' }));
mockRoutes.get('/openclaw/daily-summary', (c) => c.json({ success: true, data: { status: 'healthy', score: 95, summary: 'All systems optimal. 5 healing events triggered safely.' } }));
mockRoutes.post('/openclaw/self-healing', (c) => c.json({ success: true }));

// --- NOTIFICATIONS ---
mockRoutes.get('/notifications/rules', (c) => c.json({
    success: true,
    rules: [
        { id: '1', name: 'Test Failures', active: true, channels: ['slack', 'email'] },
        { id: '2', name: 'Deployment Success', active: true, channels: ['slack'] }
    ]
}));
mockRoutes.get('/notifications/recipients', (c) => c.json({
    success: true,
    recipients: [{ id: '1', type: 'slack', target: '#qa-alerts' }, { id: '2', type: 'email', target: 'team@questro.io' }]
}));
mockRoutes.post('/notifications/test', (c) => c.json({ success: true }));

// --- EXPLORATIONS / TEST CASES / MISSIONS ---
mockRoutes.get('/test-cases', (c) => c.json({
    success: true,
    data: [
        { id: 'tc-1', title: 'User Registration Flow', status: 'active', priority: 'high', suite: 'Core API' },
        { id: 'tc-2', title: 'Stripe Payment Verification', status: 'active', priority: 'critical', suite: 'Billing' }
    ]
}));
mockRoutes.get('/explorations', (c) => c.json({
    success: true,
    data: [
        { id: 'exp-1', name: 'Header Navigation Check', status: 'completed', duration: '2m', findings: 0 },
        { id: 'exp-2', name: 'Mobile Checkout Sandbox', status: 'running', duration: '45s', findings: 1 }
    ]
}));
mockRoutes.post('/explorations', (c) => c.json({ success: true, id: 'exp-3' }));
mockRoutes.get('/missions', (c) => c.json({
    success: true,
    data: [
        { id: 'ms-1', name: 'Full Regression Suite', status: 'active', tests_run: 120, total_tests: 125 }
    ]
}));
mockRoutes.get('/cycles/:id', (c) => c.json({
    success: true,
    data: { id: c.req.param('id'), name: 'Pre-release Cycle', status: 'running' }
}));
mockRoutes.get('/test-plans', (c) => c.json({
    success: true,
    data: [{ id: 'tp-1', name: 'Core Functionality', status: 'active' }]
}));

// --- JIRA / INTEGRATIONS ---
mockRoutes.get('/integrations/jira/status', (c) => c.json({ connected: true, jiraUrl: 'https://qestro.atlassian.net' }));
mockRoutes.get('/integrations/jira/auth-url', (c) => c.json({ url: 'https://qestro.atlassian.net/login' }));
mockRoutes.post('/integrations/jira/disconnect', (c) => c.json({ success: true }));

// --- INSIGHTS ---
mockRoutes.get('/insights/overview', (c) => c.json({
    success: true,
    data: { healthScore: 92, testCoverage: '84%', mttr: '1.2 hours', flakyTests: 4 }
}));
mockRoutes.get('/insights/weekly', (c) => c.json({
    success: true,
    data: [
        { date: 'Mon', passed: 120, failed: 2 },
        { date: 'Tue', passed: 125, failed: 1 },
        { date: 'Wed', passed: 130, failed: 5 },
        { date: 'Thu', passed: 128, failed: 0 },
        { date: 'Fri', passed: 140, failed: 2 }
    ]
}));
mockRoutes.get('/insights/trend', (c) => c.json({
    success: true,
    data: { trend: 'up', percentage: 12 }
}));

// --- CLOUD DEVICES ---
mockRoutes.get('/devices/cloud', (c) => c.json({
    success: true,
    data: [
        { id: 'dev-1', name: 'macOS Sonoma - Chrome', type: 'desktop', status: 'available' },
        { id: 'dev-2', name: 'Windows 11 - Edge', type: 'desktop', status: 'in-use' }
    ]
}));
mockRoutes.get('/devices/mobile', (c) => c.json({
    success: true,
    data: [
        { id: 'mob-1', name: 'iPhone 15 Pro', os: 'iOS 17.2', status: 'available' },
        { id: 'mob-2', name: 'Pixel 8', os: 'Android 14', status: 'offline' }
    ]
}));

export default mockRoutes;
