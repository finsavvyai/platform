/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f5f5f7',
          900: '#0a0a0c',
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
    },
  },
  plugins: [],
};
