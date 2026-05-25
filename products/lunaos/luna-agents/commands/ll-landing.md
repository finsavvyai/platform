---
name: ll-landing
displayName: Luna Landing Page
description: Generate a HeyGen-quality marketing landing page for any product — rotating 3D hero, social proof counters, logo carousel, feature tabs, testimonials, FAQ, mega footer
version: 1.0.0
category: creative
agent: luna-task-executor
parameters:
  - name: product
    type: string
    description: Product name
    required: true
    prompt: true
  - name: description
    type: string
    description: One-line product description
    required: true
    prompt: true
  - name: style
    type: string
    description: "Style: heygen (dark hero + white body), dark (full dark), light (full light), minimal"
    required: false
    default: heygen
  - name: accent
    type: string
    description: "Brand accent color hex (e.g., #00C8FF)"
    required: false
    default: "#7c5cfc"
prerequisites: []
---

# Luna Landing Page — HeyGen-Quality Marketing Pages

Generate a professional SaaS marketing landing page matching the quality of HeyGen, Linear, Vercel — with rotating 3D hero, animated counters, logo carousel, tabbed features, testimonials, and mega footer.

## What This Command Does

1. **Analyzes** your product (reads codebase, README, or URL)
2. **Generates** a complete Next.js + Tailwind CSS landing page with 18 sections
3. **Creates** a rotating 3D hero (CSS cube or video embed)
4. **Writes** conversion-optimized copy using Claw Gateway AI
5. **Outputs** production-ready code, deployable to Cloudflare Pages

## Page Sections (in order)

### 1. Sticky Nav Bar
Logo left, nav links center, Sign In + CTA right. Clean, minimal height.

### 2. Hero Section (split layout)
- **Left**: Large bold headline in accent gradient, 2-3 sentence sub, Google SSO button + primary CTA
- **Right**: Rotating 3D diamond/cube `<video>` element (or CSS `preserve-3d` fallback)
- White/dark background, generous padding, vertically centered

### 3. Social Proof Counter Bar
Dark rounded card with 3 animated count-up numbers on scroll (e.g., "10M+ users", "50K+ projects"). Uses `IntersectionObserver` for trigger.

### 4. Logo Carousel (Trust Bar)
"Trusted by" label + infinite auto-scrolling grayscale logos. CSS `translateX` animation, pause on hover. Duplicated for seamless loop.

### 5. Product Feature Cards
Large heading + horizontal scroll or grid of cards with thumbnail, tag, title, description. Hover lift effect.

### 6. Tabbed Feature Showcase
Row of tab buttons with icons. Click swaps: icon, title, heading, description, CTA. `fadeSlideIn` animation.

### 7. Comparison Section
Side-by-side "Us vs Them" with visual proof. Sub-features with heading + description + link.

### 8. Demo/Video Section
Heading + description + embedded video player. Language/variant switch buttons. Feature highlights below.

### 9. Studio/Tool Section
Banner heading + CTA. Accordion or tabs showing key features.

### 10. Customer Testimonial
Blockquote + name + title + company. Large stat callout. Photo.

### 11. Second Logo Carousel

### 12. Vision/Mission Section
Short mission statement + "Learn more" CTA + decorative backgrounds.

### 13. Use Case Cards Grid
4 cards: different audiences/industries. Each with heading, icon, image, description.

### 14. API/Integration Banner
Floating tech icons + heading + "Explore" CTA.

### 15. Compliance Badges
Row of certification logos (SOC 2, GDPR, etc.) with labels.

### 16. FAQ Accordion
15+ collapsible Q&A items. Generated from product context.

### 17. Final CTA Section
"Start [action] today" heading + CTA button + gradient backgrounds.

### 18. Mega Footer
Multi-column: logo, language selector, Products, Resources, Company, Legal. Social icons. Copyright.

## CSS Rotating Diamond Hero

```css
.cube-scene { perspective: 800px; }
.cube {
  transform-style: preserve-3d;
  animation: rotateCube 8s ease-in-out infinite;
  transform: rotateX(-20deg) rotateZ(45deg);
}
.cube__face {
  border-radius: 16px;
  backface-visibility: hidden;
  box-shadow: 0 0 20px rgba(0,255,200,0.2);
  border: 1.5px solid rgba(0,255,200,0.25);
}
@keyframes rotateCube {
  0%   { transform: rotateX(-20deg) rotateZ(45deg) rotateY(0deg); }
  25%  { transform: rotateX(-20deg) rotateZ(45deg) rotateY(90deg); }
  50%  { transform: rotateX(-20deg) rotateZ(45deg) rotateY(180deg); }
  75%  { transform: rotateX(-20deg) rotateZ(45deg) rotateY(270deg); }
  100% { transform: rotateX(-20deg) rotateZ(45deg) rotateY(360deg); }
}
```

## Key Design Patterns

1. **Color**: White/light body, dark accents, single strong accent color for headings + CTAs
2. **Typography**: Large bold display font for hero, clean sans-serif for body, big numbers for proof
3. **Animations**: Count-up on scroll, infinite logo carousel, tab fade-slide, SVG stroke draw
4. **Hero video**: Pre-rendered 3D loop as `<video autoplay muted loop playsinline>` (best quality)
5. **Layout**: Two-column hero flexbox, alternating full-width and contained sections

## Usage

```bash
# Generate for your product
/landing "LunaOS" "AI-Native Backend Platform for Developers"

# With custom style
/landing "CodeRailFlow" "Browser automation platform" --style dark --accent "#3b82f6"

# Minimal landing page
/landing "MyApp" "Project management for teams" --style minimal
```

## Output

```
.luna/{project}/landing/
  index.html          # Complete landing page
  styles.css          # Tailwind + custom CSS
  components/         # React components (if Next.js)
  assets/
    hero-cube.mp4     # 3D hero video (or CSS fallback)
    logos/             # Trust logos (placeholder)
  copy.json           # All generated copy
  deploy.sh           # Cloudflare Pages deploy script
```

## In Pipes

```bash
# Generate landing + deploy
/pipe landing "MyApp" "description" >> ship

# Generate landing + record demo + produce video
/pipe landing "MyApp" "desc" >> flow-record http://localhost:3000 >> heygen http://localhost:3000

# Full launch: landing + audit + fix + deploy
/pipe landing "MyApp" "desc" >> site-audit http://localhost:3000 >> fix >> ship
```
