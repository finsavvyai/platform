import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { zero, useQuery } from '../lib/zero';
import type { User } from '../lib/zero';
import { ThemeContext } from './theme-context';
import type { Theme } from './theme-context';

export function ThemeProvider({ children }: { children: ReactNode }) {
    // Sync theme from Zero (database), defaulting to dark if loading or undefined
    const [userData] = useQuery(zero.query.user);
    const theme = (userData ? (userData as User).theme : 'dark') as Theme;

    useEffect(() => {
        // Remove all theme classes
        document.documentElement.classList.remove('theme-dark', 'theme-light', 'theme-monochrome', 'theme-pink');

        // Add current theme class
        document.documentElement.classList.add(`theme-${theme}`);
    }, [theme]);

    const setTheme = (newTheme: Theme) => {
        // Optimistic update via Zero
        zero.mutate.user.update({ theme: newTheme });
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}
