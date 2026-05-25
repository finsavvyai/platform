import { Link } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { useReveal } from '../components/useReveal'
import { useDocumentMeta } from '../components/useDocumentMeta'
import { ViralShare } from '../components/ViralShare'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const ref = useReveal()
  return (
    <section ref={ref} className="reveal mb-16">
      <h2 className="text-2xl font-bold text-t1 mb-4">{title}</h2>
      {children}
    </section>
  )
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="rounded-xl border border-border-base bg-surface overflow-hidden mb-6">
      <div className="border-b border-border-base/60 px-4 py-2.5">
        <span className="text-[11px] font-mono text-t3">{title}</span>
      </div>
      <pre className="p-4 overflow-x-auto text-[12px] leading-5 font-mono text-t2">
        <code>{code}</code>
      </pre>
    </div>
  )
}

const agents = [
  { name: 'Claude Code', desc: 'Anthropic\'s CLI coding agent', setup: 'Built-in MCP support' },
  { name: 'Cursor', desc: 'AI-first code editor', setup: 'Settings > MCP Servers' },
  { name: 'Windsurf', desc: 'Codeium\'s AI IDE', setup: 'MCP config file' },
  { name: 'Cline', desc: 'VS Code AI assistant', setup: 'MCP server config' },
  { name: 'GitHub Copilot', desc: 'AI pair programmer', setup: 'VS Code extension' },
  { name: 'Aider', desc: 'Terminal AI coding', setup: 'Shell commands' },
]

const mcpConfig = `{
  "mcpServers": {
    "pushci": {
      "command": "pushci",
      "args": ["mcp"]
    }
  }
}`

const tools = [
  { name: 'pushci_init', desc: 'Auto-detect stack and generate CI/CD pipeline', example: '"Set up CI for this project"' },
  { name: 'pushci_run', desc: 'Run the full pipeline locally', example: '"Run my tests"' },
  { name: 'pushci_status', desc: 'Check last run results', example: '"Did my tests pass?"' },
  { name: 'pushci_doctor', desc: 'Diagnose environment issues', example: '"Why is my build failing?"' },
  { name: 'pushci_secret_set', desc: 'Store encrypted credentials', example: '"Save my deploy token"' },
  { name: 'pushci_scan', desc: 'Scan pipelines for security misconfigs (PipeWarden)', example: '"Is my CI secure?"' },
  { name: 'pushci_recommend', desc: 'Compare PushCI against your current CI provider', example: '"Should I migrate from GitHub Actions?"' },
  { name: 'pushci_heal', desc: 'AI-powered root-cause analysis + auto-fix for failing runs', example: '"Fix my broken build"' },
  { name: 'pushci_promote', desc: 'Promote a passing run from staging to production', example: '"Ship staging to prod"' },
]

