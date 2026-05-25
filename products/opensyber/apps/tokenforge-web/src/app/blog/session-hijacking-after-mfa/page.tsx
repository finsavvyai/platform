import Link from 'next/link';
import { KeyRound, ArrowLeft, ArrowRight } from 'lucide-react';

export const metadata = {
  title: 'Session Hijacking After MFA: Why Cookies Aren\'t Enough — TokenForge',
  description: 'MFA protects login but not the session. Learn how AiTM attacks bypass MFA and how device-bound sessions stop them.',
};

export default function SessionHijackingPost(): React.ReactElement {
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

      <article className="mx-auto max-w-3xl px-6 pt-36 pb-24 prose-invert">
        <div className="mb-8">
          <span className="rounded-full bg-info/10 px-2.5 py-0.5 text-xs font-medium text-info">
            Security
          </span>
          <span className="ml-3 text-xs text-text-muted">March 22, 2026</span>
        </div>

        <h1 className="font-bold text-3xl sm:text-5xl tracking-tight mb-6 leading-tight">
          Session Hijacking After MFA: Why Cookies Aren&apos;t Enough
        </h1>

        <div className="space-y-6 text-sm text-text-secondary leading-relaxed">
          <p className="text-lg text-text-primary">
            Your app has MFA. Your users complete a second factor every time they log in. You&apos;re safe, right?
          </p>
          <p>
            No. MFA protects the <strong>login</strong>. It does nothing to protect the <strong>session</strong> that comes after. Once a user authenticates and receives a session cookie, that cookie is the sole proof of identity for every subsequent request. Steal the cookie, and you are the user.
          </p>

          <h2 className="text-xl font-semibold text-text-primary pt-4">The AiTM Attack</h2>
          <p>
            Adversary-in-the-Middle (AiTM) phishing has become the dominant attack against MFA-protected applications. The attacker sets up a reverse proxy between the user and the real login page. The user sees the real UI, enters their password, completes MFA — and the proxy captures the session cookie in real time.
          </p>
          <p>
            Microsoft reported that AiTM attacks compromised over 10,000 organizations in 2023 alone. The attack works against any session-cookie-based application, regardless of the MFA method used (TOTP, push notifications, SMS).
          </p>

          <h2 className="text-xl font-semibold text-text-primary pt-4">Why Cookies Are the Problem</h2>
          <p>
            A session cookie is a bearer token. Whoever holds it can use it. There is no cryptographic proof that the request comes from the same device that originally authenticated. Cookies can be:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-text-secondary">
            <li><strong>Stolen via XSS</strong> — a single cross-site scripting vulnerability exposes every session</li>
            <li><strong>Captured by AiTM</strong> — reverse proxy intercepts the cookie during login</li>
            <li><strong>Exfiltrated by malware</strong> — browser info-stealers extract cookies from disk</li>
            <li><strong>Replayed from any device</strong> — no device binding, no way to detect theft</li>
          </ul>

          <h2 className="text-xl font-semibold text-text-primary pt-4">The Fix: Device-Bound Sessions</h2>
          <p>
            The solution is to bind the session to the device that created it. Instead of a simple cookie, every request carries a cryptographic signature proving it comes from the original device.
          </p>
          <p>
            TokenForge generates an ECDSA P-256 key pair in the browser using the Web Crypto API. The private key is marked as <strong>non-extractable</strong> — it cannot be read by JavaScript, exported, or stolen via XSS. Every API request is signed with this key, and the server verifies the signature before processing.
          </p>
          <p>
            A stolen cookie without the matching device key produces an invalid signature. The server blocks the request and logs a security event.
          </p>

          <h2 className="text-xl font-semibold text-text-primary pt-4">What About Google DBSC?</h2>
          <p>
            Google&apos;s Device Bound Session Credentials (DBSC) aims to solve the same problem at the browser level. However, DBSC is Chrome-only, not generally available, and requires browser-level implementation — it&apos;s not something you can add to your app today.
          </p>
          <p>
            TokenForge works in every modern browser (Chrome, Firefox, Safari, Edge) using standard Web Crypto APIs. Add one script tag to your HTML — that&apos;s the entire client integration.
          </p>

          <h2 className="text-xl font-semibold text-text-primary pt-4">How to Get Started</h2>
          <p>Add one script tag to your HTML. That&apos;s it for the client:</p>
          <div className="gradient-border my-4">
            <div className="rounded-2xl bg-panel p-4">
              <pre className="text-xs text-text-secondary overflow-x-auto"><code>{`<script
  src="https://tokenforge-api.opensyber.cloud/sdk.js"
  data-api-key="tf_your_api_key"
></script>`}</code></pre>
            </div>
          </div>
          <p>
            The script auto-generates device keys, binds the session, and signs every fetch() request. On the server, add one line of middleware with your API key to verify every request and calculate a 7-signal trust score. For advanced use cases, the npm package <code className="rounded-lg bg-surface px-1.5 py-0.5 text-xs">@opensyber/tokenforge</code> is also available.
          </p>
        </div>

        <div className="mt-12 gradient-border">
          <div className="rounded-2xl bg-panel p-6">
            <h3 className="text-lg font-semibold mb-2">Stop session hijacking today</h3>
            <p className="text-sm text-text-secondary mb-4">
              Free tier includes 1,000 verifications/month. No credit card required.
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
