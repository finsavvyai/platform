import {
  Star, Store, Code, Shield, DollarSign, MessageSquare, Home,
  Wrench, Zap, GitBranch, Bell, Search, Lock, Bug, FileText, Globe, Mail, Receipt,
} from 'lucide-react';
import type { SkillCategory } from '@opensyber/shared';

export const CATEGORY_STYLES: Record<SkillCategory, { icon: typeof Code; color: string; bg: string }> = {
  developer: { icon: Code, color: 'text-signal', bg: 'bg-signal/10' },
  security: { icon: Shield, color: 'text-red-400', bg: 'bg-red-500/10' },
  finance: { icon: DollarSign, color: 'text-green-400', bg: 'bg-green-500/10' },
  communication: { icon: MessageSquare, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  home: { icon: Home, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  productivity: { icon: Zap, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  utilities: { icon: Wrench, color: 'text-orange-400', bg: 'bg-orange-500/10' },
};

export const SKILL_ICONS: Record<string, typeof Code> = {
  'github-integration': GitBranch,
  'slack-notifier': Bell,
  'ai-code-reviewer': Search,
  'secret-scanner': Lock,
  'jira-sync': Zap,
  'log-analyzer': FileText,
  'docker-hardener': Shield,
  'notion-connector': FileText,
  'api-monitor': Globe,
  'cve-auto-patcher': Bug,
  'email-responder': Mail,
  'expense-tracker': Receipt,
};

export function getSkillIcon(slug: string, category: SkillCategory): typeof Code {
  return SKILL_ICONS[slug] ?? CATEGORY_STYLES[category]?.icon ?? Store;
}

/** Render a skill icon without creating a component during render. */
/* eslint-disable react-hooks/static-components */
export function SkillIconRenderer({ slug, category, className }: { slug: string; category: SkillCategory; className?: string }) {
  const Icon = getSkillIcon(slug, category);
  return <Icon className={className} />;
}
/* eslint-enable react-hooks/static-components */

export function renderStars(rating: number, size = 'h-3.5 w-3.5'): React.ReactElement[] {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const stars: React.ReactElement[] = [];
  for (let i = 0; i < 5; i++) {
    if (i < full) {
      stars.push(<Star key={i} className={`${size} fill-yellow-400 text-yellow-400`} />);
    } else if (i === full && half) {
      stars.push(<Star key={i} className={`${size} fill-yellow-400/50 text-yellow-400`} />);
    } else {
      stars.push(<Star key={i} className={`${size} text-text-dim`} />);
    }
  }
  return stars;
}
