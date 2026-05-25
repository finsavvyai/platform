import { useEffect, useState, useMemo } from 'react'
import { useTheme as useNextTheme } from 'next-themes'
import { useDomainConfig, useDomainBrand } from './use-domain'

export function useTheme() {
  const { theme: nextTheme, setTheme: setNextTheme, resolvedTheme } = useNextTheme()
  const domainConfig = useDomainConfig()
  const [customTheme, setCustomTheme] = useState<string | null>(null)

  // Apply domain-specific theme overrides
  const effectiveTheme = useMemo(() => {
    if (customTheme) return customTheme
    if (domainConfig.theme && !nextTheme) return domainConfig.theme
    return nextTheme
  }, [nextTheme, domainConfig.theme, customTheme])

  const setTheme = useCallback((theme: string) => {
    if (domainConfig.theme === theme) {
      setCustomTheme(theme)
    } else {
      setNextTheme(theme)
      setCustomTheme(null)
    }
  }, [domainConfig.theme, setNextTheme])

  const themeColors = useMemo(() => {
    const colors = {
      marketing: {
        primary: '#3b82f6',
        secondary: '#1e40af',
        accent: '#60a5fa',
        background: '#ffffff',
        surface: '#f8fafc',
        text: '#1e293b',
        textSecondary: '#64748b',
      },
      developer: {
        primary: '#10b981',
        secondary: '#047857',
        accent: '#34d399',
        background: '#ffffff',
        surface: '#f0fdf4',
        text: '#064e3b',
        textSecondary: '#047857',
      },
      ai: {
        primary: '#8b5cf6',
        secondary: '#6d28d9',
        accent: '#a78bfa',
        background: '#ffffff',
        surface: '#faf5ff',
        text: '#581c87',
        textSecondary: '#6d28d9',
      },
      docs: {
        primary: '#f59e0b',
        secondary: '#d97706',
        accent: '#fbbf24',
        background: '#ffffff',
        surface: '#fffbeb',
        text: '#92400e',
        textSecondary: '#d97706',
      },
    }

    return colors[domainConfig.theme as keyof typeof colors] || colors.marketing
  }, [domainConfig.theme])

  const isDark = resolvedTheme === 'dark'

  return {
    theme: effectiveTheme,
    resolvedTheme,
    setTheme,
    isDark,
    colors: themeColors,
    brandColor: domainConfig.brandColor,
    themeConfig: {
      ...themeColors,
      ...(isDark && {
        background: '#0f172a',
        surface: '#1e293b',
        text: '#f1f5f9',
        textSecondary: '#cbd5e1',
      }),
    },
  }
}

export function useSEO(pathname: string = '') {
  const domainConfig = useDomainConfig()
  const brand = useDomainBrand()

  const seoData = useMemo(() => {
    return {
      title: brand.title,
      description: brand.description,
      keywords: domainConfig.seo.keywords.join(', '),
      canonical: `${brand.url}${pathname}`,
      openGraph: {
        type: 'website',
        locale: 'en_US',
        url: `${brand.url}${pathname}`,
        title: brand.title,
        description: brand.description,
        siteName: 'MCPOverflow',
        images: [
          {
            url: brand.ogImage,
            width: 1200,
            height: 630,
            alt: brand.title,
          },
        ],
      },
      twitter: {
        card: domainConfig.seo.twitterCard as 'summary' | 'summary_large_image',
        site: domainConfig.seo.twitterSite,
        title: brand.title,
        description: brand.description,
        images: [brand.ogImage],
      },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          'max-video-preview': -1,
          'max-image-preview': 'large',
          'max-snippet': -1,
        },
      },
      structuredData: domainConfig.seo.structuredData ? {
        '@context': 'https://schema.org',
        '@type': domainConfig.theme === 'developer' ? 'SoftwareApplication' : 'Organization',
        name: brand.name,
        url: brand.url,
        description: brand.description,
        logo: brand.logo,
        sameAs: [
          'https://twitter.com/mcpoverflow',
          'https://github.com/mcpoverflow',
        ],
        ...(domainConfig.theme === 'developer' && {
          applicationCategory: 'DeveloperApplication',
          operatingSystem: 'Web Browser',
        }),
      } : undefined,
    }
  }, [domainConfig, brand, pathname])

  return seoData
}

export function useAnalytics() {
  const domainConfig = useDomainConfig()
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    if (domainConfig.features.analytics && domainConfig.analyticsId && !isInitialized) {
      // Initialize analytics
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('config', domainConfig.analyticsId, {
          page_title: document.title,
          page_location: window.location.href,
        })
        setIsInitialized(true)
      }
    }
  }, [domainConfig, isInitialized])

  const trackEvent = useCallback((eventName: string, parameters?: Record<string, any>) => {
    if (domainConfig.features.analytics && typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', eventName, {
        ...parameters,
        domain_name: domainConfig.name,
        domain_theme: domainConfig.theme,
      })
    }
  }, [domainConfig])

  const trackPageView = useCallback((path?: string) => {
    if (domainConfig.features.analytics && typeof window !== 'undefined' && window.gtag) {
      window.gtag('config', domainConfig.analyticsId, {
        page_title: document.title,
        page_location: path || window.location.href,
      })
    }
  }, [domainConfig])

  const trackCustomEvent = useCallback((category: string, action: string, label?: string, value?: number) => {
    if (domainConfig.features.analytics && typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', action, {
        event_category: category,
        event_label: label,
        value: value,
        domain_name: domainConfig.name,
        domain_theme: domainConfig.theme,
      })
    }
  }, [domainConfig])

  return {
    isInitialized,
    trackEvent,
    trackPageView,
    trackCustomEvent,
    isEnabled: domainConfig.features.analytics,
  }
}

export function useNavigation() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentPath, setCurrentPath] = useState('/')

  const openNavigation = useCallback(() => {
    setIsOpen(true)
  }, [])

  const closeNavigation = useCallback(() => {
    setIsOpen(false)
  }, [])

  const toggleNavigation = useCallback(() => {
    setIsOpen(prev => !prev)
  }, [])

  useEffect(() => {
    const handleRouteChange = () => {
      setCurrentPath(window.location.pathname)
      closeNavigation()
    }

    if (typeof window !== 'undefined') {
      setCurrentPath(window.location.pathname)
      window.addEventListener('popstate', handleRouteChange)
      return () => {
        window.removeEventListener('popstate', handleRouteChange)
      }
    }
  }, [closeNavigation])

  return {
    isOpen,
    openNavigation,
    closeNavigation,
    toggleNavigation,
    currentPath,
  }
}