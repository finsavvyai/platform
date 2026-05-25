import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { Shield, ExternalLink, FileText } from 'lucide-react';
import { transparencyLogEntries } from './data';

export const metadata: Metadata = {
  title: 'Skill Transparency Log | OpenSyber',
  description:
    'Every skill version is cryptographically signed. Verify any ECDSA P-256 signature independently.',
  openGraph: {
    title: 'Skill Transparency Log | OpenSyber',
    description:
      'Sigstore-style transparency log for cryptographically signed skill packages.',
    type: 'website',
  },
};

/** Truncate a SHA-256 hash to first 12 + last 4 chars for display. */
function truncateHash(hash: string): string {
  return `${hash.slice(0, 12)}...${hash.slice(-4)}`;
}

/** Format an ISO date string to a human-readable date. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function TransparencyLogPage() {
  return (
    <div className="min-h-screen bg-void text-text-primary">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-6 pt-36 pb-20">
        {/* Hero */}
        <div className="text-center mb-20">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal mb-5">
            Supply Chain Security
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-6xl uppercase tracking-wide mb-5">
            Skill Transparency Log
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Every skill version is cryptographically signed with ECDSA P-256.
            Verify any signature independently.
          </p>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-border bg-panel overflow-hidden mb-12">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-5 py-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-text-dim">
                    Skill
                  </th>
                  <th className="px-5 py-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-text-dim">
                    Version
                  </th>
                  <th className="px-5 py-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-text-dim">
                    SHA-256
                  </th>
                  <th className="px-5 py-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-text-dim">
                    Signed
                  </th>
                  <th className="px-5 py-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-text-dim">
                    SBOM
                  </th>
                  <th className="px-5 py-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-text-dim">
                    Reviewed
                  </th>
                </tr>
              </thead>
              <tbody>
                {transparencyLogEntries.map((entry) => (
                  <tr
                    key={`${entry.skillSlug}-${entry.version}`}
                    className="border-b border-border/50 last:border-b-0 hover:bg-surface/30 transition-colors"
                  >
                    <td className="px-5 py-4 font-medium text-white">
                      {entry.skillName}
                    </td>
                    <td className="px-5 py-4 font-[family-name:var(--font-mono)] text-xs text-text-secondary">
                      v{entry.version}
                    </td>
                    <td className="px-5 py-4">
                      <code className="rounded bg-surface px-2 py-1 font-[family-name:var(--font-mono)] text-xs text-text-secondary">
                        {truncateHash(entry.sha256)}
                      </code>
                    </td>
                    <td className="px-5 py-4">
                      <SignatureBadge verified={entry.verified} />
                    </td>
                    <td className="px-5 py-4">
                      {entry.sbomUrl ? (
                        <a
                          href={entry.sbomUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-signal hover:text-signal-hover"
                        >
                          <FileText className="h-3 w-3" />
                          View
                        </a>
                      ) : (
                        <span className="text-xs text-text-dim">--</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-text-secondary">
                      {formatDate(entry.reviewedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Related links */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/security/detection"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-panel/50 backdrop-blur-sm px-6 py-3 font-[family-name:var(--font-mono)] text-sm uppercase tracking-wider text-signal hover:border-signal/30 hover:bg-signal/5 transition-all duration-300"
          >
            <Shield className="h-4 w-4" />
            Detection Architecture
          </Link>
          <Link
            href="/docs/skills"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-panel/50 backdrop-blur-sm px-6 py-3 font-[family-name:var(--font-mono)] text-sm uppercase tracking-wider text-signal hover:border-signal/30 hover:bg-signal/5 transition-all duration-300"
          >
            <ExternalLink className="h-4 w-4" />
            Skill Docs
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Verified / Unverified signature status badge. */
function SignatureBadge({ verified }: { verified: boolean }) {
  if (verified) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-400">
        <Shield className="h-3 w-3" />
        Verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400">
      Unverified
    </span>
  );
}
