import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

export function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();

  return (
    <button
      onClick={toggleTheme}
      className="w-10 h-10 rounded-xl glass-dark border border-cyan-500/30 hover:border-cyan-500/60 flex items-center justify-center transition-all duration-300 group relative overflow-hidden"
      aria-label={theme === 'light' ? t('theme.switchToDark') : t('theme.switchToLight')}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {theme === 'light' ? (
        <Moon className="w-5 h-5 text-cyan-400 group-hover:rotate-12 transition-transform duration-300 relative z-10" />
      ) : (
        <Sun className="w-5 h-5 text-yellow-400 group-hover:rotate-180 transition-transform duration-500 relative z-10 animate-pulse-glow" />
      )}
    </button>
  );
}
