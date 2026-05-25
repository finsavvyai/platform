import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './locales/en'
import he from './locales/he'
import ar from './locales/ar'

export const defaultNS = 'common'
export const RTL_LANGUAGES = ['he', 'ar']

export const resources = { en, he, ar } as const

export function isRTL(lang: string): boolean {
  return RTL_LANGUAGES.includes(lang)
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    defaultNS,
    fallbackLng: 'en',
    supportedLngs: ['en', 'he', 'ar'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'amliq_lang',
    },
  })

export default i18n
