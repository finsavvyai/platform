/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#10b981',
          light: '#34d399',
          dark: '#059669',
        },
        root: '#0d0d0d',
        surface: '#141414',
        raised: '#1a1a1a',
        't1': '#f0f0f0',
        't2': '#a0a0a0',
        't3': '#666666',
        'border-base': '#2a2a2a',
        'border-em': '#333333',
      },
      fontSize: {
        'page': ['22px', { lineHeight: '1.3', fontWeight: '600' }],
        'section': ['18px', { lineHeight: '1.4', fontWeight: '600' }],
        'body': ['13.5px', { lineHeight: '1.6', fontWeight: '400' }],
        'caption': ['11px', { lineHeight: '1.5', fontWeight: '400' }],
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.3, 0.7, 1)',
      },
      keyframes: {
        'subtle-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'subtle-in': 'subtle-in 0.5s cubic-bezier(0.34, 1.3, 0.7, 1) both',
      },
    },
  },
  plugins: [],
}
