import { describe, it, expect } from 'vitest';
import { colors, typography, spacing } from '../src/tokens';

describe('Colors', () => {
  it('should have light palette with all required colors', () => {
    expect(colors.light.primary).toBe('#007AFF');
    expect(colors.light.secondary).toBe('#5856D6');
    expect(colors.light.accent).toBe('#FF9500');
    expect(colors.light.destructive).toBe('#FF3B30');
    expect(colors.light.success).toBe('#34C759');
  });

  it('should have dark palette with all required colors', () => {
    expect(colors.dark.primary).toBe('#0A84FF');
    expect(colors.dark.secondary).toBe('#6C63FF');
    expect(colors.dark.background).toBe('#000000');
    expect(colors.dark.foreground).toBe('#FFFFFF');
  });

  it('should have 6 gray shades in light mode', () => {
    const lightGrays = [
      colors.light.gray1,
      colors.light.gray2,
      colors.light.gray3,
      colors.light.gray4,
      colors.light.gray5,
      colors.light.gray6,
    ];
    expect(lightGrays).toHaveLength(6);
    expect(lightGrays.every((g) => g)).toBe(true);
  });

  it('should have border and background colors', () => {
    expect(colors.light.border).toBeDefined();
    expect(colors.light.background).toBeDefined();
    expect(colors.dark.border).toBeDefined();
    expect(colors.dark.background).toBeDefined();
  });
});

describe('Typography', () => {
  it('should have all heading sizes', () => {
    expect(typography.heading1).toBeDefined();
    expect(typography.heading2).toBeDefined();
    expect(typography.heading3).toBeDefined();
    expect(typography.heading4).toBeDefined();
    expect(typography.heading5).toBeDefined();
    expect(typography.heading6).toBeDefined();
  });

  it('should have body and caption', () => {
    expect(typography.body.fontSize).toBe('16px');
    expect(typography.bodySmall.fontSize).toBe('14px');
    expect(typography.caption.fontSize).toBe('12px');
  });

  it('heading1 should be largest', () => {
    expect(typography.heading1.fontSize).toBe('32px');
    expect(typography.heading1.fontWeight).toBe(700);
  });

  it('should use SF Pro font family', () => {
    expect(typography.fontFamily).toContain('SF Pro');
  });

  it('all headings should have proper line height', () => {
    expect(typography.heading1.lineHeight).toBeDefined();
    expect(typography.heading2.lineHeight).toBeDefined();
    expect(typography.heading3.lineHeight).toBeDefined();
  });

  it('caption should have small font weight', () => {
    expect(typography.caption.fontSize).toBe('12px');
    expect(typography.caption.fontWeight).toBe(500);
  });
});

describe('Spacing', () => {
  it('should have 8pt grid spacing', () => {
    expect(spacing[0]).toBe('0px');
    expect(spacing[1]).toBe('4px');
    expect(spacing[2]).toBe('8px');
    expect(spacing[3]).toBe('12px');
    expect(spacing[4]).toBe('16px');
  });

  it('should have larger spacing values', () => {
    expect(spacing[5]).toBe('20px');
    expect(spacing[6]).toBe('24px');
    expect(spacing[8]).toBe('32px');
    expect(spacing[10]).toBe('40px');
    expect(spacing[12]).toBe('48px');
  });

  it('spacing should have consistent increments for defined keys', () => {
    const keys = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12] as const;
    const expectedValues = [0, 4, 8, 12, 16, 20, 24, 32, 40, 48];
    keys.forEach((key, idx) => {
      const val = parseInt(spacing[key]);
      expect(val).toBe(expectedValues[idx]);
    });
  });
});
