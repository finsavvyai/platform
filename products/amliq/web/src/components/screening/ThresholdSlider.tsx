interface ThresholdSliderProps {
  value: number
  onChange: (v: number) => void
}

export function ThresholdSlider({ value, onChange }: ThresholdSliderProps) {
  return (
    <div className="mt-lg">
      <label className="sf-caption text-white/60 flex justify-between">
        <span>Confidence Threshold</span>
        <span className="font-semibold text-white">{value}%</span>
      </label>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full mt-sm accent-[#C9A96E]"
      />
    </div>
  )
}
