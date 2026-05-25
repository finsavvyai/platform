export interface CloudAccount {
  id: string;
  provider: 'aws' | 'gcp' | 'azure';
  name: string;
  status: 'active' | 'inactive' | 'error' | 'scanning';
  roleArn: string | null;
  lastScanAt: string | null;
  createdAt: string;
}

export const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400',
  inactive: 'bg-neutral-800 text-neutral-400',
  error: 'bg-red-500/10 text-red-400',
  scanning: 'bg-amber-500/10 text-amber-400',
};

export const PROVIDER_LABELS: Record<string, string> = {
  aws: 'AWS',
  gcp: 'GCP',
  azure: 'Azure',
};

export const PROVIDER_COLORS: Record<string, string> = {
  aws: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  gcp: 'bg-info/10 text-info border-info/20',
  azure: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
};
