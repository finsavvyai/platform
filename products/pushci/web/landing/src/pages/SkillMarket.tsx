import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { ViralShare } from '../components/ViralShare'
import { useDocumentMeta } from '../components/useDocumentMeta'
import { useReveal } from '../components/useReveal'

type Category = 'all' | 'templates' | 'checks' | 'deploy' | 'notify' | 'security' | 'ai'

interface Skill {
  id: string
  name: string
  description: string
  category: Category
  author: string
  installs: string
  tags: string[]
  command: string
  verified: boolean
  steps: string[]
  testCmd: string
}

const skills: Skill[] = [
  {
    id: 'nextjs-vercel',
    name: 'Next.js + Vercel',
    description: 'Full CI/CD pipeline for Next.js apps with Vercel deployment, preview URLs, and lighthouse checks.',
    category: 'templates',
    author: 'pushci',
    installs: '12.4k',
    tags: ['Next.js', 'Vercel', 'React', 'TypeScript'],
    command: 'pushci skill add nextjs-vercel',
    verified: true,
    steps: ['npm ci', 'npx tsc --noEmit', 'npx eslint .', 'npm test', 'vercel deploy --prebuilt'],
    testCmd: 'pushci run --skill nextjs-vercel --dry-run',
  },
  {
    id: 'django-aws',
    name: 'Django + AWS',
    description: 'Python Django pipeline with pytest, migrations check, and AWS ECS deployment.',
    category: 'templates',
    author: 'pushci',
    installs: '8.1k',
    tags: ['Python', 'Django', 'AWS', 'ECS'],
    command: 'pushci skill add django-aws',
    verified: true,
    steps: ['pip install -r requirements.txt', 'python manage.py migrate --check', 'pytest --cov', 'flake8 .', 'aws ecs update-service'],
    testCmd: 'pushci run --skill django-aws --dry-run',
  },
  {
    id: 'go-docker',
    name: 'Go + Docker',
    description: 'Go pipeline with race detection, benchmarks, Docker image build, and registry push.',
    category: 'templates',
    author: 'pushci',
    installs: '9.7k',
    tags: ['Go', 'Docker', 'Kubernetes'],
    command: 'pushci skill add go-docker',
    verified: true,
    steps: ['go vet ./...', 'go test -race ./...', 'golangci-lint run', 'docker build -t $IMAGE .', 'docker push $IMAGE'],
    testCmd: 'pushci run --skill go-docker --dry-run',
  },
  {
    id: 'rails-fly',
    name: 'Rails + Fly.io',
    description: 'Ruby on Rails pipeline with RSpec, database migrations, and Fly.io deployment.',
    category: 'templates',
    author: 'community',
    installs: '3.2k',
    tags: ['Ruby', 'Rails', 'Fly.io', 'PostgreSQL'],
    command: 'pushci skill add rails-fly',
    verified: false,
    steps: ['bundle install', 'rails db:migrate:status', 'bundle exec rspec', 'rubocop -A', 'fly deploy'],
    testCmd: 'pushci run --skill rails-fly --dry-run',
  },
  {
    id: 'rust-shuttle',
    name: 'Rust + Shuttle',
    description: 'Rust pipeline with clippy linting, cargo test, and Shuttle.rs deployment.',
    category: 'templates',
    author: 'community',
    installs: '2.8k',
    tags: ['Rust', 'Shuttle', 'Actix', 'Axum'],
    command: 'pushci skill add rust-shuttle',
    verified: false,
    steps: ['cargo clippy -- -D warnings', 'cargo test', 'cargo audit', 'cargo build --release', 'shuttle deploy'],
    testCmd: 'pushci run --skill rust-shuttle --dry-run',
  },
  {
    id: 'flutter-firebase',
    name: 'Flutter + Firebase',
    description: 'Flutter pipeline with widget tests, build for iOS/Android, Firebase App Distribution.',
    category: 'templates',
    author: 'pushci',
    installs: '5.6k',
    tags: ['Dart', 'Flutter', 'Firebase', 'Mobile'],
    command: 'pushci skill add flutter-firebase',
    verified: true,
    steps: ['flutter pub get', 'flutter analyze', 'flutter test', 'flutter build apk --release', 'firebase appdistribution:distribute'],
    testCmd: 'pushci run --skill flutter-firebase --dry-run',
  },
  {
    id: 'secret-scan',
    name: 'Secret Scanner',
    description: 'Scan code for leaked API keys, tokens, passwords, and private keys before they reach git.',
    category: 'security',
    author: 'pushci',
    installs: '18.3k',
    tags: ['Security', 'Secrets', 'API Keys', 'Pre-commit'],
    command: 'pushci skill add secret-scan',
    verified: true,
    steps: ['gitleaks detect --source .', 'truffleHog filesystem .', 'detect-secrets scan'],
    testCmd: 'pushci scan --skill secret-scan',
  },
  {
    id: 'license-check',
    name: 'License Checker',
    description: 'Verify all dependencies use approved licenses. Block GPL in commercial projects.',
    category: 'security',
    author: 'community',
    installs: '4.1k',
    tags: ['License', 'Compliance', 'SBOM', 'Legal'],
    command: 'pushci skill add license-check',
    verified: false,
    steps: ['license-checker --onlyAllow "MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC"', 'pip-licenses --allow-only MIT,Apache,BSD'],
    testCmd: 'pushci scan --skill license-check',
  },
  {
    id: 'sbom-gen',
    name: 'SBOM Generator',
    description: 'Generate Software Bill of Materials in CycloneDX or SPDX format for every build.',
    category: 'security',
    author: 'pushci',
    installs: '6.9k',
    tags: ['SBOM', 'CycloneDX', 'SPDX', 'Supply Chain'],
    command: 'pushci skill add sbom-gen',
    verified: true,
    steps: ['syft . -o cyclonedx-json > sbom.json', 'grype sbom:./sbom.json --fail-on high'],
    testCmd: 'pushci scan --skill sbom-gen',
  },
  {
    id: 'vulnerability-scan',
    name: 'Dependency Audit',
    description: 'Scan npm, pip, cargo, and go dependencies for known CVEs. Block builds on critical vulns.',
    category: 'security',
    author: 'pushci',
    installs: '11.2k',
    tags: ['CVE', 'Vulnerability', 'npm audit', 'Safety'],
    command: 'pushci skill add vulnerability-scan',
    verified: true,
    steps: ['npm audit --audit-level=high', 'pip-audit -r requirements.txt', 'cargo audit', 'govulncheck ./...'],
    testCmd: 'pushci scan --skill vulnerability-scan',
  },
  {
    id: 'slack-notify',
    name: 'Slack Notifications',
    description: 'Post build results to Slack channels with rich formatting, diffs, and one-click rerun.',
    category: 'notify',
    author: 'pushci',
    installs: '14.7k',
    tags: ['Slack', 'Notifications', 'Chat'],
    command: 'pushci skill add slack-notify',
    verified: true,
    steps: ['on_pass: POST $SLACK_WEBHOOK with green embed', 'on_fail: POST $SLACK_WEBHOOK with red embed + log tail', 'include: repo, branch, duration, rerun link'],
    testCmd: 'pushci run --skill slack-notify --test-notify',
  },
  {
    id: 'discord-notify',
    name: 'Discord Notifications',
    description: 'Send build status embeds to Discord channels with pass/fail badges and log links.',
    category: 'notify',
    author: 'community',
    installs: '7.3k',
    tags: ['Discord', 'Notifications', 'Webhooks'],
    command: 'pushci skill add discord-notify',
    verified: false,
    steps: ['on_pass: POST $DISCORD_WEBHOOK with green embed', 'on_fail: POST $DISCORD_WEBHOOK with red embed + log link'],
    testCmd: 'pushci run --skill discord-notify --test-notify',
  },
  {
    id: 'email-digest',
    name: 'Email Digest',
    description: 'Daily or weekly email summary of all pipeline runs, failures, and deployment status.',
    category: 'notify',
    author: 'community',
    installs: '2.1k',
    tags: ['Email', 'Digest', 'Summary'],
    command: 'pushci skill add email-digest',
    verified: false,
    steps: ['cron: daily at 09:00', 'collect runs from last 24h', 'render HTML digest template', 'send via $SMTP_HOST'],
    testCmd: 'pushci run --skill email-digest --test-notify',
  },
  {
    id: 'cloudflare-deploy',
    name: 'Cloudflare Pages',
    description: 'Deploy static sites and SSR apps to Cloudflare Pages with preview URLs per branch.',
    category: 'deploy',
    author: 'pushci',
    installs: '10.8k',
    tags: ['Cloudflare', 'Pages', 'Workers', 'Edge'],
    command: 'pushci skill add cloudflare-deploy',
    verified: true,
    steps: ['npm run build', 'wrangler pages deploy ./dist --project-name=$CF_PROJECT', 'output: preview URL per branch'],
    testCmd: 'pushci run --skill cloudflare-deploy --dry-run',
  },
  {
    id: 'k8s-deploy',
    name: 'Kubernetes Deploy',
    description: 'Rolling deployment to Kubernetes clusters with health checks and automatic rollback.',
    category: 'deploy',
    author: 'pushci',
    installs: '8.4k',
    tags: ['Kubernetes', 'K8s', 'Helm', 'Rolling Deploy'],
    command: 'pushci skill add k8s-deploy',
    verified: true,
    steps: ['helm upgrade --install $APP ./chart', 'kubectl rollout status deploy/$APP', 'on fail: helm rollback $APP'],
    testCmd: 'pushci run --skill k8s-deploy --dry-run',
  },
  {
    id: 'aws-lambda',
    name: 'AWS Lambda Deploy',
    description: 'Package and deploy serverless functions to AWS Lambda with API Gateway config.',
    category: 'deploy',
    author: 'pushci',
    installs: '6.2k',
    tags: ['AWS', 'Lambda', 'Serverless', 'API Gateway'],
    command: 'pushci skill add aws-lambda',
    verified: true,
    steps: ['zip -r function.zip .', 'aws lambda update-function-code --zip-file function.zip', 'aws lambda publish-version'],
    testCmd: 'pushci run --skill aws-lambda --dry-run',
  },
  {
    id: 'lint-strict',
    name: 'Strict Linting',
    description: 'Enforce ESLint, Pylint, golangci-lint, or Clippy with zero-tolerance for warnings.',
    category: 'checks',
    author: 'pushci',
    installs: '13.1k',
    tags: ['Lint', 'ESLint', 'Pylint', 'Code Quality'],
    command: 'pushci skill add lint-strict',
    verified: true,
    steps: ['auto-detect linter from stack', 'run with --max-warnings 0', 'fail on any warning or error'],
    testCmd: 'pushci run --skill lint-strict',
  },
  {
    id: 'coverage-gate',
    name: 'Coverage Gate',
    description: 'Fail builds if test coverage drops below threshold. Supports lcov, cobertura, go cover.',
    category: 'checks',
    author: 'pushci',
    installs: '9.8k',
    tags: ['Coverage', 'Testing', 'Quality Gate'],
    command: 'pushci skill add coverage-gate',
    verified: true,
    steps: ['run tests with coverage', 'parse coverage report (lcov/cobertura/go cover)', 'fail if coverage < threshold (default 80%)'],
    testCmd: 'pushci run --skill coverage-gate',
  },
  {
    id: 'bundle-size',
    name: 'Bundle Size Check',
    description: 'Track JavaScript bundle size per commit. Fail if size increases beyond threshold.',
    category: 'checks',
    author: 'community',
    installs: '5.4k',
    tags: ['Bundle', 'Performance', 'Webpack', 'Vite'],
    command: 'pushci skill add bundle-size',
    verified: false,
    steps: ['npm run build', 'bundlesize --config bundlesize.json', 'compare vs baseline, fail if +threshold%'],
    testCmd: 'pushci run --skill bundle-size',
  },
  {
    id: 'lighthouse',
    name: 'Lighthouse CI',
    description: 'Run Google Lighthouse audits on every build. Track performance, a11y, SEO scores.',
    category: 'checks',
    author: 'community',
    installs: '4.7k',
    tags: ['Lighthouse', 'Performance', 'A11y', 'SEO'],
    command: 'pushci skill add lighthouse',
    verified: false,
    steps: ['lhci autorun', 'assert: performance >= 90', 'assert: accessibility >= 90', 'assert: best-practices >= 90'],
    testCmd: 'pushci run --skill lighthouse',
  },
  {
    id: 'ai-review',
    name: 'AI Code Review',
    description: 'AI-powered code review that catches bugs, suggests improvements, and checks patterns.',
    category: 'ai',
    author: 'pushci',
    installs: '15.9k',
    tags: ['AI', 'Code Review', 'Claude', 'Quality'],
    command: 'pushci skill add ai-review',
    verified: true,
    steps: ['git diff HEAD~1 → send to Claude Haiku', 'analyze: bugs, security, patterns, test coverage', 'post inline comments to PR or print to terminal'],
    testCmd: 'pushci ask "review my last commit"',
  },
  {
    id: 'ai-changelog',
    name: 'AI Changelog',
    description: 'Auto-generate changelogs from commits using AI. Semantic versioning suggestions included.',
    category: 'ai',
    author: 'pushci',
    installs: '7.6k',
    tags: ['AI', 'Changelog', 'Semver', 'Release'],
    command: 'pushci skill add ai-changelog',
    verified: true,
    steps: ['collect commits since last tag', 'AI groups by: features, fixes, breaking changes', 'output CHANGELOG.md + suggested semver bump'],
    testCmd: 'pushci ask "generate changelog since last release"',
  },
  {
    id: 'ai-test-gen',
    name: 'AI Test Generator',
    description: 'Generate missing unit tests using AI. Targets uncovered functions and edge cases.',
    category: 'ai',
    author: 'pushci',
    installs: '11.3k',
    tags: ['AI', 'Testing', 'Unit Tests', 'Coverage'],
    command: 'pushci skill add ai-test-gen',
    verified: true,
    steps: ['parse coverage report → find uncovered functions', 'send function + context to Claude', 'write test file alongside source', 're-run coverage to verify improvement'],
    testCmd: 'pushci ask "generate tests for uncovered functions"',
  },
  {
    id: 'ai-fix',
    name: 'AI Auto-Fix',
    description: 'Automatically fix failing tests and lint errors using AI. Creates fix PRs on failure.',
    category: 'ai',
    author: 'pushci',
    installs: '9.1k',
    tags: ['AI', 'Auto-fix', 'Self-healing', 'Pipeline'],
    command: 'pushci skill add ai-fix',
    verified: true,
    steps: ['on pipeline failure: capture log', 'AI diagnoses root cause', 'applies targeted code fix', 'reruns failing check to verify', 'opens PR with fix if on CI'],
    testCmd: 'pushci heal',
  },
]

