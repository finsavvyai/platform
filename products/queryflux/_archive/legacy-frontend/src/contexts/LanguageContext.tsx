import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { translations } from '../translations';

type Language = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ru' | 'zh' | 'ja' | 'ar' | 'he' | 'hi';
type TextDirection = 'ltr' | 'rtl';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  direction: TextDirection;
  languages: LanguageInfo[];
}

interface LanguageInfo {
  code: Language;
  name: string;
  nativeName: string;
  direction: TextDirection;
  flag: string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const languages: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr', flag: '🇬🇧' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', direction: 'ltr', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', direction: 'ltr', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', direction: 'ltr', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', direction: 'ltr', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', direction: 'ltr', flag: '🇵🇹' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', direction: 'ltr', flag: '🇷🇺' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', direction: 'ltr', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', direction: 'ltr', flag: '🇯🇵' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl', flag: '🇸🇦' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', direction: 'rtl', flag: '🇮🇱' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', direction: 'ltr', flag: '🇮🇳' },
];

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [direction, setDirection] = useState<TextDirection>('ltr');

  useEffect(() => {
    loadLanguagePreference();
  }, []);

  useEffect(() => {
    const langInfo = languages.find(l => l.code === language);
    setDirection(langInfo?.direction || 'ltr');
    document.documentElement.dir = langInfo?.direction || 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const loadLanguagePreference = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const browserLang = navigator.language.split('-')[0] as Language;
      if (languages.find(l => l.code === browserLang)) {
        setLanguageState(browserLang);
      }
      return;
    }

    const { data } = await supabase
      .from('user_settings')
      .select('language, text_direction')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data?.language) {
      setLanguageState(data.language as Language);
    }
  };

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const langInfo = languages.find(l => l.code === lang);

    await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        language: lang,
        text_direction: langInfo?.direction || 'ltr',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });
  };

  const t = (key: string): string => {
    const keys = key.split('.');
    let value: any = translations[language];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key;
      }
    }

    return typeof value === 'string' ? value : key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, direction, languages }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
