import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0A2463',
          50: '#E6EBF5',
          100: '#CCD7EB',
          200: '#99AFD7',
          300: '#6687C3',
          400: '#335FAF',
          500: '#0A2463',
          600: '#081D4F',
          700: '#06163B',
          800: '#040F27',
          900: '#020813',
        },
        secondary: {
          DEFAULT: '#00D9FF',
          50: '#E6F9FF',
          100: '#CCF3FF',
          200: '#99E7FF',
          300: '#66DBFF',
          400: '#33CFFF',
          500: '#00D9FF',
          600: '#00AECC',
          700: '#008299',
          800: '#005766',
          900: '#002B33',
        },
        accent: {
          DEFAULT: '#6B46C1',
          50: '#F3EFFC',
          100: '#E7DFF9',
          200: '#CFBFF3',
          300: '#B79FED',
          400: '#9F7FE7',
          500: '#6B46C1',
          600: '#56389A',
          700: '#412A73',
          800: '#2C1C4D',
          900: '#160E26',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};

export default config;
