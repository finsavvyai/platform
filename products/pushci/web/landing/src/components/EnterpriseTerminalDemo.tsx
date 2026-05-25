import { useEffect, useState, useCallback } from 'react'

type Line = { text: string; delay: number; style?: string }

const scenarios: Record<string, { title: string; subtitle: string; lines: Line[] }> = {
  sso: {
    title: 'SSO + SCIM in 90 seconds',
    subtitle: 'Connect Okta, provision users, enforce SSO-only login.',
    lines: [
      { text: '$ pushci sso setup --provider okta', delay: 0, style: 'text-t1' },
      { text: '', delay: 300 },
      { text: '→ Fetching tenant metadata...', delay: 500, style: 'text-t3' },
      { text: '  ✓ SAML 2.0 / OIDC endpoints resolved', delay: 1100, style: 'text-accent' },
      { text: '  ✓ Signing certificate imported', delay: 1500, style: 'text-accent' },
      { text: '  ✓ Attribute mapping: email, groups, roles', delay: 1900, style: 'text-accent' },
      { text: '', delay: 2100 },
      { text: '$ pushci scim enable --enforce', delay: 2400, style: 'text-t1' },
      { text: '  ✓ SCIM 2.0 endpoint armed at https://api.pushci.dev/scim/v2', delay: 3000, style: 'text-accent' },
      { text: '  ✓ Provisioning token rotated (valid 90d)', delay: 3400, style: 'text-accent' },
      { text: '  ⚠ SSO-only login: enforced for acme.com', delay: 3800, style: 'text-amber-400' },
      { text: '', delay: 4000 },
      { text: '$ pushci audit tail --actor=alice@acme.com', delay: 4300, style: 'text-t1' },
      { text: '18:02  sso.login       alice@acme.com  ip=10.0.3.14', delay: 4800, style: 'text-t2' },
      { text: '18:02  scim.assign     alice@acme.com  group=engineers', delay: 5100, style: 'text-t2' },
      { text: '18:03  run.approve     alice@acme.com  run=r_a1b2c', delay: 5400, style: 'text-t2' },
      { text: '', delay: 5600 },
      { text: '✓ Ready. 420 users provisioned. 0 passwords issued.', delay: 5900, style: 'text-accent' },
    ],
  },
  audit: {
    title: 'Tamper-evident audit export',
    subtitle: 'Stream to SIEM with hash-chain verification.',
    lines: [
      { text: '$ pushci audit export --since=7d --format=siem', delay: 0, style: 'text-t1' },
      { text: '', delay: 300 },
      { text: '→ Streaming 2,847 events to Splunk HEC...', delay: 500, style: 'text-t3' },
      { text: '  ✓ Events signed with HMAC-SHA256 chain', delay: 1200, style: 'text-accent' },
      { text: '  ✓ Prior event hash = 9f3a...c120 (verified)', delay: 1700, style: 'text-accent' },
      { text: '  ✓ Retention pinned: 7 years (compliance)', delay: 2100, style: 'text-accent' },
      { text: '', delay: 2300 },
      { text: '$ pushci audit verify --range=7d', delay: 2600, style: 'text-t1' },
      { text: '  Checking 2,847 events...', delay: 3100, style: 'text-t3' },
      { text: '  ✓ Every event links to prior hash', delay: 3600, style: 'text-accent' },
      { text: '  ✓ No gaps, no replays, no tampering', delay: 4000, style: 'text-accent' },
      { text: '', delay: 4200 },
      { text: '✓ Chain intact. Ready for SOC 2 evidence export.', delay: 4500, style: 'text-accent' },
    ],
  },
  policy: {
    title: 'Policy-as-code + AI scan',
    subtitle: 'Block risky pipelines before they deploy.',
    lines: [
      { text: '$ pushci scan --engine=claude --fail-on=high', delay: 0, style: 'text-t1' },
      { text: '', delay: 300 },
      { text: '→ Analyzing 34 pipelines across 12 repos...', delay: 600, style: 'text-t3' },
      { text: '  ✓ Heuristic rules: 0 blocking issues', delay: 1300, style: 'text-accent' },
      { text: '  ⚠ AI analyzer flagged 2 pipelines:', delay: 1700, style: 'text-amber-400' },
      { text: '      acme/api        unpinned action@master   HIGH', delay: 2100, style: 'text-red-400' },
      { text: '      acme/checkout   secret in plaintext env  HIGH', delay: 2400, style: 'text-red-400' },
      { text: '', delay: 2600 },
      { text: '→ OPA policy: require-pinned-actions', delay: 2900, style: 'text-t3' },
      { text: '  ✗ Blocking deploys until remediated', delay: 3300, style: 'text-red-400' },
      { text: '', delay: 3500 },
      { text: '→ Auto-remediation suggested (review before merge):', delay: 3800, style: 'text-t3' },
      { text: '  patch: pin actions/checkout@v4 → sha a3b9e...', delay: 4200, style: 'text-t2' },
      { text: '  patch: move AWS_KEY to secrets.AWS_KEY', delay: 4500, style: 'text-t2' },
      { text: '', delay: 4700 },
      { text: '✗ Risk score: 72/100 — escalated to #secops Slack', delay: 5000, style: 'text-red-400' },
    ],
  },
  migrate: {
    title: 'Migrate from Jenkins + Gerrit',
    subtitle: 'Import 50 jobs, preserve history, switch cleanly.',
    lines: [
      { text: '$ pushci migrate --from=jenkins --url=$JENKINS_URL', delay: 0, style: 'text-t1' },
      { text: '', delay: 300 },
      { text: '→ Reading 54 Jenkinsfile jobs...', delay: 500, style: 'text-t3' },
      { text: '  ✓ Pipeline DSL parsed (10,342 lines)', delay: 1100, style: 'text-accent' },
      { text: '  ✓ Shared libraries mapped to PushCI skills', delay: 1500, style: 'text-accent' },
      { text: '  ✓ Credentials re-homed to Vault', delay: 1900, style: 'text-accent' },
      { text: '', delay: 2100 },
      { text: '$ pushci migrate --from=gerrit --preserve-history', delay: 2400, style: 'text-t1' },
      { text: '  ✓ 18,902 change-ids imported', delay: 3000, style: 'text-accent' },
      { text: '  ✓ Reviewers + labels preserved', delay: 3400, style: 'text-accent' },
      { text: '  ✓ Verified votes mapped to PushCI approvals', delay: 3800, style: 'text-accent' },
      { text: '', delay: 4000 },
      { text: '→ Dry-run diff ready at /runs/migrate_r8c2', delay: 4300, style: 'text-t3' },
      { text: '✓ Cutover window: 12 min. Zero downtime.', delay: 4600, style: 'text-accent' },
    ],
  },
}

