import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { useDocumentMeta } from '../components/useDocumentMeta'
import { Link } from 'react-router-dom'
import { btnGesturePrimary, btnGestureSubtle } from '../styles/gestures'

interface Framework {
  name: string
  status: 'live' | 'in-progress' | 'aligned'
  description: string
}

const frameworks: Framework[] = [
  {
    name: 'GDPR',
    status: 'live',
    description:
      'Full GDPR compliance including Article 17 right-to-erasure automation, data subject access request workflows, and an executed Data Processing Addendum (DPA) available for every customer.',
  },
  {
    name: 'SOC 2 Type II',
    status: 'in-progress',
    description:
      'SOC 2 Type II is on the roadmap. Independent CPA firm selection is in progress and the target audit window is within the next 12 months. The control matrix is already defined — covering security, availability, confidentiality, and processing integrity — and evidence export tooling is wired into the platform so the audit can run on fresh data from day one.',
  },
  {
    name: 'ISO 27001',
    status: 'aligned',
    description:
      'PushCI is aligned with ISO 27001 controls across asset management, access control, cryptography, operations security, communications security, and supplier relationships. Formal certification is planned for the next audit cycle.',
  },
  {
    name: 'EU Data Residency',
    status: 'in-progress',
    description:
      'The shared Cloud SaaS currently runs on Cloudflare\'s global edge with a US-primary D1 database. A data_residency: "eu" policy flag is plumbed through the compliance API for forward-compatibility, but EU-only routing enforcement (EU D1 binding, Workers region pinning, subprocessor swap) is still on the roadmap. Dedicated single-tenant and self-hosted deployments can be provisioned with an EU location hint today — contact sales for a pilot.',
  },
]

const subprocessors = [
  {
    name: 'Cloudflare',
    purpose: 'Edge hosting, Workers, D1 database, KV storage, R2 object storage',
    region: 'Global, EU routing available',
  },
  {
    name: 'Lemon Squeezy',
    purpose: 'Billing, subscription management, invoicing, VAT / sales tax (merchant of record)',
    region: 'US (with EU VAT compliance)',
  },
  {
    name: 'Resend',
    purpose: 'Transactional email delivery',
    region: 'EU datacenters',
  },
  {
    name: 'Anthropic',
    purpose: 'Claude AI inference for pipeline analysis and auto-fix',
    region: 'US (no customer source code stored)',
  },
]

const statusLabel: Record<Framework['status'], { text: string; classes: string }> = {
  live: {
    text: 'Live',
    classes: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  'in-progress': {
    text: 'In progress',
    classes: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  aligned: {
    text: 'Aligned',
    classes: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  },
}

export default function CompliancePage() {
  useDocumentMeta({
    title: 'Compliance — PushCI',
    description:
      'PushCI compliance posture: GDPR, SOC 2 (in progress), ISO 27001 aligned. EU data residency on roadmap (Dedicated tenants today). Full subprocessor list and downloadable DPA.',
    canonical: 'https://pushci.dev/compliance',
  })

  return (
    <div className="min-h-screen bg-root">
      <Navbar />

      <section className="pt-28 sm:pt-36 pb-12 px-4 sm:px-6">
        <div className="mx-auto max-w-[1080px]">
          <p className="text-caption font-medium text-accent uppercase tracking-wider">Trust & Compliance</p>
          <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-t1 max-w-3xl">
            Security and compliance
          </h1>
          <p className="mt-4 text-lg text-t2 max-w-2xl leading-relaxed">
            PushCI is engineered for regulated industries — energy, telco, finance, and government.
            Our compliance posture is public, auditable, and documented in this page.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1080px] px-4 sm:px-6 pb-20">
        {/* Frameworks */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-t1 mb-5">Compliance frameworks</h2>
          <div className="grid gap-5 sm:grid-cols-1 md:grid-cols-2">
            {frameworks.map((f) => {
              const s = statusLabel[f.status]
              return (
                <div key={f.name} className="rounded-xl border border-border-base bg-surface p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-t1 font-semibold text-lg">{f.name}</h3>
                    <span className={`rounded-md px-2 py-0.5 text-caption font-medium border ${s.classes}`}>
                      {s.text}
                    </span>
                  </div>
                  <p className="text-sm text-t2 leading-relaxed">{f.description}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* Subprocessors */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-t1 mb-5">Subprocessors</h2>
          <p className="text-sm text-t2 mb-5 max-w-2xl">
            PushCI uses a small set of vetted subprocessors to deliver the platform.
            Current and prospective subprocessor DPAs are available on request to
            enterprise prospects as part of the security questionnaire flow below.
          </p>
          <div className="rounded-xl border border-border-base bg-surface overflow-hidden">
            <div className="grid grid-cols-3 gap-4 px-5 py-3 border-b border-border-base text-caption font-medium text-t3 uppercase tracking-wider">
              <div>Name</div>
              <div>Purpose</div>
              <div>Region</div>
            </div>
            {subprocessors.map((sub) => (
              <div
                key={sub.name}
                className="grid grid-cols-3 gap-4 px-5 py-4 border-b border-border-base/50 last:border-b-0"
              >
                <div className="text-sm text-t1 font-medium">{sub.name}</div>
                <div className="text-sm text-t2">{sub.purpose}</div>
                <div className="text-sm text-t2">{sub.region}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Documents */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-t1 mb-5">Documents</h2>
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
            <a
              href="/contact?topic=security"
              className="rounded-xl border border-border-base bg-surface p-5 hover:border-accent/40 transition-colors"
            >
              <div className="text-t1 font-semibold">SOC 2 control matrix</div>
              <div className="text-caption text-t3 mt-1">Available on request</div>
              <p className="text-sm text-t2 mt-3 leading-relaxed">
                Full control mapping for the planned SOC 2 Type II audit. Shared with prospects under NDA.
              </p>
            </a>
            <a
              href="/contact?topic=security"
              className="rounded-xl border border-border-base bg-surface p-5 hover:border-accent/40 transition-colors"
            >
              <div className="text-t1 font-semibold">GDPR Data Processing Addendum</div>
              <div className="text-caption text-t3 mt-1">Available on request</div>
              <p className="text-sm text-t2 mt-3 leading-relaxed">
                Standard DPA template with Article 28 processor obligations. Sign-ready for any EU customer.
              </p>
            </a>
          </div>
        </section>

        {/* Contact */}
        <section className="rounded-2xl border border-border-em bg-surface p-8 sm:p-10 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-t1">Security questionnaire?</h2>
          <p className="mt-3 text-t2 max-w-xl mx-auto">
            Enterprise prospects can request our completed CAIQ Lite, SIG, or a custom vendor questionnaire.
            Response SLA: 3 business days.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <a
              href="/contact?topic=security"
              className={`rounded-lg bg-accent px-6 py-3 text-body font-semibold text-root ${btnGesturePrimary}`}
            >
              Contact security team
            </a>
            <Link
              to="/enterprise"
              className={`rounded-lg border border-border-em bg-raised px-6 py-3 text-body font-medium text-t1 hover:bg-border-base ${btnGestureSubtle}`}
            >
              Enterprise overview
            </Link>
          </div>
        </section>
      </div>

      <Footer />
    </div>
  )
}
