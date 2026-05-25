export interface SkillListing {
  name: string
  cat: string
  tier: 'Free' | 'Pro'
  desc: string
}

export const MARKETPLACE_SKILLS: SkillListing[] = [
  { name: 'secret-scanner', cat: 'security', tier: 'Free', desc: 'Scan for hardcoded secrets and API keys' },
  { name: 'dependency-auditor', cat: 'security', tier: 'Free', desc: 'Deep CVE + malicious package scanning' },
  { name: 'prompt-guard', cat: 'security', tier: 'Pro', desc: 'Block prompt injection attacks' },
  { name: 'mcp-auditor', cat: 'security', tier: 'Free', desc: 'Audit MCP server configurations' },
  { name: 'supply-chain-guard', cat: 'security', tier: 'Free', desc: 'Block malicious packages at install' },
  { name: 'container-hardener', cat: 'security', tier: 'Free', desc: 'Audit Docker container security' },
  { name: 'network-monitor', cat: 'security', tier: 'Pro', desc: 'Real-time network anomaly detection' },
  { name: 'github-integration', cat: 'cicd', tier: 'Free', desc: 'Monitor GitHub security events' },
  { name: 'ci-cd-guardian', cat: 'cicd', tier: 'Pro', desc: 'Protect CI/CD pipelines' },
  { name: 'slack-notifier', cat: 'alerts', tier: 'Free', desc: 'Send alerts to Slack' },
  { name: 'pagerduty-connector', cat: 'alerts', tier: 'Pro', desc: 'Route to PagerDuty' },
  { name: 'discord-alerter', cat: 'alerts', tier: 'Free', desc: 'Send alerts to Discord' },
  { name: 'teams-connector', cat: 'alerts', tier: 'Free', desc: 'Send alerts to Teams' },
  { name: 'agent-behavior-profiler', cat: 'agents', tier: 'Pro', desc: 'Behavioral baselines + anomaly alerts' },
  { name: 'log-analyzer', cat: 'runtime', tier: 'Free', desc: 'Parse logs for anomalies' },
  { name: 'auto-patcher', cat: 'runtime', tier: 'Pro', desc: 'Auto-apply security patches' },
  { name: 'compliance-reporter', cat: 'compliance', tier: 'Pro', desc: 'SOC 2, ISO 27001, GDPR reports' },
  { name: 'audit-logger', cat: 'compliance', tier: 'Free', desc: 'Immutable audit logging' },
  { name: 'firewall-manager', cat: 'infra', tier: 'Pro', desc: 'Manage agent firewall rules' },
  { name: 'backup-manager', cat: 'infra', tier: 'Free', desc: 'Encrypted agent backups' },
  { name: 'credential-rotator', cat: 'infra', tier: 'Pro', desc: 'Auto-rotate credentials on breach' },
]
