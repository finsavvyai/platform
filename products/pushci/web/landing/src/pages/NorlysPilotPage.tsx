import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { useDocumentMeta } from '../components/useDocumentMeta'
import { Link } from 'react-router-dom'
import { btnGesturePrimary, btnGestureSubtle } from '../styles/gestures'
import {
  stackDelivered, stackPilotScope, timeline, successCriteria, deliverables, risks,
} from './norlysPilotData'

const TH = 'text-left px-5 py-3 text-caption text-t3 uppercase tracking-wider font-medium'
const SECTION = 'mb-16'
const H2 = 'text-2xl font-bold text-t1 mb-5'
const CARD = 'rounded-xl border border-border-base bg-surface'

function StackGrid({ rows, dim = false }: { rows: { label: string; value: string }[]; dim?: boolean }) {
  return (
    <div className="grid gap-px bg-border-base rounded-xl overflow-hidden sm:grid-cols-2">
      {rows.map((s) => (
        <div key={s.label} className={`p-5 ${dim ? 'bg-surface/60' : 'bg-surface'}`}>
          <div className="text-caption text-t3 uppercase tracking-wider">{s.label}</div>
          <div className={`text-sm font-medium mt-1 ${dim ? 'text-t2' : 'text-t1'}`}>{s.value}</div>
        </div>
      ))}
    </div>
  )
}

