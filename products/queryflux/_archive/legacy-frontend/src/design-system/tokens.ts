/**
 * Apple Design System Tokens
 * Implements Apple's Human Interface Guidelines design tokens
 */

// ===================
// Typography Tokens
// ===================

export const TYPOGRAPHY = {
  // Display Headlines - Large, impactful text
  displayLarge: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif',
    fontSize: 'clamp(2.5rem, 5vw, 4rem)',
    fontWeight: 700,
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
  },
  displayMedium: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif',
    fontSize: 'clamp(2rem, 4vw, 3rem)',
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: '-0.01em',
  },
  displaySmall: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif',
    fontSize: 'clamp(1.5rem, 3vw, 2rem)',
    fontWeight: 600,
    lineHeight: 1.3,
  },

  // Title Styles - Section headers
  titleLarge: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif',
    fontSize: '1.5rem',
    fontWeight: 600,
    lineHeight: 1.3,
  },
  titleMedium: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif',
    fontSize: '1.25rem',
    fontWeight: 600,
    lineHeight: 1.3,
  },
  titleSmall: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif',
    fontSize: '1.125rem',
    fontWeight: 600,
    lineHeight: 1.4,
  },

  // Body Text - Main content
  bodyLarge: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
    fontSize: '1.125rem',
    fontWeight: 400,
    lineHeight: 1.5,
  },
  bodyMedium: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
    fontSize: '1rem',
    fontWeight: 400,
    lineHeight: 1.5,
  },
  bodySmall: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
    fontSize: '0.875rem',
    fontWeight: 400,
    lineHeight: 1.5,
  },

  // Caption Styles - Secondary information
  captionLarge: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
    fontSize: '0.875rem',
    fontWeight: 500,
    lineHeight: 1.3,
  },
  captionMedium: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
    fontSize: '0.75rem',
    fontWeight: 500,
    lineHeight: 1.3,
  },
  captionSmall: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
    fontSize: '0.625rem',
    fontWeight: 500,
    lineHeight: 1.3,
  },

  // Label Styles - UI controls and tags
  labelLarge: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
    fontSize: '0.875rem',
    fontWeight: 600,
    lineHeight: 1.3,
    textTransform: 'none',
  },
  labelMedium: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
    fontSize: '0.75rem',
    fontWeight: 600,
    lineHeight: 1.3,
    textTransform: 'none',
  },
  labelSmall: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
    fontSize: '0.625rem',
    fontWeight: 600,
    lineHeight: 1.3,
    textTransform: 'none',
  },
} as const;

// ===================
// Color Tokens
// ===================

export const COLORS = {
  // System Colors - Semantic
  system: {
    // Background colors
    background: {
      primary: '#ffffff',
      secondary: '#f8f9fa',
      tertiary: '#f1f3f4',
      quaternary: '#e9ecef',
      grouped: '#ffffff',
      groupedSecondary: '#f8f9fa',
      groupedTertiary: '#f1f3f4',
    },

    // Dark mode backgrounds
    darkBackground: {
      primary: '#000000',
      secondary: '#1c1c1e',
      tertiary: '#2c2c2e',
      quaternary: '#3a3a3c',
      grouped: '#1c1c1e',
      groupedSecondary: '#2c2c2e',
      groupedTertiary: '#3a3a3c',
    },

    // Label colors
    label: {
      primary: '#000000',
      secondary: '#3c3c43',
      tertiary: '#3c3c4399', // 60% opacity
      quaternary: '#3c3c434d', // 30% opacity
    },

    // Dark mode labels
    darkLabel: {
      primary: '#ffffff',
      secondary: '#ebebf5',
      tertiary: '#ebebf599', // 60% opacity
      quaternary: '#ebebf54d', // 30% opacity
    },

    // Separator colors
    separator: {
      primary: '#c6c6c8',
      secondary: '#d1d1d6',
      tertiary: '#e5e5ea',
    },

    // Dark mode separators
    darkSeparator: {
      primary: '#38383a',
      secondary: '#48484a',
      tertiary: '#58585a',
    },

    // Fill colors
    fill: {
      primary: '#78788033', // 20% opacity
      secondary: '#78788028', // 16% opacity
      tertiary: '#7676801e', // 12% opacity
      quaternary: '#74748014', // 8% opacity
    },

    // Dark mode fills
    darkFill: {
      primary: '#ffffff1c', // 11% opacity
      secondary: '#ffffff14', // 8% opacity
      tertiary: '#ffffff0d', // 5% opacity
      quaternary: '#ffffff08', // 3% opacity
    },

    // Accent colors (iOS style)
    accent: {
      blue: '#007aff',
      purple: '#5856d6',
      pink: '#ff2d55',
      red: '#ff3b30',
      orange: '#ff9500',
      yellow: '#ffcc00',
      green: '#34c759',
      mint: '#00c7be',
      teal: '#30b0c7',
      cyan: '#32d74b',
      indigo: '#5e5ce6',
    },

    // System indicators
    indicator: {
      success: '#34c759',
      warning: '#ff9500',
      error: '#ff3b30',
      info: '#007aff',
    },
  },
} as const;

