import { useState } from 'react';

interface EnvVar { key: string; value: string }

export default function EnvVarsEditor() {
  const [vars, setVars] = useState<EnvVar[]>([
    { key: 'GITHUB_TOKEN', value: '***hidden***' },
    { key: 'AWS_REGION', value: 'us-east-1' },
  ]);

  const add = () => setVars([...vars, { key: '', value: '' }]);
  const remove = (i: number) => setVars(vars.filter((_, idx) => idx !== i));
  const update = (i: number, field: 'key' | 'value', val: string) => {
    const next = [...vars];
    next[i] = { ...next[i], [field]: val };
    setVars(next);
  };

  return (
    <div className="space-y-2">
      {vars.map((v, i) => (
        <div key={i} className="flex gap-2">
          <input
            value={v.key} onChange={(e) => update(i, 'key', e.target.value)}
            placeholder="KEY"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2
                       text-sm text-zinc-100 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <input
            value={v.value} onChange={(e) => update(i, 'value', e.target.value)}
            placeholder="value"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2
                       text-sm text-zinc-100 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button onClick={() => remove(i)}
            className="px-3 text-zinc-500 hover:text-red-400 text-sm">
            Remove
          </button>
        </div>
      ))}
      <button onClick={add}
        className="text-sm text-emerald-400 hover:text-emerald-300 mt-2">
        + Add variable
      </button>
    </div>
  );
}
