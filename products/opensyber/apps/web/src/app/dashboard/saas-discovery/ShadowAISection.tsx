'use client';

import { Bot, ShieldAlert } from 'lucide-react';
import type { SaasApp } from './types';

interface Props {
  apps: SaasApp[];
  onBlock: (id: string) => void;
  onAllow: (id: string) => void;
}

export function ShadowAISection({
  apps,
  onBlock,
  onAllow,
}: Props): React.ReactElement | null {
  const shadowApps = apps.filter((a) => a.isShadowAI);
  if (shadowApps.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
      <div className="flex items-center gap-3 mb-4">
        <ShieldAlert className="h-6 w-6 text-amber-400" />
        <div>
          <h2 className="text-lg font-semibold text-amber-400">
            Shadow AI Detected
          </h2>
          <p className="text-sm text-neutral-400">
            {shadowApps.length} unauthorized AI tool
            {shadowApps.length !== 1 ? 's' : ''} sending company data
            to external services
          </p>
        </div>
      </div>
      <div className="space-y-3">
        {shadowApps.map((app) => (
          <div
            key={app.id}
            className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/50 p-4"
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white ${app.color}`}
              >
                {app.initials}
              </div>
              <div>
                <p className="font-medium">{app.name}</p>
                <p className="text-xs text-amber-400/80 flex items-center gap-1">
                  <Bot className="h-3 w-3" />
                  Sending company data to external AI
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onBlock(app.id)}
                className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition"
              >
                Block
              </button>
              <button
                onClick={() => onAllow(app.id)}
                className="rounded-lg border border-green-500/30 px-3 py-1.5 text-xs text-green-400 hover:bg-green-500/10 transition"
              >
                Allow
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
