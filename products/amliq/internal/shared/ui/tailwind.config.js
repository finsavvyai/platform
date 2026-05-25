/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './stories/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        // Apple-inspired dark theme with cyan/blue/indigo accents
        background: {
          DEFAULT: '#000000',
          primary: '#0a0a0a',
          secondary: '#1a1a1a',
          tertiary: '#2a2a2a',
          glass: 'rgba(255, 255, 255, 0.05)',
          'glass-hover': 'rgba(255, 255, 255, 0.08)',
          'glass-active': 'rgba(255, 255, 255, 0.12)',
          surface: 'rgba(255, 255, 255, 0.02)',
          'surface-hover': 'rgba(255, 255, 255, 0.04)',
          'surface-active': 'rgba(255, 255, 255, 0.06)',
        },
        foreground: {
          DEFAULT: '#ffffff',
          primary: '#ffffff',
          secondary: '#a1a1aa',
          tertiary: '#71717a',
          muted: '#52525b',
          accent: '#f4f4f5',
          inverse: '#000000',
        },
        // FinTech brand colors with Apple-style gradients
        brand: {
          cyan: {
            DEFAULT: '#06b6d4',
            50: '#ecfeff',
            100: '#cffafe',
            200: '#a5f3fc',
            300: '#67e8f9',
            400: '#22d3ee',
            500: '#06b6d4',
            600: '#0891b2',
            700: '#0e7490',
            800: '#155e75',
            900: '#164e63',
            950: '#083344',
          },
          blue: {
            DEFAULT: '#3b82f6',
            50: '#eff6ff',
            100: '#dbeafe',
            200: '#bfdbfe',
            300: '#93c5fd',
            400: '#60a5fa',
            500: '#3b82f6',
            600: '#2563eb',
            700: '#1d4ed8',
            800: '#1e40af',
            900: '#1e3a8a',
            950: '#172554',
          },
          indigo: {
            DEFAULT: '#6366f1',
            50: '#eef2ff',
            100: '#e0e7ff',
            200: '#c7d2fe',
            300: '#a5b4fc',
            400: '#818cf8',
            500: '#6366f1',
            600: '#4f46e5',
            700: '#4338ca',
            800: '#3730a3',
            900: '#312e81',
            950: '#1e1b4b',
          },
          // Gradient combinations
          gradient: {
            1: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #6366f1 100%)',
            2: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 25%, #3b82f6 75%, #818cf8 100%)',
            3: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
            4: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
            5: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 50%, #3b82f6 100%)',
          }
        },
        // Semantic colors following Apple's philosophy
        semantic: {
          success: {
            DEFAULT: '#34d399',
            foreground: '#ffffff',
            background: 'rgba(52, 211, 153, 0.1)',
            border: 'rgba(52, 211, 153, 0.2)',
            light: '#86efac',
            dark: '#10b981',
          },
          warning: {
            DEFAULT: '#fbbf24',
            foreground: '#000000',
            background: 'rgba(251, 191, 36, 0.1)',
            border: 'rgba(251, 191, 36, 0.2)',
            light: '#fde68a',
            dark: '#f59e0b',
          },
          error: {
            DEFAULT: '#f87171',
            foreground: '#ffffff',
            background: 'rgba(248, 113, 113, 0.1)',
            border: 'rgba(248, 113, 113, 0.2)',
            light: '#fca5a5',
            dark: '#ef4444',
          },
          info: {
            DEFAULT: '#60a5fa',
            foreground: '#ffffff',
            background: 'rgba(96, 165, 250, 0.1)',
            border: 'rgba(96, 165, 250, 0.2)',
            light: '#93c5fd',
            dark: '#3b82f6',
          },
        },
        // Glass morphism effects
        glass: {
          border: 'rgba(255, 255, 255, 0.1)',
          background: 'rgba(255, 255, 255, 0.05)',
          backdrop: 'rgba(255, 255, 255, 0.8)',
          shadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          'shadow-lg': '0 16px 64px rgba(0, 0, 0, 0.5)',
          blur: 'blur(20px)',
        }
      },
      fontFamily: {
        // Apple system font stack
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
          'ui-sans-serif'
        ],
        mono: [
          '"SF Mono"',
          '"Monaco"',
          '"Inconsolata"',
          '"Roboto Mono"',
          '"Source Code Pro"',
          'monospace',
          'ui-monospace'
        ]
      },
      fontSize: {
        // Apple-inspired type scale
        xs: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.05em' }],
        sm: ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0.025em' }],
        base: ['1rem', { lineHeight: '1.5rem', letterSpacing: '0' }],
        lg: ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '-0.025em' }],
        xl: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.025em' }],
        '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.05em' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.05em' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.05em' }],
        '5xl': ['3rem', { lineHeight: '1', letterSpacing: '-0.05em' }],
        '6xl': ['3.75rem', { lineHeight: '1', letterSpacing: '-0.05em' }],
        '7xl': ['4.5rem', { lineHeight: '1', letterSpacing: '-0.05em' }],
        '8xl': ['6rem', { lineHeight: '1', letterSpacing: '-0.05em' }],
        '9xl': ['8rem', { lineHeight: '1', letterSpacing: '-0.05em' }],
      },
      fontWeight: {
        thin: '100',
        extralight: '200',
        light: '300',
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        extrabold: '800',
        black: '900',
      },
      borderRadius: {
        // Apple-inspired border radius
        none: '0',
        sm: '0.25rem',
        DEFAULT: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
        full: '9999px',
        // Apple-specific values
        'apple-sm': '0.125rem',    // 2px
        'apple-md': '0.25rem',     // 4px
        'apple-lg': '0.5rem',      // 8px
        'apple-xl': '0.75rem',     // 12px
        'apple-2xl': '1rem',       // 16px
        'apple-3xl': '1.5rem',     // 24px
        'apple-4xl': '2rem',       // 32px
      },
      boxShadow: {
        // Apple-inspired shadows with depth
        sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
        DEFAULT: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
        md: '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)',
        lg: '0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
        xl: '0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04)',
        '2xl': '0 25px 50px rgba(0, 0, 0, 0.25)',
        inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
        // Glass morphism shadows
        glass: '0 8px 32px rgba(0, 0, 0, 0.3)',
        'glass-lg': '0 16px 64px rgba(0, 0, 0, 0.4)',
        // Glowing shadows for buttons and interactive elements
        glow: '0 0 20px rgba(6, 182, 212, 0.3)',
        'glow-lg': '0 0 40px rgba(6, 182, 212, 0.4)',
        'glow-cyan': '0 0 20px rgba(6, 182, 212, 0.6)',
        'glow-blue': '0 0 20px rgba(59, 130, 246, 0.6)',
        'glow-indigo': '0 0 20px rgba(99, 102, 241, 0.6)',
      },
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        DEFAULT: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        '2xl': '40px',
        '3xl': '64px',
      },
      animation: {
        // Smooth Apple-inspired animations
        'fade-in': 'fadeIn 0.2s ease-out',
        'fade-out': 'fadeOut 0.2s ease-in',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-out': 'scaleOut 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'bounce-in': 'bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'gradient-shift': 'gradientShift 8s ease infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        scaleOut: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0.95)', opacity: '0' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.3)', opacity: '0' },
          '50%': { transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(6, 182, 212, 0.5)' },
          '50%': { boxShadow: '0 0 20px rgba(6, 182, 212, 0.8), 0 0 40px rgba(6, 182, 212, 0.4)' },
          '100%': { boxShadow: '0 0 5px rgba(6, 182, 212, 0.5)' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
        '144': '36rem',
      },
      screens: {
        'xs': '475px',
      },
      aspectRatio: {
        '4/3': '4 / 3',
        '3/2': '3 / 2',
        '2/3': '2 / 3',
        '9/16': '9 / 16',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
    // Custom plugin for gradient text
    function({ addUtilities }: any) {
      addUtilities({
        '.gradient-text': {
          background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #6366f1 100%)',
          '-webkit-background-clip': 'text',
          '-webkit-text-fill-color': 'transparent',
          'background-clip': 'text',
          'text-fill-color': 'transparent',
        },
        '.gradient-text-cyan': {
          background: 'linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%)',
          '-webkit-background-clip': 'text',
          '-webkit-text-fill-color': 'transparent',
          'background-clip': 'text',
          'text-fill-color': 'transparent',
        },
        '.gradient-text-blue': {
          background: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
          '-webkit-background-clip': 'text',
          '-webkit-text-fill-color': 'transparent',
          'background-clip': 'text',
          'text-fill-color': 'transparent',
        },
        '.gradient-text-indigo': {
          background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
          '-webkit-background-clip': 'text',
          '-webkit-text-fill-color': 'transparent',
          'background-clip': 'text',
          'text-fill-color': 'transparent',
        },
        '.glass-morphism': {
          background: 'rgba(255, 255, 255, 0.05)',
          'backdrop-filter': 'blur(20px)',
          '-webkit-backdrop-filter': 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        },
        '.glass-morphism-hover': {
          background: 'rgba(255, 255, 255, 0.08)',
          'backdrop-filter': 'blur(20px)',
          '-webkit-backdrop-filter': 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 12px 48px rgba(0, 0, 0, 0.5)',
        },
        '.shimmer': {
          background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 2s linear infinite',
        },
      });
    },
    // Custom plugin for focus states
    function({ addUtilities, addComponents }: any) {
      addComponents({
        '.focus-ring': {
          '@apply outline-none ring-2 ring-brand-cyan-500 ring-offset-2 ring-offset-background': {},
        },
        '.focus-ring-cyan': {
          '@apply outline-none ring-2 ring-brand-cyan-500 ring-offset-2 ring-offset-background': {},
        },
        '.focus-ring-blue': {
          '@apply outline-none ring-2 ring-brand-blue-500 ring-offset-2 ring-offset-background': {},
        },
        '.focus-ring-indigo': {
          '@apply outline-none ring-2 ring-brand-indigo-500 ring-offset-2 ring-offset-background': {},
        },
      });
    },
  ],
}