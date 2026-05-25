'use client';

import { useState } from 'react';
import { Check, ChevronRight, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { ReviewStep } from './ReviewStep';
import { ConfigureStep } from './ConfigureStep';
import { ConnectStep } from './ConnectStep';
import { ActivateStep } from './ActivateStep';

interface Manifest {
  permissions?: { network?: string[]; filesystem?: string[]; env?: string[] };
}

interface Props {
  skill: { id: string; slug: string; name: string; description: string | null; category: string; currentVersion: string };
  manifest: Manifest;
  installation: { id: string; isActive: boolean } | null;
  instanceId: string | null;
}

const STEPS = ['Review', 'Configure', 'Connect', 'Activate'] as const;
type Step = (typeof STEPS)[number];

export function SkillConfigWizard({ skill, manifest, installation, instanceId }: Props) {
  const [step, setStep] = useState<Step>(installation ? 'Configure' : 'Review');
  const [envValues, setEnvValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setActivated] = useState(installation?.isActive ?? false);

  const envVars = manifest.permissions?.env ?? [];
  const networkPerms = manifest.permissions?.network ?? [];
  const fsPerms = manifest.permissions?.filesystem ?? [];
  const hasConfig = envVars.length > 0;
  const currentIdx = STEPS.indexOf(step);

  async function handleSaveConfig() {
    if (!instanceId) return;
    setSaving(true);
    setError(null);
    const failedKeys: string[] = [];
    try {
      for (const [key, value] of Object.entries(envValues)) {
        if (!value.trim()) continue;
        const res = await fetch(`/api/proxy/instances/${instanceId}/secrets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value: value.trim() }),
        });
        if (!res.ok) failedKeys.push(key);
      }
      if (failedKeys.length > 0) {
        setError(`Failed to save: ${failedKeys.join(', ')}. Check values and retry.`);
      } else {
        setStep('Connect');
      }
    } catch {
      setError('Network error — could not save configuration. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate() {
    if (!instanceId || !installation) {
      setError('No instance or installation found. Please reinstall the skill.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/instances/${instanceId}/skills/${skill.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        setError(data.message ?? 'Failed to activate skill. Please try again.');
        return;
      }
      setActivated(true);
      setStep('Activate');
    } catch {
      setError('Network error — could not activate skill. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/dashboard/skills" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-neutral-200 transition mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Skills
        </Link>
        <h1 className="text-2xl font-bold">Configure {skill.name}</h1>
        <p className="text-sm text-text-secondary mt-1">{skill.description}</p>
      </div>

      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => i <= currentIdx && setStep(s)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition ${
                s === step
                  ? 'bg-signal text-white'
                  : i < currentIdx
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-surface text-text-dim'
              }`}
            >
              {i < currentIdx ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
              {s}
            </button>
            {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-text-dim" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {step === 'Review' && (
        <ReviewStep
          networkPerms={networkPerms} fsPerms={fsPerms} envVars={envVars}
          hasConfig={hasConfig} onContinue={() => setStep(hasConfig ? 'Configure' : 'Connect')}
        />
      )}

      {step === 'Configure' && (
        <ConfigureStep
          envVars={envVars} envValues={envValues} setEnvValues={setEnvValues}
          saving={saving} onSave={envVars.length > 0 ? handleSaveConfig : () => setStep('Connect')}
          onBack={() => setStep('Review')}
        />
      )}

      {step === 'Connect' && (
        <ConnectStep
          skillName={skill.name} currentVersion={skill.currentVersion}
          networkPerms={networkPerms} fsPerms={fsPerms} envVars={envVars}
          saving={saving} onActivate={handleActivate} onBack={() => setStep('Configure')}
        />
      )}

      {step === 'Activate' && <ActivateStep skillName={skill.name} />}
    </div>
  );
}
