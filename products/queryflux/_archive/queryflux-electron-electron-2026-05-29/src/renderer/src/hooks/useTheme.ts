import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'system';

export function useTheme() {
    const [theme, setTheme] = useState<Theme>('dark');

    useEffect(() => {
        // Load theme from settings
        async function loadTheme() {
            if (window.api?.settings) {
                const savedTheme = await window.api.settings.get<Theme>('settings.theme');
                if (savedTheme) {
                    setTheme(savedTheme);
                }
            }
        }
        loadTheme();
    }, []);

    useEffect(() => {
        // Apply theme to document
        const root = document.documentElement;

        if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.classList.toggle('light', !prefersDark);
            root.classList.toggle('dark', prefersDark);
        } else {
            root.classList.toggle('light', theme === 'light');
            root.classList.toggle('dark', theme === 'dark');
        }
    }, [theme]);

    const updateTheme = async (newTheme: Theme) => {
        setTheme(newTheme);
        if (window.api?.settings) {
            await window.api.settings.set('settings.theme', newTheme);
        }
    };

    return { theme, setTheme: updateTheme };
}
