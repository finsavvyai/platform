export const valueProps = [
  {
    icon: '⛓️',
    title: 'Bridge, not replace',
    body: 'Keep your Gerrit, Jenkins, and AWS CodePipeline investments. PushCI adds a modern control plane on top — no rip-and-replace risk. Import Jenkinsfiles in minutes, not months.',
  },
  {
    icon: '🔒',
    title: 'Security by default',
    body: 'AES-256-GCM secrets at rest, TLS 1.3 in transit, field-level encryption, SHA-256 checksums on every release, tamper-evident audit log, and govulncheck clean on every commit.',
  },
  {
    icon: '📋',
    title: 'Regulated-industry ready',
    body: '7-year audit retention, SOC 2 evidence export, GDPR Article 17 automation. EU data residency and self-hosted deployment available — contact sales for a pilot.',
  },
  {
    icon: '🤖',
    title: 'AI-powered pipeline intelligence',
    body: 'Claude-powered diagnosis pinpoints root causes in seconds. Semantic heal proposes targeted fixes. Bus-factor analytics flag pipelines with single points of failure before they become incidents.',
  },
  {
    icon: '🔌',
    title: 'MCP server integration',
    body: 'PushCI ships a Model Context Protocol server — your AI agents (Claude, Cursor, Windsurf) can trigger builds, read run results, and invoke security scans without leaving their context window.',
  },
  {
    icon: '🌍',
    title: '35 languages, 22 deploy targets',
    body: 'Go, Node, Python, Java, Rust, Ruby, Elixir, Clojure, and 27 more. Deploys to Cloudflare, AWS, GCP, Fly.io, Vercel, Railway, Render, Terraform, Pulumi, Kubernetes, Docker, and more — 22 targets, one CLI.',
  },
]

export const integrations = [
  'Gerrit', 'Jenkins', 'AWS CodePipeline', 'GitHub Actions', 'GitLab CI', 'Bitbucket Pipelines',
  'Maven', 'Gradle', 'Ant', 'SonarQube', 'Azure AD', 'Okta',
  'SAML / SCIM', 'Slack', 'Discord', 'Telegram',
  'Docker', 'Kubernetes', 'Terraform', 'GoReleaser',
]

export const badges = [
  { label: 'SOC 2', sub: 'in progress' },
  { label: 'GDPR', sub: 'article 17 automated' },
  { label: 'ISO 27001', sub: 'aligned' },
  { label: 'EU Residency', sub: 'dedicated topology' },
  { label: 'govulncheck', sub: 'clean on every commit' },
  { label: 'gosec', sub: 'zero issues' },
  { label: 'gitleaks', sub: 'secret scanning' },
  { label: '7-year audit', sub: 'retention' },
]

export const topologies = [
  {
    name: 'Cloud SaaS',
    price: 'from $29/seat/mo',
    bullets: [
      'Managed on Cloudflare Workers global edge',
      'Self-hosted runner pool — code stays in your VPC',
      'Zero ops burden, fastest onboarding',
      'Best fit for pilots and proof-of-value',
      'Instant SSO / SAML / SCIM provisioning',
    ],
  },
  {
    name: 'Dedicated (single-tenant)',
    price: 'from $8k/mo',
    bullets: [
      'Isolated Workers namespace + D1 database',
      'Custom domain (e.g. pushci.acme.com)',
      'Network isolation via Cloudflare Tunnels',
      'SLA 99.9%, 24/7 incident response',
      'EU, US, or APAC data residency',
    ],
  },
  {
    name: 'Self-hosted runner pool',
    price: 'included with any plan',
    bullets: [
      'Docker Compose — runners in your VPC',
      'Source code never leaves your network',
      'Managed control plane, self-hosted execution',
      'Full on-prem SaaS deployment on H2 2026 roadmap',
      'Supports air-gapped environments',
    ],
  },
]

