/**
 * Unit tests for chart theme constants and exports.
 * Verifies that all color palettes and the darkTheme object are correctly
 * defined and structurally valid for use with Victory charts.
 */

import { describe, it, expect } from 'vitest';
import {
  COLORS,
  PIE_PALETTE,
  SEVERITY_COLORS,
  darkTheme,
  CHART_PADDING,
  CHART_HEIGHT,
} from './theme.js';

const HEX_RE = /^#[0-9A-Fa-f]{3,8}$/;

describe('COLORS', () => {
  it('exports all expected color keys', () => {
    const keys = [
      'blue', 'cyan', 'green', 'amber', 'rose',
      'teal', 'purple', 'neutral400', 'neutral600',
      'neutral800', 'neutral900',
    ] as const;
    for (const key of keys) {
      expect(COLORS).toHaveProperty(key);
    }
  });

  it('every color value is a valid CSS hex string', () => {
    for (const [key, value] of Object.entries(COLORS)) {
      expect(value, `COLORS.${key}`).toMatch(HEX_RE);
    }
  });

  it('has correct teal brand color', () => {
    expect(COLORS.teal).toBe('#00E5C3');
  });

  it('has correct neutral-900 background color', () => {
    expect(COLORS.neutral900).toBe('#171717');
  });
});

describe('PIE_PALETTE', () => {
  it('is an array of 6 colors', () => {
    expect(Array.isArray(PIE_PALETTE)).toBe(true);
    expect(PIE_PALETTE).toHaveLength(6);
  });

  it('all entries are valid hex strings', () => {
    for (const color of PIE_PALETTE) {
      expect(color).toMatch(HEX_RE);
    }
  });

  it('includes blue, cyan, green, amber, rose, purple from COLORS', () => {
    expect(PIE_PALETTE).toContain(COLORS.blue);
    expect(PIE_PALETTE).toContain(COLORS.cyan);
    expect(PIE_PALETTE).toContain(COLORS.green);
    expect(PIE_PALETTE).toContain(COLORS.amber);
    expect(PIE_PALETTE).toContain(COLORS.rose);
    expect(PIE_PALETTE).toContain(COLORS.purple);
  });

  it('contains no duplicate values', () => {
    const unique = new Set(PIE_PALETTE);
    expect(unique.size).toBe(PIE_PALETTE.length);
  });
});

describe('SEVERITY_COLORS', () => {
  it('exports all four severity levels plus info', () => {
    expect(SEVERITY_COLORS).toHaveProperty('critical');
    expect(SEVERITY_COLORS).toHaveProperty('high');
    expect(SEVERITY_COLORS).toHaveProperty('medium');
    expect(SEVERITY_COLORS).toHaveProperty('low');
    expect(SEVERITY_COLORS).toHaveProperty('info');
  });

  it('all severity colors are valid hex strings', () => {
    for (const [key, value] of Object.entries(SEVERITY_COLORS)) {
      expect(value, `SEVERITY_COLORS.${key}`).toMatch(HEX_RE);
    }
  });

  it('critical is red (high-attention) and low is green (safe)', () => {
    // Critical should be a red hue — starts with #EF, #F4, #DC, etc.
    expect(SEVERITY_COLORS.critical.toUpperCase()).toMatch(/^#E|^#F/);
    // Low should be a green hue
    expect(SEVERITY_COLORS.low.toUpperCase()).toMatch(/^#2/);
  });
});

describe('darkTheme', () => {
  it('is a defined object', () => {
    expect(darkTheme).toBeDefined();
    expect(typeof darkTheme).toBe('object');
  });

  it('has an axis property', () => {
    expect(darkTheme).toHaveProperty('axis');
  });

  it('axis.style has axis, grid, tickLabels, and axisLabel keys', () => {
    const style = darkTheme.axis?.style as Record<string, unknown> | undefined;
    expect(style).toBeDefined();
    expect(style).toHaveProperty('axis');
    expect(style).toHaveProperty('grid');
    expect(style).toHaveProperty('tickLabels');
    expect(style).toHaveProperty('axisLabel');
  });

  it('axis stroke matches neutral600', () => {
    const style = darkTheme.axis?.style as Record<string, { stroke?: string }>;
    expect(style?.axis?.stroke).toBe(COLORS.neutral600);
  });

  it('grid stroke matches neutral800', () => {
    const style = darkTheme.axis?.style as Record<string, { stroke?: string }>;
    expect(style?.grid?.stroke).toBe(COLORS.neutral800);
  });
});

describe('CHART_PADDING', () => {
  it('has top, bottom, left, right properties', () => {
    expect(CHART_PADDING).toHaveProperty('top');
    expect(CHART_PADDING).toHaveProperty('bottom');
    expect(CHART_PADDING).toHaveProperty('left');
    expect(CHART_PADDING).toHaveProperty('right');
  });

  it('all padding values are positive numbers', () => {
    for (const [key, value] of Object.entries(CHART_PADDING)) {
      expect(typeof value, `CHART_PADDING.${key}`).toBe('number');
      expect(value, `CHART_PADDING.${key}`).toBeGreaterThan(0);
    }
  });
});

describe('CHART_HEIGHT', () => {
  it('is a positive number', () => {
    expect(typeof CHART_HEIGHT).toBe('number');
    expect(CHART_HEIGHT).toBeGreaterThan(0);
  });

  it('equals 220', () => {
    expect(CHART_HEIGHT).toBe(220);
  });
});
