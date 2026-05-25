import { FadeUp, Parallax } from './animations'

export default function CaseStudy() {
  return (
    <section className="py-28 px-4 relative overflow-hidden">
      <Parallax speed={0.2}>
        <div className="absolute inset-0 opacity-30"
          style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(245,158,11,0.08), transparent 60%)' }} />
      </Parallax>
      <div className="max-w-3xl mx-auto text-center relative z-10">
        <FadeUp>
          <p className="text-xs uppercase tracking-[0.2em] text-token-gold font-semibold mb-10">
            Case Study
          </p>
          <blockquote>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-snug mb-10 text-slate-900"
              style={{ letterSpacing: '-0.02em' }}>
              &ldquo;AMLIQ reduced our false positives by 70% while cutting screening costs by 80%.&rdquo;
            </p>
          </blockquote>
          <div className="flex items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold bg-gradient-to-br from-[#C9A96E] to-[#C9A96E]-dark text-[#0F172A]">
              JR
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-900">James Richardson</p>
              <p className="text-sm text-slate-600">Head of Compliance, Meridian Fintech</p>
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  )
}
