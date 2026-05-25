export interface SaasApp {
  id: string;
  name: string;
  initials: string;
  color: string;
  category: 'Productivity' | 'AI' | 'DevTools' | 'Communication' | 'Storage';
  riskLevel: 'Critical' | 'High' | 'Medium' | 'Low' | 'Safe';
  users: number;
  oauthPermissions: string;
  isShadowAI: boolean;
  lastSeen: string;
}

export const RISK_COLORS: Record<string, string> = {
  Critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  High: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Medium: 'bg-info/20 text-info border-info/30',
  Low: 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30',
  Safe: 'bg-green-500/20 text-green-400 border-green-500/30',
};

export const CATEGORY_COLORS: Record<string, string> = {
  Productivity: 'bg-purple-500/20 text-purple-400',
  AI: 'bg-amber-500/20 text-amber-400',
  DevTools: 'bg-info/20 text-info',
  Communication: 'bg-green-500/20 text-green-400',
  Storage: 'bg-cyan-500/20 text-cyan-400',
};

export const INITIALS_COLORS = [
  'bg-purple-600', 'bg-info', 'bg-green-600',
  'bg-amber-600', 'bg-cyan-600', 'bg-pink-600', 'bg-info',
];
