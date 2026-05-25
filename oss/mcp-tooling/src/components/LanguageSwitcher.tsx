import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { useState, useEffect } from 'react';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const languages = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'he', name: 'Hebrew', nativeName: 'עברית' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  ];

  const currentLanguage = languages.find((lang) => lang.code === i18n.language) || languages[0];

  const changeLanguage = (langCode: string) => {
    i18n.changeLanguage(langCode);
    document.documentElement.lang = langCode;
    document.documentElement.dir = langCode === 'he' || langCode === 'ar' ? 'rtl' : 'ltr';
    setIsOpen(false);
  };

  useEffect(() => {
    const currentLang = i18n.language;
    document.documentElement.dir = currentLang === 'he' || currentLang === 'ar' ? 'rtl' : 'ltr';
  }, [i18n.language]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl glass-dark border border-cyan-500/30 hover:border-cyan-500/60 transition-all duration-300 group"
        aria-label={t('language.select')}
      >
        <Globe className="w-5 h-5 text-cyan-400 group-hover:rotate-12 transition-transform duration-300" />
        <span className="text-white font-medium">{currentLanguage.nativeName}</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full mt-2 right-0 z-50 glass-dark border border-cyan-500/30 rounded-2xl shadow-floating overflow-hidden min-w-[200px] animate-scale-in">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => changeLanguage(lang.code)}
                className={`w-full px-4 py-3 text-left transition-all duration-300 flex items-center justify-between group ${
                  i18n.language === lang.code
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-white hover:bg-white/5'
                }`}
              >
                <span className="font-medium">{lang.nativeName}</span>
                {i18n.language === lang.code && (
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse-glow" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
