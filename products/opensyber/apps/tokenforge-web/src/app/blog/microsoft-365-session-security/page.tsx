import Link from 'next/link';
import { KeyRound, ArrowLeft, ArrowRight } from 'lucide-react';

export const metadata = {
  title: 'Protecting Microsoft 365 SSO Sessions with Device Binding — TokenForge',
  description: 'Add cryptographic session protection to apps using Microsoft Entra ID SSO. Prevent token theft after authentication.',
};

function Code({ children }: { children: string }): React.ReactElement {
  return (
    <div className="gradient-border my-4">
      <div className="rounded-2xl bg-panel p-4">
        <pre className="text-xs text-text-secondary overflow-x-auto leading-relaxed">
          <code>{children}</code>
        </pre>
      </div>
    </div>
  );
}

export default function M365Post(): React.ReactElement {
  return (
    <div className="min-h-screen bg-void">
      <header className="border-b border-border/50">
        <div className="mx-auto max-w-3xl flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-info" />
            <span className="text-lg font-bold">TokenForge</span>
          </Link>
          <Link href="/blog" className="text-sm text-text-secondary hover:text-text-primary transition">
            <ArrowLeft className="h-3 w-3 inline mr-1" />Blog
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 pt-36 pb-24">
        <div className="mb-8">
          <span className="rounded-full bg-info/10 px-2.5 py-0.5 text-xs font-medium text-info">
            Integration
          </span>
          <span className="ml-3 text-xs text-text-muted">March 22, 2026</span>
        </div>

        <h1 className="font-bold text-3xl sm:text-5xl tracking-tight mb-6 leading-tight">
          Protecting Microsoft 365 SSO Sessions with Device Binding
        </h1>

        <div className="space-y-6 text-sm text-text-secondary leading-relaxed">
          <p className="text-lg text-text-primary">
            Your app uses Microsoft Entra ID (Azure AD) for SSO. Users sign in with their corporate Microsoft account. But after SSO completes, the session cookie is a bearer token anyone can steal. Here&apos;s how to fix that.
          </p>

          <h2 className="text-xl font-semibold text-text-primary pt-4">The Problem with Microsoft SSO Sessions</h2>
          <p>
            Microsoft Entra ID handles authentication. After the OAuth flow completes, your app receives tokens (access token, ID token, refresh token) and creates a session. This session is typically stored as an HTTP cookie.
          </p>
          <p>
            The issue: <strong>Microsoft secures the login. You secure the session.</strong> If an attacker steals the session cookie (via AiTM, XSS, or malware), they bypass all of Microsoft&apos;s security — MFA, Conditional Access, device compliance — because those checks only run during authentication, not on every request.
          </p>

          <h2 className="text-xl font-semibold text-text-primary pt-4">How TokenForge Fits In</h2>
          <p>
            TokenForge adds a device-binding layer <strong>after</strong> Microsoft SSO completes. The flow becomes:
          </p>
          <ol className="list-decimal pl-6 space-y-3 text-text-secondary">
            <li>User clicks &quot;Sign in with Microsoft&quot; → Microsoft Entra ID handles auth + MFA</li>
            <li>Your app receives tokens, creates a session cookie</li>
            <li><strong>TokenForge binds the session to the device</strong> — generates ECDSA key pair, registers public key with the server</li>
            <li>Every subsequent request is signed with the device key</li>
            <li>Server verifies signature + calculates trust score on every request</li>
          </ol>

          <h2 className="text-xl font-semibold text-text-primary pt-4">Integration: Next.js + MSAL + TokenForge</h2>
          <p>
            If you&apos;re using <code className="rounded-lg bg-surface px-1.5 py-0.5 text-xs">@azure/msal-react</code> or <code className="rounded-lg bg-surface px-1.5 py-0.5 text-xs">next-auth</code> with the Azure AD provider, here&apos;s how to add TokenForge:
          </p>

          <h3 className="text-lg font-medium text-text-primary pt-2">Step 1: Add the script tag</h3>
          <p>One line in your HTML. Auto-binds the device after Microsoft SSO completes:</p>
          <Code>{`<script
  src="https://tokenforge-api.opensyber.cloud/sdk.js"
  data-api-key="tf_your_api_key"
></script>`}</Code>

          <h3 className="text-lg font-medium text-text-primary pt-2">Step 2: Add server middleware</h3>
          <Code>{`npm install @opensyber/tokenforge

// Express
import { tokenForgeMiddleware } from '@opensyber/tokenforge/express';
app.use(tokenForgeMiddleware({ apiKey: process.env.TOKENFORGE_API_KEY! }));

// Next.js
import { withTokenForge } from '@opensyber/tokenforge/nextjs';
export const GET = withTokenForge(handler, { apiKey: process.env.TOKENFORGE_API_KEY! });`}</Code>

          <h3 className="text-lg font-medium text-text-primary pt-2">Advanced: MSAL integration (optional)</h3>
          <p>For deeper control with <code className="rounded-lg bg-surface px-1.5 py-0.5 text-xs">@azure/msal-react</code>, use the npm package:</p>
          <Code>{`npm install @opensyber/tokenforge

// app/providers.tsx
import { createTokenForge } from '@opensyber/tokenforge/client';
import { useEffect } from 'react';
import { useSession } from 'next-auth/react'; // or useMsal()

const tf = createTokenForge({ apiBase: '/api' });

export function TokenForgeInit() {
  const { data: session } = useSession();
  useEffect(() => {
    if (session?.user) tf.init();
  }, [session]);
  return null;
}`}</Code>

          <h2 className="text-xl font-semibold text-text-primary pt-4">Integration: Power Automate + Logic Apps</h2>
          <p>
            For Microsoft 365 flows (Power Automate, Logic Apps) that call your API, the service-to-service pattern is different. These calls use app-only tokens, not user sessions. TokenForge protects <strong>user-facing sessions</strong>, not service-to-service calls.
          </p>
          <p>
            The recommended approach:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-text-secondary">
            <li><strong>User-facing web app</strong> → TokenForge device binding (full protection)</li>
            <li><strong>Power Automate → your API</strong> → validate the app-only token + IP allowlist (no device binding needed)</li>
            <li><strong>Teams tab / Outlook add-in</strong> → TokenForge works inside the embedded browser (WebView supports Web Crypto API)</li>
          </ul>

          <h2 className="text-xl font-semibold text-text-primary pt-4">What You Get</h2>
          <ul className="list-disc pl-6 space-y-2 text-text-secondary">
            <li>AiTM attacks that steal Microsoft SSO cookies are blocked — signature mismatch</li>
            <li>XSS token theft is neutralized — private keys are non-extractable</li>
            <li>Trust score dashboard shows anomalies (IP change, geo mismatch, fingerprint drift)</li>
            <li>Step-up auth triggers re-verification for sensitive operations</li>
            <li>Audit logs for compliance (SOC2, ISO 27001 session security controls)</li>
          </ul>

          <h2 className="text-xl font-semibold text-text-primary pt-4">Microsoft Conditional Access + TokenForge</h2>
          <p>
            Microsoft Conditional Access evaluates device compliance, location, and risk <strong>at login time</strong>. TokenForge evaluates trust <strong>on every request</strong>. They complement each other:
          </p>
          <div className="gradient-border my-4">
            <div className="overflow-x-auto rounded-2xl bg-panel p-4">
              <table className="w-full min-w-[480px] text-xs">
                <thead>
                  <tr className="text-text-muted">
                    <th className="text-left py-2">Check</th>
                    <th className="text-center py-2">Conditional Access</th>
                    <th className="text-center py-2">TokenForge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 text-text-secondary">
                  <tr><td className="py-2">When</td><td className="text-center">Login only</td><td className="text-center">Every request</td></tr>
                  <tr><td className="py-2">Device check</td><td className="text-center">Intune compliance</td><td className="text-center">Crypto key binding</td></tr>
                  <tr><td className="py-2">IP/Geo</td><td className="text-center">At login</td><td className="text-center">Continuous</td></tr>
                  <tr><td className="py-2">Session theft</td><td className="text-center">Not detected</td><td className="text-center">Blocked</td></tr>
                  <tr><td className="py-2">Step-up</td><td className="text-center">MFA prompt</td><td className="text-center">TOTP/passkey/email</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="mt-12 gradient-border">
          <div className="rounded-2xl bg-panel p-6">
            <h3 className="text-lg font-semibold mb-2">Add device binding to your Microsoft SSO app</h3>
            <p className="text-sm text-text-secondary mb-4">
              Free tier includes 1,000 verifications/month. Works with any Microsoft auth flow.
            </p>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-lg bg-info text-void px-8 py-4 text-sm font-medium glow-info hover:brightness-110 transition"
            >
              Get Started Free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}
