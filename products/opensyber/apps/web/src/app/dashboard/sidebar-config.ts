import {
  LayoutDashboard, Package, ScrollText, Settings, BellRing,
  Users, Settings2, KeyRound, MapPin, UserCircle,
  MonitorDot, ShieldCheck, Bell, AlertOctagon, Lock, Wifi,
  FileSearch, Bug, ClipboardCheck, Globe, Activity, Trophy,
  Cloud, ShieldAlert, ShieldOff, UsersRound, Network, Database,
  Store, FileCheck, Timer, Plug, Zap,
  Crosshair, Cpu, Gauge, Workflow, Radar, Scale,
  BarChart3, Brain, Eye, Box, BookOpen, Monitor, Inbox,
  Shield, Grid3X3, AlertTriangle, FileCode, FlaskConical,
} from 'lucide-react';
import type { NavItem, SidebarGroup } from './sidebar-types';
export type { NavItem, NavSubGroup, SidebarGroup } from './sidebar-types';

/** Pinned home link — always visible at top */
export const homeItem: NavItem = {
  href: '/dashboard', label: 'Overview', icon: LayoutDashboard,
};

/** HIG: 5 collapsible groups, sub-grouped to keep each level at 5-7 items */
export const sidebarGroups: SidebarGroup[] = [
  {
    id: 'agent',
    title: 'Agent',
    icon: Cpu,
    items: [
      { href: '/dashboard/agents', label: 'Activity', icon: MonitorDot },
      { href: '/dashboard/skills', label: 'Skills', icon: Package },
      { href: '/dashboard/marketplace', label: 'Marketplace', icon: Store },
      { href: '/dashboard/bundles', label: 'Bundles', icon: Package },
      { href: '/dashboard/logs', label: 'Audit Logs', icon: ScrollText },
      { href: '/dashboard/mcp-monitoring', label: 'MCP Monitoring', icon: Cpu },
      { href: '/dashboard/getting-started', label: 'Getting Started', icon: Zap },
      { href: '/dashboard/achievements', label: 'Achievements', icon: Trophy },
    ],
  },
  {
    id: 'security',
    title: 'Security',
    icon: ShieldCheck,
    items: [
      { href: '/dashboard/security', label: 'Dashboard', icon: ShieldCheck },
      { href: '/dashboard/security/vulnerabilities', label: 'Vulnerabilities', icon: Bug },
    ],
    subGroups: [
      {
        label: 'Detection',
        items: [
          { href: '/dashboard/security/alerts', label: 'Alerts', icon: Bell },
          { href: '/dashboard/security/incidents', label: 'Incidents', icon: AlertOctagon },
          { href: '/dashboard/kill-chain', label: 'Kill Chain', icon: Crosshair },
          { href: '/dashboard/detection-tests', label: 'Validation', icon: FlaskConical },
        ],
      },
      {
        label: 'Investigation',
        items: [
          { href: '/dashboard/security/threats', label: 'Threat Map', icon: Globe },
          { href: '/dashboard/threat-feed', label: 'Threat Feed', icon: Radar },
          { href: '/dashboard/attack-paths', label: 'Attack Paths', icon: Network },
          { href: '/dashboard/threat-level', label: 'Threat Level', icon: Gauge },
          { href: '/dashboard/toxic-combinations', label: 'Toxic Combos', icon: Zap },
          { href: '/dashboard/storylines', label: 'Storylines', icon: BookOpen },
          { href: '/dashboard/security-inbox', label: 'Security Inbox', icon: Inbox },
        ],
      },
      {
        label: 'Infrastructure',
        items: [
          { href: '/dashboard/security/network', label: 'Network', icon: Wifi },
          { href: '/dashboard/security/files', label: 'File Integrity', icon: FileSearch },
          { href: '/dashboard/security/attestation-feed', label: 'Attestation Feed', icon: ShieldCheck },
          { href: '/dashboard/security/supply-chain', label: 'Supply Chain', icon: Package },
          { href: '/dashboard/container-security', label: 'Containers', icon: Box },
          { href: '/dashboard/api-security', label: 'API Security', icon: Lock },
          { href: '/dashboard/iac-scanner', label: 'IaC Scanner', icon: FileCode },
          { href: '/dashboard/session-recordings', label: 'Sessions', icon: Monitor },
        ],
      },
    ],
  },
  {
    id: 'governance',
    title: 'Governance',
    icon: Scale,
    subGroups: [
      {
        label: 'Policy',
        items: [
          { href: '/dashboard/agents/policies', label: 'Agent Policies', icon: ShieldAlert },
          { href: '/dashboard/security/policies', label: 'Policies', icon: Lock },
          { href: '/dashboard/rule-engine', label: 'Rule Engine', icon: Workflow },
        ],
      },
      {
        label: 'Compliance',
        items: [
          { href: '/dashboard/oasf', label: 'OASF', icon: ClipboardCheck },
          { href: '/dashboard/soc2', label: 'SOC2 Readiness', icon: FileCheck },
          { href: '/dashboard/security/compliance', label: 'Compliance', icon: ClipboardCheck },
          { href: '/dashboard/cloud/findings', label: 'CSPM Findings', icon: ShieldAlert },
          { href: '/dashboard/compliance-heatmap', label: 'Heatmap', icon: Grid3X3 },
          { href: '/dashboard/mitre-attack', label: 'MITRE ATT&CK', icon: Shield },
        ],
      },
      {
        label: 'Operations',
        items: [
          { href: '/dashboard/cloud', label: 'Cloud Security', icon: Cloud },
          { href: '/dashboard/assets', label: 'Asset Inventory', icon: Database },
          { href: '/dashboard/slo-dashboard', label: 'SLO Dashboard', icon: Gauge },
          { href: '/dashboard/security/uptime', label: 'Uptime', icon: Activity },
          { href: '/dashboard/sla', label: 'SLA Monitor', icon: Timer },
        ],
      },
    ],
  },
  {
    id: 'team',
    title: 'Team',
    icon: Users,
    planGated: true,
    items: [
      { href: '/dashboard/team', label: 'Members', icon: Users },
      { href: '/dashboard/team/settings', label: 'Team Settings', icon: Settings2 },
      { href: '/dashboard/team/sso', label: 'SSO', icon: KeyRound },
      { href: '/dashboard/team/residency', label: 'Residency', icon: MapPin },
      { href: '/dashboard/agents/team', label: 'Team Agents', icon: UsersRound },
      { href: '/dashboard/agents/alert-channels', label: 'Alert Channels', icon: BellRing },
      { href: '/dashboard/agents/violations', label: 'Violations', icon: ShieldOff },
    ],
  },
  {
    id: 'intelligence',
    title: 'Intelligence',
    icon: Brain,
    subGroups: [
      {
        label: 'Analytics',
        items: [
          { href: '/dashboard/executive', label: 'Executive', icon: BarChart3 },
          { href: '/dashboard/behavior-analytics', label: 'Behavior', icon: Activity },
          { href: '/dashboard/composite-alerts', label: 'Composite Alerts', icon: AlertTriangle },
          { href: '/dashboard/security-graph', label: 'Security Graph', icon: Network },
        ],
      },
      {
        label: 'Data',
        items: [
          { href: '/dashboard/data-exposure', label: 'Data Exposure', icon: Eye },
          { href: '/dashboard/entitlements', label: 'Entitlements', icon: Users },
          { href: '/dashboard/saas-discovery', label: 'SaaS Discovery', icon: Globe },
          { href: '/dashboard/agent-discovery', label: 'Agent Discovery', icon: Cpu },
          { href: '/dashboard/access-requests', label: 'Access Requests', icon: KeyRound },
        ],
      },
      {
        label: 'Automation',
        items: [
          { href: '/dashboard/workflows', label: 'Workflows', icon: Workflow },
          { href: '/dashboard/ai', label: 'AI Intelligence', icon: Brain },
        ],
      },
    ],
  },
];

/** Bottom rail — only system-level utilities (HIG: no feature items here) */
export const bottomRailItems: NavItem[] = [
  { href: '/dashboard/integrations', label: 'Integrations', icon: Plug },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  { href: '/dashboard/settings/api-keys', label: 'API Keys', icon: KeyRound },
  { href: '/dashboard/settings/alerts', label: 'Alert Prefs', icon: Bell },
  { href: '/dashboard/profile', label: 'Profile', icon: UserCircle },
];

/** All hrefs across all groups — used for route matching */
export function allGroupHrefs(group: SidebarGroup): string[] {
  const hrefs: string[] = [];
  if (group.items) hrefs.push(...group.items.map((i) => i.href));
  if (group.subGroups) {
    for (const sg of group.subGroups) hrefs.push(...sg.items.map((i) => i.href));
  }
  return hrefs;
}
