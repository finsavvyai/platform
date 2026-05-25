/**
 * Tests for Apple HIG theme tokens.
 */

import { spacing, radius, fontSize, fontWeight, colors, nodeColors } from '../lib/theme';

describe('theme', () => {
  test('spacing uses 8px grid multiples', () => {
    expect(spacing.sm).toBe(8);
    expect(spacing.md).toBe(16);
    expect(spacing.lg).toBe(24);
    expect(spacing.xl).toBe(32);
    // xs (4) is the half-grid exception
    expect(spacing.xs).toBe(4);
  });

  test('border radius values are within Apple HIG range', () => {
    expect(radius.sm).toBeGreaterThanOrEqual(8);
    expect(radius.lg).toBeLessThanOrEqual(16);
  });

  test('font sizes follow SF type scale', () => {
    expect(fontSize.body).toBe(17);
    expect(fontSize.caption1).toBe(12);
    expect(fontSize.title1).toBe(28);
  });

  test('font weights are standard values', () => {
    expect(fontWeight.regular).toBe(400);
    expect(fontWeight.bold).toBe(700);
  });

  test('dark and light color schemes both exist', () => {
    expect(colors.dark.bg).toBeTruthy();
    expect(colors.light.bg).toBeTruthy();
    expect(colors.dark.accent).toBeTruthy();
    expect(colors.light.accent).toBeTruthy();
  });

  test('accent colors are valid hex', () => {
    expect(colors.dark.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(colors.light.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  test('nodeColors map covers all categories', () => {
    expect(nodeColors['agent']).toBeTruthy();
    expect(nodeColors['trigger']).toBeTruthy();
    expect(nodeColors['condition']).toBeTruthy();
    expect(nodeColors['output']).toBeTruthy();
  });
});
