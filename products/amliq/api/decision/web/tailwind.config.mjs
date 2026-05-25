/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  theme: {
    extend: {
      // Apple HIG-aligned ink palette + system signal colours.
      // Sibling pattern to products/amliq/brain/web/tailwind.config.mjs.
      colors: {
        ink: {
          50: '#f5f5f7',
          100: '#eaeaee',
          400: '#7d7d86',
          500: '#5a5a63',
          700: '#28282d',
          900: '#0a0a0c',
        },
        accent: {
          50: '#e8f1ff',
          500: '#0a84ff',
        },
        // System signal palette — used by EngineScoreBadge / DecisionPill.
        // Picked from the Apple system colour set for AA contrast on ink.50.
        risk: {
          low: '#30d158',
          medium: '#ff9f0a',
          high: '#ff453a',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'Inter',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          'SF Mono',
          'ui-monospace',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },
      letterSpacing: {
        tightish: '-0.015em',
      },
      // 8pt grid — Tailwind defaults align; expose semantic tokens.
      spacing: {
        gutter: '1.5rem',
      },
    },
  },
  plugins: [],
};
