'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ProviderSelect } from './ProviderSelect';
import { SetupInstructions } from './SetupInstructions';
import { CredentialsForm } from './CredentialsForm';
import { ValidationStep } from './ValidationStep';

type Provider = 'aws' | 'azure' | 'gcp';

const STEP_LABELS = ['Select Provider', 'Setup Instructions', 'Enter Credentials', 'Validate', 'Complete'];

export default function CloudSetupWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});

  function handleProviderSelect(p: Provider) {
    setProvider(p);
    setStep(1);
  }

  function handleCredentialsSubmit(creds: Record<string, string>) {
    setCredentials(creds);
    setStep(3);
  }

  function handleValidationSuccess() {
    router.push('/dashboard/cloud');
  }

  return (
    <div>
      <button
        onClick={() => (step === 0 ? router.push('/dashboard/cloud') : setStep(Math.max(0, step - 1)))}
        className="mb-6 flex items-center gap-2 text-sm text-text-secondary hover:text-white transition"
      >
        <ArrowLeft className="h-4 w-4" />
        {step === 0 ? 'Back to Cloud Security' : 'Previous Step'}
      </button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Connect Cloud Account</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Follow the guided setup to connect your cloud provider securely.
        </p>
      </div>

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-2">
        {STEP_LABELS.slice(0, 4).map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                i < step ? 'bg-green-500/20 text-green-400' :
                i === step ? 'bg-signal text-white' :
                'bg-surface text-text-dim'
              }`}
            >
              {i < step ? '\u2713' : i + 1}
            </div>
            <span className={`text-xs ${i === step ? 'text-white' : 'text-text-dim'}`}>
              {label}
            </span>
            {i < 3 && <div className="mx-1 h-px w-8 bg-neutral-700" />}
          </div>
        ))}
      </div>

      {step === 0 && <ProviderSelect onSelect={handleProviderSelect} />}
      {step === 1 && provider && (
        <SetupInstructions provider={provider} onContinue={() => setStep(2)} />
      )}
      {step === 2 && provider && (
        <CredentialsForm provider={provider} onSubmit={handleCredentialsSubmit} />
      )}
      {step === 3 && provider && (
        <ValidationStep
          provider={provider}
          credentials={credentials}
          onSuccess={handleValidationSuccess}
          onRetry={() => setStep(2)}
        />
      )}
    </div>
  );
}
