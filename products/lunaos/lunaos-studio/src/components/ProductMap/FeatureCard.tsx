/**
 * FeatureCard — individual feature card within a workflow column.
 * Shows title, description, status badge, tags, context files,
 * and a "Start Building" button that navigates to the canvas.
 */

import React, { useState } from 'react';
import type { FeatureCardData, CardStatus, ApprovalState } from './types';
import * as S from './styles';

interface FeatureCardProps {
  card: FeatureCardData;
  onStatusChange: (id: string, status: CardStatus) => void;
  onApprovalChange?: (id: string, approval: ApprovalState, note?: string) => void;
}

const STATUS_COLORS: Record<CardStatus, string> = {
  planned: '#a78bfa',
  building: '#fbbf24',
  done: '#34d399',
};

const STATUS_LABELS: Record<CardStatus, string> = {
  planned: 'Planned',
  building: 'Building',
  done: 'Done',
};

const baseActionBtn: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, padding: '2px 8px',
  borderRadius: 999, border: 'none', cursor: 'pointer',
  whiteSpace: 'nowrap',
};
const approveBtn: React.CSSProperties = {
  ...baseActionBtn, background: '#10b98120', color: '#10b981',
};
const rejectBtn: React.CSSProperties = {
  ...baseActionBtn, background: '#ef444420', color: '#ef4444',
};
const reviewBtn: React.CSSProperties = {
  ...baseActionBtn, background: '#94a3b820', color: '#cbd5e1',
};

const APPROVAL_LABELS: Record<ApprovalState, string> = {
  pending_review: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
};

const APPROVAL_COLORS: Record<ApprovalState, string> = {
  pending_review: '#f59e0b',
  approved: '#10b981',
  rejected: '#ef4444',
};

export function FeatureCard({ card, onStatusChange, onApprovalChange }: FeatureCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [noteDraft, setNoteDraft] = useState(card.reviewNote ?? '');
  const approval: ApprovalState = card.approval ?? 'pending_review';

  const handleBuild = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStatusChange(card.id, 'building');
    window.location.hash = '#app';
  };

  const cycleStatus = (e: React.MouseEvent) => {
    e.stopPropagation();
    const order: CardStatus[] = ['planned', 'building', 'done'];
    const currentIdx = card.status ? order.indexOf(card.status) : -1;
    const next = order[(currentIdx + 1) % order.length] ?? order[0]!;
    onStatusChange(card.id, next);
  };

  const handleApprove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onApprovalChange?.(card.id, 'approved');
  };
  const handleReject = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!reviewMode) {
      setReviewMode(true);
      return;
    }
    onApprovalChange?.(card.id, 'rejected', noteDraft);
    setReviewMode(false);
  };
  const handleReview = (e: React.MouseEvent) => {
    e.stopPropagation();
    setReviewMode(!reviewMode);
  };
  const handleResetReview = (e: React.MouseEvent) => {
    e.stopPropagation();
    onApprovalChange?.(card.id, 'pending_review');
  };

  const badgeStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
    border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
    background: `${STATUS_COLORS[card.status]}20`,
    color: STATUS_COLORS[card.status],
  };

  return (
    <div
      style={S.fcCard}
      onClick={() => setExpanded(!expanded)}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      aria-label={`Feature: ${card.title}`}
      onKeyDown={(e) => e.key === 'Enter' && setExpanded(!expanded)}
    >
      <div style={S.fcHeaderRow}>
        <span style={S.fcTitle}>{card.title}</span>
        <button
          style={badgeStyle}
          onClick={cycleStatus}
          aria-label={`Status: ${STATUS_LABELS[card.status]}. Click to cycle.`}
        >
          {STATUS_LABELS[card.status]}
        </button>
      </div>

      {/* Approval row — always visible */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginTop: 8, fontSize: 11,
        }}
      >
        <span
          aria-label={`Approval: ${APPROVAL_LABELS[approval]}`}
          style={{
            fontWeight: 600, padding: '2px 8px', borderRadius: 999,
            background: `${APPROVAL_COLORS[approval]}20`,
            color: APPROVAL_COLORS[approval],
          }}
        >
          {APPROVAL_LABELS[approval]}
        </span>
        {approval === 'pending_review' && (
          <>
            <button
              type="button"
              onClick={handleApprove}
              style={approveBtn}
              aria-label={`Approve ${card.title}`}
            >
              Approve
            </button>
            <button
              type="button"
              onClick={handleReview}
              style={reviewBtn}
              aria-label={`Request review for ${card.title}`}
            >
              Review
            </button>
            <button
              type="button"
              onClick={handleReject}
              style={rejectBtn}
              aria-label={`Reject ${card.title}`}
            >
              Reject
            </button>
          </>
        )}
        {(approval === 'approved' || approval === 'rejected') && (
          <button
            type="button"
            onClick={handleResetReview}
            style={reviewBtn}
            aria-label="Reset approval to pending"
          >
            Reset
          </button>
        )}
      </div>

      {/* Review note editor — visible while in review mode */}
      {reviewMode && (
        <div
          style={{ marginTop: 8 }}
          onClick={(e) => e.stopPropagation()}
        >
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Feedback for the author…"
            aria-label="Review feedback"
            style={{
              width: '100%', minHeight: 60, padding: 8,
              borderRadius: 6, border: '1px solid #334155',
              background: '#0f172a', color: '#e2e8f0',
              fontSize: 12, fontFamily: 'inherit', resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button
              type="button"
              style={rejectBtn}
              onClick={(e) => {
                e.stopPropagation();
                onApprovalChange?.(card.id, 'rejected', noteDraft);
                setReviewMode(false);
              }}
            >
              Submit rejection
            </button>
            <button
              type="button"
              style={reviewBtn}
              onClick={(e) => {
                e.stopPropagation();
                setReviewMode(false);
                setNoteDraft(card.reviewNote ?? '');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Persistent reviewer note if rejected */}
      {approval === 'rejected' && card.reviewNote && !reviewMode && (
        <p
          style={{
            margin: '8px 0 0', padding: 8, borderRadius: 6,
            background: '#ef444410', color: '#fca5a5',
            fontSize: 12, borderLeft: '3px solid #ef4444',
          }}
        >
          {card.reviewNote}
        </p>
      )}

      {card.description && <p style={S.fcDesc}>{card.description}</p>}

      {card.tags.length > 0 && (
        <div style={S.fcTagsRow}>
          {card.tags.map((tag) => (
            <span key={tag} style={S.fcTagChip}>{tag}</span>
          ))}
        </div>
      )}

      {expanded && (
        <div style={S.fcExpanded}>
          {card.contextFiles.length > 0 && (
            <div style={S.fcContextBlock}>
              <span style={S.fcContextLabel}>Context</span>
              {card.contextFiles.map((f) => (
                <span key={f} style={S.fcFileChip}>{f}</span>
              ))}
            </div>
          )}
          {card.status !== 'done' && (
            <button
              style={S.fcBuildBtn}
              onClick={handleBuild}
              aria-label={`Start building ${card.title}`}
            >
              Start Building
            </button>
          )}
        </div>
      )}
    </div>
  );
}
