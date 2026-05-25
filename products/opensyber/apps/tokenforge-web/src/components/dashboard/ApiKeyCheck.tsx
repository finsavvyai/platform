'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Shield } from 'lucide-react';
import { useApiKeyContext } from '@/lib/api-key-context';
import { useApiKey } from '@/lib/use-api';
import { StepIndicator, ProvisionStep, KeyRevealStep, ScriptStep } from './OnboardingSteps';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://tokenforge-api.opensyber.cloud';

export function ApiKeyCheck({ children }: { children: React.ReactNode }): React.ReactElement {
  const { data: session, status } = useSession();
  const existingKey = useApiKey();
  const { setApiKey: setContextKey } = useApiKeyContext();
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState('');
  const [domain, setDomain] = useState('');

  useEffect(() => {
    if (!existingKey) return;
    // If key was just set in this session (provisioned now), trust it
    if (apiKey && existingKey === apiKey) { setReady(true); return; }
    // Validate existing JWT key is still active
    let cancelled = false;
    fetch(`${API}/v1/usage`, { headers: { Authorization: `Bearer ${existingKey}` } })
      .then((res) => {
        if (cancelled) return;
        if (res.ok || res.status === 429) { setReady(true); }
        else { setError('Your API key is no longer valid. Please sign out and sign in again.'); }
      })
      .catch(() => { if (!cancelled) setReady(true); }); // fail-open
    return () => { cancelled = true; };
  }, [existingKey, apiKey]);

  useEffect(() => {
    if (typeof window !== 'undefined' && !domain) {
      const host = window.location.hostname;
      if (host && host !== 'localhost') setDomain(host);
    }
  }, [domain]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-text-secondary">Loading...</p>
      </div>
    );
  }

  if (ready) return <>{children}</>;

  async function provision(): Promise<void> {
    if (!session?.user?.email) { setError('Not signed in'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/public/provision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: session.user.name ?? session.user.email.split('@')[0],
          email: session.user.email,
        }),
      });
      const json = await res.json();
      const key = (json as { data?: { apiKey?: string } }).data?.apiKey;
      if (key) {
        setApiKey(key);
        setContextKey(key);
        setStep(2);
      } else if ((json as { data?: { existing?: boolean } }).data?.existing) {
        setError('Account exists. Generate a new key in Settings.');
      } else {
        setError('Failed. Try again.');
      }
    } catch { setError('Connection failed.'); }
    finally { setLoading(false); }
  }

  async function handleCopy(): Promise<void> {
    if (!apiKey) return;
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const scriptTag = `<script src="${API}/sdk.js" data-api-key="${apiKey ?? 'YOUR_KEY'}"></script>`;

  return (
    <div className="max-w-xl mx-auto py-8">
      <div className="text-center mb-10">
        <Shield className="h-12 w-12 text-info mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Get Started with TokenForge</h1>
        <p className="text-text-secondary">Protect your app in 3 steps</p>
      </div>

      <StepIndicator step={step} />

      {step === 0 && <ProvisionStep error={error} loading={loading} onProvision={provision} />}

      {step === 2 && apiKey && (
        <KeyRevealStep
          apiKey={apiKey}
          showKey={showKey}
          setShowKey={setShowKey}
          copied={copied}
          onCopy={handleCopy}
          domain={domain}
          setDomain={setDomain}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && <ScriptStep scriptTag={scriptTag} onDone={() => setReady(true)} />}
    </div>
  );
}
