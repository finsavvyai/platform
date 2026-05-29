'use client'

import { Award, CreditCard, Lock, Shield, ShieldCheck } from 'lucide-react'

const badges = [
  { label: 'SOC 2 Type II', icon: Shield },
  { label: 'HIPAA', icon: Lock },
  { label: 'GDPR', icon: ShieldCheck },
  { label: 'PCI-DSS', icon: CreditCard },
  { label: 'ISO 27001', icon: Award },
]

export function TrustBar() {
  return (
    <section className="py-16 border-t border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
      <div className="max-w-6xl mx-auto px-6">
        <p className="text-sm text-muted-foreground text-center mb-8">
          Trusted by enterprise teams. Compliant by design.
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          {badges.map((badge) => {
            const Icon = badge.icon
            return (
              <div
                key={badge.label}
                className="flex items-center gap-2 rounded-full border dark:border-slate-700 px-4 py-2 text-sm font-medium bg-white dark:bg-slate-800"
              >
                <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span>{badge.label}</span>
              </div>
            )
          })}
        </div>

        <p className="text-sm text-muted-foreground text-center mt-8">
          Serving 500+ enterprise teams across finance, healthcare, and government
        </p>
      </div>
    </section>
  )
}
