'use client';

import { Shield } from 'lucide-react';

interface SkillSignatureBadgeProps {
  /** Whether the ECDSA P-256 signature has been verified. */
  verified: boolean;
  /** Skill version string, e.g. "1.2.0". */
  version: string;
  /** Whether an SBOM artifact is attached. */
  hasSbom: boolean;
  /** ISO date string of when the skill was reviewed. */
  reviewedAt: string | null;
}

/** Format an ISO date string to a short month + year. */
function formatReviewDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Compact signature verification badge for skill detail views.
 *
 * Displays verification status, version, SBOM presence, and review date
 * in a single inline indicator.
 */
export function SkillSignatureBadge({
  verified,
  version,
  hasSbom,
  reviewedAt,
}: SkillSignatureBadgeProps) {
  if (verified) {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs text-green-400">
        <Shield className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium">Signature verified</span>
        <Separator />
        <span>v{version}</span>
        {hasSbom && (
          <>
            <Separator />
            <span>SBOM attached</span>
          </>
        )}
        {reviewedAt && (
          <>
            <Separator />
            <span>Reviewed {formatReviewDate(reviewedAt)}</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 text-xs text-amber-400">
      <Shield className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="font-medium">Signature unverified</span>
      <Separator />
      <span>v{version}</span>
    </div>
  );
}

/** Visual dot separator between badge segments. */
function Separator() {
  return (
    <span className="text-text-dim" aria-hidden="true">
      &middot;
    </span>
  );
}
