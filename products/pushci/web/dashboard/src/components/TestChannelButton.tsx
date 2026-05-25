import { useState } from 'react';
import { api } from '../hooks/useApi';
import { friendlyError } from '../utils/errorMessages';

interface Props {
  channelId: string;
}

type TestState = 'idle' | 'testing' | 'success' | 'error';

export default function TestChannelButton({ channelId }: Props) {
  const [state, setState] = useState<TestState>('idle');
  const [tooltip, setTooltip] = useState('');

  const runTest = async () => {
    setState('testing');
    setTooltip('');
    try {
      const res = await api.testChannel(channelId);
      setState(res.success ? 'success' : 'error');
      const msg = res.error
        ? res.detail ? `${res.error} — ${res.detail}` : res.error
        : res.detail || '';
      if (msg) setTooltip(msg);
    } catch (e) {
      setState('error');
      setTooltip(friendlyError(e));
    }
    setTimeout(() => setState('idle'), 6000);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={runTest}
        disabled={state === 'testing'}
        className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
          state === 'success'
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
            : state === 'error'
              ? 'bg-red-500/15 text-red-400 border border-red-500/30'
              : 'bg-surface-hover/50 text-zinc-400 border border-surface-border hover:text-accent hover:border-accent/30'
        }`}
        title={tooltip || 'Verify this channel is connected and reachable'}
      >
        {state === 'testing' && 'Testing...'}
        {state === 'success' && 'OK'}
        {state === 'error' && 'Failed'}
        {state === 'idle' && 'Test'}
      </button>
      {state === 'error' && tooltip && (
        <span className="text-[11px] text-red-400/90 max-w-[260px] truncate" title={tooltip}>
          {tooltip}
        </span>
      )}
    </div>
  );
}
