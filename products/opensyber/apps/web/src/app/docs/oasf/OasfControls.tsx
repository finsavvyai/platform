const categories = [
  {
    name: 'Identity & Access',
    color: '#4D9EFF',
    controls: [
      { id: '01', name: 'Agent Authentication', desc: 'Every agent must authenticate with a verifiable identity before executing any operation.' },
      { id: '02', name: 'Credential Isolation', desc: 'Credentials are stored in encrypted vaults and never exposed to agent runtime memory.' },
      { id: '03', name: 'Session Binding', desc: 'Sessions are cryptographically bound to the originating device using ECDSA P-256 keypairs.' },
      { id: '04', name: 'Access Scoping', desc: 'Agent permissions are scoped to the minimum required resources with explicit allow-lists.' },
    ],
  },
  {
    name: 'Runtime Security',
    color: '#00E5C3',
    controls: [
      { id: '05', name: 'Container Hardening', desc: 'Agent containers run with read-only filesystems, no-new-privileges, and seccomp profiles.' },
      { id: '06', name: 'Network Policy', desc: 'Outbound network access is restricted to explicitly allowed domains and ports.' },
      { id: '07', name: 'File System Protection', desc: 'Sensitive host paths are blocked and filesystem writes are confined to designated volumes.' },
      { id: '08', name: 'Process Isolation', desc: 'Each agent runs in an isolated process namespace with resource limits enforced.' },
    ],
  },
  {
    name: 'Data Protection',
    color: '#FFB347',
    controls: [
      { id: '09', name: 'Secret Encryption', desc: 'All secrets are encrypted at rest and in transit using AES-256-GCM with per-tenant keys.' },
      { id: '10', name: 'Audit Logging', desc: 'Every agent action, API call, and data access is logged with tamper-evident integrity.' },
      { id: '11', name: 'Data Minimization', desc: 'Agents only receive the data they need; PII is tokenized before reaching agent context.' },
      { id: '12', name: 'Output Filtering', desc: 'Agent outputs are scanned for secrets, PII, and prompt injection before delivery.' },
    ],
  },
  {
    name: 'Governance',
    color: '#E8F0F8',
    controls: [
      { id: '13', name: 'Skill Verification', desc: 'All marketplace skills undergo code review, dependency audit, and sandbox testing.' },
      { id: '14', name: 'Policy Enforcement', desc: 'Organization-wide policies are enforced at the gateway layer before agent execution.' },
      { id: '15', name: 'Compliance Reporting', desc: 'Automated compliance reports map controls to SOC 2, ISO 27001, and GDPR requirements.' },
    ],
  },
];

export function OasfControls() {
  return (
    <div className="space-y-10">
      {categories.map((cat) => (
        <section key={cat.name}>
          <h2
            className="font-[family-name:var(--font-display)] text-2xl tracking-wide mb-4"
            style={{ color: cat.color }}
          >
            {cat.name}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {cat.controls.map((c) => (
              <div
                key={c.id}
                className="brand-card rounded border border-border bg-panel p-5"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className="font-[family-name:var(--font-mono)] text-[11px] font-bold rounded px-2 py-0.5"
                    style={{ color: cat.color, backgroundColor: `${cat.color}15` }}
                  >
                    {c.id}
                  </span>
                  <h3 className="text-sm font-semibold text-text-primary">{c.name}</h3>
                </div>
                <p className="text-[13px] text-text-secondary leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
