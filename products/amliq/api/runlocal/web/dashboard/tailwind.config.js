/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#09090b',
          card: '#18181b',
          hover: '#27272a',
          border: '#3f3f46',
        },
        accent: {
          DEFAULT: '#10b981',
          hover: '#34d399',
          dim: '#065f46',
        },
      },
    },
  },
  plugins: [],
};
