import { ArrowRight, Zap } from 'lucide-react'

export function CtaSection() {
  return (
    <section className="py-24 px-6 bg-slate-900 dark:bg-slate-950 text-white">
      <div className="max-w-6xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold">
          Ready to secure your AI operations?
        </h2>

        <p className="mt-4 text-lg text-slate-300 max-w-2xl mx-auto">
          Join 500+ enterprise teams using SDLC.ai. Deploy in minutes with
          zero-trust security.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="/auth/signup"
            className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-amber-500 px-6 py-3 font-semibold text-slate-900 transition-colors duration-200 hover:bg-amber-400"
          >
            <Zap className="h-5 w-5" />
            Start Free Trial
            <ArrowRight className="h-4 w-4" />
          </a>

          <a
            href="/contact"
            className="cursor-pointer inline-flex items-center gap-2 rounded-lg border border-white/30 px-6 py-3 font-semibold text-white transition-colors duration-200 hover:border-white hover:bg-white/5"
          >
            Talk to Sales
          </a>
        </div>

        <p className="mt-6 text-sm text-slate-400">
          No credit card required &middot; 14-day free trial &middot; Cancel
          anytime
        </p>
      </div>
    </section>
  )
}
