'use client'

import { NextSeo, NextSeoProps } from 'next-seo'
import { useEffect } from 'react'

export function SEO() {
  useEffect(() => {
    // Add structured data for better SEO
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'QueryFlux',
      description: 'AI-powered database management platform with real-time collaboration',
      url: 'https://queryflux.com',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: ['Windows', 'macOS', 'Linux'],
      offers: [
        {
          '@type': 'Offer',
          name: 'Free Plan',
          price: '0',
          priceCurrency: 'USD'
        },
        {
          '@type': 'Offer',
          name: 'Pro Plan',
          price: '29',
          priceCurrency: 'USD',
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: '29',
            priceCurrency: 'USD',
            billingDuration: 'P1M'
          }
        }
      ],
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.8',
        ratingCount: '1250'
      }
    }

    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.innerHTML = JSON.stringify(structuredData)
    document.head.appendChild(script)

    return () => {
      document.head.removeChild(script)
    }
  }, [])

  return (
    <NextSeo
      additionalLinkTags={[
        {
          rel: 'icon',
          href: '/favicon.ico'
        },
        {
          rel: 'apple-touch-icon',
          href: '/apple-touch-icon.png',
          sizes: '180x180'
        },
        {
          rel: 'manifest',
          href: '/site.webmanifest'
        }
      ]}
      additionalMetaTags={[
        {
          name: 'theme-color',
          content: '#000000'
        },
        {
          name: 'msapplication-TileColor',
          content: '#000000'
        }
      ]}
    />
  )
}