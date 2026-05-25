'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, Gift, Mail } from 'lucide-react';
import type { ReferralData } from './referral-helpers';
import {
  REFERRAL_MILESTONES, buildReferralLink, buildInviteMessage, buildSocialShareText,
} from './referral-helpers';

export function ReferralSection() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedState, setCopiedState] = useState<'link' | 'message' | null>(null);

  useEffect(() => {
    async function fetchReferral() {
      try {
        const res = await fetch('/api/proxy/user/referral');
        if (res.ok) { setData(await res.json()); }
      } catch { /* non-critical */ } finally { setLoading(false); }
    }
    fetchReferral();
  }, []);

  async function handleCopy() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(buildReferralLink(data.referralCode));
      setCopiedState('link');
      setTimeout(() => setCopiedState(null), 2000);
    } catch { /* Clipboard API may not be available */ }
  }

  async function handleCopyMessage() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(buildInviteMessage(buildReferralLink(data.referralCode)));
      setCopiedState('message');
      setTimeout(() => setCopiedState(null), 2000);
    } catch { /* Clipboard API may not be available */ }
  }

  if (loading) {
    return (
      <div className="rounded border border-border bg-panel/30 p-6">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-600 border-t-info" />
          <span className="text-sm text-text-secondary">Loading referral info...</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const referralLink = buildReferralLink(data.referralCode);
  const inviteMessage = buildInviteMessage(referralLink);
  const socialShareText = buildSocialShareText(referralLink);
  const nextMilestone = REFERRAL_MILESTONES.find((m) => m.count > data.referredCount) ?? null;
  const progressPercent = nextMilestone ? Math.min(100, (data.referredCount / nextMilestone.count) * 100) : 100;
  const mailtoHref = `mailto:?subject=${encodeURIComponent('Try OpenSyber')}&body=${encodeURIComponent(inviteMessage)}`;
  const xShareHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(socialShareText)}`;
  const linkedInShareHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`;

  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      <ReferralHeader />
      <ProgressCard nextMilestone={nextMilestone} data={data} progressPercent={progressPercent} />
      <LinkCopyRow referralLink={referralLink} copiedState={copiedState} onCopy={handleCopy} />
      <ActionButtons copiedState={copiedState} onCopyMessage={handleCopyMessage} mailtoHref={mailtoHref} />
      <SocialShareButtons xShareHref={xShareHref} linkedInShareHref={linkedInShareHref} />
      <InvitePreview inviteMessage={inviteMessage} />
      <ReferralStats referredCount={data.referredCount} creditsEarned={data.creditsEarned} />
    </div>
  );
}

function ReferralHeader() {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface">
        <Gift className="h-4 w-4 text-text-primary" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-neutral-100">Referral Program</h3>
        <p className="text-sm text-text-secondary">Earn free months by referring friends to OpenSyber</p>
      </div>
    </div>
  );
}

function ProgressCard({ nextMilestone, data, progressPercent }: {
  nextMilestone: { count: number; reward: string } | null; data: ReferralData; progressPercent: number;
}) {
  return (
    <div className="mb-4 rounded border border-info/20 bg-info/5 p-4">
      <div className="mb-2 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-neutral-100">Referral momentum</p>
          <p className="text-xs text-text-secondary">
            {nextMilestone
              ? `${nextMilestone.count - data.referredCount} more referral${nextMilestone.count - data.referredCount === 1 ? '' : 's'} to unlock ${nextMilestone.reward}.`
              : 'Top milestone unlocked. Keep sharing to stack more credits.'}
          </p>
        </div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-info">
          {nextMilestone ? `Next: ${nextMilestone.reward}` : 'Top tier'}
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface">
        <div className="h-full rounded-full bg-gradient-to-r from-info to-cyan-400 transition-all" style={{ width: `${progressPercent}%` }} />
      </div>
    </div>
  );
}

function LinkCopyRow({ referralLink, copiedState, onCopy }: {
  referralLink: string; copiedState: 'link' | 'message' | null; onCopy: () => void;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="flex-1 overflow-hidden rounded-lg border border-wire bg-surface/50 px-3 py-2">
        <p className="truncate text-sm text-text-primary">{referralLink}</p>
      </div>
      <button onClick={onCopy} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-wire transition hover:bg-surface" aria-label="Copy referral link">
        {copiedState === 'link' ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4 text-text-secondary" />}
      </button>
    </div>
  );
}

function ActionButtons({ copiedState, onCopyMessage, mailtoHref }: {
  copiedState: 'link' | 'message' | null; onCopyMessage: () => void; mailtoHref: string;
}) {
  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-2">
      <button onClick={onCopyMessage} className="inline-flex items-center justify-center gap-2 rounded-lg border border-wire px-3 py-2 text-sm text-neutral-200 transition hover:bg-surface">
        {copiedState === 'message' ? <><Check className="h-4 w-4 text-green-400" />Copied invite text</> : <><Copy className="h-4 w-4 text-text-secondary" />Copy invite text</>}
      </button>
      <a href={mailtoHref} className="inline-flex items-center justify-center gap-2 rounded-lg border border-wire px-3 py-2 text-sm text-neutral-200 transition hover:bg-surface">
        <Mail className="h-4 w-4 text-text-secondary" />Share by email
      </a>
    </div>
  );
}

function SocialShareButtons({ xShareHref, linkedInShareHref }: { xShareHref: string; linkedInShareHref: string }) {
  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-2">
      <a href={xShareHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg border border-wire px-3 py-2 text-sm text-neutral-200 transition hover:bg-surface">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">X</span>Share on X
      </a>
      <a href={linkedInShareHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg border border-wire px-3 py-2 text-sm text-neutral-200 transition hover:bg-surface">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">in</span>Share on LinkedIn
      </a>
    </div>
  );
}

function InvitePreview({ inviteMessage }: { inviteMessage: string }) {
  return (
    <div className="mb-4 rounded-lg border border-border bg-void/60 p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-text-dim">Suggested invite</p>
      <p className="whitespace-pre-line text-sm leading-6 text-text-primary">{inviteMessage}</p>
    </div>
  );
}

function ReferralStats({ referredCount, creditsEarned }: { referredCount: number; creditsEarned: number }) {
  return (
    <div className="flex gap-6">
      <div>
        <p className="text-2xl font-semibold text-neutral-100">{referredCount}</p>
        <p className="text-xs text-text-dim">users referred</p>
      </div>
      <div>
        <p className="text-2xl font-semibold text-neutral-100">{creditsEarned}</p>
        <p className="text-xs text-text-dim">months earned</p>
      </div>
    </div>
  );
}
