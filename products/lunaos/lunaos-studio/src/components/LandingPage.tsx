/**
 * LandingPage — public splash page shown before the auth wall.
 * Explains what Studio is, highlights key features, and provides
 * CTAs to sign in or view a demo.
 */

import React from 'react';
import { LandingFeatures } from './LandingFeatures';
import { LandingHero } from './LandingHero';

const COLORS = {
  bg: '#0a0a0f',
  bgCard: '#141420',
  violet: '#8b5cf6',
  indigo: '#6366f1',
  emerald: '#34d399',
  textPrimary: '#f0f0f5',
  textSecondary: '#a1a1b5',
  border: '#1e1e2e',
} as const;

const FONT =
  'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif';

export interface LandingColors {
  bg: string;
  bgCard: string;
  violet: string;
  indigo: string;
  emerald: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
}

interface LandingPageProps {
  onSignIn: () => void;
}

export function LandingPage({ onSignIn }: LandingPageProps) {
  const handleDemo = () => {
    window.location.hash = '#demo';
  };

  return (
    <div style={pageStyle} role="main" aria-label="LunaOS Studio landing page">
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <LandingHeader onSignIn={onSignIn} />
      <LandingHero
        colors={COLORS}
        font={FONT}
        onSignIn={onSignIn}
        onDemo={handleDemo}
      />
      <LandingFeatures colors={COLORS} font={FONT} />
      <footer style={footerStyle}>
        <p style={{ color: COLORS.textSecondary, fontFamily: FONT, fontSize: 14 }}>
          Built on Cloudflare edge infrastructure.
          Shipped with care by the LunaOS team.
        </p>
      </footer>
    </div>
  );
}

function LandingHeader({ onSignIn }: { onSignIn: () => void }) {
  return (
    <header style={headerStyle} aria-label="Site header">
      <a href="/" style={logoLinkStyle} aria-label="LunaOS Studio home">
        <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
          <defs>
            <linearGradient id="luna-moon-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={COLORS.violet} />
              <stop offset="100%" stopColor={COLORS.indigo} />
            </linearGradient>
          </defs>
          <circle cx="16" cy="16" r="14" fill="url(#luna-moon-gradient)" />
          <circle cx="20" cy="14" r="12" fill={COLORS.bg} />
        </svg>
        <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.01em' }}>
          LunaOS{' '}
          <span style={{ color: COLORS.textSecondary, fontWeight: 500 }}>
            Studio
          </span>
        </span>
      </a>
      <nav style={headerNavStyle}>
        <a href="https://docs.lunaos.ai" style={headerLinkStyle}>Docs</a>
        <a href="https://github.com/lunaos-ai" style={headerLinkStyle}>GitHub</a>
        <button onClick={onSignIn} style={headerCtaStyle} aria-label="Sign in">
          Sign In
        </button>
      </nav>
    </header>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  width: '100vw',
  background: '#0a0a0f',
  overflowX: 'hidden',
  overflowY: 'auto',
};

const headerStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 50,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 32px',
  background: 'rgba(10, 10, 15, 0.85)',
  borderBottom: `1px solid ${COLORS.border}`,
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
};

const logoLinkStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  textDecoration: 'none',
  color: COLORS.textPrimary,
  fontFamily: FONT,
};

const headerNavStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 24,
};

const headerLinkStyle: React.CSSProperties = {
  color: COLORS.textSecondary,
  textDecoration: 'none',
  fontSize: 14,
  fontWeight: 500,
  fontFamily: FONT,
};

const headerCtaStyle: React.CSSProperties = {
  padding: '8px 18px',
  borderRadius: 8,
  border: 'none',
  background: `linear-gradient(135deg, ${COLORS.indigo}, ${COLORS.violet})`,
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: FONT,
};

const footerStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '48px 24px 64px',
  borderTop: '1px solid #1e1e2e',
};
