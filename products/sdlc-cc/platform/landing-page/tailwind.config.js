/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#7c3aed',
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        secondary: {
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
        },
        accent: {
          DEFAULT: '#06b6d4',
          light: '#22d3ee',
          dark: '#0891b2',
        },
        cta: {
          DEFAULT: '#7c3aed',
          hover: '#6d28d9',
          light: '#ede9fe',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          elevated: 'rgba(255, 255, 255, 0.78)',
          muted: '#F8FAFC',
          dark: '#0a0a0f',
          'dark-surface': '#111118',
          'dark-elevated': '#1a1a24',
        },
        success: { DEFAULT: '#10b981', light: '#d1fae5' },
        danger: { DEFAULT: '#ef4444', light: '#fee2e2' },
        warning: { DEFAULT: '#f59e0b', light: '#fef3c7' },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        code: ['var(--font-code)', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'soft': '0 12px 30px rgba(15, 23, 42, 0.08)',
        'glow': '0 0 20px rgba(124, 58, 237, 0.15)',
        'glow-cta': '0 4px 12px rgba(124, 58, 237, 0.25)',
        'glow-blue': '0 0 20px rgba(59, 130, 246, 0.15)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.4)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #7c3aed, #3b82f6)',
        'gradient-brand-text': 'linear-gradient(to right, #7c3aed, #06b6d4)',
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      animation: {
        'fade-in': 'fadeIn 0.8s ease-in-out',
        'slide-up': 'slideUp 0.6s ease-out',
        'pulse-slow': 'pulse 3s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
