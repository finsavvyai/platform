'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check, Copy, ExternalLink, Shield } from 'lucide-react';
import { ShareButtons } from '@/components/ShareButtons';

interface Props {
  instanceId: string;
  instanceName: string;
}

function buildShareText(instanceName: string) {
  return `My AI agent "${instanceName}" has a live OpenSyber trust page.`;
}

function buildCaption(instanceName: string, scoreUrl: string) {
  return [
    `We publish a live OpenSyber trust page for ${instanceName} so customers and teammates can see our current agent security posture.`,
    '',
    `View the trust page: ${scoreUrl}`,
  ].join('\n');
}

export function ScorecardShareCard({ instanceId, instanceName }: Props) {
  const [copied, setCopied] = useState(false);
  const scoreUrl = `/trust/${instanceId}`;

  async function handleCopyCaption() {
    try {
      const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${scoreUrl}` : scoreUrl;
      await navigator.clipboard.writeText(buildCaption(instanceName, fullUrl));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available.
    }
  }

  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface">
          <Shield className="h-4 w-4 text-text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-neutral-100">Public Scorecard</h3>
          <p className="text-sm text-text-secondary">
            Turn your security posture into a public trust asset you can share externally.
          </p>
        </div>
      </div>

      <div className="mb-4 rounded border border-emerald-500/15 bg-emerald-500/5 p-4">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300">Best for</p>
        <p className="mt-2 text-sm leading-6 text-text-primary">
          Sales follow-ups, customer trust pages, launch posts, and internal “look what we shipped” updates.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={scoreUrl}
          target="_blank"
          className="inline-flex items-center gap-2 rounded-lg border border-wire px-3 py-2 text-sm text-neutral-200 transition hover:bg-surface"
        >
          <ExternalLink className="h-4 w-4 text-text-secondary" />
          Open public trust page
        </Link>
        <button
          onClick={handleCopyCaption}
          className="inline-flex items-center gap-2 rounded-lg border border-wire px-3 py-2 text-sm text-neutral-200 transition hover:bg-surface"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-green-400" />
              Copied launch caption
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 text-text-secondary" />
              Copy launch caption
            </>
          )}
        </button>
      </div>

      <div className="mb-4 rounded-lg border border-border bg-void/60 p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-text-dim">Suggested caption</p>
        <p className="whitespace-pre-line text-sm leading-6 text-text-primary">
          {buildCaption(instanceName, typeof window !== 'undefined' ? `${window.location.origin}${scoreUrl}` : scoreUrl)}
        </p>
      </div>

      <ShareButtons url={scoreUrl} text={buildShareText(instanceName)} title="Security Scorecard" />
    </div>
  );
}