export const freePlanDetails = {
  headline: 'Start free, stay free.',
  subhead: 'The Free plan is not a trial. It is a permanent, production-capable tier for solo developers and open source projects.',
  includes: [
    { label: 'Unlimited local runs', detail: 'Run your full test suite, lint, and build pipeline on your own machine — no minute caps, no billing.' },
    { label: 'AI stack detection', detail: 'PushCI reads your repo and generates a complete pushci.yml in under 5 seconds. No config to write.' },
    { label: '35 languages supported', detail: 'Go, Node, Python, Java, Rust, Ruby, Elixir, Clojure, PHP, .NET, and 25 more — all detected automatically.' },
    { label: '2 deploy targets', detail: 'Deploy to Cloudflare Pages or Vercel from your local machine with a single command.' },
    { label: 'Community support', detail: 'Discord community with active maintainers. GitHub issues tracked and triaged weekly.' },
    { label: 'GitHub Actions parity', detail: 'Run your existing .github/workflows/*.yml files locally via the embedded act runtime — no Docker config needed.' },
  ],
  limits: 'Free plan runs locally on your machine. Cloud minutes, dashboard analytics, Slack/Discord alerts, and SSO require Pro or Team.',
  cta: 'npx pushci init',
}

export const faqs = [
  {
    q: 'What does the Free plan actually include?',
    a: 'The Free plan gives you unlimited local pipeline runs with no expiry, no credit card, and no minute caps. It includes AI stack detection (auto-generates your pushci.yml from your repo), support for all 35 detected languages, GitHub Actions compatibility via the embedded act runtime, and 2 deploy targets (Cloudflare Pages, Vercel). It is a permanent tier — not a 14-day trial. The only limits are that cloud minutes, the web dashboard, Slack/Discord alerts, and SSO are Pro/Team features.',
  },
  {
    q: 'Can you guarantee EU data residency?',
    a: 'On Cloud SaaS, the default deployment runs on Cloudflare\'s global edge with a US-primary D1 database. EU-only routing is available on the Dedicated topology (single-tenant Workers + D1 with EU location hint). A `data_residency: "eu"` policy flag is already plumbed through the API for forward-compatibility. If you need EU residency now, the Dedicated topology is the supported path — contact sales for a pilot.',
  },
  {
    q: 'Can our source code stay inside our network?',
    a: 'Yes. The self-hosted runner pool (Docker Compose) runs inside your VPC and executes all pipeline steps locally — only run metadata (stage name, pass/fail, duration) is sent to the managed control plane. Full self-hosted SaaS (control plane + runners in your network) is on our H2 2026 roadmap and available on the Enterprise tier today via the Dedicated topology.',
  },
  {
    q: 'We have 15 years of Jenkinsfiles. Does PushCI replace Jenkins?',
    a: 'No. PushCI sits on top of Jenkins. The Jenkins bridge imports your Jenkinsfiles into pushci.yml drafts, mirrors job status into our dashboard, and lets you adopt PushCI incrementally. Jenkins keeps running until you choose otherwise. Teams typically migrate 10-20% of pipelines in the first month as they validate equivalence.',
  },
  {
    q: 'Do you really integrate with Gerrit?',
    a: 'Yes. We poll Gerrit changes via the Gerrit REST API, trigger PushCI runs on new patch sets, and write Verified +1 / -1 and Code-Review labels back to the change. This is a first-class integration, not a proxy through GitHub.',
  },
  {
    q: 'What does AI pipeline diagnosis actually do?',
    a: 'When a build fails, PushCI sends the failure log and pipeline config to Claude. The AI identifies the root cause (e.g. "flaky network call in line 47 of integration test"), suggests a targeted fix, and optionally applies it via `pushci heal`. In production teams, this cuts mean-time-to-fix from ~40 minutes to under 5 minutes for common failure patterns.',
  },
  {
    q: 'What is bus-factor analytics?',
    a: 'Bus-factor analytics scans your pipeline commit history and flags stages or workflows where fewer than N people have ever made changes. When those people are unavailable, pipelines break and nobody else knows how to fix them. PushCI surfaces these hotspots in the dashboard before they become incidents.',
  },
  {
    q: 'How is enterprise pricing structured?',
    a: 'Team starts at $29/seat/month (cloud SaaS). Enterprise Cloud starts at $25/user/month plus $0.01 per cloud build-minute. Dedicated is $8k/month base plus usage. Self-hosted pricing will be announced with the H2 2026 launch. Boutique services (custom integrations, migrations, on-site training) are $1.5k/day. All enterprise contracts are annual with monthly invoicing available.',
  },
]
