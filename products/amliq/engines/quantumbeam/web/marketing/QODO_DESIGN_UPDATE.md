# QuantumBeam Marketing Website - Qodo Design Update

## ✨ Overview

The marketing website has been completely redesigned with a modern, Qodo.ai-inspired aesthetic featuring:

- **Dark Mode First**: Deep purple/black theme with gradient accents
- **Smooth Animations**: Framer Motion for fluid transitions
- **Modern Typography**: Large, bold headings with gradient text
- **Glassmorphism**: Frosted glass effects with backdrop blur
- **Quantum Visualizations**: Animated particles and orbital elements
- **Clean Navigation**: Minimalist top bar with smooth hover effects

## 🎨 Design Features

### Color Palette
- Background: `#0A0A0F` (Deep black-purple)
- Primary: Purple `#A855F7` to Pink `#EC4899` gradients
- Accent: Blue `#3B82F6` for highlights
- Text: White with varying opacity levels

### Key Components

#### 1. Navigation Bar
- Fixed position with blur backdrop
- Smooth scroll behavior
- Hover animations on links
- Gradient CTA buttons with glow effects

#### 2. Hero Section
- Large, bold typography (5xl to 8xl)
- Gradient text effects
- Floating code preview with syntax highlighting
- Animated statistics cards
- Particle background animation

#### 3. Features Grid
- 6-column responsive grid
- Gradient icon containers
- Hover lift animations
- Arrow indicators on hover

#### 4. Technology Section
- Side-by-side layout
- Animated quantum circuit visualization
- Orbiting particles
- Feature checklist with icons

#### 5. Social Proof
- Minimalist company logos
- Subtle opacity for brand names

#### 6. CTA Section
- Centered call-to-action
- Gradient background with blur
- Large buttons with hover effects

#### 7. Footer
- 5-column grid layout
- Social media links
- Comprehensive site map

## 🚀 Running the Website

### Development Mode

```bash
cd web/marketing
npm install
npm run dev
```

Visit: http://localhost:3000

### Build for Production

```bash
npm run build
npm start
```

### Export Static Site

```bash
npm run export
```

## 📁 File Structure

```
web/marketing/
├── app/
│   ├── page.tsx              # New Qodo-style homepage
│   ├── page-backup.tsx       # Original design backup
│   ├── page-qodo-style.tsx   # Source for new design
│   ├── globals.css           # Updated with Qodo theme
│   └── layout.tsx            # Root layout
├── components/               # Reusable React components
└── public/                   # Static assets
```

## 🎯 Key Animations

### Framer Motion Variants

```typescript
// Fade in with upward motion
const fadeInUp = {
  initial: { opacity: 0, y: 60 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.6, -0.05, 0.01, 0.99] }
}

// Stagger children animations
const staggerChildren = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
}
```

### Hover Effects
- **Scale Transform**: Buttons scale to 1.05 on hover
- **Glow Effects**: Purple/pink shadow appears on hover
- **Translate**: Cards lift -8px on hover
- **Arrow Animations**: Right arrows translate 4px on hover

## 🎨 Styling Guidelines

### Gradient Classes

```css
/* Purple to Pink */
bg-gradient-to-r from-purple-600 to-pink-600

/* Purple to Blue */
bg-gradient-to-r from-purple-500 to-blue-500

/* Text Gradient */
bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent
```

### Glass Effect

```css
bg-white/5 backdrop-blur-sm border border-white/10
```

### Glow Effect

```css
hover:shadow-2xl hover:shadow-purple-500/50
```

## 📱 Responsive Design

### Breakpoints
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

### Mobile Optimizations
- Collapsible navigation menu
- Stacked button layouts
- Smaller typography scales
- Adjusted padding/margins

## 🔧 Customization

### Change Primary Color

Edit `globals.css`:
```css
:root {
  --primary: 270 70% 60%; /* Change hue value */
}
```

### Modify Animations

Update motion variants in `page.tsx`:
```typescript
const fadeInUp = {
  initial: { opacity: 0, y: 60 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8 } // Adjust duration
}
```

### Update Content

All content is in `app/page.tsx`:
- Hero headline: Line 118-122
- Features: Line 183-220
- Stats: Line 142-159

## 🌐 Deployment

### Vercel
```bash
vercel
```

### Cloudflare Pages
```bash
npm run build
npx wrangler pages deploy out
```

### Netlify
```bash
npm run build
netlify deploy --prod --dir=out
```

## ✅ Checklist

- [x] Dark mode design implemented
- [x] Qodo-inspired animations
- [x] Responsive mobile layout
- [x] Gradient effects throughout
- [x] Glassmorphism styling
- [x] Quantum visualizations
- [x] Smooth scroll behavior
- [x] Hover state animations
- [x] Production-ready build
- [x] SEO optimized

## 🎬 Demo Sections

### Available Pages
- `/` - Homepage (Qodo-style)
- `/api-docs` - API Documentation
- `/get-started` - Getting Started Guide
- `/dashboard` - User Dashboard
- `/login` - Login Page

### Coming Soon
- `/pricing` - Pricing page
- `/about` - About page
- `/blog` - Blog listing
- `/contact` - Contact form

## 💡 Tips

1. **Performance**: Images use Next.js Image component for optimization
2. **SEO**: Meta tags configured in `layout.tsx`
3. **Analytics**: Add tracking in `layout.tsx`
4. **A/B Testing**: Use feature flags for experiments
5. **Accessibility**: ARIA labels on interactive elements

## 📊 Performance Metrics

Target metrics:
- **Lighthouse Score**: 95+
- **First Contentful Paint**: < 1.5s
- **Time to Interactive**: < 3.5s
- **Largest Contentful Paint**: < 2.5s

## 🔗 Resources

- [Framer Motion Docs](https://www.framer.com/motion/)
- [Tailwind CSS](https://tailwindcss.com)
- [Next.js](https://nextjs.org)
- [Qodo.ai Design](https://www.qodo.ai)

## 📝 Notes

- Original design backed up as `page-backup.tsx`
- All animations respect `prefers-reduced-motion`
- Color contrast meets WCAG AA standards
- Mobile-first responsive design approach

---

**Updated**: 2025-01-07
**Design Version**: 2.0.0 (Qodo-inspired)
**Status**: ✅ Production Ready
