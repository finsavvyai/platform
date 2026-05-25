const insights = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
    title: 'Build duration trends',
    description: 'Track how fast your pipelines run over time.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
    title: 'Cost savings calculator',
    description: 'See how much you save vs GitHub Actions pricing.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
    ),
    title: 'Flaky test detection',
    description: 'Identify tests that pass and fail inconsistently.',
  },
];

export default function EmptyAnalyticsState() {
  return (
    <div className="max-w-lg mx-auto py-8 sm:py-12 md:py-16 px-4 space-y-10">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-2">
          <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-zinc-100">
          Analytics unlock after your first run
        </h2>
        <p className="text-zinc-400 text-sm max-w-md mx-auto">
          Push a commit to trigger your first pipeline.
          PushCI tracks every run and shows you exactly where your time and money go.
        </p>
      </div>

      <div className="space-y-4">
        {insights.map((item) => (
          <div key={item.title} className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-emerald-400">
              {item.icon}
            </div>
            <div>
              <p className="text-zinc-200 font-medium text-sm">{item.title}</p>
              <p className="text-zinc-500 text-xs mt-0.5">{item.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center space-y-3 pt-2">
        <p className="text-zinc-500 text-xs">Get started in 30 seconds:</p>
        <code className="block px-4 py-2 rounded-lg bg-zinc-800 text-emerald-400 text-sm font-mono select-all">
          npm i -g pushci && pushci init && git push
        </code>
        <a
          href="/billing"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-900 font-semibold text-sm transition-colors"
        >
          View Plans & Pricing
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </a>
      </div>
    </div>
  );
}
