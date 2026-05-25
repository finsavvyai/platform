interface Props {
  output: string;
}

export default function LogViewer({ output }: Props) {
  const lines = output.split('\n');

  return (
    <div className="bg-zinc-950 border border-surface-border rounded-lg p-4 overflow-x-auto max-h-64 overflow-y-auto">
      <pre className="text-xs font-mono text-zinc-300 leading-relaxed">
        {lines.map((line, i) => (
          <div key={i} className="flex">
            <span className="select-none text-zinc-600 w-8 text-right mr-3 shrink-0">
              {i + 1}
            </span>
            <span className={line.includes('FAIL') ? 'text-red-400' : ''}>{line}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}
