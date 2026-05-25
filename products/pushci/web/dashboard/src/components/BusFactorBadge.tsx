// Small inline badge for project cards + run details.
// Apple HIG: calm palette — muted gray for healthy, accent red only when
// BF=1. Not an emergency alert design; informational pill.

interface Props {
  busFactor: number;
  className?: string;
}

type Tone = "risky" | "single" | "healthy" | "strong";

function toneFor(bf: number): Tone {
  if (bf <= 0) return "risky";
  if (bf === 1) return "single";
  if (bf === 2) return "healthy";
  return "strong";
}

const toneClasses: Record<Tone, string> = {
  risky: "bg-red-500/10 text-red-300 border-red-500/30",
  single: "bg-red-500/10 text-red-300 border-red-500/30",
  healthy: "bg-amber-500/10 text-amber-200 border-amber-500/30",
  strong: "bg-zinc-700/40 text-zinc-300 border-zinc-600/40",
};

const toneLabel: Record<Tone, string> = {
  risky: "abandoned",
  single: "single owner",
  healthy: "two owners",
  strong: "healthy",
};

export default function BusFactorBadge({ busFactor, className = "" }: Props) {
  const tone = toneFor(busFactor);
  const label = busFactor >= 3 ? "BF:3+" : `BF:${Math.max(busFactor, 0)}`;
  return (
    <span
      aria-label={`Bus factor ${busFactor}: ${toneLabel[tone]}`}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide ${toneClasses[tone]} ${className}`}
    >
      {label}
    </span>
  );
}
