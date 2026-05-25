import { Brain, ShieldAlert, Server, Plus, GitPullRequest, MessageSquare } from 'lucide-react';

export const features = [
  {
    icon: Brain,
    title: 'Semantic Validation',
    body: 'Not just linting. PushCI understands what the AI intended and checks if the code actually does it. Catches hallucinated imports, phantom function calls, and schema mismatches.',
  },
  {
    icon: ShieldAlert,
    title: 'Dependency Safety',
    body: 'AI agents install packages without checking. PushCI blocks typosquats, supply chain attacks, and known-vulnerable versions before they hit your lockfile.',
  },
  {
    icon: Server,
    title: 'Infrastructure Drift',
    body: 'AI-generated Terraform, Docker, and K8s configs are dangerous. PushCI validates resource limits, IAM policies, and network rules against your baseline.',
  },
];

export const steps = [
  {
    n: '1',
    icon: Plus,
    text: 'Add PushCI to your GitHub Actions workflow (2 lines of YAML)',
  },
  {
    n: '2',
    icon: GitPullRequest,
    text: 'Open a PR with AI-generated code',
  },
  {
    n: '3',
    icon: MessageSquare,
    text: 'PushCI annotates the PR with findings — block, warn, or pass',
  },
];

export const stats = [
  { value: '340ms', label: 'median check time' },
  { value: '0.3 FP', label: 'per repo per day' },
  { value: 'Any AI', label: 'Cursor, Claude Code, Copilot, Devin' },
];
