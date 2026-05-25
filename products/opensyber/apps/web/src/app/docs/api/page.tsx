import { API_BASE_URL } from '@/lib/api-config';

export default function ApiDocsPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide tracking-tight">API Reference</h1>
      <p className="text-lg text-text-secondary mt-2">
        All public and authenticated endpoints with examples.
      </p>

      <hr className="border-border my-8" />

      <h2 className="text-2xl font-semibold">Base URL</h2>
      <div className="rounded bg-surface/50 p-4 mt-2">
        <code className="text-sm text-text-primary">{API_BASE_URL}</code>
      </div>

      <h2 className="text-2xl font-semibold mt-8">Authentication</h2>
      <p className="text-text-secondary">
        Authenticated endpoints require a Bearer JWT token in the Authorization header.
      </p>
      <div className="rounded bg-surface/50 p-4 mt-2">
        <code className="text-sm text-text-primary">Authorization: Bearer {'<jwt-token>'}</code>
      </div>

      <hr className="border-border my-8" />

      <h2 className="text-2xl font-semibold">Public Endpoints</h2>

      <h3 className="text-lg font-semibold mt-6 text-green-400">GET /health</h3>
      <p className="text-text-secondary text-sm">Returns API health status.</p>
      <div className="rounded bg-surface/50 p-4 mt-2">
        <code className="text-sm text-text-primary whitespace-pre">{`curl ${API_BASE_URL}/health

# Response: { "status": "healthy" }`}</code>
      </div>

      <h3 className="text-lg font-semibold mt-6 text-green-400">GET /api/skills</h3>
      <p className="text-text-secondary text-sm">List all published skills in the marketplace.</p>

      <h3 className="text-lg font-semibold mt-6 text-green-400">GET /api/badges/:instanceId/security-score</h3>
      <p className="text-text-secondary text-sm">Returns an SVG badge with the instance&apos;s security score.</p>
      <div className="rounded bg-surface/50 p-4 mt-2">
        <code className="text-sm text-text-primary whitespace-pre">{`curl ${API_BASE_URL}/api/badges/inst_1/security-score
# Response: SVG image (Content-Type: image/svg+xml)`}</code>
      </div>

      <h3 className="text-lg font-semibold mt-6 text-green-400">GET /api/badges/:instanceId/security-score.json</h3>
      <p className="text-text-secondary text-sm">Returns shields.io-compatible JSON for badge embedding.</p>

      <hr className="border-border my-8" />

      <h2 className="text-2xl font-semibold">Authenticated Endpoints</h2>

      <h3 className="text-lg font-semibold mt-6 text-signal">GET /api/user</h3>
      <p className="text-text-secondary text-sm">Returns the authenticated user&apos;s profile.</p>

      <h3 className="text-lg font-semibold mt-6 text-signal">GET /api/user/onboarding</h3>
      <p className="text-text-secondary text-sm">Returns computed onboarding progress.</p>

      <h3 className="text-lg font-semibold mt-6 text-signal">PATCH /api/user/onboarding</h3>
      <p className="text-text-secondary text-sm">Mark a step complete or dismiss the checklist.</p>
      <div className="rounded bg-surface/50 p-4 mt-2">
        <code className="text-sm text-text-primary whitespace-pre">{`# Mark a step complete
curl -X PATCH -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"step": "reviewSecurity"}' \\
  /api/user/onboarding

# Dismiss the checklist
curl -X PATCH -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"dismiss": true}' \\
  /api/user/onboarding`}</code>
      </div>

      <h3 className="text-lg font-semibold mt-6 text-signal">GET /api/user/referral</h3>
      <p className="text-text-secondary text-sm">Returns referral code, referred count, and credits earned.</p>

      <h3 className="text-lg font-semibold mt-6 text-signal">GET /api/instances</h3>
      <p className="text-text-secondary text-sm">List user&apos;s agent instances.</p>

      <h3 className="text-lg font-semibold mt-6 text-signal">POST /api/instances</h3>
      <p className="text-text-secondary text-sm">Deploy a new agent instance.</p>

      <h3 className="text-lg font-semibold mt-6 text-signal">GET /api/instances/:id</h3>
      <p className="text-text-secondary text-sm">Get instance details, health metrics, and skills.</p>

      <h3 className="text-lg font-semibold mt-6 text-signal">DELETE /api/instances/:id</h3>
      <p className="text-text-secondary text-sm">Destroy an agent instance.</p>

      <h3 className="text-lg font-semibold mt-6 text-signal">POST /api/instances/:id/skills/:skillId</h3>
      <p className="text-text-secondary text-sm">Install a skill on an instance.</p>

      <h3 className="text-lg font-semibold mt-6 text-signal">DELETE /api/instances/:id/skills/:skillId</h3>
      <p className="text-text-secondary text-sm">Uninstall a skill from an instance.</p>

      <h3 className="text-lg font-semibold mt-6 text-signal">GET /api/security/instances/:id/dashboard</h3>
      <p className="text-text-secondary text-sm">Security dashboard with score, events, and categories.</p>

      <h3 className="text-lg font-semibold mt-6 text-signal">GET /api/security/instances/:id/alerts</h3>
      <p className="text-text-secondary text-sm">List security alerts for an instance.</p>

      <h3 className="text-lg font-semibold mt-6 text-signal">GET /api/security/instances/:id/incidents</h3>
      <p className="text-text-secondary text-sm">List security incidents for an instance.</p>

      <hr className="border-border my-8" />

      <h2 className="text-2xl font-semibold">Webhooks</h2>

      <h3 className="text-lg font-semibold mt-6 text-yellow-400">POST /webhooks/auth</h3>
      <p className="text-text-secondary text-sm">
        Auth webhook endpoint for user lifecycle events (created, updated, deleted).
        Requires HMAC signature verification.
      </p>

      <h3 className="text-lg font-semibold mt-6 text-yellow-400">POST /webhooks/lemonsqueezy</h3>
      <p className="text-text-secondary text-sm">
        LemonSqueezy webhook for subscription events (created, updated, cancelled, expired).
        Requires HMAC signature verification.
      </p>
    </article>
  );
}
