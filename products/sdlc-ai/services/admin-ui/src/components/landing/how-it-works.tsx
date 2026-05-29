'use client'

import { Plug, Settings, Rocket } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Step {
  number: string
  title: string
  description: string
  icon: LucideIcon
}

const steps: Step[] = [
  {
    number: '01',
    title: 'Connect',
    description:
      'Connect your data sources. PostgreSQL, S3, APIs, or file uploads. Multi-tenant isolation from day one.',
    icon: Plug,
  },
  {
    number: '02',
    title: 'Configure',
    description:
      'Set compliance policies, DLP rules, and access controls. OPA-backed policy engine with pre-built templates.',
    icon: Settings,
  },
  {
    number: '03',
    title: 'Deploy',
    description:
      'Deploy RAG pipelines, vector search, and LLM routing to Cloudflare\'s edge. Sub-50ms P50 latency globally.',
    icon: Rocket,
  },
]

function StepCard({ step }: { step: Step }) {
  const Icon = step.icon

  return (
    <div className="text-center">
      <div className="text-6xl font-bold text-slate-100 dark:text-slate-800 mb-4">
        {step.number}
      </div>
      <div
        className="rounded-full bg-blue-100 dark:bg-blue-950 w-14 h-14
          flex items-center justify-center mx-auto mb-4"
      >
        <Icon className="h-7 w-7 text-blue-600 dark:text-blue-400" />
      </div>
      <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
        {step.description}
      </p>
    </div>
  )
}

export function HowItWorks() {
  return (
    <section className="py-24 px-6 bg-slate-50 dark:bg-slate-900/50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-center">
            Get started in minutes, not months
          </h2>
          <p className="text-lg text-muted-foreground text-center max-w-2xl mx-auto mt-4">
            Three steps to production-ready AI operations with enterprise
            security.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-12 max-w-5xl mx-auto mt-16">
          {steps.map((step) => (
            <StepCard key={step.number} step={step} />
          ))}
        </div>
      </div>
    </section>
  )
}