export default function NorlysPilotPage() {
  useDocumentMeta({
    title: 'Norlys x PushCI — 90-day pilot (proposal)',
    description: 'Confidential proposal for the Norlys x PushCI 90-day pilot. Pending signature. Not for public distribution.',
    canonical: 'https://pushci.dev/norlys-pilot',
    robots: 'noindex, nofollow',
  })

  return (
    <div className="min-h-screen bg-root">
      <Navbar />

      <main>
      <div className="border-b border-border-base bg-surface/60">
        <div className="mx-auto max-w-[1080px] px-4 sm:px-6 py-3 text-center">
          <p className="text-caption text-t2">
            <span className="font-mono uppercase tracking-wider text-accent">Status</span>
            <span className="mx-2 text-t3">/</span>
            <span className="text-t1">Proposal — pending signature.</span>
            <span className="ml-2 text-t3">Confidential — for Norlys evaluation only.</span>
          </p>
        </div>
      </div>

      <section className="pt-20 sm:pt-28 pb-12 px-4 sm:px-6">
        <div className="mx-auto max-w-[1080px]">
          <p className="text-caption font-medium text-accent uppercase tracking-wider">Private pilot proposal</p>
          <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-t1">
            Norlys x PushCI — 90-day pilot
          </h1>
          <p className="mt-4 text-lg text-t2 max-w-2xl leading-relaxed">
            Proposed scope: a boutique engagement to validate PushCI as a unified control plane over
            Norlys's existing Gerrit, Jenkins, and AWS CodePipeline estate. Target scope is 10 Java
            Maven repositories on a single-tenant deployment in EU-West, with SAML SSO. Final scope is
            confirmed at kickoff.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="rounded-md bg-accent/10 border border-accent/30 px-3 py-1 text-caption font-medium text-accent">
              Pilot tenant: pushci.norlys.dk
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1080px] px-4 sm:px-6 pb-20">
        <section className={SECTION}>
          <h2 className="text-2xl font-bold text-t1 mb-2">Pilot stack</h2>
          <p className="text-sm text-t2 mb-6 max-w-2xl">
            Split into capabilities PushCI ships today and integration scope to be built during the
            pilot. Lines marked as pilot scope are not pre-existing product features.
          </p>
          <h3 className="text-caption font-mono uppercase tracking-wider text-accent mb-3">PushCI delivers today</h3>
          <StackGrid rows={stackDelivered} />
          <h3 className="text-caption font-mono uppercase tracking-wider text-t3 mt-8 mb-3">Pilot integration scope (Weeks 1-3)</h3>
          <StackGrid rows={stackPilotScope} dim />
        </section>

        <section className={SECTION}>
          <h2 className={H2}>90-day timeline</h2>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border-base hidden sm:block" aria-hidden="true" />
            <div className="space-y-6">
              {timeline.map((week, idx) => (
                <div key={week.label} className="relative sm:pl-12">
                  <div className="absolute left-0 top-1 w-8 h-8 rounded-full border border-accent/40 bg-surface hidden sm:flex items-center justify-center text-caption font-mono font-semibold text-accent" aria-hidden="true">{idx + 1}</div>
                  <div className={`${CARD} p-6`}>
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mb-3">
                      <h3 className="text-t1 font-semibold text-lg">{week.title}</h3>
                      <span className="text-caption text-accent font-mono">{week.label}</span>
                    </div>
                    <ul className="space-y-2">
                      {week.milestones.map((m) => (
                        <li key={m} className="text-sm text-t2 leading-relaxed flex gap-2">
                          <span className="text-t3 shrink-0 mt-0.5">[ ]</span><span>{m}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>Success criteria</h2>
          <div className={`${CARD} p-6`}>
            <ul className="space-y-3">
              {successCriteria.map((c) => (
                <li key={c} className="flex gap-3 text-sm text-t1 leading-relaxed">
                  <span className="text-accent shrink-0 mt-0.5">[ ]</span><span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>Pilot deliverables</h2>
          <div className={`${CARD} overflow-hidden`}>
            <table className="w-full text-sm">
              <thead className="bg-raised"><tr>
                <th className={TH}>Artifact</th>
                <th className={`${TH} w-1/3`}>Target week</th>
              </tr></thead>
              <tbody>
                {deliverables.map((d, i) => (
                  <tr key={d.artifact} className={i > 0 ? 'border-t border-border-base' : ''}>
                    <td className="px-5 py-3 text-t1">{d.artifact}</td>
                    <td className="px-5 py-3 text-t2 font-mono text-caption">{d.targetWeek}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>Risk register</h2>
          <div className={`${CARD} overflow-hidden`}>
            <table className="w-full text-sm">
              <thead className="bg-raised"><tr>
                <th className={TH}>Risk</th>
                <th className={TH}>Mitigation</th>
                <th className={`${TH} w-32`}>Owner</th>
              </tr></thead>
              <tbody>
                {risks.map((r, i) => (
                  <tr key={r.risk} className={i > 0 ? 'border-t border-border-base' : ''}>
                    <td className="px-5 py-3 text-t1 align-top">{r.risk}</td>
                    <td className="px-5 py-3 text-t2 align-top">{r.mitigation}</td>
                    <td className="px-5 py-3 text-t2 align-top font-mono text-caption">{r.owner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>Weekly status</h2>
          <div className="rounded-xl border border-dashed border-border-em bg-surface/50 p-8 text-center">
            <p className="text-t2 text-sm">No updates yet. Check back after Week 1.</p>
            <p className="text-caption text-t3 mt-2">Status updates will be posted here every Friday by the PushCI pilot lead.</p>
          </div>
        </section>

        <section className="rounded-2xl border border-border-em bg-surface p-8 sm:p-10">
          <h2 className="text-2xl font-bold text-t1">Contact the pilot team</h2>
          <p className="mt-3 text-t2 max-w-xl">For scope changes, invoicing, incident escalation, or Norlys internal questions, use the contacts below.</p>
          <div className="mt-5">
            <div className="rounded-lg border border-border-base bg-raised p-4">
              <div className="text-caption text-t3 uppercase tracking-wider">Pilot lead</div>
              <div className="text-sm text-t1 font-medium mt-1">pilot-norlys@pushci.dev</div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <a href="mailto:pilot-norlys@pushci.dev" className={`rounded-lg bg-accent px-5 py-2.5 text-body font-semibold text-root ${btnGesturePrimary}`}>Email pilot lead</a>
            <Link to="/enterprise" className={`rounded-lg border border-border-em bg-raised px-5 py-2.5 text-body font-medium text-t1 hover:bg-border-base ${btnGestureSubtle}`}>Enterprise overview</Link>
          </div>
        </section>

        <p className="mt-10 text-caption text-t3 text-center max-w-2xl mx-auto leading-relaxed">
          Confidential — for Norlys evaluation only. Distribution outside Norlys requires PushCI written consent.
        </p>
      </div>
      </main>

      <Footer />
    </div>
  )
}
