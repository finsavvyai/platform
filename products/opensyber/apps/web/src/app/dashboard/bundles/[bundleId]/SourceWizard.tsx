'use client';

import { useState } from 'react';
import Link from 'next/link';
import { GitBranch, Cpu, Key, CheckCircle, ArrowRight } from 'lucide-react';

interface Props {
  bundleSlug: string;
}

const SOURCE_OPTIONS = [
  {
    id: 'github',
    label: 'GitHub App',
    description: 'Install the OpenSyber GitHub App for automatic repo scanning.',
    icon: GitBranch,
    instructions: 'Install the GitHub App from our marketplace integration to connect your repositories.',
  },
  {
    id: 'agent',
    label: 'Agent',
    description: 'Deploy an OpenSyber agent in your infrastructure.',
    icon: Cpu,
    instructions: 'Deploy an agent instance from the Agents page, then assign this bundle to it.',
  },
  {
    id: 'api-key',
    label: 'API Key',
    description: 'Use an API key for programmatic integration.',
    icon: Key,
    instructions: 'Generate an API key from Settings, then configure your CI/CD pipeline to report findings.',
  },
] as const;

export function SourceWizard({ bundleSlug: _bundleSlug }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Connect a Source</h2>
      <p className="mb-6 text-sm text-text-secondary">
        Choose how to connect your infrastructure to this bundle.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {SOURCE_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = selected === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setSelected(opt.id)}
              className={`rounded border p-5 text-left transition-colors min-h-[44px] ${
                isSelected
                  ? 'border-signal bg-signal/5'
                  : 'border-border bg-panel/30 hover:border-wire'
              }`}
              aria-pressed={isSelected}
            >
              <Icon className={`h-6 w-6 mb-3 ${isSelected ? 'text-signal' : 'text-text-secondary'}`} aria-hidden="true" />
              <h3 className="text-sm font-semibold">{opt.label}</h3>
              <p className="mt-1 text-xs text-text-secondary">{opt.description}</p>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-6 rounded border border-border bg-panel/30 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-signal mt-0.5 flex-shrink-0" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold mb-1">
                {SOURCE_OPTIONS.find((o) => o.id === selected)?.label} Setup
              </h3>
              <p className="text-sm text-text-secondary">
                {SOURCE_OPTIONS.find((o) => o.id === selected)?.instructions}
              </p>
              <div className="mt-4 flex gap-3">
                {selected === 'github' && (
                  <Link
                    href="/dashboard/integrations"
                    className="inline-flex items-center gap-1 rounded-lg bg-signal px-4 py-2 text-xs font-medium text-white min-h-[44px] hover:bg-signal-hover transition-colors"
                  >
                    Go to Integrations <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
                {selected === 'agent' && (
                  <Link
                    href="/dashboard/agents"
                    className="inline-flex items-center gap-1 rounded-lg bg-signal px-4 py-2 text-xs font-medium text-white min-h-[44px] hover:bg-signal-hover transition-colors"
                  >
                    Go to Agents <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
                {selected === 'api-key' && (
                  <Link
                    href="/dashboard/settings"
                    className="inline-flex items-center gap-1 rounded-lg bg-signal px-4 py-2 text-xs font-medium text-white min-h-[44px] hover:bg-signal-hover transition-colors"
                  >
                    Go to Settings <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
