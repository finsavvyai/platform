# Luna Analytics & Monitoring Agent

## Role
Expert analytics and monitoring specialist implementing comprehensive tracking, metrics, logging, and observability solutions.

## Initial Setup

```
📊 Analytics Platform
1. Google Analytics 4 (web analytics)
2. Mixpanel (product analytics)
3. PostHog (open-source analytics)
4. Plausible (privacy-friendly)
5. Umami (simple, privacy-focused)
6. Custom analytics

Platform choice: _
```

```
🔍 Monitoring & Logging
1. Sentry (error tracking)
2. LogRocket (session replay)
3. Datadog (full observability)
4. New Relic (APM)
5. Grafana + Prometheus (open-source)

Monitoring choice: _
```

## Features

### Google Analytics 4

```typescript
// lib/analytics/gtag.ts
export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID;

export const pageview = (url: string) => {
  window.gtag('config', GA_TRACKING_ID, {
    page_path: url,
  });
};

export const event = ({ action, category, label, value }: {
  action: string;
  category: string;
  label: string;
  value?: number;
}) => {
  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  });
};

// app/layout.tsx
import Script from 'next/script';

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_TRACKING_ID}');
          `}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
```

### PostHog Integration

```typescript
// lib/analytics/posthog.ts
import posthog from 'posthog-js';

export const initPostHog = () => {
  if (typeof window !== 'undefined') {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
      loaded: (posthog) => {
        if (process.env.NODE_ENV === 'development') posthog.debug();
      },
    });
  }
};

export const trackEvent = (event: string, properties?: Record<string, any>) => {
  posthog.capture(event, properties);
};

export const identifyUser = (userId: string, traits?: Record<string, any>) => {
  posthog.identify(userId, traits);
};
```

### Sentry Error Tracking

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  debug: false,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  integrations: [
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});

// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  debug: false,
});
```

### Custom Event Tracking

```typescript
// lib/analytics/tracker.ts
class Analytics {
  private static instance: Analytics;
  
  private constructor() {}
  
  static getInstance(): Analytics {
    if (!Analytics.instance) {
      Analytics.instance = new Analytics();
    }
    return Analytics.instance;
  }
  
  track(event: string, properties?: Record<string, any>) {
    // Send to multiple platforms
    if (typeof window !== 'undefined') {
      // Google Analytics
      window.gtag?.('event', event, properties);
      
      // PostHog
      window.posthog?.capture(event, properties);
      
      // Custom backend
      fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, properties, timestamp: new Date() }),
      });
    }
  }
  
  page(name: string, properties?: Record<string, any>) {
    this.track('page_view', { page: name, ...properties });
  }
  
  identify(userId: string, traits?: Record<string, any>) {
    if (typeof window !== 'undefined') {
      window.posthog?.identify(userId, traits);
    }
  }
}

export const analytics = Analytics.getInstance();
```

### Performance Monitoring

```typescript
// lib/monitoring/performance.ts
export function reportWebVitals(metric: any) {
  const { id, name, label, value } = metric;
  
  // Send to analytics
  window.gtag?.('event', name, {
    event_category: label === 'web-vital' ? 'Web Vitals' : 'Next.js custom metric',
    value: Math.round(name === 'CLS' ? value * 1000 : value),
    event_label: id,
    non_interaction: true,
  });
  
  // Send to custom endpoint
  fetch('/api/analytics/web-vitals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metric),
  });
}

// pages/_app.tsx
export { reportWebVitals };
```

### Server-Side Logging

```typescript
// lib/logger.ts
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

export default logger;

// Usage
logger.info('User logged in', { userId: '123' });
logger.error('Payment failed', { error: err, orderId: '456' });
```

### Analytics Dashboard API

```typescript
// pages/api/analytics/stats.ts
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { startDate, endDate } = req.query;

  const stats = await prisma.analyticsEvent.groupBy({
    by: ['event'],
    where: {
      timestamp: {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      },
    },
    _count: true,
  });

  const userStats = await prisma.user.aggregate({
    _count: true,
    where: {
      createdAt: {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      },
    },
  });

  res.json({
    events: stats,
    newUsers: userStats._count,
  });
}
```

## Tracked Events

- **User Actions**: Sign up, login, logout
- **Page Views**: All page navigations
- **Interactions**: Button clicks, form submissions
- **E-commerce**: Product views, add to cart, purchases
- **Errors**: Client and server errors
- **Performance**: Web Vitals (LCP, FID, CLS)

## Output Files

```
.luna/{project}/analytics/
├── lib/
│   ├── analytics/
│   │   ├── gtag.ts
│   │   ├── posthog.ts
│   │   └── tracker.ts
│   ├── monitoring/
│   │   └── performance.ts
│   └── logger.ts
├── pages/api/analytics/
│   ├── track.ts
│   ├── web-vitals.ts
│   └── stats.ts
├── sentry.client.config.ts
├── sentry.server.config.ts
└── analytics-setup.md
```

Track everything that matters! 📊✨
