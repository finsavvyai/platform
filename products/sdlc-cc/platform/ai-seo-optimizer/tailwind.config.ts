import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6D28D9',
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
          700: '#6D28D9',
          800: '#5B21B6',
          900: '#4C1D95',
        },
        accent: {
          DEFAULT: '#06B6D4',
          50: '#ECFEFF',
          100: '#CFFAFE',
          200: '#A5F3FC',
          300: '#67E8F9',
          400: '#22D3EE',
          500: '#06B6D4',
          600: '#0891B2',
          700: '#0E7490',
          800: '#155E75',
          900: '#164E63',
        },
        cta: {
          DEFAULT: '#059669',
          hover: '#047857',
          light: '#D1FAE5',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          elevated: 'rgba(255, 255, 255, 0.78)',
          muted: '#F8FAFC',
          dark: '#0B0F1A',
        },
        score: {
          high: '#10B981',
          medium: '#F59E0B',
          low: '#EF4444',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        code: ['var(--font-code)', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'soft': '0 12px 30px rgba(15, 23, 42, 0.08)',
        'glow': '0 10px 22px rgba(109, 40, 217, 0.15)',
        'glow-cta': '0 4px 12px rgba(5, 150, 105, 0.25)',
        'glow-accent': '0 8px 20px rgba(6, 182, 212, 0.2)',
        'card': '0 1px 3px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.06)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #6D28D9, #06B6D4)',
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-mesh': 'radial-gradient(at 27% 37%, #6D28D9 0, transparent 50%), radial-gradient(at 97% 21%, #06B6D4 0, transparent 50%), radial-gradient(at 52% 99%, #8B5CF6 0, transparent 50%), radial-gradient(at 10% 29%, #22D3EE 0, transparent 50%)',
      },
      animation: {
        'score-fill': 'scoreFill 1.5s ease-out forwards',
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        scoreFill: {
          '0%': { strokeDashoffset: '283' },
          '100%': { strokeDashoffset: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
