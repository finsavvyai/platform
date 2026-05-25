/**
 * LandingHero — hero section with headline, description, screenshot
 * placeholder, and CTA buttons for the Studio landing page.
 */

import React, { useState } from 'react';
import type { LandingColors } from './LandingPage';

interface LandingHeroProps {
  colors: LandingColors;
  font: string;
  onSignIn: () => void;
  onDemo: () => void;
}

export function LandingHero({ colors, font, onSignIn, onDemo }: LandingHeroProps) {
  const [hoverSignIn, setHoverSignIn] = useState(false);
  const [hoverDemo, setHoverDemo] = useState(false);
  const [hoverPlan, setHoverPlan] = useState(false);

  const handlePlan = () => { window.location.hash = '#map'; };

  return (
    <section style={heroSection} aria-label="Studio introduction">
      <div style={heroInner}>
        <p style={badge(colors, font)}>Visual AI Workflow Builder</p>
        <h1 style={heading(font)}>
          Drag. Connect. Deploy.
        </h1>
        <p style={subheading(colors, font)}>
          Build AI agent workflows visually — wire up triggers, models,
          and actions on an infinite canvas, then ship to production in one click.
        </p>
        <div style={ctaRow}>
          <button
            style={primaryBtn(colors, hoverSignIn)}
            onClick={onSignIn}
            onMouseEnter={() => setHoverSignIn(true)}
            onMouseLeave={() => setHoverSignIn(false)}
            aria-label="Sign in to Studio"
          >
            Sign In
          </button>
          <button
            style={secondaryBtn(colors, hoverDemo)}
            onClick={onDemo}
            onMouseEnter={() => setHoverDemo(true)}
            onMouseLeave={() => setHoverDemo(false)}
            aria-label="View a demo of Studio"
          >
            View Demo
          </button>
          <button
            style={secondaryBtn(colors, hoverPlan)}
            onClick={handlePlan}
            onMouseEnter={() => setHoverPlan(true)}
            onMouseLeave={() => setHoverPlan(false)}
            aria-label="Open Product Map planner"
          >
            Plan
          </button>
        </div>
      </div>
      <div style={screenshotArea(colors)} role="img" aria-label="Studio canvas preview">
        <div style={screenshotInner(colors)}>
          <CanvasPreviewSVG colors={colors} />
          <p style={screenshotLabel(colors, font)}>Studio Canvas Preview</p>
        </div>
      </div>
    </section>
  );
}

function CanvasPreviewSVG({ colors }: { colors: LandingColors }) {
  return (
    <svg width="100%" height="200" viewBox="0 0 600 200" fill="none" aria-hidden="true">
      <rect x="40" y="60" width="120" height="48" rx="10" fill={colors.violet} opacity="0.8" />
      <text x="100" y="89" textAnchor="middle" fill="#fff" fontSize="13">Trigger</text>
      <rect x="240" y="40" width="120" height="48" rx="10" fill={colors.indigo} opacity="0.8" />
      <text x="300" y="69" textAnchor="middle" fill="#fff" fontSize="13">AI Model</text>
      <rect x="240" y="112" width="120" height="48" rx="10" fill={colors.indigo} opacity="0.8" />
      <text x="300" y="141" textAnchor="middle" fill="#fff" fontSize="13">Condition</text>
      <rect x="440" y="76" width="120" height="48" rx="10" fill={colors.emerald} opacity="0.8" />
      <text x="500" y="105" textAnchor="middle" fill="#fff" fontSize="13">Deploy</text>
      <line x1="160" y1="84" x2="240" y2="64" stroke={colors.violet} strokeWidth="2" opacity="0.5" />
      <line x1="160" y1="84" x2="240" y2="136" stroke={colors.violet} strokeWidth="2" opacity="0.5" />
      <line x1="360" y1="64" x2="440" y2="100" stroke={colors.indigo} strokeWidth="2" opacity="0.5" />
      <line x1="360" y1="136" x2="440" y2="100" stroke={colors.indigo} strokeWidth="2" opacity="0.5" />
    </svg>
  );
}

const heroSection: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  padding: '96px 24px 64px', gap: 56, maxWidth: 960, margin: '0 auto',
};

const heroInner: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  textAlign: 'center', gap: 24,
};

const badge = (c: LandingColors, font: string): React.CSSProperties => ({
  fontFamily: font, fontSize: 13, fontWeight: 600, letterSpacing: '0.05em',
  textTransform: 'uppercase', color: c.violet, padding: '6px 16px',
  border: `1px solid ${c.violet}40`, borderRadius: 999, background: `${c.violet}10`,
});

const heading = (font: string): React.CSSProperties => ({
  fontFamily: font, fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 700,
  lineHeight: 1.1, color: '#f0f0f5', letterSpacing: '-0.02em',
});

const subheading = (c: LandingColors, font: string): React.CSSProperties => ({
  fontFamily: font, fontSize: 18, lineHeight: 1.6, color: c.textSecondary,
  maxWidth: 560,
});

const ctaRow: React.CSSProperties = {
  display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center',
  marginTop: 8,
};

const primaryBtn = (c: LandingColors, hover: boolean): React.CSSProperties => ({
  fontFamily: 'inherit', fontSize: 16, fontWeight: 600, cursor: 'pointer',
  padding: '14px 32px', borderRadius: 12, border: 'none', color: '#fff',
  background: hover
    ? `linear-gradient(135deg, ${c.violet}, ${c.indigo})`
    : `linear-gradient(135deg, ${c.indigo}, ${c.violet})`,
  transform: hover ? 'translateY(-1px)' : 'none',
  boxShadow: hover ? `0 8px 24px ${c.violet}40` : `0 4px 12px ${c.violet}20`,
  transition: 'all 200ms ease',
});

const secondaryBtn = (c: LandingColors, hover: boolean): React.CSSProperties => ({
  fontFamily: 'inherit', fontSize: 16, fontWeight: 600, cursor: 'pointer',
  padding: '14px 32px', borderRadius: 12, color: c.textPrimary,
  background: hover ? `${c.bgCard}` : 'transparent',
  border: `1px solid ${c.border}`,
  transition: 'all 200ms ease',
});

const screenshotArea = (c: LandingColors): React.CSSProperties => ({
  width: '100%', maxWidth: 720, borderRadius: 16,
  border: `1px solid ${c.border}`, background: c.bgCard,
  overflow: 'hidden',
});

const screenshotInner = (c: LandingColors): React.CSSProperties => ({
  padding: 24, background: `linear-gradient(180deg, ${c.bg}, ${c.bgCard})`,
});

const screenshotLabel = (c: LandingColors, font: string): React.CSSProperties => ({
  fontFamily: font, fontSize: 12, color: c.textSecondary,
  textAlign: 'center', marginTop: 12, opacity: 0.6,
});
