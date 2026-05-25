/**
 * OnboardingOverlay -- first-time welcome shown after sign-in.
 * Displays 3 quick steps and options to start from a template
 * or a blank canvas. Only shown once (localStorage flag).
 */

import React, { useState, useEffect } from 'react';
import { useDarkMode } from '../hooks/useDarkMode';
import {
  colors, fontFamily, fontSize, fontWeight, spacing, radius, shadow,
} from '../lib/theme';

const STORAGE_KEY = 'studio_onboarded';

interface OnboardingOverlayProps {
  onStartTemplate: () => void;
  onBlankCanvas: () => void;
}

export function OnboardingOverlay({ onStartTemplate, onBlankCanvas }: OnboardingOverlayProps) {
  const [visible, setVisible] = useState(false);
  const isDark = useDarkMode();
  const c = isDark ? colors.dark : colors.light;

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) !== 'true') {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVisible(false);
  };

  const handleTemplate = () => {
    dismiss();
    onStartTemplate();
  };

  const handleBlank = () => {
    dismiss();
    onBlankCanvas();
  };

  const steps = [
    { num: '1', text: 'Drag agents from the left panel' },
    { num: '2', text: 'Connect them with edges' },
    { num: '3', text: 'Click Run to execute' },
  ];

  return (
    <div style={backdrop(c)} role="dialog" aria-label="Welcome to LunaOS Studio">
      <div style={card(c)}>
        <div style={iconCircle(c)} aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="14" stroke={c.accent} strokeWidth="2" />
            <path d="M16 8v10M12 14l4 4 4-4" stroke={c.accent} strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h2 style={title(c)}>Welcome to LunaOS Studio</h2>
        <p style={subtitle(c)}>Build AI workflows visually in three steps.</p>

        <ol style={stepList}>
          {steps.map((s) => (
            <li key={s.num} style={stepItem(c)}>
              <span style={stepBadge(c)}>{s.num}</span>
              <span style={stepText(c)}>{s.text}</span>
            </li>
          ))}
        </ol>

        <div style={buttonRow}>
          <button style={primaryBtn(c)} onClick={handleTemplate}>
            Start with Template
          </button>
          <button style={secondaryBtn(c)} onClick={handleBlank}>
            Blank Canvas
          </button>
        </div>
      </div>
    </div>
  );
}

const backdrop = (c: typeof colors.dark): React.CSSProperties => ({
  position: 'fixed', inset: 0, zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: c.overlay, backdropFilter: 'blur(8px)',
  fontFamily,
});

const card = (c: typeof colors.dark): React.CSSProperties => ({
  background: c.bgSecondary, borderRadius: radius.xl,
  border: `1px solid ${c.separator}`, padding: spacing.xl,
  maxWidth: 400, width: '90vw', textAlign: 'center',
  boxShadow: shadow.lg,
});

const iconCircle = (c: typeof colors.dark): React.CSSProperties => ({
  width: 56, height: 56, borderRadius: radius.full,
  background: `${c.accent}15`, display: 'flex',
  alignItems: 'center', justifyContent: 'center', margin: '0 auto',
  marginBottom: spacing.md,
});

const title = (c: typeof colors.dark): React.CSSProperties => ({
  margin: 0, fontSize: fontSize.title2, fontWeight: fontWeight.bold,
  color: c.text, marginBottom: spacing.xs,
});

const subtitle = (c: typeof colors.dark): React.CSSProperties => ({
  margin: 0, fontSize: fontSize.subheadline, color: c.textSecondary,
  marginBottom: spacing.lg,
});

const stepList: React.CSSProperties = {
  listStyle: 'none', margin: 0, padding: 0,
  display: 'flex', flexDirection: 'column', gap: spacing.sm,
  marginBottom: spacing.lg, textAlign: 'left',
};

const stepItem = (c: typeof colors.dark): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: spacing.sm,
  padding: `${spacing.sm}px ${spacing.md}px`,
  borderRadius: radius.sm, background: c.bgTertiary,
});

const stepBadge = (c: typeof colors.dark): React.CSSProperties => ({
  width: 24, height: 24, borderRadius: radius.full,
  background: c.accent, color: '#fff', fontSize: fontSize.caption1,
  fontWeight: fontWeight.bold, display: 'flex',
  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
});

const stepText = (c: typeof colors.dark): React.CSSProperties => ({
  fontSize: fontSize.subheadline, color: c.text,
});

const buttonRow: React.CSSProperties = {
  display: 'flex', gap: spacing.sm, justifyContent: 'center',
};

const primaryBtn = (c: typeof colors.dark): React.CSSProperties => ({
  fontFamily, fontSize: fontSize.subheadline, fontWeight: fontWeight.semibold,
  padding: `${spacing.sm}px ${spacing.lg}px`, borderRadius: radius.sm,
  border: 'none', background: c.accent, color: '#fff', cursor: 'pointer',
});

const secondaryBtn = (c: typeof colors.dark): React.CSSProperties => ({
  fontFamily, fontSize: fontSize.subheadline, fontWeight: fontWeight.medium,
  padding: `${spacing.sm}px ${spacing.lg}px`, borderRadius: radius.sm,
  border: `1px solid ${c.separator}`, background: 'transparent',
  color: c.textSecondary, cursor: 'pointer',
});
