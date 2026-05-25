import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { CodeBlock } from '@/components/dashboard/CodeBlock';

export const metadata = {
  title: 'SIEM Integration — TokenForge',
  description: 'Forward TokenForge security events to Splunk, Microsoft Sentinel, Elastic, Datadog, or any SIEM.',
};

const payloadExample = `{
  "source": "tokenforge",
  "version": "1.0",
  "timestamp": "2026-03-22T15:30:00.000Z",
  "severity": 9,
  "severityLabel": "critical",
  "category": "session_security",
  "tenantId": "tenant_abc",
  "ruleName": "Hijack Detection",
  "event": {
    "type": "session.hijack_attempt",
    "reason": "nonce_replay",
    "trustScore": 12,
    "deviceId": "dk_8f3a2b1c",
    "ip": "198.51.100.42",
    "country": "RU"
  },
  "cef": "CEF:0|OpenSyber|TokenForge|1.0|session.hijack_attempt|nonce_replay|9|src=198.51.100.42 dvc=dk_8f3a2b1c cs1=tenant_abc cs1Label=tenantId cn1=12 cn1Label=trustScore"
}`;

const splunkCode = `# Splunk HTTP Event Collector
# 1. In Splunk: Settings → Data Inputs → HTTP Event Collector → New Token
# 2. Copy the token
# 3. In TokenForge Dashboard → Alerts → Create Rule:
#    Channel: Webhook
#    URL: https://your-splunk:8088/services/collector/event
#    (Add HEC token as query param or use Splunk's auto-auth)`;

const sentinelCode = `# Microsoft Sentinel (Log Analytics)
# 1. Azure Portal → Log Analytics Workspace → Agents → Data Collection
# 2. Create a Data Collection Endpoint
# 3. In TokenForge Dashboard → Alerts → Create Rule:
#    Channel: Webhook
#    URL: https://<workspace-id>.ods.opinsights.azure.com/api/logs?api-version=2016-04-01
#
# The payload includes CEF format in the "cef" field for automatic parsing.`;

const elasticCode = `# Elastic / Kibana
# 1. Create an index: PUT /tokenforge-events
# 2. In TokenForge Dashboard → Alerts → Create Rule:
#    Channel: Webhook
#    URL: https://elastic.company.com:9200/tokenforge-events/_doc
#
# Events are JSON — Elastic auto-maps all fields.`;

const datadogCode = `# Datadog
# 1. Get your API key from Datadog → Organization Settings → API Keys
# 2. In TokenForge Dashboard → Alerts → Create Rule:
#    Channel: Webhook
#    URL: https://http-intake.logs.datadoghq.com/api/v2/logs
#    (Include DD-API-KEY header via custom webhook config)`;

const trellixCode = `# Trellix (formerly McAfee/FireEye) — Helix
# 1. In Trellix Helix: Admin → Data Sources → Add Source → HTTP/JSON
# 2. Create an API connector with your Helix endpoint URL
# 3. In TokenForge Dashboard → Alerts → Create Rule:
#    Channel: Webhook
#    URL: https://<helix-instance>.helix.apps.fireeye.com/api/v1/alerts
#
# The "cef" field in each event is auto-parsed by Helix.
# Map severity levels: 9=Critical, 7-8=High, 5=Medium, 3=Low`;

const cyrebroCode = `# Cyrebro SOC Platform
# 1. Contact your Cyrebro SOC team to set up a webhook data source
# 2. They will provide an ingest URL like:
#    https://ingest.cyrebro.io/api/v1/events/<your-org-id>
# 3. In TokenForge Dashboard → Alerts → Create Rule:
#    Channel: Webhook
#    URL: https://ingest.cyrebro.io/api/v1/events/<your-org-id>
#
# Cyrebro auto-parses CEF format from the "cef" field.
# Events appear in your Cyrebro dashboard under "Session Security" category.
# Severity mapping aligns with Cyrebro's alert levels automatically.`;

interface GuideProps { title: string; code: string }

function Guide({ title, code }: GuideProps): React.ReactElement {
  return (
    <div className="gradient-border">
      <div className="rounded-2xl bg-panel p-6">
        <h3 className="text-lg font-semibold mb-3">{title}</h3>
        <CodeBlock code={code} language="bash" />
      </div>
    </div>
  );
}

export default function SiemPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-void">
      <header className="border-b border-border/50">
        <div className="mx-auto max-w-4xl flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-info" />
            <span className="text-lg font-bold">TokenForge</span>
          </Link>
          <Link href="/docs" className="text-sm text-text-secondary hover:text-text-primary transition">
            Docs
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 pt-36 pb-24">
        <span className="font-[family-name:var(--font-mono)] text-[11px] text-info uppercase tracking-[0.2em] mb-5 block">
          SIEM
        </span>
        <h1 className="font-bold text-3xl sm:text-5xl tracking-tight mb-2">SIEM Integration</h1>
        <p className="text-text-secondary mb-10">
          Forward TokenForge security events to your SOC/SIEM.
          Events include CEF format for automatic parsing.
        </p>

        <div className="mb-10 gradient-border">
          <div className="rounded-2xl bg-panel p-6">
            <h2 className="text-lg font-semibold mb-3">Event Payload Format</h2>
            <p className="text-sm text-text-secondary mb-4">
              Every webhook alert includes structured fields plus a CEF string for SIEM compatibility:
            </p>
            <CodeBlock code={payloadExample} language="json" />
          </div>
        </div>

        <h2 className="text-xl font-semibold mb-4">Platform Guides</h2>
        <div className="space-y-6">
          <Guide title="Splunk" code={splunkCode} />
          <Guide title="Microsoft Sentinel" code={sentinelCode} />
          <Guide title="Elastic / Kibana" code={elasticCode} />
          <Guide title="Datadog" code={datadogCode} />
          <Guide title="Trellix (McAfee/FireEye)" code={trellixCode} />
          <Guide title="Cyrebro SOC" code={cyrebroCode} />
        </div>

        <div className="mt-10 gradient-border">
          <div className="rounded-2xl bg-panel p-6">
            <h2 className="text-lg font-semibold mb-2">Any other SIEM</h2>
            <p className="text-sm text-text-secondary">
              TokenForge webhooks POST JSON to any HTTPS endpoint.
              The <code className="rounded-lg bg-surface px-1.5 py-0.5 text-xs">cef</code> field
              contains a CEF-formatted string that most SIEMs auto-parse.
              Set up a webhook alert rule in <Link href="/dashboard/alerts" className="text-info hover:text-signal-hover">Dashboard → Alerts</Link> and
              point it at your SIEM&apos;s HTTP ingest endpoint.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
