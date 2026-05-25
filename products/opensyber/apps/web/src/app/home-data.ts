import {
  Terminal, AlertTriangle, Globe, FileWarning,
  Server, Eye, Zap, Shield, Lock,
} from 'lucide-react';

export const threats = [
  {
    icon: Terminal,
    title: 'Arbitrary Code Execution',
    desc: 'Your agent runs shell commands on your server. Any shell command. And you just... let it? That\'s the plan?',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10 border-red-500/20',
  },
  {
    icon: FileWarning,
    title: 'Plaintext Credentials',
    desc: '68% of agents store API keys in plaintext .env files. Plaintext. In 2026. We put a man on the moon.',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10 border-orange-500/20',
  },
  {
    icon: Globe,
    title: 'Unrestricted Network',
    desc: 'Your agent can call any IP on the internet. Any. It\'s like giving a contractor keys to every room and skipping the cameras.',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10 border-yellow-500/20',
  },
  {
    icon: AlertTriangle,
    title: 'Zero Audit Trail',
    desc: 'When it goes wrong — and it will — you\'ll have no logs. "We should have enabled logging," every post-mortem ever.',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10 border-red-500/20',
  },
];

export const steps = [
  {
    step: '1',
    title: 'Sign Up. Free. Done.',
    description: 'No credit card. No sales call. No 47-page procurement process. You just... start. Revolutionary concept.',
    icon: Zap,
  },
  {
    step: '2',
    title: 'See What They\'re Doing',
    description: 'Every file. Every command. Every secret access. Every network call. You might want to sit down for this part.',
    icon: Eye,
  },
  {
    step: '3',
    title: 'Stop the Bad Stuff',
    description: 'Set policies. Get alerts. Respond in 340ms instead of 204 days. The bar was underground. We raised it slightly.',
    icon: Shield,
  },
];

export const comparisonRows = [
  ['Agent visibility', 'Close your eyes and hope', 'Every action recorded and scored'],
  ['Credential protection', '.env plaintext. In 2026. Incredible.', 'Encrypted vault with access logging'],
  ['Threat detection', 'Find out from Twitter. After the stock drop.', 'Real-time alerts. 340ms.'],
  ['Policy enforcement', '"We trust the developer" — famous last words', 'Automated rules across all agents'],
  ['Audit trail', '"We should have enabled logging"', 'Every file, network, and credential access'],
  ['Incident response', 'SSH into the box at 3am in your underwear', 'Dashboard + alerts + timeline + playbooks'],
  ['Session security', 'A session cookie. Like it\'s 2008.', 'Cryptographic device binding (ECDSA P-256)'],
  ['Skill verification', 'Trust the README. The README.', 'Multi-stage audit + sandbox testing'],
  ['Compliance', '"We\'ll get to it" (narrator: they did not)', 'SOC2 / ISO 27001 report generation'],
  ['Emotional damage', 'High. Very high.', 'Still high, but at least you saw it coming'],
];

export const solutionLayers = [
  {
    title: 'Agent Runtime Intelligence',
    icon: Eye,
    cardClass: 'hover:border-info/30 hover:shadow-info/5',
    iconBg: 'bg-info/10 group-hover:bg-info/20',
    iconColor: 'text-info',
    features: [
      'See what every AI agent does — files, commands, network, secrets. All of it.',
      'Works with Cursor, Claude Code, Cline, Devin, or your custom agent',
      'Behavioral analysis catches anomalies before damage occurs',
      'Connects in seconds. Runs silently. Your agents work exactly as before.',
      'No code changes required. We know. It sounds too easy. It is that easy.',
    ],
  },
  {
    title: 'Policy Engine & Threat Response',
    icon: Shield,
    cardClass: 'hover:border-green-500/30 hover:shadow-green-500/5',
    iconBg: 'bg-green-500/10 group-hover:bg-green-500/20',
    iconColor: 'text-green-400',
    features: [
      'Define what agents can and cannot do. Enforce it. Automatically.',
      'Instant alerts via Slack, email, or webhook. Not via a journalist.',
      'Incident timeline with root cause analysis and playbooks',
      'Suspend compromised agents with one click. Not one SSH session.',
      'Continuous scoring across 8 risk categories. Like a credit score, but useful.',
    ],
  },
  {
    title: 'Secure Infrastructure & Marketplace',
    icon: Server,
    cardClass: 'hover:border-purple-500/30 hover:shadow-purple-500/5',
    iconBg: 'bg-purple-500/10 group-hover:bg-purple-500/20',
    iconColor: 'text-purple-400',
    features: [
      'Hardened, isolated compute. Not your laptop with Docker and a prayer.',
      'Encrypted credential vault — agents never see plaintext secrets',
      'Verified skill marketplace. 4-stage audit. Not "trust the README."',
      'SOC2, ISO 27001 reports generated. Not "we\'ll get to it."',
      'Deploy to EU, US, or Asia Pacific. Data stays where you say.',
    ],
  },
];

export const earlyAccessFeatures = [
  {
    title: 'Works Where You Work',
    description: 'Your agents stay where they are. No migration. No disruption. No vendor lock-in. We\'re not that kind of company.',
    icon: Zap,
  },
  {
    title: 'Built for AI Agents. Actually.',
    description: 'Not server monitoring from 2014 with a new logo. Every feature exists because AI agents are a new problem. Novel concept.',
    icon: Lock,
  },
  {
    title: 'Free. Like, Actually Free.',
    description: 'Monitor your first agent at zero cost. No trial. No "contact sales." Because we\'d rather you have some protection than none.',
    icon: Shield,
  },
];
