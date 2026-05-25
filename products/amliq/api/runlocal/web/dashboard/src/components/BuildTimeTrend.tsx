// Sample data used for chart rendering before real data loads.
const sampleData = Array.from({ length: 30 }, (_, i) => ({
  run: i + 1,
  duration: 25 + Math.round(Math.sin(i * 0.4) * 12 + Math.random() * 8),
  passed: Math.random() > 0.15,
}));

export default function BuildTimeTrend() {
  const max = Math.max(...sampleData.map(d => d.duration));
  const W = 700;
  const H = 200;
  const padX = 40;
  const padY = 20;
  const chartW = W - padX - 10;
  const chartH = H - padY * 2;

  const x = (i: number) => padX + (i / (sampleData.length - 1)) * chartW;
  const y = (v: number) => padY + chartH - (v / max) * chartH;

  const passedPts = sampleData.filter(d => d.passed);
  const linePath = passedPts
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${x(d.run - 1)},${y(d.duration)}`)
    .join(' ');

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(max * f));

  return (
    <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-zinc-200 mb-3">Build Duration Trend</h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {gridLines.map(v => (
          <g key={v}>
            <line x1={padX} y1={y(v)} x2={W - 10} y2={y(v)} stroke="#27272a" strokeWidth={1} />
            <text x={padX - 6} y={y(v) + 4} textAnchor="end" fill="#71717a" fontSize={10}>
              {v}s
            </text>
          </g>
        ))}
        <path d={linePath} fill="none" stroke="#10b981" strokeWidth={2} strokeLinecap="round"
          strokeLinejoin="round" />
        {sampleData.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.duration)} r={3}
            fill={d.passed ? '#10b981' : '#ef4444'}
            stroke={d.passed ? 'none' : '#ef4444'} strokeWidth={d.passed ? 0 : 1} />
        ))}
        <text x={W / 2} y={H - 2} textAnchor="middle" fill="#52525b" fontSize={10}>
          Run #
        </text>
      </svg>
    </div>
  );
}
