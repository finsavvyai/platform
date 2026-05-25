interface Props {
  items: string[]; active: string; onSelect: (v: string) => void;
  label: string; labelMap?: Record<string, string>;
}

export function FilterBar({ items, active, onSelect, label, labelMap }: Props) {
  return (
    <div className="flex flex-wrap gap-sm mb-md" role="tablist" aria-label={`${label} filter`}>
      {items.map(item => (
        <button key={item} role="tab" aria-selected={active === item} onClick={() => onSelect(item)}
          className={`rounded-full px-lg py-sm text-[13px] font-semibold transition-all cursor-pointer min-h-[44px] ${
            active === item ? 'shadow-sm'
              : 'bg-white/5 hover:bg-white/10'
          }`}
          style={active === item ? { background: '#1A1814', color: '#FAFAF8' } : { color: 'var(--dash-text-secondary)' }}>
          {labelMap?.[item] ?? item}
        </button>
      ))}
    </div>
  )
}
