'use client';

interface SparklineProps {
  data: number[];
}

export function ThreatSparkline({ data }: SparklineProps): React.ReactElement {
  const w = 600;
  const h = 80;
  const padX = 8;
  const padY = 8;
  const chartW = w - padX * 2;
  const chartH = h - padY * 2;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = Math.max(max - min, 5);

  function x(i: number): number {
    return padX + (i / (data.length - 1)) * chartW;
  }

  function y(v: number): number {
    return padY + chartH - ((v - min) / range) * chartH;
  }

  const pts = data.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const areaPath = `M ${x(0)},${y(data[0])} ` +
    data.slice(1).map((v, i) => `L ${x(i + 1)},${y(v)}`).join(' ') +
    ` L ${x(data.length - 1)},${h - padY} L ${x(0)},${h - padY} Z`;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
      <h2 className="text-lg font-medium mb-3">30-Day Score Trend</h2>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="w-full">
        <path d={areaPath} fill="rgba(59,130,246,0.1)" />
        <polyline points={pts} fill="none" stroke="#3b82f6" strokeWidth={2} />
        <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r={4}
          fill="#3b82f6" stroke="#0a0a0a" strokeWidth={2} />
      </svg>
      <div className="flex justify-between text-xs text-neutral-500 mt-1">
        <span>30 days ago</span>
        <span>Today</span>
      </div>
    </div>
  );
}
