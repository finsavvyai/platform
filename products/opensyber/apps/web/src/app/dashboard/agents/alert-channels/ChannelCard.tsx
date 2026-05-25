'use client';

import { CheckCircle, XCircle, Trash2, Play } from 'lucide-react';
import { CHANNEL_LABELS, CHANNEL_ICONS, SEVERITY_COLORS, type AlertChannel } from './alert-channel-types';

interface Props {
  channel: AlertChannel;
  testing: string | null;
  testResult: { channelId: string; success: boolean; message: string } | null;
  onTest: (id: string) => void;
  onToggle: (c: AlertChannel) => void;
  onDelete: (id: string) => void;
}

export function ChannelCard({ channel, testing, testResult, onTest, onToggle, onDelete }: Props) {
  return (
    <div className="rounded border border-border bg-panel/30 p-6 hover:border-wire transition">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-surface p-3 text-text-secondary" aria-hidden="true">{CHANNEL_ICONS[channel.channelType]}</div>
          <div>
            <h3 className="font-semibold text-white">{channel.name}</h3>
            <p className="mt-1 text-sm text-text-secondary">{CHANNEL_LABELS[channel.channelType]}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[channel.minSeverity]}`}>
                {channel.minSeverity}+
              </span>
              {channel.isActive ? (
                <span className="inline-flex items-center gap-1 text-xs text-green-400"><CheckCircle className="h-3 w-3" aria-hidden="true" />Active</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-text-dim"><XCircle className="h-3 w-3" aria-hidden="true" />Inactive</span>
              )}
            </div>
            {testResult?.channelId === channel.id && (
              <div className={`mt-2 text-xs ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>{testResult.message}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onTest(channel.id)} disabled={testing === channel.id}
            className="flex items-center gap-1 rounded-lg border border-wire px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface hover:text-white transition disabled:opacity-50">
            {testing === channel.id ? (
              <><div className="h-3 w-3 animate-spin rounded-full border border-neutral-600 border-t-white" />Sending...</>
            ) : (
              <><Play className="h-3 w-3" aria-hidden="true" />Test</>
            )}
          </button>
          <button onClick={() => onToggle(channel)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${channel.isActive ? 'bg-green-600' : 'bg-neutral-700'}`}
            role="switch" aria-checked={!!channel.isActive} aria-label={`Toggle ${channel.name} ${channel.isActive ? 'off' : 'on'}`}>
            <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${channel.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
          <button onClick={() => onDelete(channel.id)} title="Delete channel" aria-label={`Delete ${channel.name}`}
            className="rounded-lg p-1.5 text-text-secondary hover:bg-red-500/10 hover:text-red-400 transition">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
