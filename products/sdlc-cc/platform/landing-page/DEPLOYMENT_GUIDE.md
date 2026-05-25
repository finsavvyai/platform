# Landing Page Deployment Guide

This guide covers deploying the SDLC.ai landing page to Cloudflare Pages for Week 1 GTM activities.

## Overview

The landing page is a Next.js application optimized for Cloudflare Pages deployment with:
- **Framework**: Next.js 15 with React 18
- **Styling**: Tailwind CSS with custom brand colors
- **Animations**: Framer Motion
- **Forms**: React Hook Form + Zod validation
- **Deployment**: Cloudflare Pages via `@cloudflare/next-on-pages`
- **Domain**: sdlc.cc

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Cloudflare account
- Wrangler CLI installed (`npm install -g wrangler`)
- Domain configured in Cloudflare (sdlc.cc)

## Local Development

```bash
# Navigate to landing page directory
cd landing-page

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000
```

### Available Scripts

```bash
npm run dev              # Start Next.js dev server
npm run build            # Build for production
npm run start            # Start production server locally
npm run lint             # Lint code
npm run test             # Run unit tests
npm run test:integration # Run integration tests
npm run pages:build      # Build for Cloudflare Pages
npm run pages:dev        # Test Cloudflare Pages locally
npm run pages:deploy     # Deploy to Cloudflare Pages
```

## Environment Variables

Create a `.env.local` file:

```env
# API Endpoints
NEXT_PUBLIC_API_URL=https://api.sdlc.cc
NEXT_PUBLIC_DEMO_API=/api/demo-request

# Analytics (Optional)
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxxxxxxxxxx
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# Feature Flags
NEXT_PUBLIC_ENABLE_CHAT_WIDGET=true
NEXT_PUBLIC_ENABLE_PRICING=true

# Email (for demo requests)
DEMO_NOTIFICATION_EMAIL=demos@sdlc.cc
SENDGRID_API_KEY=SG.xxxxxxxxxxxx

# Cloudflare (for Pages Functions)
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token
```

## Cloudflare Pages Deployment

### Method 1: Direct Deploy (Recommended)

```bash
# Build and deploy in one command
npm run pages:deploy

# This will:
# 1. Build Next.js application
# 2. Convert to Cloudflare Pages format
# 3. Deploy to Cloudflare Pages
```

### Method 2: Manual Deploy

```bash
# Step 1: Build the application
npm run build

# Step 2: Convert to Cloudflare Pages
npx @cloudflare/next-on-pages

# Step 3: Deploy
npx wrangler pages deploy .vercel/output/static
```

### Method 3: Git Integration

1. **Connect Repository to Cloudflare Pages**:
   - Go to Cloudflare Dashboard > Pages
   - Click "Create a project"
   - Connect your GitHub repository
   - Select the `main` branch

2. **Configure Build Settings**:
   - **Build command**: `npm run pages:build`
   - **Build output directory**: `.vercel/output/static`
   - **Root directory**: `landing-page`

3. **Add Environment Variables**:
   - Go to Settings > Environment variables
   - Add all required environment variables from `.env.local`

4. **Deploy**:
   - Push to main branch
   - Automatic deployment triggered

## Custom Domain Setup

### Configure DNS

1. **Add Custom Domain in Cloudflare Pages**:
   - Go to your Pages project > Custom domains
   - Add domain: `sdlc.cc`
   - Add domain: `www.sdlc.cc` (optional)

2. **DNS Records** (Auto-configured by Cloudflare):
   ```
   Type: CNAME
   Name: sdlc.cc
   Content: [your-project].pages.dev
   Proxy: Enabled (Orange cloud)
   ```

3. **SSL/TLS**:
   - Automatically provisioned by Cloudflare
   - Full (strict) mode recommended

### Verify Domain

```bash
# Check DNS propagation
dig sdlc.cc

# Check SSL certificate
curl -I https://sdlc.cc
```

## Deployment Checklist

### Pre-Deployment

- [ ] Test locally: `npm run dev`
- [ ] Run tests: `npm run test:all`
- [ ] Lint code: `npm run lint`
- [ ] Build successfully: `npm run pages:build`
- [ ] Test Pages build locally: `npm run pages:dev`
- [ ] Review environment variables
- [ ] Update meta tags (if needed)
- [ ] Verify API endpoints

### Deployment

