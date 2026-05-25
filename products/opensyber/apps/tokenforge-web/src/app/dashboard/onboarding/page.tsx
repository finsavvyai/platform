'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { Copy, Check, ArrowRight } from 'lucide-react';
import { useApiKey } from '@/lib/use-api';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://tokenforge-api.opensyber.cloud';

export default function OnboardingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const sessionApiKey = useApiKey();
  const [copied, setCopied] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  const apiKey = sessionApiKey ?? null;

  const scriptTag = apiKey
    ? `<script src="${API}/sdk.js" data-api-key="${apiKey}"></script>`
    : '<script src="' + API + '/sdk.js" data-api-key="YOUR_KEY"></script>';

  async function copy(text: string, which: 'key' | 'script'): Promise<void> {
    await navigator.clipboard.writeText(text);
    if (which === 'key') { setCopied(true); setTimeout(() => setCopied(false), 2000); }
    else { setCopiedScript(true); setTimeout(() => setCopiedScript(false), 2000); }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Welcome to TokenForge</h1>
      <p className="text-sm text-text-secondary mb-8">
        {session?.user?.name ? `Hi ${session.user.name}! ` : ''}Two steps to protect your app.
      </p>

      <div className="space-y-6">
        {/* Step 1 */}
        <div className="rounded-2xl border border-info/30 bg-info/5 p-6">
          <h2 className="font-semibold mb-3">Step 1 — Your API Key</h2>
          {apiKey ? (
            <div>
              <p className="text-sm text-amber-400 mb-2">Copy now — shown only once.</p>
              <div className="flex items-center gap-2 rounded-lg bg-void p-3">
                <code className="flex-1 break-all font-mono text-xs text-green-400">{apiKey}</code>
                <button type="button" onClick={() => copy(apiKey, 'key')} className="rounded p-1.5 text-text-secondary hover:text-white">
                  {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-secondary">
              Your key will appear here after sign-in. Or generate one in{' '}
              <Link href="/dashboard/settings" className="text-info hover:text-signal-hover">Settings</Link>.
            </p>
          )}
        </div>

        {/* Step 2 */}
        <div className="rounded-2xl border border-info/30 bg-info/5 p-6">
          <h2 className="font-semibold mb-3">Step 2 — Add to your HTML</h2>
          <p className="text-sm text-text-secondary mb-3">Paste in your &lt;head&gt;:</p>
          <div className="rounded-lg bg-void p-4 mb-3">
            <pre className="text-xs text-text-secondary overflow-x-auto"><code>{scriptTag}</code></pre>
          </div>
          <button type="button" onClick={() => copy(scriptTag, 'script')} className="text-xs text-info hover:text-signal-hover">
            {copiedScript ? 'Copied!' : 'Copy script tag'}
          </button>
        </div>

        {/* Done */}
        <div className="rounded-2xl border border-ok/30 bg-ok/5 p-6 text-center">
          <h2 className="font-semibold mb-2">That&apos;s it. You&apos;re protected.</h2>
          <p className="text-sm text-text-secondary mb-4">
            Sessions are now device-bound. Check your dashboard for live stats.
          </p>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center gap-2 rounded-lg bg-info px-5 py-2.5 text-sm font-medium hover:brightness-110 transition"
          >
            Go to Dashboard <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
