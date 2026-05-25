import Link from 'next/link';

export const metadata = {
  title: 'Webhooks — TokenForge Docs',
  description:
    'Receive real-time session.bound, session.verified, and trust-score events on any HTTPS endpoint.',
};

const NODE_SAMPLE = `// Node.js / Hono
import { verifyWebhookSignature } from '@opensyber/tokenforge/webhooks';

app.post('/webhooks/tokenforge', async (c) => {
  const rawBody = await c.req.text();
  const ok = await verifyWebhookSignature({
    body: rawBody,
    signatureHeader: c.req.header('X-TF-Signature') ?? '',
    timestampHeader: c.req.header('X-TF-Timestamp') ?? '',
    secret: process.env.TOKENFORGE_WEBHOOK_SECRET!,
  });
  if (!ok) return c.json({ error: 'bad_signature' }, 401);

  const event = JSON.parse(rawBody);
  // event.event: 'session.bound' | 'session.verified' | ...
  // event.data: { userId, sessionId, deviceId, trustScore, ... }
  return c.json({ received: true });
});`;

const PYTHON_SAMPLE = `# Python / Flask
import hmac, hashlib, time
from flask import request, jsonify

SECRET = os.environ['TOKENFORGE_WEBHOOK_SECRET']

@app.route('/webhooks/tokenforge', methods=['POST'])
def receive():
    sig_header = request.headers.get('X-TF-Signature', '')
    ts = request.headers.get('X-TF-Timestamp', '')
    raw = request.get_data()

    if abs(time.time() - _parse_iso8601(ts)) > 300:
        return jsonify(error='stale_timestamp'), 401

    signed = f"{ts}.{raw.decode()}".encode()
    expected = hmac.new(SECRET.encode(), signed, hashlib.sha256).hexdigest()

    ok = any(hmac.compare_digest(entry.split(',', 1)[1], expected)
             for entry in sig_header.split()
             if entry.startswith('v1,'))
    if not ok:
        return jsonify(error='bad_signature'), 401

    event = request.get_json()
    return jsonify(received=True)`;

const GO_SAMPLE = `// Go / net/http
func receive(w http.ResponseWriter, r *http.Request) {
    sigHeader := r.Header.Get("X-TF-Signature")
    ts := r.Header.Get("X-TF-Timestamp")
    body, _ := io.ReadAll(r.Body)

    parsed, _ := time.Parse(time.RFC3339Nano, ts)
    if time.Since(parsed).Abs() > 5*time.Minute {
        http.Error(w, "stale_timestamp", 401); return
    }

    mac := hmac.New(sha256.New, []byte(os.Getenv("TOKENFORGE_WEBHOOK_SECRET")))
    mac.Write([]byte(ts + "." + string(body)))
    expected := hex.EncodeToString(mac.Sum(nil))

    ok := false
    for _, entry := range strings.Fields(sigHeader) {
        parts := strings.SplitN(entry, ",", 2)
        if len(parts) == 2 && parts[0] == "v1" &&
           hmac.Equal([]byte(parts[1]), []byte(expected)) {
            ok = true; break
        }
    }
    if !ok { http.Error(w, "bad_signature", 401); return }
    w.WriteHeader(200)
}`;

