import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { isRTL } from '../i18n/config'

const FONT_MAP: Record<string, string> = {
  he: "'Rubik', sans-serif",
  ar: "'Cairo', sans-serif",
}

const DEFAULT_FONT =
  "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"

export function useDirection() {
  const { i18n } = useTranslation()
  const lang = i18n.language
  const dir = isRTL(lang) ? 'rtl' : 'ltr'

  useEffect(() => {
    const el = document.documentElement
    el.dir = dir
    el.lang = lang
    el.style.fontFamily = FONT_MAP[lang] ?? DEFAULT_FONT
  }, [dir, lang])

  return dir
}
