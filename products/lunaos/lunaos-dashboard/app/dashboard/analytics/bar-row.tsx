'use client';

interface BarRowProps {
    label: string;
    value: number;
    maxValue: number;
    color?: string;
    suffix?: string;
}

export function BarRow({
    label,
    value,
    maxValue,
    color = 'bg-violet-500',
    suffix = '',
}: BarRowProps) {
    const pct = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
    return (
        <div className="flex items-center gap-3 py-2">
            <span className="text-sm text-neutral-300 w-36 truncate" title={label}>
                {label}
            </span>
            <div className="flex-1 h-5 bg-neutral-800/60 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                />
            </div>
            <span className="text-sm text-neutral-400 w-20 text-right font-mono tabular-nums">
                {value.toLocaleString()}{suffix}
            </span>
        </div>
    );
}
