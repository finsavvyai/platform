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
        <label className="text-body font-medium text-t2">{label}</label>
        <span className="text-body font-mono text-t1">
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
        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer
          bg-raised
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-t1
          [&::-webkit-slider-thumb]:shadow-sm
          [&::-webkit-slider-thumb]:cursor-pointer"
        style={{
          background: `linear-gradient(to right, #f0f0f0 0%, #f0f0f0 ${pct}%, #1a1a1a ${pct}%, #1a1a1a 100%)`,
        }}
      />
      <div className="flex justify-between text-caption text-t3">
        <span>{min.toLocaleString()}{unit && ` ${unit}`}</span>
        <span>{max.toLocaleString()}{unit && ` ${unit}`}</span>
      </div>
    </div>
  );
}
