import { colors, spacing, typography, radius, shadows, touchTarget } from '../../theme/tokens';

describe('Design Tokens', () => {
  describe('colors', () => {
    it('should have dark theme colors', () => {
      expect(colors.dark.bgPrimary).toBe('#0a0b0f');
      expect(colors.dark.accentPrimary).toBe('#3b82f6');
      expect(colors.dark.accentSuccess).toBe('#10b981');
      expect(colors.dark.accentError).toBe('#ef4444');
    });

    it('should have light theme colors', () => {
      expect(colors.light.bgPrimary).toBe('#ffffff');
      expect(colors.light.accentPrimary).toBe('#007aff');
      expect(colors.light.accentSuccess).toBe('#34c759');
      expect(colors.light.accentError).toBe('#ff3b30');
    });

    it('should have glass effect tokens', () => {
      expect(colors.dark.glassBg).toBeDefined();
      expect(colors.dark.glassBorder).toBeDefined();
    });
  });

  describe('spacing', () => {
    it('should follow 4px grid system', () => {
      expect(spacing.xs).toBe(4);
      expect(spacing.sm).toBe(8);
      expect(spacing.md).toBe(12);
      expect(spacing.base).toBe(16);
      expect(spacing.lg).toBe(24);
      expect(spacing.xl).toBe(32);
      expect(spacing['2xl']).toBe(48);
      expect(spacing['3xl']).toBe(64);
    });
  });

  describe('typography', () => {
    it('should have SF Pro-inspired sizes', () => {
      expect(typography.largeTitle.fontSize).toBe(34);
      expect(typography.title1.fontSize).toBe(28);
      expect(typography.headline.fontSize).toBe(17);
      expect(typography.body.fontSize).toBe(17);
      expect(typography.caption1.fontSize).toBe(12);
    });
  });

  describe('radius', () => {
    it('should have correct border radii', () => {
      expect(radius.card).toBe(12);
      expect(radius.modal).toBe(16);
      expect(radius.sheet).toBe(20);
      expect(radius.pill).toBe(9999);
    });
  });

  describe('shadows', () => {
    it('should have shadow presets', () => {
      expect(shadows.sm).toBeDefined();
      expect(shadows.md).toBeDefined();
      expect(shadows.lg).toBeDefined();
      expect(shadows.md.shadowOpacity).toBeGreaterThan(0);
    });
  });

  describe('touchTarget', () => {
    it('should meet minimum 44x44 requirement', () => {
      expect(touchTarget.minHeight).toBe(44);
      expect(touchTarget.minWidth).toBe(44);
    });
  });
});
