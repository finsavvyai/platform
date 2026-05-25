interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  className?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red';
}

const colorMap = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
};

export function ProgressBar({
  value,
  max = 100,
  label,
  className,
  color = 'blue',
}: ProgressBarProps) {
  const clamped = Math.min(max, Math.max(0, value));
  const percent = max > 0 ? (clamped / max) * 100 : 0;

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label ?? 'Progress'}
      className={`h-1.5 rounded-full bg-neutral-800 overflow-hidden ${className ?? ''}`}
    >
      <div
        className={`h-full rounded-full ${colorMap[color]} transition-all`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
