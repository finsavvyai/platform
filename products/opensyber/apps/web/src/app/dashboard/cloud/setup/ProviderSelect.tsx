'use client';

import { Cloud, Server, Database } from 'lucide-react';
import type { ReactNode } from 'react';

type Provider = 'aws' | 'azure' | 'gcp';

interface Props {
  onSelect: (provider: Provider) => void;
}

interface ProviderCard {
  id: Provider;
  name: string;
  description: string;
  icon: ReactNode;
  color: string;
  borderColor: string;
}

const PROVIDERS: ProviderCard[] = [
  {
    id: 'aws',
    name: 'Amazon Web Services',
    description: 'Connect via IAM cross-account role with SecurityAudit, GuardDuty, and Config read access.',
    icon: <Cloud className="h-8 w-8" />,
    color: 'text-orange-400',
    borderColor: 'hover:border-orange-500/50',
  },
  {
    id: 'azure',
    name: 'Microsoft Azure',
    description: 'Connect via App Registration with Security Reader role and Graph API permissions.',
    icon: <Server className="h-8 w-8" />,
    color: 'text-cyan-400',
    borderColor: 'hover:border-cyan-500/50',
  },
  {
    id: 'gcp',
    name: 'Google Cloud Platform',
    description: 'Connect via Service Account with Security Center and IAM Security Reviewer access.',
    icon: <Database className="h-8 w-8" />,
    color: 'text-signal',
    borderColor: 'hover:border-info/50',
  },
];

export function ProviderSelect({ onSelect }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          onClick={() => onSelect(p.id)}
          className={`group rounded border border-border bg-panel/30 p-6 text-left transition hover:bg-surface/50 ${p.borderColor}`}
        >
          <div className={`mb-4 ${p.color}`}>{p.icon}</div>
          <h3 className="text-lg font-semibold">{p.name}</h3>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">{p.description}</p>
          <div className="mt-4 text-xs font-medium text-signal opacity-0 transition group-hover:opacity-100">
            Select provider &rarr;
          </div>
        </button>
      ))}
    </div>
  );
}
