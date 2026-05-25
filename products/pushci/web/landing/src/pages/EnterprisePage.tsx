import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { useDocumentMeta } from '../components/useDocumentMeta'
import { Link } from 'react-router-dom'
import { btnGesturePrimary, btnGestureSubtle, cardGesture } from '../styles/gestures'
import { valueProps, integrations, badges, topologies, faqs, freePlanDetails } from './enterpriseData'
import { EnterpriseTerminalDemo } from '../components/EnterpriseTerminalDemo'

function Section({ title, eyebrow, children }: { title: string; eyebrow?: string; children: React.ReactNode }) {
  return (
    <section className="mb-20">
      {eyebrow && <p className="text-caption font-medium text-accent uppercase tracking-wider mb-2">{eyebrow}</p>}
      <h2 className="text-2xl sm:text-3xl font-bold text-t1 mb-6">{title}</h2>
      {children}
    </section>
  )
}

export default function EnterprisePage() {
  useDocumentMeta({
    title: 'PushCI Enterprise — Unified control plane for Gerrit, Jenkins, AWS',
    description: 'The unified control plane for Gerrit, Jenkins, and AWS CodePipeline. Bridge, do not replace. SOC 2 (in progress), GDPR, ISO 27001 aligned. EU data residency on roadmap — Dedicated single-tenant and self-hosted deployments available today.',
    canonical: 'https://pushci.dev/enterprise',
  })

  return (
    <div className="min-h-screen bg-root">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 sm:pt-36 pb-16 px-4 sm:px-6">
        <div className="mx-auto max-w-[1080px]">
          <p className="text-caption font-medium text-accent uppercase tracking-wider">PushCI for Enterprise</p>
          <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-t1 max-w-3xl leading-tight">
            The unified control plane for Gerrit, Jenkins, and AWS CodePipeline.
          </h1>
          <p className="mt-5 text-lg text-t2 max-w-2xl leading-relaxed">
            A modern CI/CD platform that respects your existing investments. Bridge your
            heterogeneous pipeline estate, enforce policy, prove compliance, and give your
            developers a single pane of glass — without a rip-and-replace migration.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href="/contact?topic=enterprise"
              className={`rounded-lg bg-accent px-6 py-3 text-body font-semibold text-root ${btnGesturePrimary}`}
            >
              Talk to sales
            </a>
            <a
              href="#topologies"
              className={`rounded-lg border border-border-em bg-surface px-6 py-3 text-body font-medium text-t1 hover:bg-raised ${btnGestureSubtle}`}
            >
              See deployment options
            </a>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1080px] px-4 sm:px-6 pb-20">

        {/* How it works — enterprise terminal demo */}
        <Section eyebrow="See it in action" title="Enterprise workflows. Running in your terminal.">
          <div className="max-w-3xl">
            <EnterpriseTerminalDemo />
            <p className="mt-5 text-sm text-t3 max-w-2xl">
              SSO, SCIM, tamper-evident audit, policy-as-code, and legacy CI migration —
              every enterprise workflow is one CLI command. Watch each tab above to see
              what shipping on PushCI looks like day-to-day.
            </p>
          </div>
        </Section>

        {/* Free plan */}
        <Section eyebrow="Free plan" title={freePlanDetails.headline}>
          <p className="text-base text-t2 mb-8 max-w-2xl">{freePlanDetails.subhead}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
            {freePlanDetails.includes.map((item) => (
              <div key={item.label} className={`rounded-xl border border-border-base bg-surface p-5 ${cardGesture}`}>
                <div className="flex items-start gap-2 mb-2">
                  <svg className="w-4 h-4 mt-0.5 shrink-0 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-t1 font-semibold text-sm">{item.label}</span>
                </div>
                <p className="text-caption text-t3 leading-relaxed pl-6">{item.detail}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border-base bg-raised px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-caption text-t3 max-w-xl">{freePlanDetails.limits}</p>
            <a
              href="https://app.pushci.dev"
              className={`rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-root whitespace-nowrap font-mono ${btnGesturePrimary}`}
            >
              {freePlanDetails.cta}
            </a>
          </div>
        </Section>

        {/* Value props */}
        <Section eyebrow="Why enterprises pick PushCI" title="Built for heterogeneous CI estates">
          <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3">
            {valueProps.map((v) => (
              <div
                key={v.title}
                className={`rounded-xl border border-border-base bg-surface p-6 ${cardGesture}`}
              >
                {'icon' in v && <div className="text-2xl mb-3">{v.icon}</div>}
                <h3 className="text-t1 font-semibold text-lg mb-2">{v.title}</h3>
                <p className="text-sm text-t2 leading-relaxed">{v.body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Integrations */}
        <Section eyebrow="Integrations" title="Works with the tools you already run">
          <div className="grid gap-px bg-border-base rounded-xl overflow-hidden sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {integrations.map((name) => (
              <div key={name} className="bg-surface px-5 py-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-raised border border-border-base flex items-center justify-center text-caption font-mono font-semibold text-t2">
                  {name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <span className="text-sm text-t1 font-medium">{name}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-caption text-t3">
            First-party integrations for Gerrit REST, Jenkins Remote API, AWS CodePipeline,
            and SAML/SCIM identity providers. Additional integrations delivered via boutique services.
          </p>
        </Section>

        {/* Compliance badges */}
        <Section eyebrow="Compliance" title="Security and compliance posture">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {badges.map((b) => (
              <div key={b.label} className="rounded-xl border border-border-base bg-surface p-5 text-center">
                <div className="text-t1 font-semibold text-base">{b.label}</div>
                <div className="text-caption text-t3 mt-1">{b.sub}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-t2">
            Review full details on the{' '}
            <Link to="/compliance" className="text-accent hover:text-accent-light underline underline-offset-4">
              compliance page
            </Link>
            .
          </p>
        </Section>

        {/* Topologies */}
        <Section eyebrow="Deployment" title="Three deployment topologies">
          <div id="topologies" className="grid gap-5 sm:grid-cols-1 md:grid-cols-3">
            {topologies.map((t) => (
              <div
                key={t.name}
                className={`rounded-xl border border-border-base bg-surface p-6 flex flex-col ${cardGesture}`}
              >
                <h3 className="text-t1 font-semibold text-lg">{t.name}</h3>
                <p className="text-accent text-sm font-medium mt-1">{t.price}</p>
                <ul className="mt-4 space-y-2 flex-1">
                  {t.bullets.map((b) => (
                    <li key={b} className="text-sm text-t2 leading-relaxed flex gap-2">
                      <span className="text-accent shrink-0">-</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        {/* Pricing teaser */}
        <Section eyebrow="Pricing" title="Designed for annual enterprise contracts">
          <div className={`rounded-xl border border-border-em bg-surface p-8 ${cardGesture}`}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-t1 font-semibold text-lg">Custom quote within 48 hours</h3>
                <p className="text-sm text-t2 mt-2 max-w-xl">
                  Every enterprise deployment is scoped based on user count, build minutes,
                  residency requirements, and integrations. We publish indicative pricing but
                  tailor each contract to your fleet.
                </p>
              </div>
              <a
                href="/contact?topic=enterprise"
                className={`rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-root whitespace-nowrap ${btnGesturePrimary}`}
              >
                Contact sales
              </a>
            </div>
          </div>
        </Section>

        {/* FAQ */}
        <Section eyebrow="FAQ" title="Frequently asked">
          <div className="divide-y divide-border-base rounded-xl border border-border-base overflow-hidden">
            {faqs.map((f) => (
              <details key={f.q} className="group bg-surface">
                <summary className="flex cursor-pointer items-center justify-between p-5 text-t1 font-medium text-sm">
                  {f.q}
                  <span className="text-t3 group-open:rotate-45 transition-transform text-lg">+</span>
                </summary>
                <div className="px-5 pb-5 text-sm text-t2 leading-relaxed">{f.a}</div>
              </details>
            ))}
          </div>
        </Section>

        {/* Final CTA */}
        <section className="rounded-2xl border border-border-em bg-surface p-8 sm:p-10 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-t1">Book a 30-minute demo</h2>
          <p className="mt-3 text-t2 max-w-xl mx-auto">
            See PushCI running against a Gerrit + Jenkins + AWS CodePipeline stack,
            with your team's questions answered live.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <a
              href="/contact?topic=enterprise"
              className={`rounded-lg bg-accent px-6 py-3 text-body font-semibold text-root ${btnGesturePrimary}`}
            >
              Book a 30-min demo
            </a>
            <Link
              to="/compliance"
              className={`rounded-lg border border-border-em bg-raised px-6 py-3 text-body font-medium text-t1 hover:bg-border-base ${btnGestureSubtle}`}
            >
              View compliance
            </Link>
          </div>
        </section>
      </div>

      <Footer />
    </div>
  )
}
