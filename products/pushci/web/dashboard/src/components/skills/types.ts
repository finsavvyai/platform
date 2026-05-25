export interface Skill {
  id: string; name: string; description: string; longDescription?: string; version: string;
  category: string; author: string; tags: string[]; verified: boolean; installs: number;
  tier: 'free' | 'pro' | 'premium'; steps: Array<{ name: string; run: string; on_fail?: string }>;
  config?: Record<string, string>; gateway?: string;
  guide?: string; prerequisites?: string[];
}

export interface Project { id: string; repo: string; platform: string; }

export const CATEGORIES = [
  { id: 'all', label: 'All', icon: '*' }, { id: 'templates', label: 'Templates', icon: '#' },
  { id: 'checks', label: 'Checks', icon: '>' }, { id: 'deploy', label: 'Deploy', icon: '^' },
  { id: 'notify', label: 'Notify', icon: '@' }, { id: 'security', label: 'Security', icon: '!' },
  { id: 'ai', label: 'AI', icon: '~' },
];

export const CAT_COLORS: Record<string, string> = {
  templates: 'from-blue-500 to-blue-700', checks: 'from-amber-500 to-amber-700',
  deploy: 'from-emerald-500 to-emerald-700', notify: 'from-purple-500 to-purple-700',
  security: 'from-red-500 to-red-700', ai: 'from-cyan-400 to-cyan-600',
};

export const TIER_BADGE: Record<string, { label: string; cls: string }> = {
  free: { label: 'Free', cls: 'bg-emerald-500/10 text-emerald-400' },
  pro: { label: 'Pro', cls: 'bg-blue-500/10 text-blue-400' },
  premium: { label: 'Premium', cls: 'bg-amber-500/10 text-amber-400' },
};

export function fmt(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n); }
