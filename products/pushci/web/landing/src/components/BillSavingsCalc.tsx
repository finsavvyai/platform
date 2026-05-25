import { useMemo, useState } from 'react';

const GHA_LINUX_RATE_PER_MIN = 0.008;
const PUSHCI_RATE_PER_MIN = 0;

function formatMoney(n: number): string {
  if (n >= 1000) return `$${Math.round(n).toLocaleString()}`;
  return `$${n.toFixed(2)}`;
}

function buildShareText(monthly: number, annual: number, minutes: number): string {
  return [
    `So I plug ${minutes.toLocaleString()} GitHub Actions minutes/month`,
    `into the calculator and it tells me I'm paying`,
    `${formatMoney(monthly)}/month — ${formatMoney(annual)}/year — to run npm test.`,
    `On a rented Linux box. While my laptop sits there. Doing nothing.`,
    ``,
    `pushci.dev`,
  ].join(' ');
}

export function BillSavingsCalc() {
  const [minutes, setMinutes] = useState(5000);
  const [seats, setSeats] = useState(10);

  const { monthly, annual } = useMemo(() => {
    const monthlyCost = minutes * GHA_LINUX_RATE_PER_MIN;
    const monthlySaved = monthlyCost - minutes * PUSHCI_RATE_PER_MIN;
    return {
      monthly: monthlySaved,
      annual: monthlySaved * 12,
    };
  }, [minutes]);

  const handleShare = () => {
    const text = buildShareText(monthly, annual, minutes);
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <section
      id="bill-calc"
      className="mt-16 rounded-2xl border border-border-base bg-surface p-6 sm:p-8"
      aria-label="GitHub Actions bill savings calculator"
    >
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
        <h2 className="text-xl sm:text-2xl font-bold text-t1">
          How much are you paying GitHub to run <code className="font-mono text-accent">npm test</code>?
        </h2>
        <span className="text-caption text-t3 font-mono">
          Linux minutes · $0.008/min · public GHA rate
        </span>
      </div>

      <p className="mt-3 text-body text-t2 max-w-2xl">
        Be honest. Pull up the billing tab. I'll wait.
      </p>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
        <label className="block">
          <div className="flex items-center justify-between">
            <span className="text-body font-medium text-t2">GHA minutes / month</span>
            <span className="text-body font-mono text-t1">{minutes.toLocaleString()}</span>
          </div>
          <input
            type="range"
            min={500}
            max={50000}
            step={500}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="mt-2 w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-raised"
            aria-label="GitHub Actions minutes per month"
          />
        </label>

        <label className="block">
          <div className="flex items-center justify-between">
            <span className="text-body font-medium text-t2">
              Seats <span className="text-t3">(optional)</span>
            </span>
            <span className="text-body font-mono text-t1">{seats.toLocaleString()}</span>
          </div>
          <input
            type="range"
            min={1}
            max={500}
            step={1}
            value={seats}
            onChange={(e) => setSeats(Number(e.target.value))}
            className="mt-2 w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-raised"
            aria-label="Team seat count"
          />
        </label>
      </div>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border-base bg-root p-5">
          <div className="text-caption text-t3 uppercase tracking-wide">
            You'd save / month
          </div>
          <div className="mt-1 text-3xl sm:text-4xl font-extrabold text-accent font-mono">
            {formatMoney(monthly)}
          </div>
        </div>
        <div className="rounded-xl border border-border-base bg-root p-5">
          <div className="text-caption text-t3 uppercase tracking-wide">
            You'd save / year
          </div>
          <div className="mt-1 text-3xl sm:text-4xl font-extrabold text-accent font-mono">
            {formatMoney(annual)}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <button
          onClick={handleShare}
          className="rounded-lg bg-t1 px-5 py-2.5 text-sm font-semibold text-root hover:bg-white"
          aria-label="Share this savings number"
        >
          Share this number →
        </button>
        <p className="text-caption text-t3 max-w-md">
          Drops a pre-filled tweet. Curb voice, no hashtags, no emojis. Just the math.
        </p>
      </div>
    </section>
  );
}
