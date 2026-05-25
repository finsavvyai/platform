import { API_BASE_URL } from '../../config';
import type { Project } from '../../hooks/useApi';

export function cardClassName(emphasis = false): string {
  return [
    'rounded-2xl border p-5 backdrop-blur-sm',
    emphasis
      ? 'border-emerald-500/30 bg-emerald-500/[0.04] shadow-[0_0_30px_-8px_rgba(16,185,129,0.2)]'
      : 'border-zinc-800/80 bg-zinc-900/60',
  ].join(' ');
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function formatEnvironmentScope(environments: string[]): string {
  return environments.length === 0 ? 'all environments' : environments.join(', ');
}

export function webhookUrl(project: Project): string {
  return `${API_BASE_URL}/webhook/${project.platform}`;
}
