import type { Config } from 'tailwindcss';

const config: Config = {
    darkMode: 'class',
    content: [
        './app/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './lib/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                // Primary - Deep Space Violet
                primary: {
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
                    950: '#2e1065',
                },
                // Accent - Indigo (matches marketing site)
                accent: {
                    50: '#eef2ff',
                    100: '#e0e7ff',
                    200: '#c7d2fe',
                    300: '#a5b4fc',
                    400: '#818cf8',
                    500: '#6366f1',
                    600: '#4f46e5',
                    700: '#4338ca',
                    800: '#3730a3',
                    900: '#312e81',
                },
                // Neutral - Zinc
                neutral: {
                    50: '#fafafa',
                    100: '#f4f4f5',
                    200: '#e4e4e7',
                    300: '#d4d4d8',
                    400: '#a1a1aa',
                    500: '#71717a',
                    600: '#52525b',
                    700: '#3f3f46',
                    800: '#27272a',
                    900: '#18181b',
                    950: '#0a0a0f',
                },
            },
            fontFamily: {
                sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
            },
            fontSize: {
                '2xs': ['0.625rem', { lineHeight: '0.75rem' }],
            },
            spacing: {
                '18': '4.5rem',
                '88': '22rem',
                '112': '28rem',
                '128': '32rem',
            },
            borderRadius: {
                '4xl': '2rem',
            },
            boxShadow: {
                glow: '0 0 60px -15px rgba(99, 102, 241, 0.3)',
                'glow-sm': '0 0 30px -10px rgba(99, 102, 241, 0.25)',
                'glow-lg': '0 0 100px -20px rgba(99, 102, 241, 0.4)',
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
                'gradient-primary': 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
            },
            animation: {
                'fade-in': 'fadeIn 0.6s ease-out forwards',
                'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
                'fade-in-down': 'fadeInDown 0.6s ease-out forwards',
                'scale-in': 'scaleIn 0.5s ease-out forwards',
                'slide-in-right': 'slideInRight 0.6s ease-out forwards',
                'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
                'float': 'float 20s ease-in-out infinite',
                'shimmer': 'shimmer 2s linear infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                fadeInUp: {
                    '0%': { opacity: '0', transform: 'translateY(30px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                fadeInDown: {
                    '0%': { opacity: '0', transform: 'translateY(-30px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                scaleIn: {
                    '0%': { opacity: '0', transform: 'scale(0.9)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
                slideInRight: {
                    '0%': { opacity: '0', transform: 'translateX(30px)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' },
                },
                pulseGlow: {
                    '0%, 100%': { boxShadow: '0 0 20px rgba(139, 92, 246, 0.3)' },
                    '50%': { boxShadow: '0 0 40px rgba(139, 92, 246, 0.5)' },
                },
                float: {
                    '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
                    '25%': { transform: 'translate(30px, -30px) scale(1.05)' },
                    '50%': { transform: 'translate(-20px, 20px) scale(0.95)' },
                    '75%': { transform: 'translate(20px, 30px) scale(1.02)' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
            },
            transitionDuration: {
                '400': '400ms',
            },
            typography: {
                DEFAULT: {
                    css: {
                        maxWidth: 'none',
                        color: 'inherit',
                        a: {
                            color: '#8b5cf6',
                            textDecoration: 'none',
                            '&:hover': {
                                color: '#a78bfa',
                            },
                        },
                        code: {
                            color: '#8b5cf6',
                            backgroundColor: 'rgba(139, 92, 246, 0.1)',
                            padding: '0.25rem 0.375rem',
                            borderRadius: '0.25rem',
                            fontWeight: '400',
                        },
                        'code::before': {
                            content: '""',
                        },
                        'code::after': {
                            content: '""',
                        },
                    },
                },
            },
        },
    },
    plugins: [
        require('@tailwindcss/typography'),
        require('@tailwindcss/forms'),
    ],
};

export default config;
