/**
 * UserMenu — displays user email, tier badge, and logout.
 * Shows upgrade CTA for free-tier users.
 */

import React, { useState } from 'react';
import { logout, createCheckoutUrl, type User } from '../../lib/api-client';
import { useDarkMode } from '../../hooks/useDarkMode';
import {
  spacing, radius, fontFamily, fontSize, fontWeight, colors, shadow,
} from '../../lib/theme';

interface UserMenuProps {
  user: User;
  onLogout: () => void;
}

const tierColors: Record<string, string> = {
  free: '#8E8E93',
  pro: '#AF52DE',
  team: '#007AFF',
};

export function UserMenu({ user, onLogout }: UserMenuProps) {
  const isDark = useDarkMode();
  const c = isDark ? colors.dark : colors.light;
  const [open, setOpen] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const url = await createCheckoutUrl('pro');
      window.open(url, '_blank');
    } catch {
      window.open('https://lunaos.lemonsqueezy.com/buy/pro?embed=1&dark=1', '_blank');
    } finally {
      setUpgrading(false);
    }
  };

  const handleLogout = () => {
    logout();
    onLogout();
  };

  const tierColor = tierColors[user.tier] ?? tierColors.free;

  const btnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: spacing.xs,
    padding: `${spacing.xs}px ${spacing.sm}px`, borderRadius: radius.sm,
    border: `1px solid ${c.separator}`, background: 'none',
    cursor: 'pointer', fontFamily, fontSize: fontSize.caption1,
    color: c.text, position: 'relative',
  };

  const badgeStyle: React.CSSProperties = {
    fontSize: fontSize.caption2, fontWeight: fontWeight.semibold,
    padding: `1px ${spacing.xs}px`, borderRadius: radius.full,
    background: `${tierColor}20`, color: tierColor, textTransform: 'uppercase',
  };

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute', top: '100%', right: 0, marginTop: spacing.xs,
    background: isDark ? '#2C2C2E' : '#FFFFFF', borderRadius: radius.sm,
    border: `1px solid ${c.separator}`, boxShadow: shadow.lg,
    minWidth: 200, zIndex: 100, overflow: 'hidden',
  };

  const itemStyle: React.CSSProperties = {
    display: 'block', width: '100%', padding: `${spacing.sm}px ${spacing.md}px`,
    border: 'none', background: 'none', textAlign: 'left',
    fontSize: fontSize.subheadline, color: c.text, cursor: 'pointer',
    fontFamily,
  };

  return (
    <div style={{ position: 'relative' }}>
      <button style={btnStyle} onClick={() => setOpen(!open)} aria-label="User menu">
        <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.email}
        </span>
        <span style={badgeStyle}>{user.tier}</span>
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div style={dropdownStyle}>
            <div style={{ padding: `${spacing.sm}px ${spacing.md}px`, borderBottom: `1px solid ${c.separator}` }}>
              <div style={{ fontSize: fontSize.caption1, color: c.textTertiary }}>Signed in as</div>
              <div style={{ fontSize: fontSize.subheadline, fontWeight: fontWeight.medium, color: c.text }}>{user.name || user.email}</div>
            </div>
            {user.tier === 'free' && (
              <button style={{ ...itemStyle, color: c.accent, fontWeight: fontWeight.semibold }} onClick={handleUpgrade} disabled={upgrading}>
                {upgrading ? 'Opening checkout...' : 'Upgrade to Pro — $29/mo'}
              </button>
            )}
            <button style={{ ...itemStyle, color: c.red }} onClick={handleLogout}>Sign Out</button>
          </div>
        </>
      )}
    </div>
  );
}
