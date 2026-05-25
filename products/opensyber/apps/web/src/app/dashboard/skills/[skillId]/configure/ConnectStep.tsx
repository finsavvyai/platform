'use client';

import { Play, Check, Globe, FolderOpen, KeyRound } from 'lucide-react';

interface Props {
  skillName: string;
  currentVersion: string;
  networkPerms: string[];
  fsPerms: string[];
  envVars: string[];
  saving: boolean;
  onActivate: () => void;
  onBack: () => void;
}

export function ConnectStep({ skillName, currentVersion, networkPerms, fsPerms, envVars, saving, onActivate, onBack }: Props) {
  return (
    <div className="space-y-6">
      <div className="rounded border border-border bg-panel/30 p-6">
        <h3 className="text-lg font-semibold mb-4">Review &amp; Activate</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-surface p-4">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-amber-500" />
              <span className="text-sm font-medium">Ready to Activate</span>
            </div>
            <span className="text-xs text-text-secondary">{skillName} v{currentVersion}</span>
          </div>

          <div className="rounded-lg bg-surface p-4 space-y-3">
            <h4 className="text-sm font-medium mb-2">Configuration Summary</h4>
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <Globe className="h-3.5 w-3.5 text-info" />
              <span>{networkPerms.length} network domain{networkPerms.length !== 1 ? 's' : ''} allowed</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <FolderOpen className="h-3.5 w-3.5 text-amber-400" />
              <span>{fsPerms.length} filesystem path{fsPerms.length !== 1 ? 's' : ''} accessible</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <KeyRound className="h-3.5 w-3.5 text-purple-400" />
              <span>{envVars.length} environment variable{envVars.length !== 1 ? 's' : ''} configured</span>
            </div>
          </div>

          {networkPerms.length > 0 && (
            <div className="rounded-lg bg-surface p-4">
              <h4 className="text-sm font-medium mb-2">Allowed Network Connections</h4>
              {networkPerms.map((url) => (
                <div key={url} className="flex items-center justify-between py-1">
                  <span className="font-mono text-xs">{url}</span>
                  <span className="text-xs text-green-400 flex items-center gap-1">
                    <Check className="h-3 w-3" /> Allowed
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-text-dim">
            Activating will enable this skill on your agent. It will begin processing security events matching its criteria.
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onActivate}
          disabled={saving}
          className="rounded-lg bg-signal px-6 py-3 text-sm font-medium text-white hover:bg-signal-hover transition disabled:opacity-50"
        >
          <Play className="inline h-4 w-4 mr-1" /> Activate Skill
        </button>
        <button onClick={onBack} className="rounded-lg border border-wire px-4 py-3 text-sm hover:bg-surface transition">
          Back
        </button>
      </div>
    </div>
  );
}
