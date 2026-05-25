import { useReveal } from './useReveal'

const platforms = [
  { name: 'GitHub', cat: 'source' },
  { name: 'GitLab', cat: 'source' },
  { name: 'Bitbucket', cat: 'source' },
  { name: 'Docker', cat: 'deploy' },
  { name: 'Kubernetes', cat: 'deploy' },
  { name: 'Vercel', cat: 'deploy' },
  { name: 'Netlify', cat: 'deploy' },
  { name: 'Fly.io', cat: 'deploy' },
  { name: 'Railway', cat: 'deploy' },
  { name: 'AWS ECS', cat: 'deploy' },
  { name: 'GCP Cloud Run', cat: 'deploy' },
  { name: 'Cloudflare', cat: 'deploy' },
  { name: 'Terraform', cat: 'deploy' },
  { name: 'Helm', cat: 'deploy' },
  { name: 'Slack', cat: 'notify' },
  { name: 'Discord', cat: 'notify' },
  { name: 'Telegram', cat: 'notify' },
  { name: 'PagerDuty', cat: 'notify' },
  { name: 'Datadog', cat: 'notify' },
  { name: 'Trivy', cat: 'security' },
  { name: 'Snyk', cat: 'security' },
  { name: 'Semgrep', cat: 'security' },
  { name: 'Playwright', cat: 'test' },
  { name: 'Cypress', cat: 'test' },
  { name: 'Vitest', cat: 'test' },
  { name: 'Jest', cat: 'test' },
  { name: 'Pytest', cat: 'test' },
  { name: 'Claude AI', cat: 'ai' },
  { name: 'MCP Server', cat: 'ai' },
  { name: 'llamafile', cat: 'ai' },
]

const CAT_COLORS: Record<string, string> = {
  source: 'border-border-em text-t2',
  deploy: 'border-emerald-600/30 text-emerald-400',
  notify: 'border-purple-600/30 text-purple-400',
  security: 'border-red-600/30 text-red-400',
  test: 'border-amber-600/30 text-amber-400',
  ai: 'border-cyan-600/30 text-cyan-400',
}

type Companion = {
  name: string; initial: string; tagline: string; body: string;
  href: string; beta?: boolean;
}

const companions: Companion[] = [
  {
    name: 'Cepien AI',
    initial: 'C',
    tagline: 'Plans what to build. PushCI ships it.',
    body: 'Turns product feedback, analytics, and research into Jira tickets, Figma designs, and code via Cursor + Claude. Pair it with PushCI so every AI-planned feature lands in production without YAML.',
    href: 'https://cepien.ai',
    beta: true,
  },
  {
    name: 'nektos/act',
    initial: 'A',
    tagline: 'Run GitHub Actions locally — embedded in PushCI.',
    body: 'PushCI uses nektos/act as its GitHub Actions runtime. Your existing .github/workflows/*.yml just work — matrix builds, composite actions, service containers. Zero rewriting required.',
    href: 'https://github.com/nektos/act',
  },
  {
    name: 'Tailscale',
    initial: 'T',
    tagline: 'Webhook agent over mesh VPN.',
    body: 'pushci agent --tailscale=serve exposes the webhook server on your Tailscale network. Git push → private endpoint, no cloud tunnel. Zero-config WireGuard.',
    href: 'https://tailscale.com',
  },
  {
    name: 'Perfetto',
    initial: 'P',
    tagline: 'SQL-queryable pipeline traces.',
    body: 'pushci trace captures every stage as a Perfetto trace. SQL-query your build timeline, find the slow step across 100 runs. Chrome-grade performance tooling, no extra setup.',
    href: 'https://perfetto.dev',
  },
  {
    name: 'llamafile',
    initial: 'L',
    tagline: 'Local AI for offline CI heal.',
    body: 'Mozilla llamafile is a drop-in provider in PushCI\'s AI router. Self-heal, diagnose, and generate without sending code to any cloud. Single executable, runs anywhere.',
    href: 'https://github.com/Mozilla-Ocho/llamafile',
  },
]

function CompanionCard({
  name, initial, tagline, body, href, beta,
}: Companion) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group rounded-xl border border-border-base bg-surface p-5 flex gap-4 items-start transition-all duration-200 hover:border-accent/40 hover:bg-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      aria-label={`${name} — ${tagline}${beta ? ' (beta — feature-flagged)' : ''}`}
    >
      <div className="w-10 h-10 shrink-0 rounded-lg bg-raised border border-border-base flex items-center justify-center text-sm font-mono font-semibold text-t1">
        {initial}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-sm font-semibold text-t1">{name}</div>
          {beta && (
            <span
              className="rounded-full border border-amber-600/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-amber-400"
              title="Beta — integration is feature-flagged and off by default in production"
            >
              Beta
            </span>
          )}
        </div>
        <div className="text-xs text-accent mt-0.5">{tagline}</div>
        <p className="text-xs text-t3 mt-2 leading-relaxed">{body}</p>
      </div>
    </a>
  )
}

export function Integrations() {
  const ref = useReveal()
  return (
    <section ref={ref} className="reveal py-20 sm:py-28 px-4 sm:px-6 section-border">
      <div className="mx-auto max-w-[1080px]">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-t1">
            Connects to everything
          </h2>
          <p className="mt-3 text-sm text-t3 max-w-lg mx-auto">
            Source control, deploy targets, notifications, security scanners, test frameworks, and AI — all built in.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {platforms.map(p => (
            <span key={p.name}
              className={`rounded-lg border px-4 py-2.5 text-sm font-medium bg-surface/50 hover:bg-raised transition-all duration-200 cursor-default ${CAT_COLORS[p.cat]}`}>
              {p.name}
            </span>
          ))}
        </div>

        {/* Category legend */}
        <div className="flex flex-wrap justify-center gap-4 mt-8 text-[11px] text-t3">
          {Object.entries({ source: 'Source Control', deploy: 'Deploy', notify: 'Notifications', security: 'Security', test: 'Testing', ai: 'AI' }).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${k === 'source' ? 'bg-t2' : k === 'deploy' ? 'bg-emerald-400' : k === 'notify' ? 'bg-purple-400' : k === 'security' ? 'bg-red-400' : k === 'test' ? 'bg-amber-400' : 'bg-cyan-400'}`} />
              {v}
            </span>
          ))}
        </div>

        {/* Works great with — complementary products */}
        <div className="mt-16">
          <div className="text-center mb-6">
            <p className="text-xs text-t3 uppercase tracking-widest">Works great with</p>
            <p className="mt-2 text-sm text-t2 max-w-lg mx-auto">
              Tools that plan what to build — PushCI ships it.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-2xl mx-auto">
            {companions.map(c => (
              <CompanionCard key={c.name} {...c} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
