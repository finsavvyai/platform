import Head from "next/head";
import Link from "next/link";
import Header from "../components/Header";
import { ShieldCheck, Lock, Eye, Download } from "lucide-react";

export default function ExtensionPage() {
  return (
    <>
      <Head>
        <title>SDLC Guard — Browser extension | SDLC.cc</title>
        <meta
          name="description"
          content="Redact PII locally in ChatGPT, Claude, Gemini, and Copilot before your messages ever leave the browser. Apache-2.0, open source, zero telemetry."
        />
      </Head>
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
            SDLC Guard — PII redaction for AI chat
          </h1>
          <p className="text-slate-600 mb-10">
            Type anything into ChatGPT, Claude, Gemini, or Copilot. Emails,
            SSNs, credit cards, API keys, and JWTs get redacted locally in
            your browser — before the keystroke ever leaves for the provider.
          </p>

          <section className="space-y-6 mb-10">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-3">
                <ShieldCheck className="h-6 w-6 text-[#0a84ff]" />
                <h2 className="text-xl font-semibold text-slate-900">
                  What it catches
                </h2>
              </div>
              <ul className="text-slate-700 list-disc pl-6 space-y-1">
                <li>Email addresses, US phone numbers, IPv4 addresses</li>
                <li>US Social Security numbers (area-code sanity-checked)</li>
                <li>Credit cards (Luhn-validated)</li>
                <li>AWS access keys (AKIA / ASIA prefix)</li>
                <li>Generic API keys (sk-, ghp_, xoxb-, github_pat_)</li>
                <li>JWT tokens</li>
              </ul>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-3">
                <Lock className="h-6 w-6 text-[#0a84ff]" />
                <h2 className="text-xl font-semibold text-slate-900">
                  Privacy by design
                </h2>
              </div>
              <p className="text-slate-700">
                All scanning runs in your browser. The extension never
                transmits the redacted values anywhere. If you configure an
                SDLC API key, only an audit event with per-entity counts
                (e.g. <code>{`{"EMAIL": 1, "SSN": 1}`}</code>) and a
                hostname leaves your machine — never the message body.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-3">
                <Eye className="h-6 w-6 text-[#0a84ff]" />
                <h2 className="text-xl font-semibold text-slate-900">
                  Three policies
                </h2>
              </div>
              <ul className="text-slate-700 space-y-2">
                <li>
                  <strong>Strict</strong> — redact and surface an inline toast warning.
                </li>
                <li>
                  <strong>Balanced</strong> — redact silently (default).
                </li>
                <li>
                  <strong>Permissive</strong> — audit only, no redaction. Use for staging.
                </li>
              </ul>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <Download className="h-6 w-6 text-[#0a84ff]" />
              <h2 className="text-xl font-semibold text-slate-900">Install</h2>
            </div>
            <p className="text-slate-700 mb-4">
              Chrome Web Store submission is in review. In the meantime you
              can sideload the build from source in under a minute:
            </p>
            <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 overflow-x-auto text-sm">
{`git clone https://github.com/finsavvyai/sdlc-platform
cd sdlc-platform/sdlc-extension
npm install && npm run build
# Then: chrome://extensions → Developer mode → Load unpacked → dist/`}
            </pre>
            <p className="text-slate-600 text-sm mt-4">
              Source:{" "}
              <Link
                href="https://github.com/finsavvyai/sdlc-platform/tree/main/sdlc-extension"
                className="text-[#0a84ff] hover:underline"
              >
                github.com/finsavvyai/sdlc-platform/tree/main/sdlc-extension
              </Link>
              . Privacy policy:{" "}
              <Link
                href="https://github.com/finsavvyai/sdlc-platform/blob/main/sdlc-extension/PRIVACY.md"
                className="text-[#0a84ff] hover:underline"
              >
                PRIVACY.md
              </Link>
              .
            </p>
          </section>
        </main>
      </div>
    </>
  );
}
