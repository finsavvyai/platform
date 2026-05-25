import { useState } from 'react';

interface Props {
  runId: string;
  onPRCreated?: (url: string) => void;
}

type Phase = 'idle' | 'diagnosing' | 'generating' | 'creating' | 'done' | 'error';

const labels: Record<Phase, string> = {
  idle: 'Fix My Pipeline',
  diagnosing: 'Diagnosing...',
  generating: 'Generating fix...',
  creating: 'Creating PR...',
  done: 'PR Created',
  error: 'Fix Failed',
};

export default function FixMyPipeline({ runId, onPRCreated }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleClick() {
    if (phase !== 'idle' && phase !== 'error') return;
    setPhase('diagnosing');
    setErrorMsg(null);
    try {
      setPhase('generating');
      const API = import.meta.env.VITE_API_URL || 'https://pushci-api.workers.dev';
      const token = localStorage.getItem('pushci_token');
      setPhase('creating');
      const res = await fetch(`${API}/api/autofix/create-pr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ runId }),
      });
      if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
      const data = await res.json();
      setPrUrl(data.branch ?? null);
      setPhase('done');
      if (onPRCreated && data.branch) onPRCreated(data.branch);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setPhase('error');
    }
  }

  const isActive = phase === 'diagnosing' || phase === 'generating' || phase === 'creating';

  return (
    <div className="inline-flex flex-col gap-2">
      <button
        onClick={handleClick}
        disabled={isActive || phase === 'done'}
        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
          phase === 'done'
            ? 'bg-emerald-800 text-emerald-200 cursor-default'
            : phase === 'error'
            ? 'bg-red-700 hover:bg-red-600 text-white'
            : isActive
            ? 'bg-zinc-700 text-zinc-300 cursor-wait'
            : 'bg-amber-600 hover:bg-amber-500 text-white'
        }`}
      >
        {isActive && <span className="mr-2 animate-pulse">●</span>}
        {labels[phase]}
      </button>
      {prUrl && (
        <span className="text-xs text-emerald-400">
          Branch: <code className="font-mono">{prUrl}</code>
        </span>
      )}
      {errorMsg && <span className="text-xs text-red-400">{errorMsg}</span>}
    </div>
  );
}