export default function AIIntegration() {
  useDocumentMeta({
    title: 'PushCI AI Agent Integration — MCP Server for Claude, Cursor, Windsurf',
    description: 'Let your AI coding agent handle CI/CD. PushCI MCP server works with Claude Code, Cursor, Windsurf, and Cline. Natural language pipeline setup in 30 seconds.',
    canonical: 'https://pushci.dev/ai',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'PushCI AI Agent Integration',
      description: 'MCP server integration guide for AI coding agents including Claude Code, Cursor, and Windsurf',
      url: 'https://pushci.dev/ai',
      mainEntity: {
        '@type': 'HowTo',
        name: 'How to set up PushCI with AI agents',
        step: [
          { '@type': 'HowToStep', text: 'Install PushCI: npm install -g pushci' },
          { '@type': 'HowToStep', text: 'Add MCP server config to your AI agent settings' },
          { '@type': 'HowToStep', text: 'Ask your AI agent to set up CI/CD for your project' },
        ],
      },
    },
  })

  return (
    <div className="min-h-screen bg-root">
      <Navbar />

      {/* Hero — left-aligned */}
      <section className="pt-28 sm:pt-36 pb-12 px-4 sm:px-6">
        <div className="mx-auto max-w-[1080px]">
          <p className="text-sm font-medium text-accent tracking-wide">
            MCP Server + AI Agents
          </p>
          <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-t1 max-w-2xl">
            Let your AI agent handle CI/CD
          </h1>
          <p className="mt-4 text-lg text-t2 max-w-xl leading-relaxed">
            PushCI includes an MCP server that AI coding agents use directly.
            Say "set up CI for this project" and your agent does the rest.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1080px] px-4 sm:px-6 pb-20">

        {/* Quick Setup — side-by-side */}
        <Section title="Quick setup">
          <p className="text-t2 mb-6">
            Install PushCI, add the MCP config, and your agent is ready.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <CodeBlock title="Install" code="npm install -g pushci" />
            <CodeBlock title="MCP Config" code={mcpConfig} />
          </div>
          <p className="text-sm text-t3">
            Your AI agent can now set up CI/CD, run tests, check status, and manage secrets.
          </p>
        </Section>

        {/* Compatible Agents */}
        <Section title="Compatible agents">
          <div className="grid gap-px bg-raised rounded-xl overflow-hidden sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((a) => (
              <div key={a.name} className="bg-root p-5">
                <div className="text-sm font-semibold text-t1">{a.name}</div>
                <div className="text-xs text-t3 mt-1">{a.desc}</div>
                <div className="text-xs text-t2 mt-3 font-mono">{a.setup}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* MCP Tools */}
        <Section title="Available MCP tools">
          <div className="rounded-xl border border-border-base overflow-hidden divide-y divide-border-base/60">
            {tools.map((t) => (
              <div key={t.name} className="bg-surface p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                <code className="text-accent/80 font-mono text-sm font-medium shrink-0 w-40">{t.name}</code>
                <span className="text-sm text-t2 flex-1">{t.desc}</span>
                <span className="text-xs text-t3 italic shrink-0">{t.example}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Natural Language */}
        <Section title="Natural language interface">
          <div className="grid gap-8 lg:grid-cols-2 items-start">
            <div>
              <p className="text-t2 leading-relaxed mb-4">
                Even without MCP, any AI agent can use PushCI's natural language CLI.
                Describe what you need in plain English.
              </p>
              <a
                href="/#pricing"
                className="inline-block rounded-lg bg-t1 px-5 py-2.5 text-sm font-semibold text-root hover:bg-t1 transition"
              >
                Get Started Free
              </a>
            </div>
            <CodeBlock
              title="Natural Language Commands"
              code={`pushci ask "set up CI for this Next.js project"
pushci ask "why did my last build fail?"
pushci ask "deploy to staging"
pushci ask "optimize my pipeline"
pushci ask "add a secret for my API key"`}
            />
          </div>
        </Section>

        {/* How It Works */}
        <Section title="How AI agents use PushCI">
          <div className="grid gap-px bg-raised rounded-xl overflow-hidden md:grid-cols-3">
            <div className="bg-root p-6">
              <span className="text-sm font-mono text-t3">01</span>
              <h3 className="text-t1 font-semibold mt-2 mb-2">You describe what you need</h3>
              <p className="text-sm text-t3">"Set up CI/CD for my project and run the tests"</p>
            </div>
            <div className="bg-root p-6">
              <span className="text-sm font-mono text-t3">02</span>
              <h3 className="text-t1 font-semibold mt-2 mb-2">Agent calls PushCI</h3>
              <p className="text-sm text-t3">Uses pushci_init to detect stack, then pushci_run to execute</p>
            </div>
            <div className="bg-root p-6">
              <span className="text-sm font-mono text-t3">03</span>
              <h3 className="text-t1 font-semibold mt-2 mb-2">Pipeline runs locally</h3>
              <p className="text-sm text-t3">Tests pass, builds succeed, deploys go out. Zero config.</p>
            </div>
          </div>
        </Section>

        {/* CTA */}
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <div className="rounded-lg bg-surface border border-border-base px-5 py-3 font-mono text-sm text-t2 select-all">
            <span className="text-t3">$</span> npm install -g pushci
          </div>
          <Link to="/skills" className="text-sm text-t2 hover:text-t1 transition underline underline-offset-4 decoration-border-base">
            Browse AI skills
          </Link>
        </div>

        <div className="mt-12 max-w-xl">
          <ViralShare context="AI + CI = no more YAML" />
        </div>
      </div>

      <Footer />
    </div>
  )
}
