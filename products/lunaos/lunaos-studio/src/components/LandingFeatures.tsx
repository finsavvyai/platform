/**
 * LandingFeatures — feature grid section for the Studio landing page.
 * Displays four key capabilities with inline SVG icons.
 */

import React from 'react';
import type { LandingColors } from './LandingPage';

interface LandingFeaturesProps {
  colors: LandingColors;
  font: string;
}

interface Feature {
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
}

export function LandingFeatures({ colors, font }: LandingFeaturesProps) {
  const features: Feature[] = [
    {
      title: 'Visual Canvas',
      description: 'Drag and drop AI agents, triggers, and actions onto an infinite canvas. Connect them with smart edges.',
      icon: <CanvasIcon color={colors.violet} />,
      accent: colors.violet,
    },
    {
      title: 'Real-Time Execution',
      description: 'Watch workflows run live with step-by-step progress, output preview, and instant error feedback.',
      icon: <ExecutionIcon color={colors.emerald} />,
      accent: colors.emerald,
    },
    {
      title: 'Version Control',
      description: 'Every save is a snapshot. Compare versions, roll back changes, and export workflow definitions as JSON.',
      icon: <VersionIcon color={colors.indigo} />,
      accent: colors.indigo,
    },
    {
      title: 'Team Collaboration',
      description: 'Share workflows with your team. Role-based access, audit logs, and real-time presence indicators.',
      icon: <TeamIcon color="#f472b6" />,
      accent: '#f472b6',
    },
  ];

  return (
    <section style={sectionStyle} aria-label="Key features">
      <h2 style={sectionTitle(font)}>Everything you need to build AI workflows</h2>
      <div style={grid}>
        {features.map((f) => (
          <article key={f.title} style={card(colors)} aria-label={f.title}>
            <div style={iconWrap(f.accent)}>{f.icon}</div>
            <h3 style={cardTitle(font)}>{f.title}</h3>
            <p style={cardDesc(colors, font)}>{f.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function CanvasIcon({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="2" stroke={color} strokeWidth="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" stroke={color} strokeWidth="2" />
      <path d="M10 6.5H14M6.5 10V14M17.5 10V14M10 17.5H14" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ExecutionIcon({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
      <path d="M10 8.5L16 12L10 15.5V8.5Z" fill={color} />
    </svg>
  );
}

function VersionIcon({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3V8M12 8L9 5M12 8L15 5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="14" r="3" stroke={color} strokeWidth="2" />
      <path d="M6 20C6 17.8 8.7 16 12 16C15.3 16 18 17.8 18 20" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function TeamIcon({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3" stroke={color} strokeWidth="2" />
      <circle cx="17" cy="10" r="2.5" stroke={color} strokeWidth="1.5" />
      <path d="M3 20C3 17 5.7 14.5 9 14.5C10.5 14.5 11.8 15 12.8 15.7" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M14 19C14 17.3 15.3 16 17 16C18.7 16 20 17.3 20 19" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const sectionStyle: React.CSSProperties = {
  padding: '64px 24px 80px', maxWidth: 960, margin: '0 auto',
};

const sectionTitle = (font: string): React.CSSProperties => ({
  fontFamily: font, fontSize: 28, fontWeight: 700, color: '#f0f0f5',
  textAlign: 'center', marginBottom: 48, letterSpacing: '-0.01em',
});

const grid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 24,
};

const card = (c: LandingColors): React.CSSProperties => ({
  padding: 28, borderRadius: 16, border: `1px solid ${c.border}`,
  background: c.bgCard, display: 'flex', flexDirection: 'column', gap: 14,
});

const iconWrap = (accent: string): React.CSSProperties => ({
  width: 44, height: 44, borderRadius: 12, display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  background: `${accent}15`, border: `1px solid ${accent}30`,
});

const cardTitle = (font: string): React.CSSProperties => ({
  fontFamily: font, fontSize: 17, fontWeight: 600, color: '#f0f0f5',
});

const cardDesc = (c: LandingColors, font: string): React.CSSProperties => ({
  fontFamily: font, fontSize: 14, lineHeight: 1.6, color: c.textSecondary,
});
