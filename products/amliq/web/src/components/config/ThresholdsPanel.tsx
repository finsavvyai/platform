import React from 'react';

interface Props {
  th: number; d: number; ea: number; t: (k: string) => string;
  onThreshold: (v: number) => void; onDismiss: (v: number) => void; onEscalate: (v: number) => void;
}

export function ThresholdsPanel({ th, d, ea, t, onThreshold, onDismiss, onEscalate }: Props) {
  return (
    <div className="glass-panel rounded-apple-lg p-xl">
      <h3 className="sf-headline mb-md sf-title">{t('thresholds.title')}</h3>
      <SliderField label={`${t('thresholds.default')} ${th}%`} value={th} onChange={onThreshold} color="accent-[#C9A96E]" />
      <SliderField label={`${t('thresholds.auto_dismiss')} ${d}%`} value={d} onChange={onDismiss} color="accent-apple-green" />
      <SliderField label={`${t('thresholds.auto_escalate')} ${ea}%`} value={ea} onChange={onEscalate} color="accent-apple-red" />
    </div>
  );
}

function SliderField({ label, value, onChange, color }: {
  label: string; value: number; onChange: (v: number) => void; color: string;
}) {
  return (
    <label className="block mb-md">
      <span className="sf-caption">{label}</span>
      <input type="range" min="0" max="100" value={value} aria-valuetext={`${value}%`}
        aria-label={label} onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full ${color}`} />
      <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--dash-text-tertiary)' }}>
        <span>0%</span><span>100%</span>
      </div>
    </label>
  );
}
