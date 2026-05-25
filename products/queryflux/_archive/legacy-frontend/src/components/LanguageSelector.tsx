import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Globe, Check } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

export function LanguageSelector() {
  const { theme } = useTheme();
  const { language, setLanguage, languages, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const currentLang = languages.find(l => l.code === language);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.right - 256 // 256px is the dropdown width (w-64)
      });
    }
  }, [isOpen]);

  const dropdown = isOpen && createPortal(
    <>
      <div
        className="fixed inset-0 z-[9998]"
        onClick={() => setIsOpen(false)}
      />
      <div
        className="fixed w-64 glass-card rounded-xl shadow-2xl z-[9999] overflow-hidden border-4"
        style={{
          backgroundColor: theme.colors.foreground,
          borderColor: theme.colors.accent,
          top: `${dropdownPosition.top}px`,
          left: `${dropdownPosition.left}px`
        }}
      >
            <div className="p-3 border-b" style={{ borderColor: theme.colors.border }}>
              <p className="text-xs font-semibold" style={{ color: theme.colors.textSecondary }}>
                {t('common.selectLanguage') || 'Select Language'}
              </p>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setLanguage(lang.code);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{lang.flag}</span>
                    <div className="text-left">
                      <p className="text-sm font-medium" style={{ color: theme.colors.text }}>
                        {lang.nativeName}
                      </p>
                      <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
                        {lang.name}
                      </p>
                    </div>
                  </div>
                  {language === lang.code && (
                    <Check className="w-4 h-4" style={{ color: theme.colors.accent }} />
                  )}
                </button>
              ))}
            </div>

            <div className="p-3 border-t text-xs" style={{ borderColor: theme.colors.border, color: theme.colors.textSecondary }}>
              12 {t('common.languagesAvailable')}
            </div>
          </div>
        </>,
    document.body
  );

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => {
          console.log('Language selector clicked, isOpen:', isOpen);
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-2 px-3 py-2 rounded-lg glass-card hover-3d transition-all"
        style={{
          backgroundColor: theme.colors.foreground,
          borderColor: theme.colors.border
        }}
        title="Change Language"
      >
        <Globe className="w-4 h-4" style={{ color: theme.colors.accent }} />
        <span className="text-sm font-medium" style={{ color: theme.colors.text }}>
          {currentLang?.flag} {currentLang?.nativeName}
        </span>
      </button>
      {dropdown}
    </>
  );
}
