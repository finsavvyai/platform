import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { CostSlider } from '../components/CostSlider';
import { ViralShare } from '../components/ViralShare';
import { useDocumentMeta } from '../components/useDocumentMeta';

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
    <div className="flex items-center gap-3 sm:gap-4">
      <span className="w-24 sm:w-32 text-sm text-t2 text-right shrink-0 font-mono">{name}</span>
      <div className="flex-1 h-8 bg-surface rounded overflow-hidden relative border border-border-base">
        <div
          className={`h-full transition-all ${isPushCI ? 'bg-t1' : 'bg-border-em'}`}
          style={{ width: `${Math.max(pct, isPushCI ? 0 : 1)}%` }}
        />
        <span className={`absolute inset-0 flex items-center px-3 text-sm font-mono ${isPushCI ? 'text-accent' : 'text-t1'}`}>
          ${cost.toFixed(2)}/mo
        </span>
      </div>
    </div>
  );
}

export default function CostCalculator() {
  useDocumentMeta({
    title: 'CI/CD Cost Calculator — See How Much You Save with PushCI',
    description: 'Calculate how much you spend on GitHub Actions, CircleCI, or GitLab CI per month. PushCI runs locally for $0. Compare costs instantly.',
    canonical: 'https://pushci.dev/tools/cost-calculator',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'CI/CD Cost Calculator',
      description: 'Calculate CI/CD costs for GitHub Actions, CircleCI, GitLab CI vs PushCI',
      url: 'https://pushci.dev/tools/cost-calculator',
      applicationCategory: 'UtilityApplication',
      isAccessibleForFree: true,
    },
  })
  const [runs, setRuns] = useState(500);
  const [dur, setDur] = useState(5);
  const [os, setOs] = useState<'linux' | 'macos'>('linux');

  const costs = calc(runs, dur, os);
  const saved = costs.github;

  return (
    <div className="min-h-screen bg-root">
      <Navbar />
      <div className="mx-auto max-w-[1080px] px-4 sm:px-6 pt-28 sm:pt-36 pb-20">
        <p className="text-sm font-medium text-accent tracking-wide">
          Cost Calculator
        </p>
        <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-t1 max-w-xl">
          How much are you spending on CI?
        </h1>
        <p className="mt-4 text-lg text-t2 max-w-lg leading-relaxed mb-12">
          PushCI runs locally on your machine. Always $0 for local runs —
          that's what this calculator compares against GitHub Actions,
          CircleCI, and GitLab CI pay-per-minute pricing.
        </p>

        <div className="grid gap-12 lg:grid-cols-2">
          {/* Controls */}
          <div className="space-y-6">
            <CostSlider label="Runs per month" value={runs} min={1} max={10000} step={10} onChange={setRuns} />
            <CostSlider label="Avg duration" value={dur} min={1} max={30} unit="min" onChange={setDur} />
            <div className="flex gap-2">
              {(['linux', 'macos'] as const).map((o) => (
                <button key={o} onClick={() => setOs(o)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${os === o ? 'bg-t1 text-root' : 'text-t3 hover:text-t1'}`}>
                  {o === 'linux' ? 'Linux' : 'macOS'}
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          <div>
            <div className="mb-6">
              <span className="text-3xl font-bold text-t1 font-mono">${saved.toFixed(2)}</span>
              <span className="text-t3 ml-2 text-sm">saved/month with PushCI</span>
            </div>

            <div className="space-y-3 mb-8">
              <Row name="GitHub Actions" cost={costs.github} max={costs.github} />
              <Row name="CircleCI" cost={costs.circleci} max={costs.github} />
              <Row name="GitLab CI" cost={costs.gitlab} max={costs.github} />
              <Row name="PushCI" cost={costs.pushci} max={costs.github} />
            </div>

            <div className="mb-6">
              <a href="/#pricing" className="rounded-lg bg-t1 px-5 py-2.5 text-sm font-semibold text-root hover:bg-t1 transition">
                Start saving now
              </a>
            </div>
            <ViralShare context={`You'd save $${saved.toFixed(2)}/mo — share it`} />
          </div>
        </div>

        <div className="mt-12 border-t border-border-base/40 pt-8">
          <p className="text-sm text-t3 mb-3">See detailed comparisons</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/vs/github-actions" className="text-sm text-t2 hover:text-t1 transition">vs GitHub Actions</Link>
            <Link to="/vs/gitlab-ci" className="text-sm text-t2 hover:text-t1 transition">vs GitLab CI</Link>
            <Link to="/vs/circleci" className="text-sm text-t2 hover:text-t1 transition">vs CircleCI</Link>
            <Link to="/vs/jenkins" className="text-sm text-t2 hover:text-t1 transition">vs Jenkins</Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
