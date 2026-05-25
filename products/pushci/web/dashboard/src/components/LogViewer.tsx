import { useCallback } from 'react';

interface Props {
  output: string;
}

const ERROR_PATTERN = /(FAIL|FAILED|FATAL|ERROR|✗)/i;

export default function LogViewer({ output }: Props) {
  const lines = output.split('\n');

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(output);
    } catch {
      /* clipboard unavailable */
    }
  }, [output]);

  return (
    <div className="bg-zinc-950 border border-surface-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-surface-border">
        <span className="text-xs text-zinc-500 font-mono">Full log</span>
        <button
          type="button"
          onClick={handleCopy}
          disabled={output.length === 0}
          className="text-[11px] text-zinc-500 hover:text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Copy
        </button>
      </div>
      <div
        role="log"
        aria-live="off"
        className="overflow-x-auto max-h-64 overflow-y-auto p-4 text-xs font-mono text-zinc-300 leading-relaxed"
      >
        {lines.map((line, i) => (
          <div key={i} className="flex">
            <span className="select-none text-zinc-600 w-8 text-right mr-3 shrink-0" aria-hidden="true">
              {i + 1}
            </span>
            <span className={ERROR_PATTERN.test(line) ? 'text-red-400' : ''}>
              {line || ' '}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
