export default function SecurityDocsPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide tracking-tight">Security Features</h1>
      <p className="text-lg text-text-secondary mt-2">
        Comprehensive security monitoring for your AI agents.
      </p>

      <hr className="border-border my-8" />

      <h2 className="text-2xl font-semibold">Security Score</h2>
      <p className="text-text-secondary">
        Every instance has a security score (0-100) computed from 7 categories. The score updates
        daily and historical trends are available on the security dashboard.
      </p>

      <h3 className="text-xl font-semibold mt-6">Score Categories</h3>
      <div className="not-prose overflow-hidden rounded border border-border mt-4">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"><table className="w-full">
          <thead>
            <tr className="border-b border-border bg-panel/50">
              <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Category</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">What It Measures</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800 text-sm text-text-primary">
            <tr><td className="px-4 py-3">Gateway Binding</td><td className="px-4 py-3">Whether the agent gateway binds to loopback only</td></tr>
            <tr><td className="px-4 py-3">Credential Storage</td><td className="px-4 py-3">Encryption of API keys and tokens at rest</td></tr>
            <tr><td className="px-4 py-3">Docker Isolation</td><td className="px-4 py-3">Read-only root, resource limits, namespace isolation</td></tr>
            <tr><td className="px-4 py-3">Skill Verification</td><td className="px-4 py-3">Percentage of installed skills that are verified</td></tr>
            <tr><td className="px-4 py-3">Firewall Rules</td><td className="px-4 py-3">Deny-by-default firewall with explicit allowlists</td></tr>
            <tr><td className="px-4 py-3">Auto-Patching</td><td className="px-4 py-3">Timeliness of security patch application</td></tr>
            <tr><td className="px-4 py-3">Audit Logging</td><td className="px-4 py-3">Completeness of command and file access logging</td></tr>
          </tbody>
        </table></div>
      </div>

      <h2 className="text-2xl font-semibold mt-8">Policies</h2>
      <p className="text-text-secondary">
        Security policies define rules for your agent&apos;s behavior. Create policies to restrict
        file access patterns, network connections, or skill permissions. Policies can be set to
        &quot;monitor&quot; (log only) or &quot;enforce&quot; (block violations).
      </p>

      <h2 className="text-2xl font-semibold mt-8">Alerts &amp; Incidents</h2>
      <p className="text-text-secondary">
        Configure alert rules to receive notifications when security events occur. Alerts can trigger
        on specific event types, severity levels, or patterns. When an alert fires, it creates an
        incident that can be investigated and resolved through the dashboard.
      </p>

      <h2 className="text-2xl font-semibold mt-8">Compliance Frameworks</h2>
      <p className="text-text-secondary">
        Track compliance against industry frameworks including SOC 2, ISO 27001, and NIST CSF.
        The compliance dashboard shows which controls are satisfied, partially met, or missing.
      </p>

      <h2 className="text-2xl font-semibold mt-8">File Integrity Monitoring</h2>
      <p className="text-text-secondary">
        FIM tracks changes to critical system files and configuration. Any unauthorized modification
        triggers an alert and is logged in the audit trail.
      </p>

      <h2 className="text-2xl font-semibold mt-8">Network Monitoring</h2>
      <p className="text-text-secondary">
        Real-time visibility into network connections made by your agent. Track outbound connections,
        blocked requests, and bandwidth usage. The threat map shows geographic distribution of
        connection attempts.
      </p>

      <h2 className="text-2xl font-semibold mt-8">Vulnerability Scanning</h2>
      <p className="text-text-secondary">
        Automated scanning of your agent&apos;s dependencies and runtime environment for known
        vulnerabilities (CVEs). Critical vulnerabilities are auto-patched; others are surfaced
        with remediation guidance.
      </p>
    </article>
  );
}
