/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  theme: {
    extend: {
      // Apple HIG-aligned ink palette; sibling pattern to
      // websites/finsavvyai.com/tailwind.config.mjs.
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
          // Subtle blue for citation pills — high-contrast on ink palette.
          500: '#0a84ff',
          50: '#e8f1ff',
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
      },
      letterSpacing: {
        tightish: '-0.015em',
      },
      // 8pt grid — Tailwind defaults already align; expose semantic tokens.
      spacing: {
        gutter: '1.5rem',
      },
    },
  },
  plugins: [],
};
