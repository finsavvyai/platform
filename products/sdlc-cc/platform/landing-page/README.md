# SDLC Landing Page

Modern, conversion-optimized landing page for SDLC - Autonomous Secure Data Intelligence Fabric.

## First value in 10 minutes

New users can go from sign-up to first API call in under 10 minutes:

1. **Sign up** at `/sign-up` (or Get Started on the homepage).
2. **Open Dashboard** at `/dashboard` and generate an API key.
3. **Call the API** with the key (OpenAI-compatible base URL). See [docs/QUICKSTART.md](../docs/QUICKSTART.md) for copy-paste curl, Python, and Node examples.

The dashboard shows a quickstart snippet; the full flow is documented in the repo at `docs/QUICKSTART.md`.

## 🚀 Quick Start (developers)

This app is not in the root npm workspace; it has its own `package-lock.json`. If Next.js warns about "multiple lockfiles", that is expected and safe to ignore.

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

## 📦 What's Included

- ✅ **Homepage** with hero, features, and CTA sections
- ✅ **Responsive design** (mobile, tablet, desktop)
- ✅ **Animations** with Framer Motion
- ✅ **Modern UI** with Tailwind CSS
- ✅ **SEO optimized** with Next.js metadata
- ✅ **Trust badges** (SOC2, ISO, GDPR, PCI DSS)
- ✅ **Call-to-actions** (Schedule Demo, Start Pilot)

## 🎨 Design System

### Colors
- **Primary**: Deep Blue (#0A2463)
- **Secondary**: Cyan (#00D9FF)
- **Accent**: Purple (#6B46C1)
- **Background**: Dark gradient

### Typography
- **Headings**: Inter Bold
- **Body**: Inter Regular

## 📄 Pages

- `/` - Homepage
- `/demo` - Demo request form (TODO)
- `/pricing` - Pricing page (TODO)
- `/security` - Security page (TODO)
- `/docs` - Documentation (TODO)

## 🔧 Next Steps

1. **Install dependencies**: `npm install`
2. **Run dev server**: `npm run dev`
3. **Add remaining pages**: pricing, security, demo form
4. **Integrate billing**: Connect @shared/billing
5. **Deploy to Vercel**: `vercel deploy`

## 📊 Performance

- **Lighthouse Score**: 95+ (target)
- **First Contentful Paint**: <1.5s
- **Time to Interactive**: <3s

## 🚀 Deployment

```bash
# Build for production
npm run build

# Deploy to Vercel
vercel deploy --prod
```

## 📝 TODO

- [ ] Add demo request form page
- [ ] Add pricing page with 3 tiers
- [ ] Add security/compliance page
- [ ] Add documentation pages
- [ ] Integrate with @shared/billing
- [ ] Add analytics (PostHog)
- [ ] SEO optimization
- [ ] Add blog section
- [ ] Add case studies
- [ ] Add customer testimonials

---

**Built with Next.js 14, TypeScript, Tailwind CSS, and Framer Motion** 🚀