// ===================
// Spacing Tokens
// ===================

export const SPACING = {
  // Base unit: 4px (following Apple's grid system)
  xs: '4px',      // 0.25rem
  sm: '8px',      // 0.5rem
  md: '16px',     // 1rem
  lg: '24px',     // 1.5rem
  xl: '32px',     // 2rem
  xxl: '48px',    // 3rem
  xxxl: '64px',   // 4rem

  // Component-specific spacing
  component: {
    button: {
      padding: {
        small: '6px 14px',
        medium: '10px 20px',
        large: '14px 28px',
      },
      gap: '8px',
    },
    card: {
      padding: '24px',
      gap: '16px',
    },
    dialog: {
      padding: '32px',
      gap: '24px',
    },
    sidebar: {
      padding: '16px',
      gap: '8px',
    },
    input: {
      padding: '12px 16px',
      gap: '8px',
    },
    modal: {
      padding: '32px',
      gap: '24px',
    },
    tabs: {
      gap: '8px',
      padding: '8px',
    },
  },

  // Layout gaps
  gap: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
} as const;

// ===================
// Border Radius Tokens
// ===================

export const BORDER_RADIUS = {
  xs: '4px',      // Small elements
  sm: '6px',      // Buttons, inputs
  md: '8px',      // Cards, panels
  lg: '12px',     // Large cards
  xl: '16px',     // Modals, dialogs
  xxl: '24px',    // Special containers
  full: '9999px', // Pills, badges
} as const;

// ===================
// Shadow Tokens
// ===================

export const SHADOWS = {
  // Elevation shadows
  xs: '0 1px 3px rgba(0, 0, 0, 0.05)',
  sm: '0 2px 6px rgba(0, 0, 0, 0.07), 0 1px 3px rgba(0, 0, 0, 0.06)',
  md: '0 4px 12px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)',
  lg: '0 8px 24px rgba(0, 0, 0, 0.08), 0 4px 8px rgba(0, 0, 0, 0.06)',
  xl: '0 16px 48px rgba(0, 0, 0, 0.1), 0 8px 16px rgba(0, 0, 0, 0.06)',

  // Colored shadows for specific elements
  colored: {
    blue: '0 4px 20px rgba(0, 122, 255, 0.15)',
    purple: '0 4px 20px rgba(88, 86, 214, 0.15)',
    success: '0 4px 20px rgba(52, 199, 89, 0.15)',
    warning: '0 4px 20px rgba(255, 149, 0, 0.15)',
    error: '0 4px 20px rgba(255, 59, 48, 0.15)',
  },
} as const;

// ===================
// Animation Tokens
// ===================

export const ANIMATION = {
  // Easing curves
  ease: {
    standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',     // Standard
    decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)',    // Decelerate
    accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)',      // Accelerate
    spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)', // Spring
  },

  // Durations (following Apple's specifications)
  duration: {
    instant: '0ms',    // Immediate
    fast: '150ms',     // Button taps, hover states
    standard: '250ms', // Panel transitions
    slow: '350ms',     // Page transitions
    slower: '500ms',   // Complex animations
  },

  // Keyframes
  keyframes: {
    fadeIn: {
      from: { opacity: 0 },
      to: { opacity: 1 },
    },
    fadeOut: {
      from: { opacity: 1 },
      to: { opacity: 0 },
    },
    slideUp: {
      from: { transform: 'translateY(20px)', opacity: 0 },
      to: { transform: 'translateY(0)', opacity: 1 },
    },
    slideDown: {
      from: { transform: 'translateY(-20px)', opacity: 0 },
      to: { transform: 'translateY(0)', opacity: 1 },
    },
    slideLeft: {
      from: { transform: 'translateX(20px)', opacity: 0 },
      to: { transform: 'translateX(0)', opacity: 1 },
    },
    slideRight: {
      from: { transform: 'translateX(-20px)', opacity: 0 },
      to: { transform: 'translateX(0)', opacity: 1 },
    },
    scaleIn: {
      from: { transform: 'scale(0.9)', opacity: 0 },
      to: { transform: 'scale(1)', opacity: 1 },
    },
    scaleOut: {
      from: { transform: 'scale(1)', opacity: 1 },
      to: { transform: 'scale(0.9)', opacity: 0 },
    },
    bounce: {
      '0%, 100%': { transform: 'translateY(0)' },
      '50%': { transform: 'translateY(-10px)' },
    },
    pulse: {
      '0%, 100%': { opacity: 1 },
      '50%': { opacity: 0.8 },
    },
    spin: {
      from: { transform: 'rotate(0deg)' },
      to: { transform: 'rotate(360deg)' },
    },
    float: {
      '0%, 100%': { transform: 'translateY(0px)' },
      '50%': { transform: 'translateY(-10px)' },
    },
  },
} as const;

