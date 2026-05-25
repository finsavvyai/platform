/**
 * SDLC.ai Dark Design Tokens — HeyGen-style professional dark UI
 * Deep dark backgrounds, purple/blue accent gradients, glass morphism.
 */

export const darkColors = {
  background: {
    base: '#0a0a0f',
    surface: '#111118',
    elevated: '#1a1a24',
    overlay: 'rgba(10, 10, 15, 0.85)',
  },
  accent: {
    purple: '#7c3aed',
    purpleLight: '#8b5cf6',
    purpleDark: '#6d28d9',
    blue: '#3b82f6',
    blueLight: '#60a5fa',
    blueDark: '#2563eb',
    cyan: '#06b6d4',
    cyanLight: '#22d3ee',
    cyanDark: '#0891b2',
  },
  text: {
    primary: '#f8fafc',
    secondary: '#94a3b8',
    muted: '#64748b',
    inverse: '#0a0a0f',
  },
  border: {
    subtle: 'rgba(255, 255, 255, 0.08)',
    emphasis: 'rgba(255, 255, 255, 0.16)',
    accent: 'rgba(124, 58, 237, 0.3)',
  },
  status: {
    success: '#10b981',
    successMuted: 'rgba(16, 185, 129, 0.15)',
    warning: '#f59e0b',
    warningMuted: 'rgba(245, 158, 11, 0.15)',
    error: '#ef4444',
    errorMuted: 'rgba(239, 68, 68, 0.15)',
    info: '#3b82f6',
    infoMuted: 'rgba(59, 130, 246, 0.15)',
  },
} as const;

export const darkShadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
  glow: '0 0 20px rgba(124, 58, 237, 0.15)',
  glowBlue: '0 0 20px rgba(59, 130, 246, 0.15)',
  glowCyan: '0 0 20px rgba(6, 182, 212, 0.15)',
  glass: '0 8px 32px rgba(0, 0, 0, 0.4)',
} as const;

export const darkGradients = {
  brand: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
  brandText: 'linear-gradient(to right, #7c3aed, #06b6d4)',
  surface: 'linear-gradient(180deg, #111118, #0a0a0f)',
  glow: 'radial-gradient(circle at 50% 0%, rgba(124, 58, 237, 0.12), transparent 50%)',
  hero: 'radial-gradient(ellipse at 20% 50%, rgba(124, 58, 237, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(59, 130, 246, 0.06) 0%, transparent 50%)',
  card: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
} as const;

export const darkGlassmorphism = {
  panel: {
    background: 'rgba(17, 17, 24, 0.7)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(20px)',
    borderRadius: '16px',
  },
  card: {
    background: 'rgba(26, 26, 36, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    backdropFilter: 'blur(12px)',
    borderRadius: '12px',
  },
  nav: {
    background: 'rgba(10, 10, 15, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    backdropFilter: 'blur(24px)',
  },
} as const;

export type DarkDesignTokens = {
  colors: typeof darkColors;
  shadows: typeof darkShadows;
  gradients: typeof darkGradients;
  glassmorphism: typeof darkGlassmorphism;
};

export const darkDesignTokens: DarkDesignTokens = {
  colors: darkColors,
  shadows: darkShadows,
  gradients: darkGradients,
  glassmorphism: darkGlassmorphism,
};
