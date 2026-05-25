import { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { CostSlider } from '../components/CostSlider';

const RATES = {
  linux: { github: 0.008, circleci: 0.006, gitlab: 0.008 },
  macos: { github: 0.08, circleci: 0.06, gitlab: 0.08 },
};

function calc(runs: number, dur: number, os: 'linux' | 'macos') {
  const min = runs * dur;
  const r = RATES[os];
  return {
    github: Math.round(min * r.github * 100) / 100,
    circleci: Math.round(min * r.circleci * 100) / 100,
    gitlab: Math.round(min * r.gitlab * 100) / 100,
    pushci: 0,
  };
}

function Row({ name, cost, max }: { name: string; cost: number; max: number }) {
  const pct = max > 0 ? (cost / max) * 100 : 0;
  const isPushCI = name === 'PushCI';
  return (
    <div className="flex items-center gap-4">
      <span className="w-32 text-sm text-zinc-400 text-right">{name}</span>
      <div className="flex-1 h-8 bg-zinc-800 rounded-lg overflow-hidden relative">
        <div
          className={`h-full rounded-lg transition-all ${isPushCI ? 'bg-emerald-500' : 'bg-zinc-600'}`}
          style={{ width: `${Math.max(pct, 1)}%` }}
        />
        <span className="absolute inset-0 flex items-center px-3 text-sm font-semibold text-white">
          ${cost.toFixed(2)}/mo
        </span>
      </div>
    </div>
  );
}

export default function CostCalculator() {
  const [runs, setRuns] = useState(500);
  const [dur, setDur] = useState(5);
  const [os, setOs] = useState<'linux' | 'macos'>('linux');

  const costs = calc(runs, dur, os);
  const saved = costs.github;

  const shareText = `We'd save $${saved.toFixed(2)}/month on CI with @pushci_dev \u2014 zero YAML, zero cloud bills. pushci.dev/tools/cost-calculator`;

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />
      <div className="mx-auto max-w-2xl px-6 pt-28 pb-20">
        <h1 className="text-3xl font-bold text-white mb-2">CI Cost Calculator</h1>
        <p className="text-zinc-400 mb-8">See how much you'd save by running CI locally with PushCI.</p>

        <div className="space-y-6 mb-8">
          <CostSlider label="Runs per month" value={runs} min={1} max={10000} step={10} onChange={setRuns} />
          <CostSlider label="Avg duration" value={dur} min={1} max={30} unit="min" onChange={setDur} />
          <div className="flex gap-2">
            {(['linux', 'macos'] as const).map((o) => (
              <button key={o} onClick={() => setOs(o)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${os === o ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
                {o === 'linux' ? 'Linux' : 'macOS'}
              </button>
            ))}
          </div>
        </div>

        <div className="text-center mb-6">
          <span className="text-4xl font-bold text-emerald-400">${saved.toFixed(2)}</span>
          <span className="text-zinc-400 ml-2">saved/month with PushCI</span>
        </div>

        <div className="space-y-3 mb-8">
          <Row name="GitHub Actions" cost={costs.github} max={costs.github} />
          <Row name="CircleCI" cost={costs.circleci} max={costs.github} />
          <Row name="GitLab CI" cost={costs.gitlab} max={costs.github} />
          <Row name="PushCI" cost={costs.pushci} max={costs.github} />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <a href="https://pushci.dev/#pricing" className="flex-1 text-center rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-black hover:bg-emerald-400 transition">
            Start saving now
          </a>
          <button onClick={() => { navigator.clipboard.writeText(shareText); }}
            className="flex-1 rounded-lg bg-zinc-800 px-6 py-3 font-semibold text-zinc-200 hover:bg-zinc-700 transition">
            Share my savings
          </button>
        </div>
        <p className="text-center text-xs text-zinc-600 mt-3">npx pushci init &mdash; start in 30 seconds</p>
      </div>
      <Footer />
    </div>
  );
}
