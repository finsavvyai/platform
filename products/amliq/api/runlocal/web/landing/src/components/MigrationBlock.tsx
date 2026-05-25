interface MigrationBlockProps {
  beforeCode: string
  beforeLabel: string
}

export function MigrationBlock({ beforeCode, beforeLabel }: MigrationBlockProps) {
  const afterCode = `# Install PushCI
npx pushci init

# That's it. AI detects your stack
# and runs CI locally.`

  return (
    <section className="py-16 px-6">
      <div className="mx-auto max-w-5xl text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Switch in 60 Seconds</h2>
        <p className="text-zinc-400 mb-8">No migration guide needed.</p>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-left">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              <span className="text-xs font-medium text-zinc-400">{beforeLabel}</span>
            </div>
            <pre className="overflow-x-auto text-xs leading-relaxed text-zinc-400">
              <code>{beforeCode}</code>
            </pre>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-4 text-left">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-emerald-400">PushCI</span>
            </div>
            <pre className="overflow-x-auto text-xs leading-relaxed text-emerald-300">
              <code>{afterCode}</code>
            </pre>
          </div>
        </div>
        <a
          href="#"
          className="mt-8 inline-block rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-black hover:bg-emerald-400 transition"
        >
          Get Started Free
        </a>
      </div>
    </section>
  )
}
