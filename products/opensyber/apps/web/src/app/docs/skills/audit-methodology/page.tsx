import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Skill Audit Methodology | OpenSyber',
  description: 'How OpenSyber reviews and verifies marketplace skills through a 4-stage security pipeline.',
};

const SCORING_TABLE = [
  { severity: 'Critical', deduction: -30, example: 'Root filesystem access, known malicious patterns' },
  { severity: 'High', deduction: -15, example: 'Missing manifest fields, wildcard network domains' },
  { severity: 'Medium', deduction: -5, example: 'Excessive permissions, oversized packages' },
  { severity: 'Low', deduction: -2, example: 'Missing author metadata, minor style issues' },
];

export default function AuditMethodologyPage() {
  return (
    <main className="min-h-screen bg-void text-neutral-200">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <p className="text-sm font-medium text-signal mb-4">Marketplace Documentation</p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-white mb-2">Skill Audit Methodology</h1>
        <p className="text-sm text-text-secondary mb-12">
          Every skill submitted to the OpenSyber marketplace passes through an automated
          4-stage security pipeline before it can be installed by any user.
        </p>

        <section className="space-y-10 text-sm leading-relaxed">
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">Pipeline Overview</h2>
            <p className="mb-4">
              Our scanner runs automatically when a skill is submitted. Skills must pass
              all stages with a score of 70 or above and have zero critical or high
              findings to be approved.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <StageCard number={1} title="Manifest Validation" color="purple" />
              <StageCard number={2} title="Network Permission Audit" color="cyan" />
              <StageCard number={3} title="Source Code Scan" color="purple" />
              <StageCard number={4} title="Sandbox Testing" color="cyan" />
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">Stage 1: Manifest Validation</h2>
            <p className="mb-3">
              Every skill must include a valid manifest with required metadata. The scanner
              checks:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Required fields</strong> — name, slug, version, entrypoint, author</li>
              <li><strong>Slug format</strong> — lowercase alphanumeric with hyphens (e.g. <code className="text-signal">my-skill-name</code>)</li>
              <li><strong>Version format</strong> — strict semver (MAJOR.MINOR.PATCH)</li>
              <li><strong>Entrypoint</strong> — must reference an existing file in the package</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">Stage 2: Network Permission Audit</h2>
            <p className="mb-3">
              Skills that request network access are subject to domain-level scrutiny:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Domain limit</strong> — maximum 10 network domains per skill</li>
              <li><strong>Wildcard detection</strong> — wildcard domains (e.g. <code className="text-signal">*.example.com</code>) are flagged as high severity</li>
              <li><strong>Known exfiltration domains</strong> — checked against our threat intelligence feed</li>
              <li><strong>Excessive scope</strong> — requesting more domains than the skill&apos;s functionality warrants</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">Stage 3: Source Code Scan</h2>
            <p className="mb-3">
              Static analysis powered by our supply-chain security engine scans for:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Environment scanning</strong> — patterns that enumerate or exfiltrate environment variables</li>
              <li><strong>Credential access</strong> — attempts to read SSH keys, tokens, or auth files</li>
              <li><strong>Shell injection</strong> — unsafe use of <code className="text-signal">exec</code>, <code className="text-signal">spawn</code>, or template literals in commands</li>
              <li><strong>Dependency risks</strong> — postinstall scripts, known malicious packages</li>
              <li><strong>Package size</strong> — maximum 5MB per skill package</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">Stage 4: Sandbox Testing</h2>
            <p className="mb-3">
              Skills that pass stages 1–3 are executed in an isolated sandbox environment:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Isolated container</strong> — runs in a seccomp-profiled container with no network access to production</li>
              <li><strong>Permission enforcement</strong> — only declared permissions are granted</li>
              <li><strong>Behavior monitoring</strong> — filesystem access, network calls, and process spawning are logged</li>
              <li><strong>Resource limits</strong> — CPU, memory, and execution time are capped</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">Scoring System</h2>
            <p className="mb-4">
              Each skill starts at 100 points. Findings deduct points based on severity.
              Skills must score 70+ with no critical or high findings to be approved.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-wire">
                    <th className="py-2 pr-4 font-semibold text-white">Severity</th>
                    <th className="py-2 pr-4 font-semibold text-white">Deduction</th>
                    <th className="py-2 font-semibold text-white">Example</th>
                  </tr>
                </thead>
                <tbody>
                  {SCORING_TABLE.map((row) => (
                    <tr key={row.severity} className="border-b border-border">
                      <td className="py-2 pr-4 font-medium">{row.severity}</td>
                      <td className="py-2 pr-4 text-red-400">{row.deduction}</td>
                      <td className="py-2 text-text-secondary">{row.example}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">Approval Criteria</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Score of <strong>70 or above</strong> after all deductions</li>
              <li><strong>Zero</strong> critical findings</li>
              <li><strong>Zero</strong> high findings</li>
              <li>All declared permissions must have a legitimate use case</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">Questions?</h2>
            <p>
              If you have questions about the audit process or need help fixing findings,
              contact us at{' '}
              <a href="mailto:marketplace@opensyber.cloud" className="text-signal hover:text-signal-hover">
                marketplace@opensyber.cloud
              </a>.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function StageCard({ number, title, color }: { number: number; title: string; color: string }) {
  const bg = color === 'purple' ? 'bg-purple-500/10 border-purple-500/30' : 'bg-cyan-500/10 border-cyan-500/30';
  const numBg = color === 'purple' ? 'bg-purple-500' : 'bg-cyan-500';
  return (
    <div className={`rounded border p-4 ${bg}`}>
      <div className="flex items-center gap-3">
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white ${numBg}`}>
          {number}
        </span>
        <span className="font-medium text-white">{title}</span>
      </div>
    </div>
  );
}
