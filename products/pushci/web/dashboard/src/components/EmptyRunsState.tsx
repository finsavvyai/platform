import CopyCommand from './CopyCommand';
import { btnGesturePrimary } from '../styles/gestures';

const steps = [
  { number: '1', title: 'Install PushCI', command: 'npm i -g pushci && pushci init', description: 'Auto-detects your stack, language, and framework.' },
  { number: '2', title: 'Push your code', command: 'git push', description: 'PushCI runs your tests locally — zero config, zero cost.' },
  { number: '3', title: 'See results here', command: null, description: 'Pipeline results stream to this dashboard in real time.' },
];

function StepCard({ step }: { step: (typeof steps)[number] }) {
  return (
    <div className="flex gap-4 items-start">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-sm font-semibold">
        {step.number}
      </div>
      <div className="min-w-0">
        <p className="text-zinc-200 font-medium text-sm">{step.title}</p>
        {step.command && (
          <CopyCommand command={step.command} />
        )}
        <p className="mt-1 text-zinc-500 text-xs">{step.description}</p>
      </div>
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold text-emerald-400">{value}</p>
      <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
    </div>
  );
}

export default function EmptyRunsState() {
  return (
    <div className="max-w-xl mx-auto py-8 sm:py-12 md:py-16 px-4 space-y-10">
      {/* Hero */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-2">
          <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-zinc-100">
          Your CI pipeline is ready
        </h2>
        <p className="text-zinc-400 text-sm max-w-md mx-auto">
          Run tests on your own machine. No YAML, no per-minute billing,
          no vendor lock-in. Two commands and you're live.
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-5">
        {steps.map((step) => (
          <StepCard key={step.number} step={step} />
        ))}
      </div>

      {/* Stats */}
      <div className="flex justify-center gap-10 py-4 border-t border-b border-zinc-800">
        <StatCard value="19" label="Languages" />
        <StatCard value="40+" label="Frameworks" />
        <StatCard value="$0" label="Compute cost" />
      </div>

      {/* CTA */}
      <div className="text-center space-y-3">
        <a
          href="https://pushci.dev/docs"
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-900 font-semibold text-sm ${btnGesturePrimary}`}
        >
          Read the Quickstart Guide
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </a>
        <p className="text-zinc-600 text-xs">
          Free for individuals. Pro plans start at $9/mo.
        </p>
      </div>
    </div>
  );
}
