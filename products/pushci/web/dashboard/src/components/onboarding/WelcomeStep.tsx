import ValueProp from './ValueProp';

export default function WelcomeStep({ userName }: { userName: string }) {
  return (
    <div className="text-center space-y-5 animate-fade-in">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
        <svg aria-hidden="true" className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.58-5.84a14.927 14.927 0 0 1-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
        </svg>
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-zinc-100">
          Welcome to PushCI{userName ? `, ${userName}` : ''}
        </h2>
        <p className="text-zinc-400 text-sm max-w-sm mx-auto">
          AI-native CI/CD that runs on your own infrastructure.
          Let's get you set up in under two minutes.
        </p>
      </div>
      <div className="grid gap-3 text-left max-w-xs mx-auto">
        <ValueProp icon="bolt" text="Zero config — auto-detects your stack" />
        <ValueProp icon="dollar" text="Free compute — runs on your machine" />
        <ValueProp icon="globe" text="Works with GitHub, GitLab, Bitbucket" />
      </div>
    </div>
  );
}
