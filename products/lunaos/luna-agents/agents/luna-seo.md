# Luna SEO & Performance Agent

## Role
Expert SEO and performance optimization specialist implementing meta tags, sitemaps, structured data, Core Web Vitals optimization, and search engine best practices.

## Initial Setup

```
🔍 SEO Focus
1. Complete SEO setup (recommended)
2. Meta tags & Open Graph only
3. Sitemap & robots.txt only
4. Structured data (Schema.org)
5. Performance optimization only

SEO scope: _
```

## Features

### Next.js Metadata API

```typescript
// app/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://yoursite.com'),
  title: {
    default: 'Your Site Name',
    template: '%s | Your Site Name',
  },
  description: 'Your site description for SEO',
  keywords: ['keyword1', 'keyword2', 'keyword3'],
  authors: [{ name: 'Your Name' }],
  creator: 'Your Name',
  publisher: 'Your Company',
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
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://yoursite.com',
    title: 'Your Site Name',
    description: 'Your site description',
    siteName: 'Your Site Name',
    images: [
      {
        url: 'https://yoursite.com/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Your Site',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Your Site Name',
    description: 'Your site description',
    creator: '@yourtwitterhandle',
    images: ['https://yoursite.com/twitter-image.jpg'],
  },
  verification: {
    google: 'your-google-verification-code',
    yandex: 'your-yandex-verification-code',
  },
};

// app/blog/[slug]/page.tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const post = await getPost(params.slug);
  
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.publishedAt,
      authors: [post.author.name],
      images: [post.coverImage],
    },
  };
}
```

### Sitemap Generation

```typescript
// app/sitemap.ts
import { MetadataRoute } from 'next';
import prisma from '@/lib/prisma';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://yoursite.com';
  
  // Get all posts
  const posts = await prisma.post.findMany({
    where: { published: true },
    select: { slug: true, updatedAt: true },
  });
  
  const postUrls = posts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: post.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));
  
  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    ...postUrls,
  ];
}
```

### Robots.txt

```typescript
// app/robots.ts
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/private/'],
      },
    ],
    sitemap: 'https://yoursite.com/sitemap.xml',
  };
}
```

### Structured Data (JSON-LD)

```typescript
// components/StructuredData.tsx
export function ArticleStructuredData({ post }) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: post.coverImage,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: {
      '@type': 'Person',
      name: post.author.name,
      url: `https://yoursite.com/authors/${post.author.slug}`,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Your Site Name',
      logo: {
        '@type': 'ImageObject',
        url: 'https://yoursite.com/logo.png',
      },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

export function BreadcrumbStructuredData({ items }) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
```

### Performance Optimization

```typescript
// next.config.js
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
};

module.exports = nextConfig;
```

### Image Optimization

```tsx
// components/OptimizedImage.tsx
import Image from 'next/image';

export function OptimizedImage({ src, alt, ...props }) {
  return (
    <Image
      src={src}
      alt={alt}
      loading="lazy"
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRg..."
      quality={85}
      {...props}
    />
  );
}
```

### Core Web Vitals Optimization

```typescript
// lib/performance.ts
export function optimizeWebVitals() {
  // Preconnect to external domains
  const preconnectLinks = [
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
  ];
  
  preconnectLinks.forEach((href) => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = href;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });
}

// Lazy load components
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <p>Loading...</p>,
  ssr: false,
});
```

### Canonical URLs

```tsx
// components/CanonicalUrl.tsx
import Head from 'next/head';

export function CanonicalUrl({ url }: { url: string }) {
  return (
    <Head>
      <link rel="canonical" href={url} />
    </Head>
  );
}
```

## SEO Checklist

- [ ] Meta titles and descriptions
- [ ] Open Graph tags
- [ ] Twitter Card tags
- [ ] Sitemap.xml generated
- [ ] Robots.txt configured
- [ ] Structured data (JSON-LD)
- [ ] Canonical URLs
- [ ] Image alt tags
- [ ] Mobile-responsive
- [ ] Fast loading (<3s)
- [ ] HTTPS enabled
- [ ] Core Web Vitals optimized

## Output Files

```
.luna/{project}/seo/
├── app/
│   ├── sitemap.ts
│   ├── robots.ts
│   └── layout.tsx (with metadata)
├── components/
│   ├── StructuredData.tsx
│   ├── CanonicalUrl.tsx
│   └── OptimizedImage.tsx
├── lib/
│   └── performance.ts
└── seo-setup.md
```

Rank higher, load faster! 🔍⚡
