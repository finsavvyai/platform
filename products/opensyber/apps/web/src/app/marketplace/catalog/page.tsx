import Link from 'next/link';
import { Shield, CheckCircle, Terminal, Blocks } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { CATEGORY_STYLES, SkillIconRenderer } from '../marketplace-utils';
import type { SkillCategory } from '@opensyber/shared';

export const metadata = {
  title: 'AI Agent Security Skills — OpenSyber Marketplace',
  description:
    'Browse OpenSyber AI agent security skills: secret scanning, dependency auditing, prompt injection guards, ' +
    'and more for secure AI agent hosting.',
  keywords: 'AI agent security tools, AI agent monitoring skills, AI agent marketplace, MCP security skills',
  openGraph: {
    title: 'AI Agent Security Skills — OpenSyber Marketplace',
    description: 'Browse OpenSyber skills for securing AI agents. Secret scanning, dependency auditing, prompt guards, and more.',
    type: 'website',
  },
};

interface CatalogSkill {
  slug: string; name: string; description: string;
  category: SkillCategory; tier: 'Free' | 'Pro';
}

const SKILLS: CatalogSkill[] = [
  { slug: 'secret-scanner', name: 'Secret Scanner', description: 'Detects leaked API keys, tokens, and credentials in agent workspaces and logs.', category: 'security', tier: 'Free' },
  { slug: 'dependency-auditor', name: 'Dependency Auditor', description: 'Scans package manifests for known CVEs and license violations in real time.', category: 'security', tier: 'Free' },
  { slug: 'prompt-guard', name: 'Prompt Guard', description: 'Blocks prompt injection attacks targeting AI agent instruction files and tool calls.', category: 'security', tier: 'Pro' },
  { slug: 'container-hardener', name: 'Container Hardener', description: 'Applies seccomp profiles, drops capabilities, and enforces read-only filesystems.', category: 'security', tier: 'Pro' },
  { slug: 'network-monitor', name: 'Network Monitor', description: 'Tracks outbound connections from agent containers and flags anomalous C2 traffic.', category: 'security', tier: 'Pro' },
  { slug: 'mcp-auditor', name: 'MCP Auditor', description: 'Audits Model Context Protocol tool calls for over-permissioned or malicious actions.', category: 'security', tier: 'Pro' },
  { slug: 'github-integration', name: 'GitHub Integration', description: 'Connects agents to GitHub repos for automated security scanning on every push.', category: 'developer', tier: 'Free' },
  { slug: 'ci-cd-guardian', name: 'CI/CD Guardian', description: 'Monitors GitHub Actions workflows for injection vulnerabilities and mutable tag abuse.', category: 'developer', tier: 'Pro' },
  { slug: 'slack-notifier', name: 'Slack Notifier', description: 'Sends real-time security alerts and incident summaries to Slack channels.', category: 'communication', tier: 'Free' },
  { slug: 'pagerduty-connector', name: 'PagerDuty Connector', description: 'Escalates critical security incidents to PagerDuty with severity mapping.', category: 'communication', tier: 'Pro' },
  { slug: 'discord-alerter', name: 'Discord Alerter', description: 'Posts formatted security alerts to Discord servers with embed support.', category: 'communication', tier: 'Free' },
  { slug: 'teams-connector', name: 'Teams Connector', description: 'Delivers security notifications to Microsoft Teams channels via webhooks.', category: 'communication', tier: 'Pro' },
  { slug: 'opsgenie-bridge', name: 'OpsGenie Bridge', description: 'Routes agent security alerts to OpsGenie with priority mapping and on-call scheduling.', category: 'communication', tier: 'Pro' },
  { slug: 'agent-behavior-profiler', name: 'Agent Behavior Profiler', description: 'Builds behavioral baselines for AI agents and flags deviations from normal patterns.', category: 'productivity', tier: 'Pro' },
  { slug: 'supply-chain-guard', name: 'Supply Chain Guard', description: 'Detects slopsquatting, dependency confusion, and typosquatting in agent packages.', category: 'productivity', tier: 'Pro' },
  { slug: 'log-analyzer', name: 'Log Analyzer', description: 'Parses agent runtime logs and surfaces security-relevant events with structured output.', category: 'utilities', tier: 'Free' },
  { slug: 'auto-patcher', name: 'Auto Patcher', description: 'Automatically applies security patches to agent dependencies and base images.', category: 'utilities', tier: 'Pro' },
  { slug: 'compliance-reporter', name: 'Compliance Reporter', description: 'Generates SOC 2 and ISO 27001 compliance reports from agent security posture data.', category: 'finance', tier: 'Pro' },
  { slug: 'audit-logger', name: 'Audit Logger', description: 'Records tamper-proof audit trails for all agent actions, config changes, and access events.', category: 'finance', tier: 'Pro' },
  { slug: 'firewall-manager', name: 'Firewall Manager', description: 'Manages network firewall rules for agent containers with allowlist-only egress policies.', category: 'home', tier: 'Pro' },
  { slug: 'backup-manager', name: 'Backup Manager', description: 'Schedules encrypted backups of agent state, configs, and credential vaults to R2.', category: 'home', tier: 'Pro' },
  { slug: 'credential-rotator', name: 'Credential Rotator', description: 'Automatically rotates API keys, tokens, and secrets on a configurable schedule.', category: 'home', tier: 'Pro' },
];

