import type { SkillCategory, VerificationStatus } from '@opensyber/shared';

export interface MarketplaceSkill {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: SkillCategory;
  currentVersion: string | null;
  verificationStatus: VerificationStatus;
  installCount: number;
  ratingAvg: number;
  ratingCount: number;
}

export const DEMO_SKILLS: MarketplaceSkill[] = [
  {
    id: 'demo-1', slug: 'secret-scanner', name: 'Secret Scanner',
    description: 'Detects AWS keys, GitHub tokens, API secrets, and private keys in files accessed by AI agents. Zero false positives.',
    category: 'security', currentVersion: '2.1.0', verificationStatus: 'approved',
    installCount: 2_847, ratingAvg: 4.8, ratingCount: 312,
  },
  {
    id: 'demo-2', slug: 'docker-hardener', name: 'Docker Hardener',
    description: 'Audits container configurations for security misconfigurations. Checks privileged mode, network exposure, and volume mounts.',
    category: 'security', currentVersion: '1.4.2', verificationStatus: 'approved',
    installCount: 1_923, ratingAvg: 4.6, ratingCount: 198,
  },
  {
    id: 'demo-3', slug: 'ai-code-reviewer', name: 'AI Code Reviewer',
    description: 'Analyzes code changes made by AI agents for security vulnerabilities, injection risks, and unsafe patterns.',
    category: 'developer', currentVersion: '3.0.1', verificationStatus: 'approved',
    installCount: 4_512, ratingAvg: 4.9, ratingCount: 567,
  },
  {
    id: 'demo-4', slug: 'cve-auto-patcher', name: 'CVE Auto-Patcher',
    description: 'Monitors dependencies for known vulnerabilities and suggests safe version upgrades automatically.',
    category: 'developer', currentVersion: '1.2.0', verificationStatus: 'approved',
    installCount: 1_456, ratingAvg: 4.5, ratingCount: 142,
  },
  {
    id: 'demo-5', slug: 'slack-notifier', name: 'Slack Notifier',
    description: 'Sends real-time Slack alerts when AI agents access critical files, run dangerous commands, or trigger policy violations.',
    category: 'communication', currentVersion: '2.0.3', verificationStatus: 'approved',
    installCount: 3_201, ratingAvg: 4.7, ratingCount: 289,
  },
  {
    id: 'demo-6', slug: 'github-integration', name: 'GitHub Integration',
    description: 'Tracks AI agent commits, PR reviews, and repository access. Creates audit trails for compliance reporting.',
    category: 'developer', currentVersion: '1.8.0', verificationStatus: 'approved',
    installCount: 2_678, ratingAvg: 4.4, ratingCount: 231,
  },
  {
    id: 'demo-7', slug: 'api-monitor', name: 'API Monitor',
    description: 'Monitors outbound API calls from AI agents. Detects data exfiltration, unauthorized endpoints, and anomalous traffic patterns.',
    category: 'security', currentVersion: '1.5.1', verificationStatus: 'approved',
    installCount: 1_834, ratingAvg: 4.6, ratingCount: 176,
  },
  {
    id: 'demo-8', slug: 'expense-tracker', name: 'Cost Tracker',
    description: 'Tracks compute costs, API usage, and token consumption across all AI agents. Per-agent and per-team breakdowns.',
    category: 'finance', currentVersion: '1.1.0', verificationStatus: 'approved',
    installCount: 987, ratingAvg: 4.3, ratingCount: 89,
  },
  {
    id: 'demo-9', slug: 'log-analyzer', name: 'Log Analyzer',
    description: 'Parses and correlates agent activity logs. Surfaces anomalies, permission escalations, and unusual file access patterns.',
    category: 'utilities', currentVersion: '2.3.0', verificationStatus: 'approved',
    installCount: 1_567, ratingAvg: 4.5, ratingCount: 154,
  },
  {
    id: 'demo-10', slug: 'jira-sync', name: 'Jira Sync',
    description: 'Automatically creates Jira tickets from security findings and policy violations detected by OpenSyber.',
    category: 'productivity', currentVersion: '1.0.2', verificationStatus: 'approved',
    installCount: 1_123, ratingAvg: 4.2, ratingCount: 98,
  },
  {
    id: 'demo-11', slug: 'notion-connector', name: 'Notion Connector',
    description: 'Syncs agent activity reports and compliance summaries to Notion workspaces. Auto-generates weekly digests.',
    category: 'productivity', currentVersion: '1.3.0', verificationStatus: 'approved',
    installCount: 876, ratingAvg: 4.1, ratingCount: 67,
  },
  {
    id: 'demo-12', slug: 'email-responder', name: 'Email Alerts',
    description: 'Sends formatted email digests of agent activity. Configurable schedules, severity filters, and recipient lists.',
    category: 'communication', currentVersion: '1.6.0', verificationStatus: 'approved',
    installCount: 2_345, ratingAvg: 4.4, ratingCount: 201,
  },
];
