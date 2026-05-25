import { useMemo } from 'react'
import { getCurrentDomain, getDomainConfig, createFrontendConfig, DomainConfig } from '@mcpoverflow/frontend-config'

export function useCurrentDomain(): string {
  return useMemo(() => getCurrentDomain(), [])
}

export function useDomainConfig(domain?: string): DomainConfig {
  return useMemo(() => getDomainConfig(domain), [domain])
}

export function useFrontendConfig() {
  return useMemo(() => createFrontendConfig(), [])
}

export function useAPIConfig() {
  const config = useFrontendConfig()
  return config.apiUrls
}

export function useIsDomainSupported(domain: string): boolean {
  return useMemo(() => {
    const supportedDomains = ['marketing', 'developer', 'ai', 'docs']
    return supportedDomains.includes(domain)
  }, [domain])
}

export function useDomainFeatures() {
  const domainConfig = useDomainConfig()
  return domainConfig.features
}

export function useDomainTheme() {
  const domainConfig = useDomainConfig()
  return domainConfig.theme
}

export function useDomainBrand() {
  const domainConfig = useDomainConfig()
  return {
    name: domainConfig.name,
    url: domainConfig.url,
    title: domainConfig.title,
    description: domainConfig.description,
    brandColor: domainConfig.brandColor,
    logo: domainConfig.logo,
    favicon: domainConfig.favicon,
    ogImage: domainConfig.ogImage,
  }
}