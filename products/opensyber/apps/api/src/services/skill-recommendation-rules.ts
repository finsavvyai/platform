/**
 * Signal rules for skill recommendations.
 *
 * Each rule maps a user context signal to a skill suggestion.
 * Extracted from skill-recommendations.ts to stay within 200-line limit.
 */

export interface ResolvedContext {
  installedSlugs: Set<string>;
  hasCloudAccounts: boolean;
  hasSlackChannel: boolean;
  hasPagerDutyChannel: boolean;
  hasGitHubIntegration: boolean;
}

export interface SignalRule {
  check: (ctx: ResolvedContext) => boolean;
  slug: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  signal: string;
}

export const SIGNAL_RULES: SignalRule[] = [
  {
    check: (ctx) => !ctx.installedSlugs.has('secret-scanner'),
    slug: 'secret-scanner',
    reason: 'No secret scanning active — hardcoded credentials are the #1 cause of breaches',
    priority: 'high',
    signal: 'no_secret_scanning',
  },
  {
    check: (ctx) => !ctx.installedSlugs.has('dependency-auditor'),
    slug: 'dependency-auditor',
    reason: 'No dependency auditing — supply chain attacks increased 150% in 2025',
    priority: 'high',
    signal: 'no_dep_audit',
  },
  {
    check: (ctx) => !ctx.installedSlugs.has('agent-instruction-guardian'),
    slug: 'agent-instruction-guardian',
    reason: 'No instruction file protection — CLAUDE.md and .cursor/rules are prime prompt injection targets',
    priority: 'high',
    signal: 'no_instruction_guard',
  },
  {
    check: (ctx) => ctx.hasGitHubIntegration && !ctx.installedSlugs.has('github-actions-ai-prompt-guard'),
    slug: 'github-actions-ai-prompt-guard',
    reason: 'GitHub connected — scan CI workflows for AI prompt injection vectors',
    priority: 'high',
    signal: 'github_no_prompt_guard',
  },
  {
    check: (ctx) => ctx.hasGitHubIntegration && !ctx.installedSlugs.has('workflow-trigger-auditor'),
    slug: 'workflow-trigger-auditor',
    reason: 'GitHub connected — audit workflow triggers for pull_request_target and privilege escalation',
    priority: 'high',
    signal: 'github_no_trigger_audit',
  },
  {
    check: (ctx) => ctx.hasGitHubIntegration && !ctx.installedSlugs.has('workflow-permissions-auditor'),
    slug: 'workflow-permissions-auditor',
    reason: 'GitHub connected — enforce least-privilege permissions on workflow jobs',
    priority: 'medium',
    signal: 'github_no_perms_audit',
  },
  {
    check: (ctx) => ctx.hasGitHubIntegration && !ctx.installedSlugs.has('transitive-action-scanner'),
    slug: 'transitive-action-scanner',
    reason: 'GitHub connected — pin and monitor transitive action dependencies against supply chain attacks',
    priority: 'medium',
    signal: 'github_no_transitive_scan',
  },
  {
    check: (ctx) => ctx.hasCloudAccounts && !ctx.installedSlugs.has('oidc-trust-monitor'),
    slug: 'oidc-trust-monitor',
    reason: 'Cloud accounts connected — audit OIDC trust policies for overprivileged role assumptions',
    priority: 'medium',
    signal: 'cloud_no_oidc_monitor',
  },
  {
    check: (ctx) => ctx.hasCloudAccounts && !ctx.installedSlugs.has('iac-scanner'),
    slug: 'iac-scanner',
    reason: 'You have cloud accounts connected but no IaC security scanning',
    priority: 'medium',
    signal: 'cloud_no_iac',
  },
  {
    check: (ctx) => ctx.hasSlackChannel && !ctx.installedSlugs.has('slack-security-alerts'),
    slug: 'slack-security-alerts',
    reason: 'Slack is configured as an alert channel — install the skill for rich formatting',
    priority: 'medium',
    signal: 'slack_channel_no_skill',
  },
  {
    check: (ctx) => ctx.hasPagerDutyChannel && !ctx.installedSlugs.has('pagerduty-escalation'),
    slug: 'pagerduty-escalation',
    reason: 'PagerDuty is configured — install the skill for automatic incident escalation',
    priority: 'medium',
    signal: 'pagerduty_channel_no_skill',
  },
  {
    check: (ctx) => !ctx.installedSlugs.has('supply-chain-guard'),
    slug: 'supply-chain-guard',
    reason: 'No supply chain monitoring — detect typosquatting and malicious packages',
    priority: 'medium',
    signal: 'no_supply_chain',
  },
  {
    check: (ctx) => !ctx.installedSlugs.has('ide-extension-guardian'),
    slug: 'ide-extension-guardian',
    reason: 'No IDE extension monitoring — detect token reuse and malicious extension publishes',
    priority: 'low',
    signal: 'no_ide_guard',
  },
  {
    check: (ctx) => ctx.installedSlugs.size === 0,
    slug: 'network-sentinel',
    reason: 'No skills installed yet — start with network traffic monitoring',
    priority: 'high',
    signal: 'empty_agent',
  },
  {
    check: (ctx) => !ctx.installedSlugs.has('log-analyzer') && ctx.installedSlugs.size >= 2,
    slug: 'log-analyzer',
    reason: 'You have multiple skills running — add log analysis for anomaly detection',
    priority: 'low',
    signal: 'no_log_analysis',
  },
  {
    check: (ctx) => !ctx.installedSlugs.has('git-guardian') && ctx.hasGitHubIntegration,
    slug: 'git-guardian',
    reason: 'GitHub is connected — enforce pre-commit security hooks',
    priority: 'medium',
    signal: 'github_no_guardian',
  },
  {
    check: (ctx) => !ctx.installedSlugs.has('container-hardening') && ctx.hasCloudAccounts,
    slug: 'container-hardening',
    reason: 'Cloud infrastructure detected — audit container security configurations',
    priority: 'low',
    signal: 'cloud_no_container',
  },
];
