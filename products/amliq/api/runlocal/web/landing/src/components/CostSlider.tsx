interface CostSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}

export function CostSlider({ label, value, min, max, step = 1, unit = '', onChange }: CostSliderProps) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-zinc-300">{label}</label>
        <span className="text-sm font-bold text-emerald-400">
          {value.toLocaleString()}{unit && ` ${unit}`}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer
          bg-zinc-700 accent-emerald-500
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-emerald-500
          [&::-webkit-slider-thumb]:shadow-lg
          [&::-webkit-slider-thumb]:cursor-pointer"
        style={{
          background: `linear-gradient(to right, #10b981 0%, #10b981 ${pct}%, #3f3f46 ${pct}%, #3f3f46 100%)`,
        }}
      />
      <div className="flex justify-between text-xs text-zinc-500">
        <span>{min.toLocaleString()}{unit && ` ${unit}`}</span>
        <span>{max.toLocaleString()}{unit && ` ${unit}`}</span>
      </div>
    </div>
  );
}
