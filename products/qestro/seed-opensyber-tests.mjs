/**
 * Seed OpenSyber test cases into Qestro via the API
 * Run on local machine: node seed-opensyber-tests.mjs
 */

const API = process.env.QESTRO_API || 'https://api.qestro.app';

const testCases = [
  // ── 1. LANDING PAGE ──
  { title: 'Homepage loads with 200 status', type: 'web', priority: 'Critical', status: 'Active', targetUrl: 'https://opensyber.cloud', description: 'Verify opensyber.cloud homepage returns 200 and renders hero section', tags: ['landing', 'smoke'], expectedResults: ['Page returns 200', 'Title contains OpenSyber', 'Hero CTA visible'] },
  { title: 'Homepage has correct meta tags', type: 'web', priority: 'High', status: 'Active', targetUrl: 'https://opensyber.cloud', description: 'Verify OG tags, meta description, and title are correct', tags: ['seo', 'landing'], expectedResults: ['og:title present', 'meta description > 50 chars'] },
  { title: 'Navigation bar shows all links', type: 'web', priority: 'High', status: 'Active', targetUrl: 'https://opensyber.cloud', description: 'Verify header nav: Pricing, Skills, Docs, Blog, Demo, Threat Intel, Sign In', tags: ['navigation', 'landing'], expectedResults: ['All 7 nav items visible'] },
  { title: 'Footer has Privacy and Terms links', type: 'web', priority: 'Medium', status: 'Active', targetUrl: 'https://opensyber.cloud', description: 'Footer renders with legal links and social links', tags: ['footer', 'legal'], expectedResults: ['Privacy link present', 'Terms link present'] },

  // ── 2. AUTH FLOWS ──
  { title: 'Sign-in page loads with OAuth providers', type: 'web', priority: 'Critical', status: 'Active', targetUrl: 'https://opensyber.cloud/sign-in', description: 'Sign-in page renders with Google and GitHub OAuth buttons', tags: ['auth', 'smoke'], expectedResults: ['Page loads', 'OAuth providers visible', 'No demo credentials'] },
  { title: 'Sign-up page loads with registration form', type: 'web', priority: 'Critical', status: 'Active', targetUrl: 'https://opensyber.cloud/sign-up', description: 'Sign-up page renders registration UI with terms references', tags: ['auth', 'smoke'], expectedResults: ['Page loads', 'Terms/Privacy referenced'] },
  { title: 'Dashboard redirects unauthenticated users', type: 'web', priority: 'Critical', status: 'Active', targetUrl: 'https://opensyber.cloud/dashboard', description: 'Accessing /dashboard without auth redirects to sign-in', tags: ['auth', 'security'], expectedResults: ['Redirects to sign-in or shows auth prompt'] },
  { title: 'No hardcoded credentials exposed', type: 'web', priority: 'Critical', status: 'Active', targetUrl: 'https://opensyber.cloud/sign-in', description: 'No demo@, test@, password123, or admin@ visible on sign-in', tags: ['security', 'auth'], expectedResults: ['No demo credentials in page content'] },
  { title: 'No API keys leaked in page source', type: 'web', priority: 'Critical', status: 'Active', targetUrl: 'https://opensyber.cloud/sign-in', description: 'No sk-, AKIA, ghp_, or private keys in HTML source', tags: ['security'], expectedResults: ['No API key patterns in HTML'] },

  // ── 3. PRICING ──
  { title: 'Pricing page shows all 4 plan tiers', type: 'web', priority: 'High', status: 'Active', targetUrl: 'https://opensyber.cloud/pricing', description: 'Free, Professional, Team, Enterprise plans all visible', tags: ['pricing', 'conversion'], expectedResults: ['Free tier shown', 'Professional shown', 'Team shown', 'Enterprise shown'] },
  { title: 'Enterprise plan has contact CTA', type: 'web', priority: 'High', status: 'Active', targetUrl: 'https://opensyber.cloud/pricing', description: 'Enterprise tier shows contact sales / custom pricing CTA', tags: ['pricing', 'conversion'], expectedResults: ['Contact/Sales CTA present'] },
  { title: 'Billing toggle works (monthly/annual)', type: 'web', priority: 'Medium', status: 'Active', targetUrl: 'https://opensyber.cloud/pricing', description: 'Toggle between monthly and annual billing', tags: ['pricing', 'interactive'], expectedResults: ['Toggle clickable', 'Prices update'] },

  // ── 4. MARKETPLACE ──
  { title: 'Marketplace page loads with skill cards', type: 'web', priority: 'High', status: 'Active', targetUrl: 'https://opensyber.cloud/marketplace', description: 'Skills marketplace renders with category filters and skill cards', tags: ['marketplace', 'features'], expectedResults: ['Skill cards visible', 'Category filters present'] },
  { title: 'Skill detail page loads', type: 'web', priority: 'Medium', status: 'Active', targetUrl: 'https://opensyber.cloud/marketplace', description: 'Click on a skill to view details, description, install info', tags: ['marketplace'], expectedResults: ['Detail page renders', 'Description visible'] },
  { title: 'Marketplace bundles page loads', type: 'web', priority: 'Medium', status: 'Active', targetUrl: 'https://opensyber.cloud/marketplace/bundles', description: 'Premium skill bundles page renders without errors', tags: ['marketplace', 'bundles'], expectedResults: ['Page loads', 'No 404'] },

  // ── 5. DOCS ──
  { title: 'Docs hub loads', type: 'web', priority: 'High', status: 'Active', targetUrl: 'https://opensyber.cloud/docs', description: 'Documentation hub renders with section links', tags: ['docs'], expectedResults: ['Page loads', 'Content present'] },
  { title: 'Getting Started guide has content', type: 'web', priority: 'High', status: 'Active', targetUrl: 'https://opensyber.cloud/docs/getting-started', description: 'Getting started guide has step-by-step instructional content', tags: ['docs', 'onboarding'], expectedResults: ['Page has install/setup content'] },
  { title: 'API reference page loads', type: 'web', priority: 'Medium', status: 'Active', targetUrl: 'https://opensyber.cloud/docs/api', description: 'API reference documentation renders', tags: ['docs', 'api'], expectedResults: ['API content visible'] },
  { title: 'OASF framework page loads', type: 'web', priority: 'Medium', status: 'Active', targetUrl: 'https://opensyber.cloud/docs/oasf', description: 'Open Agent Security Framework page has content', tags: ['docs', 'compliance'], expectedResults: ['OASF content > 200 chars'] },
  { title: 'Skills audit methodology loads', type: 'web', priority: 'Medium', status: 'Active', targetUrl: 'https://opensyber.cloud/docs/skills/audit-methodology', description: '4-stage skill audit methodology documentation', tags: ['docs', 'skills'], expectedResults: ['Page loads with content'] },
  { title: 'FAQ page loads', type: 'web', priority: 'Low', status: 'Active', targetUrl: 'https://opensyber.cloud/docs/faq', description: 'FAQ page renders with questions and answers', tags: ['docs'], expectedResults: ['Page loads'] },

  // ── 6. BLOG ──
  { title: 'Blog index shows article cards', type: 'web', priority: 'Medium', status: 'Active', targetUrl: 'https://opensyber.cloud/blog', description: 'Blog index page shows 3+ article links', tags: ['blog', 'content'], expectedResults: ['3+ article links visible'] },
  { title: 'Introducing OpenSyber article loads', type: 'web', priority: 'Medium', status: 'Active', targetUrl: 'https://opensyber.cloud/blog/introducing-opensyber', description: 'First blog article has substantial content (>500 chars)', tags: ['blog'], expectedResults: ['Article content > 500 chars'] },
  { title: 'MCP Security Best Practices article', type: 'web', priority: 'Medium', status: 'Active', targetUrl: 'https://opensyber.cloud/blog/mcp-security-best-practices', description: 'MCP security article loads with content', tags: ['blog', 'security'], expectedResults: ['Article loads'] },
  { title: 'EU AI Act compliance article', type: 'web', priority: 'Medium', status: 'Active', targetUrl: 'https://opensyber.cloud/blog/eu-ai-act-compliance-for-agent-platforms', description: 'EU AI Act compliance blog post loads', tags: ['blog', 'compliance'], expectedResults: ['Article loads'] },

  // ── 7. DEMO & THREATS ──
  { title: 'Demo page loads with interactive content', type: 'web', priority: 'High', status: 'Active', targetUrl: 'https://opensyber.cloud/demo', description: 'Interactive demo page shows security dashboard simulation', tags: ['demo', 'conversion'], expectedResults: ['Page loads', 'Security content present'] },
  { title: 'Threat intelligence page loads', type: 'web', priority: 'High', status: 'Active', targetUrl: 'https://opensyber.cloud/threats', description: 'Live threat feed with CVE/vulnerability data', tags: ['threats', 'features'], expectedResults: ['Threat data visible'] },

  // ── 8. LEGAL & COMPANY ──
  { title: 'Privacy policy has substantial content', type: 'web', priority: 'High', status: 'Active', targetUrl: 'https://opensyber.cloud/privacy', description: 'Privacy policy > 2000 chars with GDPR references', tags: ['legal'], expectedResults: ['Privacy keyword present', 'Content > 2000 chars'] },
  { title: 'Terms of service has substantial content', type: 'web', priority: 'High', status: 'Active', targetUrl: 'https://opensyber.cloud/terms', description: 'Terms page > 2000 chars', tags: ['legal'], expectedResults: ['Terms keyword present', 'Content > 2000 chars'] },
  { title: 'About page loads', type: 'web', priority: 'Medium', status: 'Active', targetUrl: 'https://opensyber.cloud/about', description: 'Company about page with team info and timeline', tags: ['company'], expectedResults: ['Page loads with content'] },
  { title: 'Security policy page loads', type: 'web', priority: 'High', status: 'Active', targetUrl: 'https://opensyber.cloud/security', description: 'Security page with encryption and compliance info', tags: ['security', 'company'], expectedResults: ['Encryption/TLS/compliance mentioned'] },
  { title: 'Enterprise page loads with SSO info', type: 'web', priority: 'High', status: 'Active', targetUrl: 'https://opensyber.cloud/enterprise', description: 'Enterprise features: SSO, SAML, SLA, data residency', tags: ['enterprise', 'conversion'], expectedResults: ['Enterprise keyword present', 'SSO/SAML mentioned'] },
  { title: 'Governance page loads', type: 'web', priority: 'Medium', status: 'Active', targetUrl: 'https://opensyber.cloud/governance', description: 'Governance framework page', tags: ['compliance'], expectedResults: ['Page returns < 500'] },
  { title: 'Compliance page loads', type: 'web', priority: 'Medium', status: 'Active', targetUrl: 'https://opensyber.cloud/compliance', description: 'Compliance certifications page', tags: ['compliance'], expectedResults: ['Page loads'] },
  { title: 'Partners page loads', type: 'web', priority: 'Low', status: 'Active', targetUrl: 'https://opensyber.cloud/partners', description: 'Partner program page', tags: ['company'], expectedResults: ['Page returns < 500'] },

  // ── 9. COMPARISONS ──
  { title: 'OpenSyber vs DIY monitoring comparison', type: 'web', priority: 'Medium', status: 'Active', targetUrl: 'https://opensyber.cloud/compare/opensyber-vs-diy-monitoring', description: 'Comparison page vs Datadog+Sentry DIY', tags: ['comparison', 'conversion'], expectedResults: ['Page loads with content'] },
  { title: 'TokenForge vs traditional sessions comparison', type: 'web', priority: 'Medium', status: 'Active', targetUrl: 'https://opensyber.cloud/compare/tokenforge-vs-traditional-sessions', description: 'TokenForge device-bound vs cookie sessions comparison', tags: ['comparison', 'tokenforge'], expectedResults: ['Page loads with content'] },

  // ── 10. SECURITY CHECKS ──
  { title: 'HTTPS enforced on all pages', type: 'web', priority: 'Critical', status: 'Active', targetUrl: 'https://opensyber.cloud', description: 'All pages serve over HTTPS', tags: ['security'], expectedResults: ['URL starts with https://'] },
  { title: 'robots.txt exists', type: 'web', priority: 'Low', status: 'Active', targetUrl: 'https://opensyber.cloud/robots.txt', description: 'robots.txt returns < 500', tags: ['seo'], expectedResults: ['File accessible'] },
  { title: 'sitemap.xml exists', type: 'web', priority: 'Low', status: 'Active', targetUrl: 'https://opensyber.cloud/sitemap.xml', description: 'sitemap.xml returns < 500', tags: ['seo'], expectedResults: ['File accessible'] },
  { title: 'No sensitive paths accessible (.env, .git)', type: 'web', priority: 'Critical', status: 'Active', targetUrl: 'https://opensyber.cloud/.env', description: 'Sensitive files not exposed publicly', tags: ['security'], expectedResults: ['No DATABASE_URL or SECRET_KEY in response'] },

  // ── 11. I18N ──
  { title: 'Spanish locale loads', type: 'web', priority: 'Medium', status: 'Active', targetUrl: 'https://opensyber.cloud/es', description: 'Spanish locale renders with translated content', tags: ['i18n'], expectedResults: ['Page loads with content > 500 chars'] },
  { title: 'French locale loads', type: 'web', priority: 'Medium', status: 'Active', targetUrl: 'https://opensyber.cloud/fr', description: 'French locale renders', tags: ['i18n'], expectedResults: ['Page loads'] },
  { title: 'German locale loads', type: 'web', priority: 'Medium', status: 'Active', targetUrl: 'https://opensyber.cloud/de', description: 'German locale renders', tags: ['i18n'], expectedResults: ['Page loads'] },
  { title: 'Japanese locale loads', type: 'web', priority: 'Medium', status: 'Active', targetUrl: 'https://opensyber.cloud/ja', description: 'Japanese locale renders', tags: ['i18n'], expectedResults: ['Page loads'] },

  // ── 12. TOKENFORGE ──
  { title: 'TokenForge homepage loads', type: 'web', priority: 'High', status: 'Active', targetUrl: 'https://tokenforge.opensyber.cloud', description: 'TokenForge subdomain homepage renders', tags: ['tokenforge'], expectedResults: ['Page returns < 500', 'Contains TokenForge'] },
  { title: 'TokenForge pricing loads', type: 'web', priority: 'Medium', status: 'Active', targetUrl: 'https://tokenforge.opensyber.cloud/pricing', description: 'TokenForge pricing page renders', tags: ['tokenforge', 'pricing'], expectedResults: ['Pricing content visible'] },
  { title: 'TokenForge docs loads', type: 'web', priority: 'Medium', status: 'Active', targetUrl: 'https://tokenforge.opensyber.cloud/docs', description: 'TokenForge documentation renders', tags: ['tokenforge', 'docs'], expectedResults: ['Page loads'] },
  { title: 'TokenForge sign-in loads', type: 'web', priority: 'High', status: 'Active', targetUrl: 'https://tokenforge.opensyber.cloud/sign-in', description: 'TokenForge auth page renders', tags: ['tokenforge', 'auth'], expectedResults: ['Sign-in UI visible'] },
  { title: 'TokenForge dashboard redirects unauthenticated', type: 'web', priority: 'High', status: 'Active', targetUrl: 'https://tokenforge.opensyber.cloud/dashboard', description: 'Unauthenticated users redirected from TF dashboard', tags: ['tokenforge', 'auth'], expectedResults: ['Redirects to sign-in or shows auth'] },

  // ── 13. PERFORMANCE ──
  { title: 'Homepage loads under 5 seconds', type: 'web', priority: 'High', status: 'Active', targetUrl: 'https://opensyber.cloud', description: 'Homepage DOMContentLoaded < 5000ms', tags: ['performance'], expectedResults: ['Load time < 5000ms'] },
  { title: 'Sign-in loads under 3 seconds', type: 'web', priority: 'High', status: 'Active', targetUrl: 'https://opensyber.cloud/sign-in', description: 'Sign-in page DOMContentLoaded < 3000ms', tags: ['performance'], expectedResults: ['Load time < 3000ms'] },
  { title: 'Pricing loads under 5 seconds', type: 'web', priority: 'Medium', status: 'Active', targetUrl: 'https://opensyber.cloud/pricing', description: 'Pricing page DOMContentLoaded < 5000ms', tags: ['performance'], expectedResults: ['Load time < 5000ms'] },

  // ── 14. PERSONA FLOWS ──
  { title: 'P1: Solo DevSecOps full journey', type: 'web', priority: 'Critical', status: 'Active', targetUrl: 'https://opensyber.cloud', description: 'Landing → pricing → docs → marketplace → signup (all accessible)', tags: ['persona', 'e2e'], expectedResults: ['All 5 pages return 200'] },
  { title: 'P2: Startup CTO evaluation flow', type: 'web', priority: 'High', status: 'Active', targetUrl: 'https://opensyber.cloud', description: 'Security page → comparison → pricing (all load)', tags: ['persona', 'e2e'], expectedResults: ['All 3 pages return 200'] },
  { title: 'P3: Security Engineer investigation flow', type: 'web', priority: 'High', status: 'Active', targetUrl: 'https://opensyber.cloud', description: 'Threats → OASF → compliance → bundles (all accessible)', tags: ['persona', 'e2e'], expectedResults: ['All 4 pages return < 500'] },
  { title: 'P4: Enterprise CISO evaluation flow', type: 'web', priority: 'High', status: 'Active', targetUrl: 'https://opensyber.cloud', description: 'Enterprise → governance → security → pricing (all load, SSO mentioned)', tags: ['persona', 'e2e'], expectedResults: ['All pages load', 'SSO/SAML referenced'] },
];

// Seed via bulk endpoint
const allCases = testCases.map(tc => ({
  ...tc,
  projectId: 'proj-opensyber',
}));

const response = await fetch(`${API}/api/test-cases/bulk`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ testCases: allCases }),
});

const result = await response.json();
console.log(`Status: ${response.status}`);
console.log(`Seeded: ${result.total || result.data?.length || 0} test cases into Qestro (${API})`);

// Verify
const verify = await fetch(`${API}/api/test-cases`);
const verifyResult = await verify.json();
console.log(`Verified: ${verifyResult.data?.length || 0} test cases in Qestro DB`);
