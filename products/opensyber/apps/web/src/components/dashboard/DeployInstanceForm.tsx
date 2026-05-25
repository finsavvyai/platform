'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { RefObject } from 'react';
import { ProvisioningStatus } from './ProvisioningStatus';

export type DeployPhase = 'idle' | 'creating' | 'provisioning' | 'running' | 'error';

export const REGIONS = [
  { value: 'eu-central', label: 'EU Central (Falkenstein)' },
  { value: 'us-east', label: 'US East (Ashburn)' },
  { value: 'us-west', label: 'US West (Hillsboro)' },
  { value: 'ap-southeast', label: 'Asia Pacific (Singapore)' },
];

const isLimitError = (msg: string) => /limit/i.test(msg);

interface Props {
  formRef: RefObject<HTMLDivElement | null>;
  phase: DeployPhase;
  pollCount: number;
  name: string;
  region: string;
  error: string | null;
  deploying: boolean;
  setName: (v: string) => void;
  setRegion: (v: string) => void;
  onDeploy: () => void;
  onCancel: () => void;
  onViewInstance: () => void;
}

export function DeployInstanceForm({
  formRef, phase, pollCount, name, region, error, deploying,
  setName, setRegion, onDeploy, onCancel, onViewInstance,
}: Props) {
  return (
    <div ref={formRef} className="w-full max-w-md rounded border border-border bg-panel/30 p-6">
      <h3 className="text-base font-semibold mb-4">Deploy New Instance</h3>

      {(phase === 'running' || phase === 'provisioning') && (
        <ProvisioningStatus
          phase={phase}
          pollCount={pollCount}
          onViewInstance={onViewInstance}
        />
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1">Instance Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={deploying || phase === 'running'}
            placeholder="My Agent"
            className={`w-full bg-surface border rounded-lg px-3 py-2 text-sm text-white disabled:opacity-50 ${!name.trim() ? 'border-red-500/50' : 'border-wire'}`}
          />
          {!name.trim() && (
            <p className="mt-1 text-xs text-red-400">Instance name is required.</p>
          )}
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">Region</label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            disabled={deploying || phase === 'running'}
            className="w-full bg-surface border border-wire rounded-lg px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {REGIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            <p>{error}</p>
            {isLimitError(error) && (
              <Link href="/pricing" className="mt-1 inline-block underline text-signal hover:text-signal-hover">
                Upgrade your plan to deploy more instances
              </Link>
            )}
          </div>
        )}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onDeploy}
            disabled={deploying || !name.trim() || phase === 'running'}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-signal-hover transition disabled:opacity-50"
          >
            {deploying && <Loader2 className="h-4 w-4 animate-spin" />}
            {phase === 'creating' ? 'Creating...' : phase === 'provisioning' ? 'Provisioning...' : phase === 'error' ? 'Retry Deploy' : 'Deploy'}
          </button>
          <button
            onClick={onCancel}
            disabled={phase === 'running'}
            className="rounded-lg border border-wire px-4 py-2 text-sm hover:bg-surface transition disabled:opacity-50"
          >
            {deploying ? 'Stop' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}
