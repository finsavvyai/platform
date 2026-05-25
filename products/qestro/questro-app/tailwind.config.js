/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'system': ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        'mono': ['SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Consolas', 'Droid Sans Mono', 'Courier New', 'monospace'],
      },
      colors: {
        'apple-blue': '#007AFF',
        'apple-blue-dark': '#0056D6',
        'apple-purple': '#5856D6',
        'apple-green': '#32D74B',
        'apple-orange': '#FF9F0A',
        'apple-red': '#FF3B30',
        'apple-gray': {
          50: '#F2F2F7',
          100: '#E5E5EA',
          200: '#D1D1D6',
          300: '#C7C7CC',
          400: '#AEAEB2',
          500: '#8E8E93',
          600: '#636366',
          700: '#48484A',
          800: '#3A3A3C',
          900: '#2C2C2E',
          950: '#1C1C1E',
        }
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '20px',
      },
      boxShadow: {
        'apple-1': '0 1px 3px rgba(0, 0, 0, 0.1)',
        'apple-2': '0 4px 6px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.1)',
        'apple-3': '0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
        'apple-4': '0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04)',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s cubic-bezier(0, 0, 0.2, 1)',
        'slide-up': 'slideUp 0.4s cubic-bezier(0, 0, 0.2, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
  darkMode: 'media', // Enables automatic dark mode based on system preference
}