import { TerminalDemo } from './TerminalDemo'

export function Hero() {
  return (
    <section className="relative pt-32 pb-20 px-6 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none" />
      <div className="mx-auto max-w-6xl text-center relative">
        <div className="inline-block mb-6 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-400">
          Open Source CI/CD
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
          CI/CD that just works.
          <br />
          <span className="text-emerald-400">Zero config. Zero cost.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400 leading-relaxed">
          AI auto-detects your stack. Runs on your machine.
          Works with GitHub, GitLab, Bitbucket.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#"
            className="rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-black hover:bg-emerald-400 transition w-full sm:w-auto"
          >
            Get Started Free
          </a>
          <a
            href="#"
            className="rounded-lg border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-300 hover:border-zinc-500 hover:text-white transition w-full sm:w-auto"
          >
            View on GitHub
          </a>
        </div>
        <div className="mt-16 flex justify-center animate-fade-in-up">
          <TerminalDemo />
        </div>
      </div>
    </section>
  )
}
