'use client';

import { Check, KeyRound, Loader2 } from 'lucide-react';

interface Props {
  envVars: string[];
  envValues: Record<string, string>;
  setEnvValues: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
  saving: boolean;
  onSave: () => void;
  onBack: () => void;
}

export function ConfigureStep({ envVars, envValues, setEnvValues, saving, onSave, onBack }: Props) {
  return (
    <div className="space-y-6">
      <div className="rounded border border-border bg-panel/30 p-6">
        <h3 className="text-lg font-semibold mb-4">Configuration</h3>
        {envVars.length > 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Set the required environment variables. These will be encrypted and injected into your agent at runtime.
            </p>
            {envVars.map((env) => (
              <div key={env}>
                <label className="block text-sm font-medium mb-1">
                  <KeyRound className="inline h-3.5 w-3.5 mr-1 text-purple-400" />
                  {env}
                </label>
                <input
                  type="password"
                  value={envValues[env] ?? ''}
                  onChange={(e) => setEnvValues((prev) => ({ ...prev, [env]: e.target.value }))}
                  placeholder={`Enter ${env}`}
                  className="w-full bg-surface border border-wire rounded-lg px-3 py-2 text-sm font-mono"
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-green-400 flex items-center gap-2">
            <Check className="h-4 w-4" /> No configuration needed — this skill works out of the box.
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onSave}
          disabled={saving}
          className="rounded-lg bg-signal px-6 py-3 text-sm font-medium text-white hover:bg-signal-hover transition disabled:opacity-50"
        >
          {saving ? <><Loader2 className="inline h-4 w-4 mr-1 animate-spin" /> Saving...</> : 'Save & Continue'}
        </button>
        <button onClick={onBack} className="rounded-lg border border-wire px-4 py-3 text-sm hover:bg-surface transition">
          Back
        </button>
      </div>
    </div>
  );
}
