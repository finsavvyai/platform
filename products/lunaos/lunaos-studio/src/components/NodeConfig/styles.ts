/**
 * NodeConfig style helpers — shared between NodeConfig and its sub-components.
 */

import type { CSSProperties } from 'react';
import type { ColorScheme } from '../../lib/theme';
import {
  spacing, radius, fontFamily, fontSize, fontWeight,
} from '../../lib/theme';

export function panelStyle(c: ColorScheme, isDark: boolean): CSSProperties {
  return {
    fontFamily, width: 288, height: '100%',
    background: isDark ? '#1C1C1E' : '#F2F2F7',
    borderLeft: `1px solid ${c.separator}`,
    display: 'flex', flexDirection: 'column', overflowY: 'auto',
  };
}

export function emptyStyle(c: ColorScheme, isDark: boolean): CSSProperties {
  return {
    ...panelStyle(c, isDark),
    justifyContent: 'center', alignItems: 'center',
  };
}

export function headerStyle(c: ColorScheme): CSSProperties {
  return {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.md, borderBottom: `1px solid ${c.separator}`,
  };
}

export function formStyle(): CSSProperties {
  return { padding: spacing.md, flex: 1 };
}

export function labelStyle(c: ColorScheme): CSSProperties {
  return {
    display: 'block', fontSize: fontSize.caption1,
    fontWeight: fontWeight.semibold, color: c.textTertiary,
    marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5,
  };
}

export function inputStyle(c: ColorScheme, isDark: boolean): CSSProperties {
  return {
    width: '100%', padding: `${spacing.sm}px ${spacing.sm}px`,
    borderRadius: radius.sm, border: `1px solid ${c.separator}`,
    background: isDark ? '#2C2C2E' : '#FFFFFF', color: c.text,
    fontSize: fontSize.subheadline, fontFamily, outline: 'none',
  };
}

export function colorDot(color: string): CSSProperties {
  return { width: 12, height: 12, borderRadius: radius.full, background: color };
}

export function deleteBtn(c: ColorScheme): CSSProperties {
  return {
    background: 'none', border: 'none', color: c.red,
    fontWeight: fontWeight.semibold, fontSize: fontSize.subheadline,
    cursor: 'pointer', fontFamily,
  };
}
