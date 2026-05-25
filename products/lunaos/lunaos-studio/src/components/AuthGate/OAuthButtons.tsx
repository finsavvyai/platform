/**
 * Social OAuth buttons for Studio — Google, GitHub, Microsoft.
 * Inline CSS styling (no Tailwind) matching Studio design system.
 */

import React from 'react';
import { useDarkMode } from '../../hooks/useDarkMode';
import {
  spacing, radius, fontFamily, fontSize, fontWeight, colors,
} from '../../lib/theme';
import type { User } from '../../lib/api-client';

const API_URL = 'https://api.lunaos.ai';

interface OAuthButtonsProps {
  onSuccess: (user: User) => void;
}

interface Provider {
  id: string;
  label: string;
  bg: string;
  hoverBg: string;
  textColor: string;
  borderColor?: string;
}

const providers: Provider[] = [
  {
    id: 'google', label: 'Continue with Google',
    bg: '#FFFFFF', hoverBg: '#F8F8F8', textColor: '#1F1F1F',
    borderColor: '#DADCE0',
  },
  {
    id: 'github', label: 'Continue with GitHub',
    bg: '#24292E', hoverBg: '#2F363D', textColor: '#FFFFFF',
  },
  {
    id: 'microsoft', label: 'Continue with Microsoft',
    bg: '#00A4EF', hoverBg: '#0090D1', textColor: '#FFFFFF',
  },
];

function handleOAuth(providerId: string): void {
  const redirectUri = `${window.location.origin}/auth/callback`;
  const url = `${API_URL}/auth/oauth/${providerId}?redirect_uri=${encodeURIComponent(redirectUri)}`;
  window.location.href = url;
}

export function OAuthButtons({ onSuccess: _onSuccess }: OAuthButtonsProps) {
  const isDark = useDarkMode();
  const c = isDark ? colors.dark : colors.light;

  const btnBase: React.CSSProperties = {
    width: '100%',
    padding: `${spacing.sm + 2}px 0`,
    borderRadius: radius.sm,
    border: 'none',
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    fontFamily,
    cursor: 'pointer',
    marginBottom: spacing.sm,
    transition: 'opacity 150ms ease',
  };

  const dividerRow: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    margin: `${spacing.md}px 0`,
    gap: spacing.sm,
  };

  const dividerLine: React.CSSProperties = {
    flex: 1,
    height: 1,
    background: c.separator,
  };

  return (
    <div>
      {providers.map((p) => (
        <button
          key={p.id}
          type="button"
          style={{
            ...btnBase,
            background: p.bg,
            color: p.textColor,
            border: p.borderColor ? `1px solid ${p.borderColor}` : 'none',
          }}
          onClick={() => handleOAuth(p.id)}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = p.hoverBg;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = p.bg;
          }}
          aria-label={p.label}
        >
          {p.label}
        </button>
      ))}

      <div style={dividerRow}>
        <div style={dividerLine} />
        <span style={{
          color: c.textSecondary,
          fontSize: fontSize.caption1,
          fontFamily,
          whiteSpace: 'nowrap',
        }}>
          or continue with email
        </span>
        <div style={dividerLine} />
      </div>
    </div>
  );
}
