'use client'

import { ArrowRight, Play } from 'lucide-react'

export function Hero() {
  return (
    <section
      className="relative min-h-screen bg-gradient-to-b from-slate-50 to-white
        dark:from-slate-950 dark:to-slate-900 overflow-hidden"
    >
      {/* Dot pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage:
            'radial-gradient(circle, #1E293B 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
        aria-hidden="true"
      />

      {/* Grid line accent */}
      <div
        className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #1E40AF 1px, transparent 1px),
            linear-gradient(to bottom, #1E40AF 1px, transparent 1px)
          `,
          backgroundSize: '96px 96px',
        }}
        aria-hidden="true"
      />

      <div className="relative max-w-5xl mx-auto px-6 pt-32 pb-24 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full
          bg-[#1E40AF]/5 dark:bg-[#1E40AF]/10 border border-[#1E40AF]/10
          dark:border-[#1E40AF]/20"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm font-medium text-[#1E40AF] dark:text-blue-400">
            Now SOC 2 Type II Certified
          </span>
        </div>

        {/* Headline */}
        <h1
          className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight
            text-[#1E293B] dark:text-white leading-[1.08]"
        >
          Secure AI Operations
          <br />
          <span className="text-[#1E40AF]">for the Enterprise</span>
        </h1>

        {/* Subheadline */}
        <p
          className="mt-6 text-xl text-slate-500 dark:text-slate-400
            max-w-2xl mx-auto leading-relaxed"
        >
          Zero-trust data learning platform with compliance built in.
          Process, analyze, and deploy AI models with GDPR, HIPAA,
          and SOC 2 compliance from day one.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="/signup"
            className="group min-h-[52px] px-8 flex items-center gap-2 rounded-xl
              text-base font-semibold bg-[#F59E0B] text-[#1E293B]
              hover:bg-amber-400 transition-colors duration-200
              cursor-pointer shadow-lg shadow-amber-500/20"
          >
            Start Free Trial
            <ArrowRight
              className="h-4 w-4 transition-transform duration-200
                group-hover:translate-x-1"
            />
          </a>
          <a
            href="/demo"
            className="min-h-[52px] px-8 flex items-center gap-2 rounded-xl
              text-base font-semibold text-[#1E293B] dark:text-white
              border-2 border-slate-200 dark:border-slate-700
              hover:border-slate-300 dark:hover:border-slate-600
              transition-colors duration-200 cursor-pointer"
          >
            <Play className="h-4 w-4" />
            Book a Demo
          </a>
        </div>

        {/* Trust line */}
        <p className="mt-8 text-sm text-slate-500 dark:text-slate-500">
          No credit card required
          <span className="mx-2 select-none">&#183;</span>
          SOC 2 certified
          <span className="mx-2 select-none">&#183;</span>
          99.9% uptime SLA
        </p>
      </div>
    </section>
  )
}
