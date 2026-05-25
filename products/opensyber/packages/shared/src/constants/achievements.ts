/**
 * Security achievement definitions for gamified milestones.
 * Each achievement has evaluation criteria checked server-side
 * and shareable metadata for public cards.
 */

export interface Achievement {
  slug: string;
  title: string;
  description: string;
  icon: string; // Lucide icon name
  category: 'score' | 'defense' | 'compliance' | 'configuration';
  shareText: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    slug: 'fortress',
    title: 'Fortress',
    description: 'Maintained a security score of 95+ for 7 consecutive days.',
    icon: 'Castle',
    category: 'score',
    shareText: 'My AI agent earned the Fortress achievement — 95+ security score for 7 days straight!',
  },
  {
    slug: 'guardian',
    title: 'Guardian',
    description: 'Maintained a security score of 80+ for 30 consecutive days.',
    icon: 'ShieldCheck',
    category: 'score',
    shareText: 'My AI agent is a Guardian — 80+ security score for 30 consecutive days!',
  },
  {
    slug: 'zero-day-hero',
    title: 'Zero Day Hero',
    description: 'Patched a CVE within 1 hour of detection.',
    icon: 'Zap',
    category: 'defense',
    shareText: 'Zero Day Hero! Patched a vulnerability within 1 hour on OpenSyber.',
  },
  {
    slug: 'clean-sheet',
    title: 'Clean Sheet',
    description: 'Zero security incidents for 30 consecutive days.',
    icon: 'Sparkles',
    category: 'defense',
    shareText: 'Clean Sheet — zero security incidents for 30 days on OpenSyber!',
  },
  {
    slug: 'vigilant',
    title: 'Vigilant',
    description: 'Configured 5 or more active alert rules.',
    icon: 'Eye',
    category: 'configuration',
    shareText: 'Vigilant and watching! 5+ active alert rules on OpenSyber.',
  },
  {
    slug: 'hardened',
    title: 'Hardened',
    description: 'All 6 security policy types are active.',
    icon: 'Lock',
    category: 'configuration',
    shareText: 'Fully Hardened — all 6 policy types active on OpenSyber!',
  },
  {
    slug: 'verified-only',
    title: 'Verified Only',
    description: 'All installed skills are verified — zero unverified.',
    icon: 'BadgeCheck',
    category: 'compliance',
    shareText: 'Verified Only — 100% verified skills on OpenSyber!',
  },
  {
    slug: 'compliance-ready',
    title: 'Compliance Ready',
    description: 'Generated compliance reports for 3 or more frameworks.',
    icon: 'ClipboardCheck',
    category: 'compliance',
    shareText: 'Compliance Ready! Reports for 3+ frameworks on OpenSyber.',
  },
  {
    slug: 'first-responder',
    title: 'First Responder',
    description: 'Resolved a security incident within 24 hours.',
    icon: 'Siren',
    category: 'defense',
    shareText: 'First Responder — resolved an incident within 24h on OpenSyber!',
  },
  {
    slug: 'network-sentinel',
    title: 'Network Sentinel',
    description: 'Both network allowlist and blocklist policies are active.',
    icon: 'Radar',
    category: 'configuration',
    shareText: 'Network Sentinel — full network policy coverage on OpenSyber!',
  },
] as const;

export const ACHIEVEMENT_BY_SLUG = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.slug, a]),
) as Record<string, Achievement>;

export const VALID_ACHIEVEMENT_SLUGS = ACHIEVEMENTS.map((a) => a.slug);
