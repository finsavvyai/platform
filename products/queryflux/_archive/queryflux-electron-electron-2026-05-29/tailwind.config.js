/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './src/renderer/**/*.{html,js,ts,jsx,tsx}',
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: '#6366f1',
                accent: '#818cf8',
                background: {
                    primary: '#0f172a',
                    secondary: '#1e293b',
                    tertiary: '#334155',
                },
            },
            fontFamily: {
                sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
                mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
            },
        },
    },
    plugins: [],
}
