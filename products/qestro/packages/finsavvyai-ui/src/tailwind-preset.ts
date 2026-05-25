/**
 * @finsavvyai/ui — Tailwind CSS preset with Apple HIG tokens
 * Extend your tailwind.config with this preset for portfolio consistency
 *
 * Usage:
 *   import { finsavvyTailwindPreset } from '@finsavvyai/ui/tailwind';
 *   export default { presets: [finsavvyTailwindPreset], ... }
 */

import { colors, spacing, typography, borderRadius, shadows, animation } from './tokens.js';

export const finsavvyTailwindPreset = {
  theme: {
    extend: {
      colors: {
        brand: colors.primary,
        neutral: colors.neutral,
        success: colors.success.light,
        warning: colors.warning.light,
        error: colors.error.light,
        info: colors.info.light,
      },
      fontFamily: typography.fontFamily,
      fontSize: typography.fontSize,
      fontWeight: typography.fontWeight,
      spacing,
      borderRadius,
      boxShadow: shadows,
      transitionDuration: animation.duration,
      transitionTimingFunction: {
        'hig': animation.easing.default,
        'hig-enter': animation.easing.enter,
        'hig-exit': animation.easing.exit,
        'hig-bounce': animation.easing.bounce,
      },
    },
  },
};
