'use client';

const LEGEND_ITEMS = [
  { label: 'Critical', color: '#ef4444' },
  { label: 'High', color: '#f59e0b' },
  { label: 'Medium', color: '#3b82f6' },
  { label: 'Low', color: '#9ca3af' },
];

export function GraphLegend() {
  return (
    <div className="flex gap-4 mt-3 justify-center">
      {LEGEND_ITEMS.map((i) => (
        <span key={i.label} className="flex items-center gap-1 text-xs text-text-secondary">
          <span className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: i.color }} />
          {i.label}
        </span>
      ))}
      <span className="flex items-center gap-1 text-xs text-amber-400">
        <span className="inline-block h-2.5 w-2.5 rounded-full border border-dashed border-amber-400" />
        Crown Jewel
      </span>
    </div>
  );
}
