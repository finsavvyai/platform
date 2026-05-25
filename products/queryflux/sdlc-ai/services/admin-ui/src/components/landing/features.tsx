'use client'

import {
  Brain,
  Eye,
  FileCheck,
  GitBranch,
  Search,
  Shield,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Feature {
  title: string
  description: string
  icon: LucideIcon
}

const features: Feature[] = [
  {
    title: 'Zero-Trust Gateway',
    description:
      'Go-powered API gateway with JWT auth, rate limiting, and tenant isolation. Every request verified.',
    icon: Shield,
  },
  {
    title: 'RAG Pipelines',
    description:
      'Ingest, chunk, embed, and index documents with production-grade retrieval-augmented generation.',
    icon: GitBranch,
  },
  {
    title: 'Vector Search',
    description:
      'Rust-powered vector search with sub-10ms latency. Cloudflare Vectorize integration built in.',
    icon: Search,
  },
  {
    title: 'Data Loss Prevention',
    description:
      'Automatic PII detection across SSN, credit cards, emails, and API keys. Block, mask, or allow.',
    icon: Eye,
  },
  {
    title: 'Compliance Engine',
    description:
      'Policy-as-code with OPA integration. Audit trails for SOC 2, HIPAA, and GDPR out of the box.',
    icon: FileCheck,
  },
  {
    title: 'LLM Gateway',
    description:
      'Route to GPT-4, Claude, or open-source models with cost tracking, failover, and usage analytics.',
    icon: Brain,
  },
]

function FeatureCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon

  return (
    <div className="rounded-2xl border dark:border-slate-700 p-6 hover:shadow-lg transition-shadow duration-300 bg-white dark:bg-slate-900">
      <div className="rounded-xl bg-blue-50 dark:bg-blue-950 w-12 h-12 flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {feature.description}
      </p>
    </div>
  )
}

export function Features() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-center">
            Everything you need for secure AI operations
          </h2>
          <p className="text-lg text-muted-foreground text-center max-w-2xl mx-auto mt-4">
            From data ingestion to model deployment, with zero-trust security at
            every layer.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mt-16">
          {features.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </div>
      </div>
    </section>
  )
}