const categories: { key: Category; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'templates', label: 'Templates' },
  { key: 'checks', label: 'Checks' },
  { key: 'deploy', label: 'Deploy' },
  { key: 'notify', label: 'Notify' },
  { key: 'security', label: 'Security' },
  { key: 'ai', label: 'AI' },
]

function SkillCard({ skill }: { skill: Skill }) {
  const [copied, setCopied] = useState(false)
  const [copiedTest, setCopiedTest] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const ref = useReveal()

  const copy = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text)
    setter(true)
    setTimeout(() => setter(false), 2000)
  }

  return (
    <div ref={ref} className="reveal rounded-xl border border-border-base bg-surface hover:border-border-em transition-colors flex flex-col">
      <div className="p-5 flex flex-col flex-1">
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-t1">{skill.name}</h3>
            {skill.verified && (
              <svg className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-t3">{skill.author}</span>
            <span className="text-border-base">·</span>
            <span className="text-xs text-t3">{skill.installs} installs</span>
          </div>
        </div>

        <p className="text-sm text-t2 leading-relaxed flex-1 mb-3">{skill.description}</p>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {skill.tags.map((t) => (
            <span key={t} className="rounded bg-raised/80 px-2 py-0.5 text-[10px] text-t3 font-mono">
              {t}
            </span>
          ))}
        </div>

        {/* Install command */}
        <button
          onClick={() => copy(skill.command, setCopied)}
          aria-label={copied ? 'Copied install command' : `Copy install command: ${skill.command}`}
          className="w-full rounded-lg border border-border-base bg-surface px-3 py-2 text-xs font-mono text-t2 transition hover:border-border-em flex items-center justify-between gap-2 mb-2"
        >
          <span className="truncate">{skill.command}</span>
          <span className="shrink-0 text-t3">
            {copied ? (
              <svg className="w-3.5 h-3.5 text-accent" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="w-3.5 h-3.5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            )}
          </span>
        </button>

        {/* How it works toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-left text-[11px] text-t3 hover:text-t2 transition-colors flex items-center gap-1"
        >
          <span className={`transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}>▶</span>
          How it works
        </button>
      </div>

      {/* Expandable panel */}
      {expanded && (
        <div className="border-t border-border-base/60 px-5 py-4 bg-raised/40">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-t3 mb-2">Steps</p>
          <ol className="space-y-1 mb-4">
            {skill.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px] text-t2 font-mono">
                <span className="text-t3 shrink-0 w-4">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-t3 mb-1.5">Test it</p>
          <button
            onClick={() => copy(skill.testCmd, setCopiedTest)}
            className="w-full rounded border border-border-base/60 bg-surface px-2.5 py-1.5 text-[11px] font-mono text-t2 hover:border-border-em transition flex items-center justify-between gap-2"
          >
            <span className="truncate">{skill.testCmd}</span>
            <span className="shrink-0 text-t3 text-[10px]">{copiedTest ? '✓' : 'copy'}</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default function SkillMarket() {
  const [active, setActive] = useState<Category>('all')
  const [search, setSearch] = useState('')

  useDocumentMeta({
    title: 'PushCI Skill Market — CI/CD Templates, Checks, Deploys & AI Skills',
    description: 'Browse 25 pre-built CI/CD skills for PushCI. Pipeline templates, security checks, deploy targets, notifications, and AI-powered tools. Install with one command.',
    canonical: 'https://pushci.dev/skills',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'PushCI Skill Market',
      description: 'Marketplace of CI/CD pipeline skills, templates, and integrations for PushCI',
      url: 'https://pushci.dev/skills',
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: skills.length,
        itemListElement: skills.slice(0, 10).map((s, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: s.name,
          description: s.description,
        })),
      },
    },
  })

  const filtered = skills.filter((s) => {
    const matchCat = active === 'all' || s.category === active
    const matchSearch = !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())) ||
      s.description.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div className="min-h-screen bg-root">
      <Navbar />

      {/* Hero — left-aligned, no gradient text */}
      <section className="pt-28 sm:pt-36 pb-12 px-4 sm:px-6">
        <div className="mx-auto max-w-[1080px]">
          <p className="text-sm font-medium text-accent tracking-wide">
            Skill Market
          </p>
          <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-t1 max-w-2xl">
            Pre-built pipelines, one command away
          </h1>
          <p className="mt-4 text-lg text-t2 max-w-xl leading-relaxed">
            Templates, security checks, deploy targets, and AI tools.
            Install any skill with <code className="font-mono text-t2">pushci skill add</code>.
          </p>
          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm text-t3">
            <span>{skills.length} skills</span>
            <span className="text-border-base">·</span>
            <span>6 categories</span>
            <span className="text-border-base">·</span>
            <span>{skills.filter(s => s.verified).length} verified</span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1080px] px-4 sm:px-6 pb-20">
        {/* Search + Filters */}
        <div className="sticky top-[64px] z-40 bg-root/95 backdrop-blur-md py-4 -mx-4 px-4 sm:-mx-6 sm:px-6 border-b border-border-base/40 mb-8">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-t3" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search skills..."
                aria-label="Search skills"
                className="w-full rounded-lg border border-border-base bg-surface pl-10 pr-4 py-2 text-sm text-t1 placeholder-t3 focus:border-border-em focus:outline-none transition"
              />
            </div>
            <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0" role="tablist" aria-label="Skill categories">
              {categories.map((c) => (
                <button
                  key={c.key}
                  role="tab"
                  aria-selected={active === c.key}
                  onClick={() => setActive(c.key)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    active === c.key
                      ? 'bg-t1 text-root'
                      : 'text-t3 hover:text-t1'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results count */}
        <p className="text-sm text-t3 mb-6">
          {filtered.length} skill{filtered.length !== 1 ? 's' : ''}
          {search && <> matching "<span className="text-t2">{search}</span>"</>}
        </p>

        {/* Skills Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <SkillCard key={s.id} skill={s} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="py-10 sm:py-16 md:py-20 text-center">
            <p className="text-t3">No skills found. Try a different search.</p>
          </div>
        )}

        {/* Create Your Own */}
        <section className="mt-20 grid gap-8 lg:grid-cols-2 items-start">
          <div>
            <h2 className="text-2xl font-bold text-t1">Create your own skill</h2>
            <p className="mt-3 text-t2 leading-relaxed max-w-md">
              Skills are YAML files. Define steps, config, and failure behavior.
              Publish to the market or keep them private.
            </p>
            <div className="mt-6 flex gap-3">
              <a
                href="https://pushci.dev/docs#skills"
                className="rounded-lg bg-t1 px-5 py-2.5 text-sm font-semibold text-root hover:bg-t1 transition"
              >
                Publish a Skill
              </a>
              <a
                href="https://pushci.dev/docs#skills"
                className="rounded-lg border border-border-base px-5 py-2.5 text-sm font-medium text-t2 hover:border-border-em hover:text-t1 transition"
              >
                Read the Guide
              </a>
            </div>
          </div>
          <div className="rounded-xl border border-border-base bg-surface overflow-hidden">
            <div className="border-b border-border-base/60 px-4 py-2.5">
              <span className="text-[11px] font-mono text-t3">my-skill.yml</span>
            </div>
            <pre className="p-4 overflow-x-auto text-[12px] leading-5 font-mono text-t2">
              <code>{`name: my-awesome-skill
version: 1.0.0
description: My custom pipeline check
category: checks

steps:
  - name: Custom Check
    run: npm run my-check
    on_fail: block

config:
  threshold: 80
  notify: true`}</code>
            </pre>
          </div>
        </section>

        {/* CLI Section */}
        <section className="mt-16 grid gap-8 lg:grid-cols-2 items-start">
          <div className="rounded-xl border border-border-base bg-surface overflow-hidden">
            <div className="border-b border-border-base/60 px-4 py-2.5">
              <span className="text-[11px] font-mono text-t3">Terminal</span>
            </div>
            <pre className="p-4 overflow-x-auto text-[12px] leading-5 font-mono">
              <code>
                <span className="text-t3"># Browse available skills</span>{'\n'}
                <span className="text-t2">pushci skill list</span>{'\n\n'}
                <span className="text-t3"># Search by keyword</span>{'\n'}
                <span className="text-t2">pushci skill search deploy</span>{'\n\n'}
                <span className="text-t3"># Install a skill</span>{'\n'}
                <span className="text-t2">pushci skill add ai-review</span>{'\n\n'}
                <span className="text-t3"># Let AI pick skills for your project</span>{'\n'}
                <span className="text-t2">pushci ask "add security scanning"</span>
              </code>
            </pre>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-t1">Install from the CLI</h2>
            <p className="mt-3 text-t2 leading-relaxed max-w-md">
              Browse, search, and install skills without leaving your terminal.
              Or let the AI agent pick the right skills for your stack.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <a
                href="/#pricing"
                className="rounded-lg bg-t1 px-5 py-2.5 text-sm font-semibold text-root hover:bg-t1 transition"
              >
                Get Started Free
              </a>
              <Link to="/ai" className="text-sm text-t2 hover:text-t1 transition underline underline-offset-4 decoration-border-base">
                AI agent setup
              </Link>
            </div>
          </div>
        </section>

        {/* Viral share */}
        <div className="mt-12 max-w-xl">
          <ViralShare context="Know someone stuck in YAML?" />
        </div>
      </div>

      <Footer />
    </div>
  )
}
