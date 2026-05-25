import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { useDocumentMeta } from '../components/useDocumentMeta'

export default function SecurityPage() {
  useDocumentMeta({
    title: 'Security — PushCI',
    description: 'PushCI security policy, responsible disclosure, and contact information.',
    canonical: 'https://pushci.dev/security',
  })

  return (
    <div className="min-h-screen bg-root">
      <Navbar />
      <div className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-3xl font-bold text-t1 mb-2">Security</h1>
        <p className="text-t3 text-sm mb-10">Last updated: April 2026</p>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-t1 mb-3">Reporting a vulnerability</h2>
          <p className="text-t2 leading-relaxed mb-4">
            If you discover a security vulnerability in PushCI — the CLI, the Cloudflare Workers API,
            the dashboard, or any published package — please report it privately before public disclosure.
          </p>
          <div className="rounded-xl border border-border-base bg-surface p-5">
            <p className="text-t1 font-semibold mb-1">Contact</p>
            <a href="mailto:security@pushci.dev" className="text-accent underline text-sm">
              security@pushci.dev
            </a>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-t1 mb-3">What to include</h2>
          <ul className="list-disc list-inside text-t2 space-y-1 text-sm leading-relaxed">
            <li>A description of the vulnerability and its potential impact</li>
            <li>Steps to reproduce or a proof-of-concept</li>
            <li>Affected version(s) and platform(s)</li>
            <li>Your contact details for follow-up</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-t1 mb-3">Our commitments</h2>
          <ul className="list-disc list-inside text-t2 space-y-1 text-sm leading-relaxed">
            <li>Acknowledge your report within 48 hours</li>
            <li>Provide a timeline for a fix within 5 business days</li>
            <li>Patch critical and high-severity issues within 14 days</li>
            <li>Credit researchers in release notes (unless you prefer anonymity)</li>
            <li>Not pursue legal action against good-faith reporters</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-t1 mb-3">Scope</h2>
          <p className="text-t2 text-sm leading-relaxed mb-3">In scope:</p>
          <ul className="list-disc list-inside text-t2 space-y-1 text-sm leading-relaxed mb-4">
            <li>pushci CLI (<code className="font-mono text-xs bg-raised px-1 rounded">npm i -g pushci</code>)</li>
            <li>Cloudflare Workers API at <code className="font-mono text-xs bg-raised px-1 rounded">api.pushci.dev</code></li>
            <li>Dashboard at <code className="font-mono text-xs bg-raised px-1 rounded">app.pushci.dev</code></li>
            <li>MCP server (<code className="font-mono text-xs bg-raised px-1 rounded">pushci mcp</code>)</li>
          </ul>
          <p className="text-t2 text-sm leading-relaxed mb-3">Out of scope:</p>
          <ul className="list-disc list-inside text-t2 space-y-1 text-sm leading-relaxed">
            <li>Social engineering or phishing attacks</li>
            <li>Attacks requiring physical access</li>
            <li>Issues in third-party services (Lemon Squeezy, Cloudflare, GitHub)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-t1 mb-3">Security practices</h2>
          <ul className="list-disc list-inside text-t2 space-y-1 text-sm leading-relaxed">
            <li>Secrets encrypted with AES-256-GCM, machine-bound keys</li>
            <li>CLI binary scanned with govulncheck and gosec on every push</li>
            <li>Dependencies audited via gitleaks on every push</li>
            <li>SARIF security scan built into every pipeline via <code className="font-mono text-xs bg-raised px-1 rounded">pushci scan</code></li>
          </ul>
        </section>
      </div>
      <Footer />
    </div>
  )
}
