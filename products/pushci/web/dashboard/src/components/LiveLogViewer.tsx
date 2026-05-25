import { useCallback, useEffect, useRef, useState } from 'react';
import type { LogLine } from '../hooks/useLogs';

interface Props {
  logs: LogLine[];
  connected: boolean;
}

const levelColor = {
  info: 'text-zinc-400',
  error: 'text-red-400',
  success: 'text-emerald-400',
};

function isNearBottom(el: HTMLElement, threshold = 32): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function LiveLogViewer({ logs, connected }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);

  useEffect(() => {
    if (!follow) return;
    const node = bottomRef.current;
    if (!node || typeof node.scrollIntoView !== 'function') return;
    const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
    node.scrollIntoView({ behavior });
  }, [logs.length, follow]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setFollow(isNearBottom(el));
  }, []);

  const handleCopy = useCallback(async () => {
    const text = logs.map((l) => l.text).join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard unavailable */
    }
  }, [logs]);

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <span className="text-xs text-zinc-500 font-mono">Logs</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCopy}
            disabled={logs.length === 0}
            className="text-[11px] text-zinc-500 hover:text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Copy
          </button>
          {!follow && (
            <button
              type="button"
              onClick={() => setFollow(true)}
              className="text-[11px] text-emerald-400 hover:text-emerald-300"
            >
              Jump to bottom
            </button>
          )}
          <span
            role="status"
            aria-live="polite"
            className="flex items-center gap-1.5 text-xs"
          >
            <span
              aria-hidden="true"
              className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`}
            />
            <span className={connected ? 'text-emerald-400' : 'text-zinc-600'}>
              {connected ? 'Live' : 'Disconnected'}
            </span>
          </span>
        </div>
      </div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-live="off"
        className="h-80 overflow-y-auto p-4 font-mono text-xs space-y-0.5"
      >
        {logs.length === 0 && (
          <p className="text-zinc-600">Waiting for output…</p>
        )}
        {logs.map((line) => (
          <div key={line.id} className="flex gap-3">
            <span className="text-zinc-700 select-none shrink-0" aria-hidden="true">
              {new Date(line.time).toLocaleTimeString()}
            </span>
            <span className={levelColor[line.level]}>{line.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
