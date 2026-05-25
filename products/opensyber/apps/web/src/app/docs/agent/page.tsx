export default function AgentDocsPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide tracking-tight">Agent Architecture</h1>
      <p className="text-lg text-text-secondary mt-2">
        How OpenSyber deploys and manages AI agent instances.
      </p>

      <hr className="border-border my-8" />

      <h2 className="text-2xl font-semibold">Instance Lifecycle</h2>
      <p className="text-text-secondary">
        Each agent runs in an isolated Docker container on a hardened VM. The lifecycle follows
        these stages: <strong className="text-white">provisioning</strong> &rarr;{' '}
        <strong className="text-white">configuring</strong> &rarr;{' '}
        <strong className="text-white">ready</strong> &rarr;{' '}
        <strong className="text-white">running</strong>.
      </p>

      <h2 className="text-2xl font-semibold mt-8">Security Hardening</h2>
      <ul className="space-y-2 text-text-secondary">
        <li><strong className="text-white">Read-only root filesystem</strong> — Prevents tampering with system binaries</li>
        <li><strong className="text-white">Deny-by-default firewall</strong> — Only explicitly allowed ports are open</li>
        <li><strong className="text-white">Loopback-only gateway</strong> — The agent gateway binds to 127.0.0.1, not 0.0.0.0</li>
        <li><strong className="text-white">AES-256 credential vault</strong> — API keys and tokens stored encrypted at rest</li>
        <li><strong className="text-white">Auto-patching</strong> — Same-day CVE patches applied automatically</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8">Health Reporting</h2>
      <p className="text-text-secondary">
        Agents report health metrics every 30 seconds: CPU usage, memory consumption, disk utilization,
        and active connections. These metrics are displayed on the dashboard and used for alerting.
      </p>

      <h2 className="text-2xl font-semibold mt-8">Environment Variables</h2>
      <p className="text-text-secondary">
        Agents support environment variables for configuration. Sensitive values like API keys should
        use the credential vault instead of plain environment variables.
      </p>
      <div className="rounded bg-surface/50 p-4 mt-4">
        <code className="text-sm text-text-primary whitespace-pre">{`OPENSYBER_INSTANCE_ID=inst_abc123
OPENSYBER_REGION=eu-central-1
OPENSYBER_LOG_LEVEL=info`}</code>
      </div>

      <h2 className="text-2xl font-semibold mt-8">Updates</h2>
      <p className="text-text-secondary">
        Agent updates are rolling — your instance is updated without downtime. Critical security
        patches are applied within hours of disclosure. You can view patch history in the audit logs.
      </p>
    </article>
  );
}
