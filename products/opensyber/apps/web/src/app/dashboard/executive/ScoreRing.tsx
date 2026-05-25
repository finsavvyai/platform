'use client';

interface ScoreRingProps {
  score: number;
  grade: string;
  delta: number;
  riskLevel: string;
}

function getGradeColor(grade: string): string {
  if (grade.startsWith('A')) return 'text-green-400';
  if (grade.startsWith('B')) return 'text-info';
  if (grade.startsWith('C')) return 'text-amber-400';
  return 'text-red-400';
}

function getRiskColor(level: string): string {
  const colors: Record<string, string> = {
    Excellent: 'bg-green-500/10 text-green-400',
    Low: 'bg-green-500/10 text-green-400',
    Medium: 'bg-amber-500/10 text-amber-400',
    High: 'bg-red-500/10 text-red-400',
    Critical: 'bg-red-500/10 text-red-400',
  };
  return colors[level] ?? 'bg-neutral-800 text-neutral-400';
}

function getStrokeColor(score: number): string {
  if (score >= 90) return '#22c55e';
  if (score >= 70) return '#3b82f6';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

export function ScoreRing({ score, grade, delta, riskLevel }: ScoreRingProps) {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const strokeColor = getStrokeColor(score);

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-8">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-12">
        <div className="relative flex-shrink-0">
          <svg width="200" height="200" viewBox="0 0 200 200" data-testid="score-ring-svg">
            <circle cx="100" cy="100" r={radius} fill="none" stroke="#262626" strokeWidth="12" />
            <circle
              cx="100" cy="100" r={radius} fill="none"
              stroke={strokeColor} strokeWidth="12" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={offset}
              transform="rotate(-90 100 100)"
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-bold">{score}</span>
            <span className={`text-2xl font-semibold ${getGradeColor(grade)}`}>{grade}</span>
          </div>
        </div>
        <div className="flex flex-col items-center sm:items-start gap-3">
          <h2 className="text-lg font-medium text-neutral-400">Security Score</h2>
          <div className="flex items-center gap-2">
            {delta > 0 ? (
              <span className="text-green-400 text-sm font-medium flex items-center gap-1">
                <ArrowUp /> +{delta} vs last month
              </span>
            ) : delta < 0 ? (
              <span className="text-red-400 text-sm font-medium flex items-center gap-1">
                <ArrowDown /> {delta} vs last month
              </span>
            ) : (
              <span className="text-neutral-400 text-sm">No change vs last month</span>
            )}
          </div>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getRiskColor(riskLevel)}`}>
            {riskLevel} Risk
          </span>
        </div>
      </div>
    </div>
  );
}

function ArrowUp() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 2L12 8H2L7 2Z" fill="currentColor" />
    </svg>
  );
}

function ArrowDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 12L2 6H12L7 12Z" fill="currentColor" />
    </svg>
  );
}
