'use client';

import { KeyRound, Copy, Check, Code2, ArrowRight, ChevronRight, Eye, EyeOff, Globe } from 'lucide-react';

export function StepIndicator({ step }: { step: number }): React.ReactElement {
  const steps = [
    { label: 'Get Key', idx: 0 },
    { label: 'Copy Key', idx: 1 },
    { label: 'Add Script', idx: 2 },
  ];
  return (
    <div className="flex items-center justify-center gap-1 mb-10">
      {steps.map(({ label, idx }) => (
        <div key={idx} className="flex items-center gap-1">
          <div className="flex flex-col items-center gap-1">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
              step > idx ? 'bg-green-500 text-black' : step === idx ? 'bg-info' : 'bg-surface text-text-muted'
            }`}>{step > idx ? '\u2713' : idx + 1}</div>
            <span className={`text-[10px] ${step >= idx ? 'text-text-secondary' : 'text-text-muted'}`}>{label}</span>
          </div>
          {idx < 2 && <ChevronRight className="h-4 w-4 text-text-muted mb-4" />}
        </div>
      ))}
    </div>
  );
}

interface ProvisionStepProps {
  error: string;
  loading: boolean;
  onProvision: () => void;
}

export function ProvisionStep({ error, loading, onProvision }: ProvisionStepProps): React.ReactElement {
  return (
    <div className="rounded-xl border border-info/30 bg-info/5 p-8 text-center">
      <KeyRound className="h-8 w-8 text-info mx-auto mb-4" />
      <h2 className="text-lg font-semibold mb-2">Create your API key</h2>
      <p className="text-sm text-text-secondary mb-6">One click. Free. 1,000 verifications/month.</p>
      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
      <button type="button" onClick={onProvision} disabled={loading} className="rounded-lg bg-info px-6 py-3 text-sm font-medium hover:bg-info disabled:opacity-50 transition">
        {loading ? 'Creating...' : 'Generate API Key'}
      </button>
    </div>
  );
}

interface KeyRevealStepProps {
  apiKey: string;
  showKey: boolean;
  setShowKey: (v: boolean) => void;
  copied: boolean;
  onCopy: () => void;
  domain: string;
  setDomain: (v: string) => void;
  onNext: () => void;
}

export function KeyRevealStep({ apiKey, showKey, setShowKey, copied, onCopy, domain, setDomain, onNext }: KeyRevealStepProps): React.ReactElement {
  return (
    <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-8 text-center">
      <Check className="h-8 w-8 text-green-400 mx-auto mb-4" />
      <h2 className="text-lg font-semibold mb-2">Your API Key</h2>
      <p className="text-sm text-amber-400 mb-4">Copy now -- shown only once.</p>
      <div className="flex items-center gap-2 rounded-lg bg-void p-3 mb-4 max-w-md mx-auto">
        <code className="flex-1 break-all font-mono text-xs text-green-400">
          {showKey ? apiKey : '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
        </code>
        <button type="button" onClick={() => setShowKey(!showKey)} className="rounded p-1.5 text-text-secondary hover:text-text-primary" title={showKey ? 'Hide' : 'Show'}>
          {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        <button type="button" onClick={onCopy} className="rounded p-1.5 text-text-secondary hover:text-text-primary" title="Copy">
          {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      <div className="max-w-sm mx-auto mb-6">
        <label className="flex items-center gap-1.5 text-xs text-text-secondary mb-1.5">
          <Globe className="h-3.5 w-3.5" /> Where will you use this key?
        </label>
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="myapp.com"
          className="w-full rounded-lg border border-wire bg-void px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-signal focus:outline-none"
        />
        <p className="mt-1 text-[10px] text-text-muted">
          Optional. You can configure domain restrictions later in Settings.
        </p>
      </div>
      <button type="button" onClick={onNext} className="rounded-lg bg-info px-6 py-3 text-sm font-medium hover:bg-info transition">
        Next <ArrowRight className="h-4 w-4 inline ml-1" />
      </button>
    </div>
  );
}

interface ScriptStepProps {
  scriptTag: string;
  onDone: () => void;
}

export function ScriptStep({ scriptTag, onDone }: ScriptStepProps): React.ReactElement {
  return (
    <div className="rounded-xl border border-info/30 bg-info/5 p-8">
      <Code2 className="h-8 w-8 text-info mx-auto mb-4" />
      <h2 className="text-lg font-semibold mb-2 text-center">Add to your app</h2>
      <p className="text-sm text-text-secondary mb-4 text-center">Paste in your HTML &lt;head&gt;:</p>
      <div className="rounded-lg bg-void p-4 mb-6">
        <pre className="text-xs text-text-secondary overflow-x-auto"><code>{scriptTag}</code></pre>
      </div>
      <div className="text-center">
        <button type="button" onClick={onDone} className="rounded-lg bg-green-600 px-6 py-3 text-sm font-medium hover:bg-green-500 transition">
          Done -- Go to Dashboard <ArrowRight className="h-4 w-4 inline ml-1" />
        </button>
      </div>
    </div>
  );
}