const CATEGORY_ORDER: Array<{ key: SkillCategory; label: string }> = [
  { key: 'security', label: 'Security' }, { key: 'developer', label: 'CI/CD' },
  { key: 'communication', label: 'Alerts' }, { key: 'productivity', label: 'AI Agents' },
  { key: 'utilities', label: 'Runtime' }, { key: 'finance', label: 'Compliance' },
  { key: 'home', label: 'Infrastructure' },
];

/** Build JSON-LD ItemList with SoftwareApplication entries for AI search discovery. */
function buildJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'OpenSyber AI Agent Security Skills',
    numberOfItems: SKILLS.length,
    itemListElement: SKILLS.map((skill, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'SoftwareApplication',
        name: skill.name,
        description: skill.description,
        applicationCategory: 'SecurityApplication',
        ...(skill.tier === 'Free'
          ? { offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } }
          : {}),
        url: `https://opensyber.com/marketplace/${skill.slug}`,
      },
    })),
  };
}

export default function CatalogPage() {
  const jsonLd = buildJsonLd();
  return (
    <div className="min-h-screen bg-void">
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="pt-24 pb-12 md:pb-20">
        <article className="prose prose-invert max-w-none mx-auto max-w-6xl px-6 md:px-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            AI Agent Security Skills
          </h1>
          <p className="text-lg text-text-secondary mt-2 max-w-2xl">
            {SKILLS.length} skills for AI agent security. Each skill is code-audited, sandboxed,
            and ready to install in under 60 seconds.
          </p>

          {CATEGORY_ORDER.map(({ key, label }) => {
            const skills = SKILLS.filter((s) => s.category === key);
            const style = CATEGORY_STYLES[key];
            return (
              <section key={key} className="mt-10">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  {style?.icon && <style.icon className={`h-5 w-5 ${style.color}`} />}
                  {label}
                  <span className="text-sm text-text-dim font-normal">({skills.length})</span>
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 not-prose">
                  {skills.map((skill) => (
                    <SkillCatalogCard key={skill.slug} skill={skill} />
                  ))}
                </div>
              </section>
            );
          })}

          <section className="mt-14 grid gap-6 md:grid-cols-2 not-prose">
            <div className="rounded-xl border border-signal/20 bg-signal/5 p-6">
              <div className="flex items-center gap-2 mb-3">
                <Blocks className="h-5 w-5 text-signal" />
                <h3 className="text-lg font-semibold">Build Your Own Skill</h3>
              </div>
              <p className="text-sm text-text-secondary mb-4">
                Publish skills to the marketplace and earn a 70/30 revenue split. Our SDK handles packaging, sandboxing, and distribution.
              </p>
              <code className="block rounded-lg bg-surface px-4 py-2.5 text-sm text-text-secondary font-mono">
                npx @opensyber/skill-sdk init my-skill
              </code>
            </div>
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-6">
              <div className="flex items-center gap-2 mb-3">
                <Terminal className="h-5 w-5 text-purple-400" />
                <h3 className="text-lg font-semibold">Install via AI Agent</h3>
              </div>
              <p className="text-sm text-text-secondary mb-4">
                Connect your AI coding agent to OpenSyber via our MCP server. Your agent can browse, install, and configure skills automatically.
              </p>
              <code className="block rounded-lg bg-surface px-4 py-2.5 text-sm text-text-secondary font-mono">
                npx @opensyber/mcp-server
              </code>
            </div>
          </section>
        </article>
      </div>
      <footer className="border-t border-border py-12">
        <div className="mx-auto max-w-7xl px-6 flex flex-col items-center gap-4 md:flex-row md:justify-between">
          <div className="flex items-center gap-2 text-sm text-text-dim">
            <Shield className="h-4 w-4" /><span>&copy; 2026 OpenSyber. All rights reserved.</span>
          </div>
          <div className="flex gap-6 text-sm text-text-dim">
            <Link href="/pricing" className="hover:text-white transition">Pricing</Link>
            <Link href="/marketplace" className="hover:text-white transition">Skills</Link>
            <Link href="/docs" className="hover:text-white transition">Docs</Link>
            <Link href="/blog" className="hover:text-white transition">Blog</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SkillCatalogCard({ skill }: { skill: CatalogSkill }) {
  const style = CATEGORY_STYLES[skill.category];
  return (
    <Link href={`/marketplace/${skill.slug}`}
      className="group rounded-xl border border-border bg-surface/50 p-4 hover:border-signal/40 transition">
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${style?.bg ?? 'bg-surface'}`}>
          <SkillIconRenderer slug={skill.slug} category={skill.category} className={`h-4 w-4 ${style?.color ?? 'text-text-secondary'}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm group-hover:text-signal transition">{skill.name}</span>
            <CheckCircle className="h-3.5 w-3.5 text-green-400 shrink-0" />
          </div>
          <p className="text-xs text-text-secondary mt-1 line-clamp-2">{skill.description}</p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 text-xs text-text-dim">
        <span className={skill.tier === 'Free' ? 'text-green-400' : 'text-signal'}>{skill.tier}</span>
        <span className="text-text-dim">View &rarr;</span>
      </div>
    </Link>
  );
}
