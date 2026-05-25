import { useState, useRef, useEffect } from 'react';

interface Option {
  value: string;
  label: string;
  icon?: string;
  desc?: string;
}

interface Props {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function Select({ options, value, onChange, placeholder, className }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className={`relative ${className || ''}`}>
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 rounded-xl border border-surface-border bg-surface-card px-4 py-2.5 text-sm text-zinc-100 hover:border-zinc-600 focus:border-accent focus:outline-none transition-colors">
        <span className={selected ? 'text-zinc-100' : 'text-zinc-500'}>
          {selected ? (
            <span className="flex items-center gap-2">
              {selected.icon && <span className="text-xs opacity-60">{selected.icon}</span>}
              {selected.label}
            </span>
          ) : placeholder || 'Select...'}
        </span>
        <span className={`text-zinc-500 text-xs transition-transform ${open ? 'rotate-180' : ''}`}>v</span>
      </button>
      {open && (
        <div className="absolute z-50 w-full mt-1.5 rounded-xl border border-surface-border bg-surface-card/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-scale-in">
          {options.map(o => (
            <button key={o.value} type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                o.value === value ? 'bg-accent/10 text-accent' : 'text-zinc-300 hover:bg-surface-hover'
              }`}>
              {o.icon && <span className="text-xs opacity-60 w-5 text-center">{o.icon}</span>}
              <div>
                <span className="block">{o.label}</span>
                {o.desc && <span className="text-[11px] text-zinc-500 block">{o.desc}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
