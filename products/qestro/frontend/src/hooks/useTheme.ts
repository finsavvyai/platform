import { useState, useEffect } from 'react';
import type { Theme } from '../styles/themes';
import { themes, applyTheme, loadTheme } from '../styles/themes';

export function useTheme() {
  const [currentTheme, setCurrentTheme] = useState<Theme>(() => loadTheme());

  useEffect(() => {
    // Apply theme on mount
    applyTheme(currentTheme);
  }, [currentTheme]);

  const changeTheme = (themeId: string) => {
    const theme = themes[themeId];
    if (theme) {
      setCurrentTheme(theme);
      applyTheme(theme);
    }
  };

  const availableThemes = Object.values(themes);

  return {
    currentTheme,
    changeTheme,
    availableThemes,
    themes,
  };
}
