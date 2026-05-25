/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep Space Backgrounds
        bg: {
          primary: 'var(--bg-primary)', // #030712
          secondary: 'var(--bg-secondary)', // rgba(11, 17, 33, 0.6)
          tertiary: 'var(--bg-tertiary)', // For hover states
          glass: 'var(--bg-glass)', // rgba(11, 17, 33, 0.4)
        },
        // Neon Accents
        primary: {
          DEFAULT: '#00F0FF', // Cyber Cyan - Keeping hardcoded for now or move to var if needed
          glow: 'rgba(0, 240, 255, 0.5)',
          dim: 'rgba(0, 240, 255, 0.1)',
        },
        secondary: {
          DEFAULT: '#7000FF', // Electric Purple
          glow: 'rgba(112, 0, 255, 0.5)',
        },
        // Semantic — wired to CSS variables so theme switches propagate
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          inverse: 'var(--text-inverse)',
        },
        border: {
          DEFAULT: 'var(--border-color)',
          light: 'var(--border-light)',
          focus: 'var(--border-focus)',
          glow: 'rgba(0, 240, 255, 0.3)',
        },
        // Brand tokens for accent usage
        brand: {
          primary: 'var(--brand-primary)',
          accent: 'var(--brand-accent)',
        },
        // Status tokens
        status: {
          success: 'var(--status-success)',
          error: 'var(--status-error)',
          warning: 'var(--status-warning)',
          info: 'var(--status-info)',
          pending: 'var(--status-pending)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'], // For that "Advanced Tool" feel
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-glow': 'conic-gradient(from 180deg at 50% 50%, #00F0FF33 0deg, #7000FF33 180deg, #FF009933 360deg)',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'neon': '0 0 10px rgba(0, 240, 255, 0.5), 0 0 20px rgba(0, 240, 255, 0.3)',
        'neon-purple': '0 0 10px rgba(112, 0, 255, 0.5), 0 0 20px rgba(112, 0, 255, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0, 240, 255, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 240, 255, 0.6), 0 0 10px rgba(0, 240, 255, 0.4)' },
        }
      }
    },
  },
  plugins: [],
}
