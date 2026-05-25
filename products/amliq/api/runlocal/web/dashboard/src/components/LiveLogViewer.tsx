import { useEffect, useRef } from 'react';

interface LogLine {
  time: string;
  text: string;
  level: 'info' | 'error' | 'success';
}

interface Props {
  logs: LogLine[];
  connected: boolean;
}

const levelColor = {
  info: 'text-zinc-400',
  error: 'text-red-400',
  success: 'text-emerald-400',
};

export default function LiveLogViewer({ logs, connected }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900
                      border-b border-zinc-800">
        <span className="text-xs text-zinc-500 font-mono">Logs</span>
        <span className="flex items-center gap-1.5 text-xs">
          <span className={`w-2 h-2 rounded-full ${
            connected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
          }`} />
          <span className={connected ? 'text-emerald-400' : 'text-zinc-600'}>
            {connected ? 'Live' : 'Disconnected'}
          </span>
        </span>
      </div>
      <div className="h-80 overflow-y-auto p-4 font-mono text-xs space-y-0.5">
        {logs.length === 0 && (
          <p className="text-zinc-600">Waiting for output...</p>
        )}
        {logs.map((line, i) => (
          <div key={i} className="flex gap-3">
            <span className="text-zinc-700 select-none shrink-0">
              {new Date(line.time).toLocaleTimeString()}
            </span>
            <span className={levelColor[line.level]}>
              {line.text}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