export default function WebhooksDocsPage(): React.ReactElement {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-text-primary">
      <h1 className="mb-2 text-3xl font-bold">Webhooks</h1>
      <p className="mb-8 text-text-secondary">
        TokenForge POSTs JSON events to any HTTPS endpoint you register in{' '}
        <Link href="/dashboard/settings" className="text-info hover:text-signal-hover">
          Dashboard → Settings
        </Link>
        . Every delivery is HMAC-SHA256 signed and timestamp-bound so replays
        past a 5-minute window are rejected by any correctly-implemented
        receiver.
      </p>

      <h2 className="mt-8 mb-3 text-xl font-semibold">Event types</h2>
      <ul className="mb-6 space-y-1 text-sm">
        <li><code className="text-info">session.bound</code> — first device-bound session issued for a user.</li>
        <li><code className="text-info">session.verified</code> — a subsequent request on that session passed signature + trust-score checks.</li>
        <li><code className="text-info">session.revoked</code> — user or admin revoked the session.</li>
        <li><code className="text-info">trust_score.degraded</code> — score crossed 70 → 40 threshold.</li>
        <li><code className="text-info">trust_score.critical</code> — score dropped below 40 (consider step-up / block).</li>
        <li><code className="text-info">session.hijack_attempt</code> — signature mismatch or known-bad replay attempt.</li>
        <li><code className="text-info">webhook.test</code> — synthetic event from the &ldquo;Send test event&rdquo; button.</li>
      </ul>

      <h2 className="mt-8 mb-3 text-xl font-semibold">Request headers</h2>
      <div className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[520px] text-sm">
          <tbody>
            <tr className="border-b border-border"><td className="py-2 pr-4 font-mono text-info">X-TF-Signature</td><td className="py-2 text-text-secondary">One or more <code>v1,&lt;hex&gt;</code> entries separated by spaces. During secret rotation the dispatcher signs with both the current and previous secret for 24h — match either one.</td></tr>
            <tr className="border-b border-border"><td className="py-2 pr-4 font-mono text-info">X-TF-Timestamp</td><td className="py-2 text-text-secondary">ISO-8601 instant the dispatcher built the payload. Reject if more than 5 minutes away from your server clock.</td></tr>
            <tr className="border-b border-border"><td className="py-2 pr-4 font-mono text-info">X-TF-Event</td><td className="py-2 text-text-secondary">Convenience copy of <code>body.event</code> for quick routing.</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-info">X-TF-Delivery-Id</td><td className="py-2 text-text-secondary">Per-attempt UUID. Use it as an idempotency key — the same event can be retried up to 4 times with different delivery IDs.</td></tr>
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 mb-3 text-xl font-semibold">Signature scheme</h2>
      <p className="mb-3 text-sm text-text-secondary">
        Compute <code className="font-mono text-info">HMAC-SHA256(secret, timestamp + &quot;.&quot; + rawBody)</code>{' '}
        and compare the hex digest against each <code>v1,&lt;hex&gt;</code> entry in the header.
        <strong className="ml-1 text-text-primary">Always use constant-time comparison</strong> — don&apos;t short-circuit on the first byte.
      </p>
      <p className="mb-6 text-sm text-text-secondary">
        The <code className="font-mono">@opensyber/tokenforge/webhooks</code> npm export does all of this for you, including the 5-minute freshness check and dual-secret acceptance during rotation.
      </p>

      <h2 className="mt-8 mb-3 text-xl font-semibold">Retries</h2>
      <p className="mb-6 text-sm text-text-secondary">
        TokenForge retries any 4xx (except 401/403) or 5xx response up to 4 times with 1s/4s/15s backoff. A 2xx response marks the delivery complete immediately. Endpoints that can&apos;t respond within 5 seconds are treated as failures and retried.
      </p>

      <h2 className="mt-8 mb-3 text-xl font-semibold">Code samples</h2>
      <h3 className="mb-2 text-sm font-medium text-text-secondary">Node.js (recommended)</h3>
      <pre className="mb-4 overflow-x-auto rounded-lg border border-border bg-void p-4 text-xs"><code>{NODE_SAMPLE}</code></pre>
      <h3 className="mb-2 text-sm font-medium text-text-secondary">Python</h3>
      <pre className="mb-4 overflow-x-auto rounded-lg border border-border bg-void p-4 text-xs"><code>{PYTHON_SAMPLE}</code></pre>
      <h3 className="mb-2 text-sm font-medium text-text-secondary">Go</h3>
      <pre className="mb-6 overflow-x-auto rounded-lg border border-border bg-void p-4 text-xs"><code>{GO_SAMPLE}</code></pre>

      <h2 className="mt-8 mb-3 text-xl font-semibold">Testing</h2>
      <p className="text-sm text-text-secondary">
        Use the <strong>Send test event</strong> button next to each webhook in{' '}
        <Link href="/dashboard/settings" className="text-info hover:text-signal-hover">Dashboard → Settings</Link>{' '}
        to POST a synthetic <code>webhook.test</code> event to your endpoint without waiting for a real session bind.
      </p>
    </div>
  );
}