// ===================
// Glass Morphism Tokens
// ===================

export const GLASS = {
  // Blur values
  blur: {
    none: 'blur(0px)',
    light: 'blur(20px)',
    medium: 'blur(40px)',
    heavy: 'blur(60px)',
    ultra: 'blur(80px)',
  },

  // Glass morphism styles
  effect: {
    light: {
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      backgroundColor: 'rgba(255, 255, 255, 0.7)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
    },
    medium: {
      backdropFilter: 'blur(40px) saturate(180%)',
      WebkitBackdropFilter: 'blur(40px) saturate(180%)',
      backgroundColor: 'rgba(255, 255, 255, 0.5)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
    },
    heavy: {
      backdropFilter: 'blur(60px) saturate(180%)',
      WebkitBackdropFilter: 'blur(60px) saturate(180%)',
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
    },
    dark: {
      backdropFilter: 'blur(40px) saturate(180%)',
      WebkitBackdropFilter: 'blur(40px) saturate(180%)',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
    },
  },
} as const;

// ===================
// Breakpoint Tokens
// ===================

export const BREAKPOINTS = {
  // Apple device sizes
  watch: '320px',      // Apple Watch
  phone: '375px',      // iPhone SE
  phonePlus: '414px',  // iPhone Pro Max
  tablet: '768px',     // iPad
  desktop: '1024px',   // iPad Pro landscape
  desktopLarge: '1280px',
  desktopXLarge: '1440px',
  desktopXXLarge: '1920px',
} as const;

// ===================
// Z-Index Tokens
// ===================

export const Z_INDEX = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  fixed: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  tooltip: 1600,
  toast: 1700,
  maximum: 9999,
} as const;

// ===================
// Utility Functions
// ===================

/**
 * Create a CSS-in-JS style object with proper typing
 */
export const createStyle = <T extends Record<string, any>>(style: T): T => style;

/**
 * Get responsive media query
 */
export const getMediaQuery = (breakpoint: keyof typeof BREAKPOINTS) =>
  `@media (max-width: ${BREAKPOINTS[breakpoint]})`;

/**
 * Create responsive styles
 */
export const createResponsiveStyle = <T extends Record<string, any>>(
  base: T,
  breakpoints: Partial<Record<keyof typeof BREAKPOINTS, Partial<T>>>
) => {
  const responsive = { ...base };

  Object.entries(breakpoints).forEach(([breakpoint, styles]) => {
    if (styles) {
      responsive[getMediaQuery(breakpoint as keyof typeof BREAKPOINTS)] = styles;
    }
  });

  return responsive;
};

/**
 * Create transition style
 */
export const createTransition = (
  properties: string[],
  duration: keyof typeof ANIMATION.duration = 'standard',
  easing: keyof typeof ANIMATION.ease = 'standard'
) => ({
  transition: properties.map(prop => `${prop} ${ANIMATION.duration[duration]} ${ANIMATION.ease[easing]}`).join(', '),
});

/**
 * Create glass effect style
 */
export const createGlassEffect = (
  variant: keyof typeof GLASS.effect = 'medium',
  additionalStyles: Record<string, any> = {}
) => ({
  ...GLASS.effect[variant],
  ...additionalStyles,
});

// Export all tokens as a single object for convenience
export const DESIGN_TOKENS = {
  TYPOGRAPHY,
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  ANIMATION,
  GLASS,
  BREAKPOINTS,
  Z_INDEX,
} as const;

export type DesignTokens = typeof DESIGN_TOKENS;