- [ ] Deploy to Cloudflare Pages: `npm run pages:deploy`
- [ ] Verify deployment URL (*.pages.dev)
- [ ] Configure custom domain (sdlc.cc)
- [ ] Wait for DNS propagation (5-10 minutes)
- [ ] Test custom domain: `https://sdlc.cc`

### Post-Deployment

- [ ] Verify all pages load correctly
- [ ] Test demo form submission
- [ ] Check analytics tracking
- [ ] Verify SEO meta tags (View Source)
- [ ] Test mobile responsiveness
- [ ] Check page load performance (Lighthouse)
- [ ] Verify SSL certificate (https)
- [ ] Test all CTAs (Request Demo buttons)
- [ ] Verify social media previews (LinkedIn, Twitter)

## Monitoring

### Cloudflare Analytics

Access real-time analytics:
- **Dashboard**: Cloudflare Pages > Analytics
- **Metrics**: Page views, unique visitors, bandwidth
- **Performance**: Core Web Vitals, response times

### Page Performance

Test with Lighthouse:
```bash
# Install Lighthouse
npm install -g lighthouse

# Run audit
lighthouse https://sdlc.cc --view
```

Target scores:
- Performance: >90
- Accessibility: 100
- Best Practices: 100
- SEO: 100

## Troubleshooting

### Build Fails

```bash
# Clear Next.js cache
rm -rf .next

# Clear node_modules
rm -rf node_modules package-lock.json
npm install

# Try build again
npm run pages:build
```

### Deployment Fails

```bash
# Check Wrangler authentication
wrangler whoami

# Re-authenticate if needed
wrangler auth login

# Check account ID
wrangler pages project list
```

### Domain Not Working

1. Check DNS records in Cloudflare
2. Verify Pages custom domain configuration
3. Wait for DNS propagation (up to 24 hours)
4. Clear browser cache
5. Try incognito mode

### API Routes Not Working

- Verify Pages Functions are enabled
- Check `functions/` directory structure
- Review Cloudflare Workers logs
- Test API endpoints separately

## Optimization

### Performance

```bash
# Analyze bundle size
npm run build
# Check .next/analyze/ output

# Optimize images
# Use Next.js Image component
# Convert to WebP format
# Use responsive images
```

### SEO

1. **Meta Tags**: Verify all pages have unique titles and descriptions
2. **Structured Data**: Check schema.org markup
3. **Sitemap**: Generate and submit to Google Search Console
4. **Robots.txt**: Ensure proper crawling directives

### Analytics Setup

Add tracking code to `pages/_app.tsx`:

```typescript
// Google Analytics
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function App({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    const handleRouteChange = (url: string) => {
      // Track page view
      window.gtag?.('config', process.env.NEXT_PUBLIC_GA_ID, {
        page_path: url,
      });
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events]);

  return <Component {...pageProps} />;
}
```

## Rollback Procedure

### Rollback to Previous Deployment

1. **Via Cloudflare Dashboard**:
   - Go to Pages > Deployments
   - Find previous successful deployment
   - Click "..." > "Rollback to this deployment"

2. **Via Wrangler CLI**:
   ```bash
   # List deployments
   wrangler pages deployment list

   # Rollback to specific deployment
   wrangler pages deployment rollback <deployment-id>
   ```

## Week 1 GTM Deployment

### Monday (Jan 6)

```bash
# Initial deployment
cd landing-page
npm install
npm run pages:deploy
```

### Tuesday (Jan 7)

- Configure custom domain (sdlc.cc)
- Set up analytics tracking
- Verify all CTAs work
- Test demo form submission

### Wednesday (Jan 8)

- Add chat widget (if ready)
- Optimize for mobile
- Run Lighthouse audit
- Fix any issues

## Support

### Issues

- **Build errors**: Check Node.js version (>=18.0.0)
- **Deployment errors**: Verify Wrangler authentication
- **Domain issues**: Contact Cloudflare support

### Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [@cloudflare/next-on-pages](https://github.com/cloudflare/next-on-pages)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

### Contact

- **Email**: devops@sdlc.cc
- **Slack**: #deployments channel
- **GitHub Issues**: Report deployment issues

## Security

### Environment Variables

- Never commit `.env.local` to Git
- Store secrets in Cloudflare environment variables
- Rotate API keys regularly
- Use separate keys for staging/production

### Content Security Policy

Add to `next.config.js`:

```javascript
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' *.googletagmanager.com; style-src 'self' 'unsafe-inline';"
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  }
];

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};
```

---

**Ready to deploy?** Follow the deployment checklist and launch sdlc.cc! 🚀