const tabs = [
  { id: 'sso', label: 'SSO + SCIM' },
  { id: 'audit', label: 'Audit & SIEM' },
  { id: 'policy', label: 'Policy + Scan' },
  { id: 'migrate', label: 'Migrate legacy' },
]

export function EnterpriseTerminalDemo() {
  const [active, setActive] = useState('sso')
  const [visible, setVisible] = useState(0)
  const [done, setDone] = useState(false)
  const scenario = scenarios[active]

  const restart = useCallback(() => { setVisible(0); setDone(false) }, [])
  const switchTab = useCallback((id: string) => { setActive(id); setVisible(0); setDone(false) }, [])

  useEffect(() => {
    if (visible >= scenario.lines.length) { setDone(true); return }
    const prev = visible > 0 ? scenario.lines[visible - 1].delay : 0
    const t = setTimeout(() => setVisible(v => v + 1), scenario.lines[visible].delay - prev || 250)
    return () => clearTimeout(t)
  }, [visible, scenario])

  return (
    <div className="relative">
      {/* glow */}
      <div aria-hidden className="absolute -inset-4 rounded-2xl bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.20),transparent_70%)] blur-2xl pointer-events-none" />

      <div className="relative rounded-2xl border border-border-em bg-gradient-to-b from-surface/90 to-root/90 backdrop-blur-xl overflow-hidden shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]">
        {/* tabs */}
        <div className="flex flex-wrap items-center gap-1 border-b border-border-base/60 px-4 py-3">
          <div className="flex items-center gap-1.5 mr-4">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
          </div>
          {tabs.map(t => (
            <button key={t.id} onClick={() => switchTab(t.id)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                active === t.id ? 'bg-accent/15 text-accent' : 'text-t3 hover:text-t2 hover:bg-raised/50'
              }`}
            >{t.label}</button>
          ))}
        </div>

        {/* header */}
        <div className="px-5 sm:px-6 py-4 border-b border-border-base/40">
          <div className="text-sm font-semibold text-t1">{scenario.title}</div>
          <div className="text-xs text-t3 mt-0.5">{scenario.subtitle}</div>
        </div>

        {/* terminal */}
        <div className="p-5 sm:p-6 font-mono text-[13px] leading-6 min-h-[380px] relative">
          {scenario.lines.slice(0, visible).map((line, i) => (
            <div key={`${active}-${i}`} className={line.style || 'text-t3'}>
              {line.text || ' '}
            </div>
          ))}
          {!done && <span className="inline-block w-[7px] h-[14px] bg-t2 cursor-blink ml-0.5" />}
          {done && (
            <button onClick={restart} className="absolute bottom-4 right-4 flex items-center gap-1.5 text-caption text-t3 hover:text-t2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Replay
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
