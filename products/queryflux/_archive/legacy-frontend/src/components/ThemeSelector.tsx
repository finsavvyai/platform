import { Palette, Check } from 'lucide-react';
import { useTheme, ThemeName } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

interface ThemeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ThemeSelector({ isOpen, onClose }: ThemeSelectorProps) {
  const { theme, themeName, setTheme, availableThemes } = useTheme();
  const { t } = useLanguage();

  if (!isOpen) return null;

  const handleThemeSelect = (name: ThemeName) => {
    setTheme(name);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 backdrop-blur-sm" style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }} onClick={onClose} />
      <div className="fixed right-4 top-20 z-50 w-80 glass-card rounded-2xl shadow-2xl border overflow-hidden" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.foreground }}>
        <div className="p-4 border-b" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.sidebar }}>
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5" style={{ color: theme.colors.accent }} />
            <h3 className="font-semibold" style={{ color: theme.colors.text }}>{t('nav.chooseTheme')}</h3>
          </div>
          <p className="text-xs mt-1" style={{ color: theme.colors.textSecondary }}>{t('nav.selectPreferredTheme')}</p>
        </div>

        <div className="p-3 max-h-96 overflow-y-auto" style={{ backgroundColor: theme.colors.background }}>
          <div className="space-y-2">
            {availableThemes.map((t) => (
              <button
                key={t.name}
                onClick={() => handleThemeSelect(t.name)}
                className="w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all hover-3d"
                style={{
                  borderColor: themeName === t.name ? theme.colors.accent : theme.colors.border,
                  backgroundColor: themeName === t.name ? theme.colors.accent + '20' : 'transparent',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-lg border shadow-sm"
                    style={{
                      background: `linear-gradient(135deg, ${t.colors.sidebar} 0%, ${t.colors.background} 50%, ${t.colors.foreground} 100%)`,
                      borderColor: theme.colors.border,
                    }}
                  />
                  <div className="text-left">
                    <p className="font-medium" style={{ color: theme.colors.text }}>{t.displayName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: t.colors.accent }}
                      />
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: t.colors.text }}
                      />
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: t.colors.sidebar }}
                      />
                    </div>
                  </div>
                </div>
                {themeName === t.name && (
                  <Check className="w-5 h-5" style={{ color: theme.colors.accent }} />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 border-t" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.sidebar }}>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-white rounded-lg transition-all font-medium text-sm hover-3d"
            style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
