'use client';

import { Globe, FolderOpen, KeyRound, Shield } from 'lucide-react';

interface Props {
  networkPerms: string[];
  fsPerms: string[];
  envVars: string[];
  hasConfig: boolean;
  onContinue: () => void;
}

export function ReviewStep({ networkPerms, fsPerms, envVars, hasConfig, onContinue }: Props) {
  return (
    <div className="space-y-6">
      <div className="rounded border border-border bg-panel/30 p-6">
        <h3 className="text-lg font-semibold mb-4">Permissions Review</h3>
        <p className="text-sm text-text-secondary mb-4">This skill requests the following permissions:</p>

        {networkPerms.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="h-4 w-4 text-info" />
              <span className="text-sm font-medium">Network Access</span>
            </div>
            <div className="ml-6 space-y-1">
              {networkPerms.map((url) => (
                <div key={url} className="flex items-center gap-2 text-sm text-text-secondary">
                  <span className="font-mono text-xs bg-surface px-2 py-0.5 rounded">{url}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {fsPerms.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <FolderOpen className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-medium">Filesystem Access</span>
            </div>
            <div className="ml-6 space-y-1">
              {fsPerms.map((path) => (
                <div key={path} className="flex items-center gap-2 text-sm text-text-secondary">
                  <span className="font-mono text-xs bg-surface px-2 py-0.5 rounded">{path}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {envVars.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <KeyRound className="h-4 w-4 text-purple-400" />
              <span className="text-sm font-medium">Environment Variables Required</span>
            </div>
            <div className="ml-6 space-y-1">
              {envVars.map((env) => (
                <div key={env} className="flex items-center gap-2 text-sm text-text-secondary">
                  <span className="font-mono text-xs bg-surface px-2 py-0.5 rounded">{env}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {networkPerms.length === 0 && fsPerms.length === 0 && envVars.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-green-400">
            <Shield className="h-4 w-4" />
            No special permissions required — this skill runs in a sandboxed environment.
          </div>
        )}
      </div>

      <button
        onClick={onContinue}
        className="rounded-lg bg-signal px-6 py-3 text-sm font-medium text-white hover:bg-signal-hover transition"
      >
        {hasConfig ? 'Continue to Configuration' : 'Continue to Connection'}
      </button>
    </div>
  );
}
