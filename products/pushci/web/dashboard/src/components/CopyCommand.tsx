import { useState } from 'react';

export default function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button onClick={copy}
      className="group flex items-center gap-2 w-full mt-1 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-750 border border-zinc-700/50 hover:border-zinc-600 transition-all text-left">
      <code className="flex-1 text-emerald-400 text-xs font-mono truncate">{command}</code>
      <span className="shrink-0 text-zinc-500 group-hover:text-zinc-300 transition-colors">
        {copied ? (
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </span>
    </button>
  );
}
