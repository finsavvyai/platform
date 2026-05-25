/**
 * ToastContainer — renders stacked toast notifications.
 * Positioned bottom-center, auto-dismiss with manual close.
 */

import React from 'react';
import type { Toast, ToastVariant } from '../../hooks/useToast';
import { useDarkMode } from '../../hooks/useDarkMode';
import {
  spacing, radius, fontFamily, fontSize, fontWeight, colors, shadow,
} from '../../lib/theme';

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

const variantColors: Record<ToastVariant, { light: string; dark: string }> = {
  success: { light: '#34C759', dark: '#30D158' },
  error: { light: '#FF3B30', dark: '#FF453A' },
  info: { light: '#007AFF', dark: '#0A84FF' },
};

const variantIcons: Record<ToastVariant, string> = {
  success: '\u2713',
  error: '\u2717',
  info: '\u2139',
};

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  const isDark = useDarkMode();
  const c = isDark ? colors.dark : colors.light;

  if (toasts.length === 0) return null;

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: spacing.xl,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
    zIndex: 2000,
    pointerEvents: 'none',
  };

  return (
    <div style={containerStyle} data-testid="toast-container">
      {toasts.map((toast) => {
        const accent = isDark
          ? variantColors[toast.variant].dark
          : variantColors[toast.variant].light;

        const toastStyle: React.CSSProperties = {
          fontFamily,
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
          padding: `${spacing.sm}px ${spacing.md}px`,
          borderRadius: radius.md,
          background: isDark ? '#2C2C2E' : '#FFFFFF',
          border: `1px solid ${c.separator}`,
          boxShadow: shadow.lg,
          color: c.text,
          fontSize: fontSize.subheadline,
          pointerEvents: 'auto',
          minWidth: 240,
          maxWidth: 400,
          backdropFilter: 'blur(12px)',
        };

        const iconStyle: React.CSSProperties = {
          width: 24,
          height: 24,
          borderRadius: radius.full,
          background: `${accent}20`,
          color: accent,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: fontSize.caption1,
          fontWeight: fontWeight.bold,
          flexShrink: 0,
        };

        const closeStyle: React.CSSProperties = {
          background: 'none',
          border: 'none',
          color: c.textTertiary,
          cursor: 'pointer',
          padding: spacing.xs,
          fontSize: fontSize.body,
          lineHeight: 1,
          fontFamily,
          marginLeft: 'auto',
          flexShrink: 0,
        };

        return (
          <div key={toast.id} style={toastStyle} role="status">
            <div style={iconStyle}>{variantIcons[toast.variant]}</div>
            <span style={{ flex: 1 }}>{toast.message}</span>
            <button
              style={closeStyle}
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss"
            >
              &times;
            </button>
          </div>
        );
      })}
    </div>
  );
}
